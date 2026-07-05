package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.springframework.stereotype.Component;

@Component
public class QueryLimitResolver {

    private final DatawiseQueryProperties properties;

    public QueryLimitResolver(DatawiseQueryProperties properties) {
        this.properties = properties;
    }

    /**
     * 合并客户端请求与服务端配置。返回值 0 表示不限制。
     */
    public int resolve(Integer clientMaxRows) {
        int serverDefault = properties.getMaxResultRows();
        int client = clientMaxRows != null ? Math.max(0, clientMaxRows) : 0;

        if (serverDefault <= 0 && client <= 0) {
            return 0;
        }
        if (serverDefault <= 0) {
            return client;
        }
        if (client <= 0) {
            return serverDefault;
        }
        return Math.min(client, serverDefault);
    }
}
