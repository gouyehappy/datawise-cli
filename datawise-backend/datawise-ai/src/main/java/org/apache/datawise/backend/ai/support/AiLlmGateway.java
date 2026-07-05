package org.apache.datawise.backend.ai.support;

import org.apache.datawise.backend.ai.domain.AiLlmProfileDto;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class AiLlmGateway {

    private static final Logger log = LoggerFactory.getLogger(AiLlmGateway.class);
    private static final Pattern CODE_FENCE = Pattern.compile("^```[\\w-]*\\n?|\\n?```$");

    private final AiLlmCallPolicy callPolicy;

    public AiLlmGateway(AiLlmCallPolicy callPolicy) {
        this.callPolicy = callPolicy;
    }

    public String complete(AiLlmProfileDto profile, String systemPrompt, String userPrompt) {
        return complete(profile, systemPrompt, userPrompt, "llm");
    }

    public String complete(AiLlmProfileDto profile, String systemPrompt, String userPrompt, String phase) {
        if (isMock(profile)) {
            AiCallLogger.logRoute(log, phase + "-mock", "mock provider");
            return mockComplete(userPrompt);
        }
        validateOpenAiProfile(profile);

        long started = System.currentTimeMillis();
        AiCallLogger.logLlmStart(
                log,
                phase,
                profile,
                systemPrompt != null ? systemPrompt.length() : 0,
                userPrompt != null ? userPrompt.length() : 0
        );
        try {
            String reply = callPolicy.execute(phase, () -> callOpenAi(profile, systemPrompt, userPrompt));
            AiCallLogger.logLlmSuccess(log, phase, System.currentTimeMillis() - started, reply.length());
            return reply;
        } catch (NonTransientAiException ex) {
            AiCallLogger.logLlmFailure(log, phase, System.currentTimeMillis() - started, ex);
            throw new IllegalArgumentException(AiOpenAiErrorMapper.toChatMessage(profile, ex.getMessage()), ex);
        } catch (RuntimeException ex) {
            AiCallLogger.logLlmFailure(log, phase, System.currentTimeMillis() - started, ex);
            throw ex;
        }
    }

    private String callOpenAi(AiLlmProfileDto profile, String systemPrompt, String userPrompt) {
        String baseUrl = AiLlmUrlNormalizer.normalizeBaseUrl(profile.baseUrl());
        int timeoutSeconds = callPolicy.timeoutSeconds();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(timeoutSeconds));
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));

        OpenAiApi openAiApi = OpenAiApi.builder()
                .baseUrl(baseUrl)
                .apiKey(profile.apiKey())
                .completionsPath(profile.resolvedCompletionsPath())
                .restClientBuilder(RestClient.builder().requestFactory(requestFactory))
                .build();

        OpenAiChatOptions options = OpenAiChatOptions.builder()
                .model(profile.model())
                .temperature(profile.temperature() != null ? profile.temperature() : 0.7)
                .maxTokens(profile.maxTokens() != null ? profile.maxTokens() : 4096)
                .build();

        ChatModel chatModel = OpenAiChatModel.builder()
                .openAiApi(openAiApi)
                .defaultOptions(options)
                .build();

        ChatResponse response = chatModel.call(new Prompt(
                List.of(new SystemMessage(systemPrompt), new UserMessage(userPrompt))
        ));
        String text = response.getResult().getOutput().getText();
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("LLM returned empty reply");
        }
        return stripCodeFence(text.trim());
    }

    public String mockComplete(String userPrompt) {
        if (userPrompt != null && userPrompt.toLowerCase(Locale.ROOT).contains("ok")) {
            return "OK";
        }
        return "OK";
    }

    public boolean isMock(AiLlmProfileDto profile) {
        return profile != null
                && profile.provider() != null
                && "mock".equalsIgnoreCase(profile.provider());
    }

    private void validateOpenAiProfile(AiLlmProfileDto profile) {
        if (profile.apiKey() == null || profile.apiKey().isBlank()) {
            throw new IllegalArgumentException("API Key is required");
        }
        if (profile.baseUrl() == null || profile.baseUrl().isBlank()) {
            throw new IllegalArgumentException("Base URL is required");
        }
        if (profile.model() == null || profile.model().isBlank()) {
            throw new IllegalArgumentException("Model is required");
        }
    }

    public static String stripCodeFence(String text) {
        return CODE_FENCE.matcher(text).replaceAll("").trim();
    }
}
