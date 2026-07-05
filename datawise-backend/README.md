# DataWise Backend

Spring Boot 多模块 API。说明见 [docs/README.md](../docs/README.md)。

## 启动

```bash
cd datawise-backend
mvn spring-boot:run -pl datawise-server -am
```

- 地址：`http://localhost:18421`（与 `datawise-frontend/runtime-ports.json` 中 `backend` 一致）
- 健康检查：`GET /api/health`
- 配置目录：仓库根 `config/`

## 测试

```bash
mvn test
mvn test -pl datawise-database -am
```

## 模块

`common` · `connectors` · `config` · `database` · `workspace` · `ai` · `server`

数据源插件构建后复制到 `config/plugins/`。
