package org.apache.datawise.backend.lineage.spi;

import org.apache.datawise.backend.lineage.model.LineageParseRequest;
import org.apache.datawise.backend.lineage.model.LineageParseResult;
import org.apache.datawise.backend.lineage.model.LineageWarning;
import org.apache.datawise.backend.lineage.model.ParseStatus;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class SqlLineageParserRegistry {

    private final List<SqlLineageParser> parsers;

    public SqlLineageParserRegistry(List<SqlLineageParser> parsers) {
        this.parsers = parsers == null ? List.of() : List.copyOf(parsers);
    }

    public SqlLineageParser require(String dbType) {
        return parsers.stream()
                .filter(parser -> parser.supports(dbType))
                .min(Comparator.comparingInt(SqlLineageParser::priority))
                .orElseThrow(() -> new IllegalStateException("No SqlLineageParser for dbType: " + dbType));
    }

    public LineageParseResult parseWithFallback(LineageParseRequest request) {
        String dbType = request.dbType() == null ? "generic" : request.dbType();
        List<SqlLineageParser> candidates = parsers.stream()
                .filter(parser -> parser.supports(dbType))
                .sorted(Comparator.comparingInt(SqlLineageParser::priority))
                .toList();
        if (candidates.isEmpty()) {
            return new LineageParseResult(
                    List.of(),
                    List.of(LineageWarning.of("UNSUPPORTED_DIALECT", "No parser for dbType: " + dbType)),
                    ParseStatus.FAILED,
                    "none",
                    "0"
            );
        }
        LineageParseResult last = null;
        for (SqlLineageParser parser : candidates) {
            LineageParseResult result = parser.parse(request);
            last = result;
            if (result.status() != ParseStatus.FAILED) {
                return result;
            }
        }
        return last != null
                ? last
                : LineageParseResult.failed("none", "0", "Lineage parsing failed");
    }
}
