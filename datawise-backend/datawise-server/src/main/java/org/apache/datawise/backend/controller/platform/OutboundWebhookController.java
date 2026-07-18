package org.apache.datawise.backend.controller.platform;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.OutboundWebhookDto;
import org.apache.datawise.backend.domain.OutboundWebhookTestResultDto;
import org.apache.datawise.backend.domain.SaveOutboundWebhookRequest;
import org.apache.datawise.backend.service.outbound.OutboundWebhookService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform/outbound-webhooks")
public class OutboundWebhookController {

    private final OutboundWebhookService outboundWebhookService;

    public OutboundWebhookController(OutboundWebhookService outboundWebhookService) {
        this.outboundWebhookService = outboundWebhookService;
    }

    @GetMapping
    public ApiResponse<List<OutboundWebhookDto>> list() {
        return ApiResponse.ok(outboundWebhookService.list());
    }

    @PutMapping
    public ApiResponse<OutboundWebhookDto> save(@RequestBody SaveOutboundWebhookRequest request) {
        return ApiResponse.ok(outboundWebhookService.save(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        outboundWebhookService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/test")
    public ApiResponse<OutboundWebhookTestResultDto> test(@PathVariable String id) {
        return ApiResponse.ok(outboundWebhookService.test(id));
    }
}
