# P2: converge org.apache.datawise.backend.support across JARs
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Move-SupportDir {
    param(
        [string]$ModulePath,
        [string]$FromSuffix,
        [string]$ToSuffix,
        [string]$NewPackage
    )
    $fromMain = Join-Path $ModulePath "src/main/java/org/apache/datawise/backend/$FromSuffix"
    $toMain = Join-Path $ModulePath "src/main/java/org/apache/datawise/backend/$ToSuffix"
    if (Test-Path $fromMain) {
        New-Item -ItemType Directory -Force -Path (Split-Path $toMain) | Out-Null
        if (Test-Path $toMain) { Remove-Item -Recurse -Force $toMain }
        Move-Item $fromMain $toMain
        Get-ChildItem -Path $toMain -Filter *.java -Recurse | ForEach-Object {
            $c = Get-Content $_.FullName -Raw -Encoding UTF8
            $c = $c -replace 'package org\.apache\.datawise\.backend\.support;', "package $NewPackage;"
            Write-Utf8NoBom -Path $_.FullName -Content $c
        }
    }
    $fromTest = Join-Path $ModulePath "src/test/java/org/apache/datawise/backend/$FromSuffix"
    $toTest = Join-Path $ModulePath "src/test/java/org/apache/datawise/backend/$ToSuffix"
    if (Test-Path $fromTest) {
        New-Item -ItemType Directory -Force -Path (Split-Path $toTest) | Out-Null
        if (Test-Path $toTest) { Remove-Item -Recurse -Force $toTest }
        Move-Item $fromTest $toTest
        Get-ChildItem -Path $toTest -Filter *.java -Recurse | ForEach-Object {
            $c = Get-Content $_.FullName -Raw -Encoding UTF8
            $c = $c -replace 'package org\.apache\.datawise\.backend\.support;', "package $NewPackage;"
            Write-Utf8NoBom -Path $_.FullName -Content $c
        }
    }
}

$dirs = @(
    @{ Mod = "datawise-common"; From = "support"; To = "common/support"; Pkg = "org.apache.datawise.backend.common.support" },
    @{ Mod = "datawise-server"; From = "support"; To = "server/web"; Pkg = "org.apache.datawise.backend.server.web" },
    @{ Mod = "datawise-connectors/datawise-connector-api"; From = "support"; To = "connector/api/support"; Pkg = "org.apache.datawise.backend.connector.api.support" },
    @{ Mod = "datawise-connectors/datawise-connector-jdbc-runtime"; From = "support"; To = "jdbc/support"; Pkg = "org.apache.datawise.backend.jdbc.support" },
    @{ Mod = "datawise-connectors/datawise-connector-mongodb"; From = "support"; To = "connector/mongodb/support"; Pkg = "org.apache.datawise.backend.connector.mongodb.support" },
    @{ Mod = "datawise-connectors/datawise-connector-redis"; From = "support"; To = "connector/redis/support"; Pkg = "org.apache.datawise.backend.connector.mongodb.support".Replace("mongodb", "redis") },
    @{ Mod = "datawise-connectors/datawise-connector-kafka"; From = "support"; To = "connector/kafka/support"; Pkg = "org.apache.datawise.backend.connector.kafka.support" }
)

foreach ($d in $dirs) {
    $modPath = Join-Path $root $d.Mod
    Write-Host "Moving $($d.Mod): $($d.From) -> $($d.To)"
    Move-SupportDir -ModulePath $modPath -FromSuffix $d.From -ToSuffix $d.To -NewPackage $d.Pkg
}

# Fix AI tests that used wrong package (classes live under ai.support)
$aiTestFixes = @(
    "AiDataAgentSupportTest.java",
    "AiLlmUrlNormalizerTest.java",
    "AiTableMatcherTest.java"
)
$aiTestDir = Join-Path $root "datawise-ai/src/test/java/org/apache/datawise/backend/support"
if (Test-Path $aiTestDir) {
    $aiTarget = Join-Path $root "datawise-ai/src/test/java/org/apache/datawise/backend/ai/support"
    New-Item -ItemType Directory -Force -Path $aiTarget | Out-Null
    foreach ($f in $aiTestFixes) {
        $src = Join-Path $aiTestDir $f
        if (Test-Path $src) {
            $c = Get-Content $src -Raw -Encoding UTF8
            $c = $c -replace 'package org\.apache\.datawise\.backend\.support;', 'package org.apache.datawise.backend.ai.support;'
            Write-Utf8NoBom -Path (Join-Path $aiTarget $f) -Content $c
            Remove-Item $src
        }
    }
    if ((Get-ChildItem $aiTestDir -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
        Remove-Item $aiTestDir -Force -ErrorAction SilentlyContinue
    }
}

$classToPackage = @{
    ApiRequestLogger = "org.apache.datawise.backend.common.support"
    ConfigDirectoryLocator = "org.apache.datawise.backend.common.support"
    ConnectionAccessLevel = "org.apache.datawise.backend.common.support"
    ConnectionTargetSupport = "org.apache.datawise.backend.common.support"
    ConnectionsXmlCodec = "org.apache.datawise.backend.common.support"
    DatawiseMetricsCatalog = "org.apache.datawise.backend.common.support"
    ExceptionLogging = "org.apache.datawise.backend.common.support"
    IdGenerator = "org.apache.datawise.backend.common.support"
    PathSegmentSanitizer = "org.apache.datawise.backend.common.support"
    TeamRoleSupport = "org.apache.datawise.backend.common.support"
    ThrowableSupport = "org.apache.datawise.backend.common.support"
    XmlConfigSupport = "org.apache.datawise.backend.common.support"
    SessionAuthFilter = "org.apache.datawise.backend.server.web"
    RequestLoggingFilter = "org.apache.datawise.backend.server.web"
    ClassLoaderDriverDataSource = "org.apache.datawise.backend.jdbc.support"
    DbTypeFamilies = "org.apache.datawise.backend.jdbc.support"
    DbTypeJdbcDriverDefaultsProvider = "org.apache.datawise.backend.jdbc.support"
    HikariJdbcPoolTuning = "org.apache.datawise.backend.jdbc.support"
    JdbcCellValues = "org.apache.datawise.backend.jdbc.support"
    JdbcConnectionCallback = "org.apache.datawise.backend.jdbc.support"
    JdbcConnectionPoolManager = "org.apache.datawise.backend.jdbc.support"
    JdbcDriverConnectionFactory = "org.apache.datawise.backend.jdbc.support"
    JdbcDriverDefaultsProvider = "org.apache.datawise.backend.jdbc.support"
    JdbcDriverLoader = "org.apache.datawise.backend.jdbc.support"
    MigrationWhereSupport = "org.apache.datawise.backend.jdbc.support"
    ResultSetColumnMapper = "org.apache.datawise.backend.jdbc.support"
    SqlExecutionTracker = "org.apache.datawise.backend.jdbc.support"
    ConnectionMapper = "org.apache.datawise.backend.connector.api.support"
    ConnectionsCatalogMapper = "org.apache.datawise.backend.connector.api.support"
    SqlErrorLineParser = "org.apache.datawise.backend.connector.api.support"
    SqlSelectDetector = "org.apache.datawise.backend.connector.api.support"
    SqlWriteClassifier = "org.apache.datawise.backend.connector.api.support"
    TableDefinitionConverter = "org.apache.datawise.backend.connector.api.support"
    TableDetailIntrospector = "org.apache.datawise.backend.connector.api.support"
    TableMetadataSupport = "org.apache.datawise.backend.connector.api.support"
    MongoClientSupport = "org.apache.datawise.backend.connector.mongodb.support"
    MongoConnectionErrors = "org.apache.datawise.backend.connector.mongodb.support"
    MongoConnectionSupport = "org.apache.datawise.backend.connector.mongodb.support"
    MongoDocumentSupport = "org.apache.datawise.backend.connector.mongodb.support"
    RedisConnectionErrors = "org.apache.datawise.backend.connector.redis.support"
    RedisConnectionSupport = "org.apache.datawise.backend.connector.redis.support"
    KafkaConnectionErrors = "org.apache.datawise.backend.connector.kafka.support"
}

$files = Get-ChildItem -Path $root -Include *.java,*.xml -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\target\\' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content
    foreach ($class in $classToPackage.Keys) {
        $oldPkg = "org.apache.datawise.backend.support.$class"
        $newPkg = "$($classToPackage[$class]).$class"
        $content = $content.Replace($oldPkg, $newPkg)
    }
    if ($content -ne $original) {
        Write-Utf8NoBom -Path $file.FullName -Content $content
    }
}

Write-Host "Package migration complete."
