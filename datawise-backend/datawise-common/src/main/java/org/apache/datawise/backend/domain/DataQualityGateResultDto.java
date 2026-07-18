package org.apache.datawise.backend.domain;

import java.util.List;

public record DataQualityGateResultDto(
        boolean passed,
        int total,
        int failed,
        List<DataQualityRuleRunDto> results
) {
}
