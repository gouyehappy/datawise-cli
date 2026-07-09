package org.apache.datawise.sqlparser.handle;

import net.sf.jsqlparser.JSQLParserException;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.select.PlainSelect;
import org.apache.datawise.sqlparser.VisitorContext;

import java.util.ArrayList;
import java.util.List;

/**
 * AND-injects a lexicographic keyset seek predicate ({@code (c1 > v1) OR (c1 = v1 AND c2 > v2) ...})
 * into the outer query WHERE clause.
 */
public final class KeysetSeekHandler extends MainQueryHandler {

    private final Expression condition;

    public KeysetSeekHandler(List<String> orderByColumns, List<String> lastValues) throws JSQLParserException {
        if (orderByColumns == null || orderByColumns.isEmpty()) {
            throw new IllegalArgumentException("orderByColumns must not be empty");
        }
        if (lastValues == null || lastValues.isEmpty()) {
            throw new IllegalArgumentException("lastValues must not be empty");
        }
        if (orderByColumns.size() != lastValues.size()) {
            throw new IllegalArgumentException("orderByColumns size mismatch with seek key");
        }
        this.condition = CCJSqlParserUtil.parseCondExpression(buildLexicographicGreaterPredicate(orderByColumns, lastValues));
    }

    @Override
    protected void apply(PlainSelect plainSelect, VisitorContext visitorContext) {
        new WhereConditionHandler(condition).handle(plainSelect, visitorContext);
    }

    public static String buildLexicographicGreaterPredicate(List<String> columns, List<String> values) {
        List<String> disjuncts = new ArrayList<>(columns.size());
        for (int i = 0; i < columns.size(); i++) {
            List<String> conjuncts = new ArrayList<>(i + 1);
            for (int j = 0; j < i; j++) {
                conjuncts.add(columns.get(j).trim() + " = " + formatSeekLiteral(values.get(j)));
            }
            conjuncts.add(columns.get(i).trim() + " > " + formatSeekLiteral(values.get(i)));
            disjuncts.add(conjuncts.size() == 1 ? conjuncts.get(0) : "(" + String.join(" AND ", conjuncts) + ")");
        }
        return "(" + String.join(" OR ", disjuncts) + ")";
    }

    private static String formatSeekLiteral(String value) {
        if (value == null || value.isBlank()) {
            return "NULL";
        }
        if (value.matches("-?\\d+")) {
            return value;
        }
        if (value.matches("-?\\d+\\.\\d+")) {
            return value;
        }
        return sqlLiteral(value);
    }

    private static String sqlLiteral(String value) {
        return "'" + value.replace("'", "''") + "'";
    }
}
