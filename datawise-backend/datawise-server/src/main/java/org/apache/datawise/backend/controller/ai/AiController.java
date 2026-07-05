package org.apache.datawise.backend.controller.ai;

import org.apache.datawise.backend.ai.analysis.stream.AiAnalysisStreamEmitter;
import org.apache.datawise.backend.ai.chat.AiDataAgentService;
import org.apache.datawise.backend.ai.chat.AiService;
import org.apache.datawise.backend.ai.support.AiCallLogger;
import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.ai.domain.AiAnalysisResumeRequest;
import org.apache.datawise.backend.ai.domain.AiAnalysisRunOutcome;
import org.apache.datawise.backend.ai.domain.AiChatReply;
import org.apache.datawise.backend.ai.domain.AiChatRequest;
import org.apache.datawise.backend.ai.domain.AiSqlGenerateReply;
import org.apache.datawise.backend.ai.domain.AiSqlGenerateRequest;
import org.apache.datawise.backend.ai.domain.AiTestConnectionRequest;
import org.apache.datawise.backend.ai.domain.AiTestEmbeddingRequest;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.security.UserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final AiService aiService;
    private final AiDataAgentService aiDataAgentService;

    public AiController(AiService aiService, AiDataAgentService aiDataAgentService) {
        this.aiService = aiService;
        this.aiDataAgentService = aiDataAgentService;
    }

    @PostMapping("/chat")
    public ApiResponse<AiChatReply> chat(@RequestBody AiChatRequest request) {
        int targetCount = request.targets() != null ? request.targets().size() : 0;
        AiCallLogger.logChatEntry(log, request.prompt(), targetCount, request.llm());
        long started = System.currentTimeMillis();
        try {
            AiChatReply reply = aiService.chat(request);
            AiCallLogger.logChatSuccess(log, reply, System.currentTimeMillis() - started);
            return ApiResponse.ok(reply);
        } catch (RuntimeException ex) {
            AiCallLogger.logChatFailure(log, System.currentTimeMillis() - started, ex);
            throw ex;
        }
    }

    @PostMapping(value = "/analyze/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter analyzeStream(@RequestBody AiChatRequest request) {
        int targetCount = request.targets() != null ? request.targets().size() : 0;
        AiCallLogger.logChatEntry(log, request.prompt(), targetCount, request.llm());
        log.info("AI analyze/stream started targets={}", targetCount);

        SseEmitter emitter = AiAnalysisStreamEmitter.createEmitter();
        UserContext.Snapshot userSnapshot = UserContext.snapshotOrNull();
        CompletableFuture.runAsync(() -> UserContext.runAs(userSnapshot, () -> streamAnalysis(request, emitter)));
        return emitter;
    }

    @PostMapping(value = "/analyze/resume", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter analyzeResume(@RequestBody AiAnalysisResumeRequest request) {
        log.info("AI analyze/resume threadId={} approved={}", request.threadId(), request.approved());
        SseEmitter emitter = AiAnalysisStreamEmitter.createEmitter();
        UserContext.Snapshot userSnapshot = UserContext.snapshotOrNull();
        CompletableFuture.runAsync(() -> UserContext.runAs(userSnapshot, () -> streamResume(request, emitter)));
        return emitter;
    }

    private void streamAnalysis(AiChatRequest request, SseEmitter emitter) {
        long started = System.currentTimeMillis();
        try {
            AiAnalysisRunOutcome outcome = aiDataAgentService.analyzeStream(
                    request,
                    step -> AiAnalysisStreamEmitter.sendStep(emitter, step)
            );
            if (outcome.awaitingConfirmation()) {
                AiAnalysisStreamEmitter.sendInterrupt(emitter, outcome.interrupt());
                AiAnalysisStreamEmitter.completeSuccess(emitter);
                return;
            }
            AiAnalysisStreamEmitter.sendResult(emitter, outcome.reply());
            AiCallLogger.logChatSuccess(log, outcome.reply(), System.currentTimeMillis() - started);
            AiAnalysisStreamEmitter.completeSuccess(emitter);
        } catch (RuntimeException ex) {
            AiCallLogger.logChatFailure(log, System.currentTimeMillis() - started, ex);
            AiAnalysisStreamEmitter.completeFailure(emitter, ex, log);
        }
    }

    private void streamResume(AiAnalysisResumeRequest request, SseEmitter emitter) {
        long started = System.currentTimeMillis();
        try {
            AiAnalysisRunOutcome outcome = aiDataAgentService.resumeStream(
                    request,
                    step -> AiAnalysisStreamEmitter.sendStep(emitter, step)
            );
            AiAnalysisStreamEmitter.sendResult(emitter, outcome.reply());
            AiCallLogger.logChatSuccess(log, outcome.reply(), System.currentTimeMillis() - started);
            AiAnalysisStreamEmitter.completeSuccess(emitter);
        } catch (RuntimeException ex) {
            AiCallLogger.logChatFailure(log, System.currentTimeMillis() - started, ex);
            AiAnalysisStreamEmitter.completeFailure(emitter, ex, log);
        }
    }

    @PostMapping("/sql/generate")
    public ApiResponse<AiSqlGenerateReply> generateSql(@RequestBody AiSqlGenerateRequest request) {
        AiCallLogger.logSqlGenerateEntry(
                log,
                request.prompt(),
                request.connectionId(),
                request.database(),
                request.llm()
        );
        long started = System.currentTimeMillis();
        try {
            AiSqlGenerateReply reply = aiService.generateSql(request);
            AiCallLogger.logSqlGenerateSuccess(log, reply.sql(), System.currentTimeMillis() - started);
            return ApiResponse.ok(reply);
        } catch (RuntimeException ex) {
            AiCallLogger.logChatFailure(log, System.currentTimeMillis() - started, ex);
            throw ex;
        }
    }

    @PostMapping("/test-connection")
    public ApiResponse<ConnectionTestResult> testConnection(@RequestBody AiTestConnectionRequest request) {
        log.info("AI test-connection provider={}", request.llm() != null ? request.llm().provider() : "mock");
        return ApiResponse.ok(aiService.testConnection(request.llm()));
    }

    @PostMapping("/test-embedding")
    public ApiResponse<ConnectionTestResult> testEmbedding(@RequestBody AiTestEmbeddingRequest request) {
        log.info(
                "AI test-embedding provider={}",
                request.embedding() != null ? request.embedding().provider() : "hash"
        );
        return ApiResponse.ok(aiService.testEmbedding(request.embedding()));
    }
}
