package org.apache.datawise.backend.controller.table;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.datagen.DatagenPreviewRequest;
import org.apache.datawise.backend.datagen.DatagenPreviewResult;
import org.apache.datawise.backend.datagen.DatagenService;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.security.HeadlessSqlAuth;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/datagen")
public class DatagenController {

    private final DatagenService datagenService;
    private final SqlService sqlService;

    public DatagenController(DatagenService datagenService, SqlService sqlService) {
        this.datagenService = datagenService;
        this.sqlService = sqlService;
    }

    @PostMapping("/table/preview")
    public ApiResponse<DatagenPreviewResult> preview(@RequestBody DatagenPreviewRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        return ApiResponse.ok(datagenService.preview(request));
    }

    @PostMapping("/table/execute")
    public ApiResponse<ExecuteSqlResult> execute(@RequestBody DatagenPreviewRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        DatagenPreviewResult preview = datagenService.preview(request);
        String sql = preview.insertSql();
        ExecuteSqlRequest executeRequest = new ExecuteSqlRequest(
                sql,
                preview.connectionId(),
                preview.database(),
                null,
                null,
                null,
                null,
                "datagen"
        );
        return ApiResponse.ok(sqlService.execute(executeRequest));
    }
}

