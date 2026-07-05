package org.apache.datawise.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "datawise.query")
public class DatawiseQueryProperties {

    /**
     * 服务端默认最大返回行数；0 表示不限制
     */
    private int maxResultRows = 0;

    public int getMaxResultRows() {
        return maxResultRows;
    }

    public void setMaxResultRows(int maxResultRows) {
        this.maxResultRows = Math.max(0, maxResultRows);
    }
}
