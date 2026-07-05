package org.apache.datawise.backend.jdbc.execution;

import org.apache.datawise.backend.domain.TableDataResult;
import org.apache.datawise.backend.jdbc.support.ResultSetColumnMapper;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Maps JDBC {@link ResultSet} rows into {@link TableDataResult} for API responses.
 */
public final class JdbcResultSetMapper {

    private JdbcResultSetMapper() {
    }

    /** Reads all remaining rows from the result set. */
    public static TableDataResult mapAll(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        List<ResultSetColumnMapper.ColumnField> fields = ResultSetColumnMapper.buildFields(meta);
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
            rows.add(ResultSetColumnMapper.readRow(rs, fields));
        }
        return new TableDataResult(ResultSetColumnMapper.toColumnMaps(fields), rows, null, false, null, null);
    }

    /**
     * Reads up to {@code pageSize} rows and sets {@code hasMore} when an extra row exists.
     */
    public static TableDataResult mapPage(ResultSet rs, int pageSize) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        List<ResultSetColumnMapper.ColumnField> fields = ResultSetColumnMapper.buildFields(meta);
        List<Map<String, Object>> rows = new ArrayList<>(Math.min(pageSize, 64));
        while (rs.next()) {
            rows.add(ResultSetColumnMapper.readRow(rs, fields));
            if (rows.size() > pageSize) {
                break;
            }
        }
        boolean hasMore = rows.size() > pageSize;
        if (!hasMore && rows.size() == pageSize) {
            // Full page without probe row: either end of data or fetch-size capped before row pageSize+1.
            hasMore = true;
        }
        if (hasMore && rows.size() > pageSize) {
            rows.remove(pageSize);
        }
        return new TableDataResult(
                ResultSetColumnMapper.toColumnMaps(fields),
                rows,
                null,
                hasMore,
                null,
                pageSize
        );
    }
}
