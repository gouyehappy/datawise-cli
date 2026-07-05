# 可选数据源 Connector 插件

将构建好的 connector JAR 复制到此目录，重启后端即可启用对应数据源类型。

## 示例

```text
config/plugins/
├── datawise-connector-mysql-0.1.0-SNAPSHOT.jar
├── datawise-connector-postgresql-0.1.0-SNAPSHOT.jar
├── datawise-connector-starrocks-0.1.0-SNAPSHOT.jar
├── datawise-connector-doris-0.1.0-SNAPSHOT.jar
└── datawise-connector-redis-0.1.0-SNAPSHOT-plugin.jar   # Redis 需带 -plugin 分类器（含 lettuce）
```

JDBC 类数据源还需在 `config/drivers/` 放置对应 JDBC 驱动 JAR。

## 构建插件

```bash
cd datawise-backend
# 单模块（package 后自动复制到 config/plugins/）
mvn package -pl datawise-connectors/datawise-connector-mysql -am

# 全部 connector 插件
mvn package -pl datawise-connectors/datawise-connector-mysql,datawise-connectors/datawise-connector-postgresql,datawise-connectors/datawise-connector-doris,datawise-connectors/datawise-connector-starrocks,datawise-connectors/datawise-connector-redis -am
```

构建成功时控制台会输出 `Installed connector plugin: ...`。无需再手工复制 JAR。

产物路径：`datawise-connectors/<module>/target/datawise-connector-*-0.1.0-SNAPSHOT.jar`（Redis 为 `*-plugin.jar`）。

详见 [docs/README.md](../../docs/README.md#connectors)。
