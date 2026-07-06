package org.apache.datawise.backend.controller.platform;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.database.federated.FederatedQueryService;
import org.apache.datawise.backend.domain.ExecuteFederatedViewRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.domain.FederatedViewDetailDto;
import org.apache.datawise.backend.domain.FederatedViewSummaryDto;
import org.apache.datawise.backend.domain.SaveFederatedViewRequest;
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
@RequestMapping("/api/platform/federated-views")
public class FederatedQueryController {

    private final FederatedQueryService federatedQueryService;

    public FederatedQueryController(FederatedQueryService federatedQueryService) {
        this.federatedQueryService = federatedQueryService;
    }

    @GetMapping
    public ApiResponse<List<FederatedViewSummaryDto>> list() {
        return ApiResponse.ok(federatedQueryService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<FederatedViewDetailDto> get(@PathVariable String id) {
        return ApiResponse.ok(federatedQueryService.get(id));
    }

    @PutMapping
    public ApiResponse<FederatedViewDetailDto> save(@RequestBody SaveFederatedViewRequest request) {
        return ApiResponse.ok(federatedQueryService.save(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        federatedQueryService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/execute")
    public ApiResponse<ExecuteSqlResult> execute(@RequestBody ExecuteFederatedViewRequest request) {
        return ApiResponse.ok(federatedQueryService.execute(request));
    }
}
