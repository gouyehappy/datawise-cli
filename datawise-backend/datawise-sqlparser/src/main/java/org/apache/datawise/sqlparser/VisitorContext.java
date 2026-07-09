package org.apache.datawise.sqlparser;

import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.PlainSelect;
import net.sf.jsqlparser.statement.select.Select;
import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.sqlparser.exceptions.StopVisitException;
import org.apache.datawise.sqlparser.support.VisitorRegistry;
import org.apache.datawise.sqlparser.visitors.CommonStatementVisitor;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Visitor execution context (ported from datawise-components sqlparser). */
public final class VisitorContext {

    private final Deque<PlainSelect> plainSelects = new ArrayDeque<>();
    private PlainSelect mainPlainSelect;
    private Statement statement;
    private final Map<Class<?>, List<Handler<?>>> classHandlers = new HashMap<>();
    private final Map<PlainSelect, Map<String, Object>> plainSelectParamMap = new HashMap<>();
    private boolean shouldStopVisitor;
    private VisitorContext parentVisitorContext;
    private final Map<String, Select> withItemInfo = new HashMap<>();
    private Set<String> tmpWithTableNameSets;
    private Map<String, Object> shareMemory;
    private final List<Handler<?>> abandonedHandlers = new ArrayList<>();
    private DbType dbType = DbType.MYSQL;
    private transient VisitorRegistry visitorRegistry;

    public VisitorContext() {
        this(DbType.MYSQL);
    }

    public VisitorContext(DbType dbType) {
        this.dbType = dbType == null ? DbType.MYSQL : dbType;
    }

    public VisitorRegistry visitors() {
        if (visitorRegistry == null) {
            visitorRegistry = new VisitorRegistry(this);
        }
        return visitorRegistry;
    }

    public <T> void addSqlHandler(Class<T> clazz, Handler<? super T> handler) {
        classHandlers.computeIfAbsent(clazz, ignored -> new ArrayList<>()).add(handler);
    }

    @SuppressWarnings("unchecked")
    public List<Handler<Object>> getSqlHandler(Class<?> clazz) {
        List<Handler<Object>> handlers = new ArrayList<>();
        for (Map.Entry<Class<?>, List<Handler<?>>> entry : classHandlers.entrySet()) {
            if (entry.getKey().isAssignableFrom(clazz)) {
                for (Handler<?> handler : entry.getValue()) {
                    handlers.add((Handler<Object>) handler);
                }
            }
        }
        return handlers;
    }

    /** @deprecated use {@link #getSqlHandler(Class)} */
    @Deprecated
    public List<Handler<Object>> getSqlHandlers(Class<?> clazz) {
        return getSqlHandler(clazz);
    }

    public void invokeHandlers(Object target) {
        if (target == null || shouldStopVisitor) {
            return;
        }
        for (Handler<Object> handler : getSqlHandler(target.getClass())) {
            if (abandonedHandlers.contains(handler)) {
                continue;
            }
            handler.handle(target, this);
            if (shouldStopVisitor) {
                return;
            }
        }
    }

    /**
     * Runs an action unless traversal was stopped. Converts {@link StopVisitException}
     * into a cooperative stop flag instead of propagating.
     */
    public void runIfActive(Runnable action) {
        if (shouldStopVisitor) {
            return;
        }
        try {
            action.run();
        } catch (StopVisitException ignored) {
            shouldStopVisitor = true;
        }
    }

    public boolean shouldContinue() {
        return !shouldStopVisitor;
    }

    public void stopVisiting() {
        shouldStopVisitor = true;
    }

    public void pushPlainSelect(PlainSelect plainSelect) {
        plainSelects.push(plainSelect);
    }

    public PlainSelect popPlainSelect() {
        return plainSelects.isEmpty() ? null : plainSelects.pop();
    }

    public Map<String, Object> getPrePlainSelectParamMap() {
        int size = plainSelects.size();
        if (size <= 1) {
            return null;
        }
        PlainSelect plainSelect = plainSelects.toArray(new PlainSelect[0])[size - 2];
        return plainSelectParamMap.computeIfAbsent(plainSelect, ignored -> new HashMap<>());
    }

    public Map<String, Object> getCurrentPlainSelectParamMap() {
        PlainSelect plainSelect = getCurrentPlainSelect();
        return plainSelectParamMap.computeIfAbsent(plainSelect, ignored -> new HashMap<>());
    }

    public PlainSelect getCurrentPlainSelect() {
        return plainSelects.isEmpty() ? null : plainSelects.peek();
    }

    public void restartVisit() {
        runIfActive(() -> {
            if (statement != null) {
                statement.accept(new CommonStatementVisitor(this), null);
            }
        });
    }

    public void doNotExcuteThisHandlerAgain(Handler<?> handler) {
        abandonedHandlers.add(handler);
    }

    public Map<Class<?>, List<Handler<?>>> getClassHandlers() {
        return classHandlers;
    }

    public void setClassHandlers(Map<Class<?>, List<Handler<?>>> classHandlers) {
        this.classHandlers.clear();
        this.classHandlers.putAll(classHandlers);
    }

    public boolean hasHandlers() {
        return !classHandlers.isEmpty();
    }

    public boolean isStopVisitor() {
        return shouldStopVisitor;
    }

    public void setShouldStopVisitor(boolean shouldStopVisitor) {
        this.shouldStopVisitor = shouldStopVisitor;
    }

    public Statement getStatement() {
        return statement;
    }

    public void setStatement(Statement statement) {
        this.statement = statement;
    }

    public void addWithItem(String name, Select select) {
        withItemInfo.put(name, select);
    }

    public void removeWithItem(String name) {
        withItemInfo.remove(name);
    }

    public Select getSelectBodyOfWithItem(String name) {
        Select select = withItemInfo.get(name);
        if (select == null && parentVisitorContext != null) {
            select = parentVisitorContext.getSelectBodyOfWithItem(name);
        }
        return select;
    }

    public PlainSelect getMainPlainSelect() {
        return mainPlainSelect;
    }

    public void setMainPlainSelect(PlainSelect mainPlainSelect) {
        this.mainPlainSelect = mainPlainSelect;
    }

    public Map<String, Select> getWithItemInfo() {
        return withItemInfo;
    }

    public void setWithItemInfo(Map<String, Select> withItemInfo) {
        this.withItemInfo.clear();
        this.withItemInfo.putAll(withItemInfo);
    }

    public VisitorContext getParentVisitorContext() {
        return parentVisitorContext;
    }

    public void setParentVisitorContext(VisitorContext parentVisitorContext) {
        this.parentVisitorContext = parentVisitorContext;
    }

    public Set<String> getTmpWithTableNameSets() {
        return tmpWithTableNameSets;
    }

    public void setTmpWithTableNameSets(Set<String> tmpWithTableNameSets) {
        this.tmpWithTableNameSets = tmpWithTableNameSets;
    }

    public DbType getDbType() {
        return dbType;
    }

    public void setDbType(DbType dbType) {
        this.dbType = dbType == null ? DbType.MYSQL : dbType;
    }

    public Map<String, Object> getShareMemory() {
        return shareMemory;
    }

    public void setShareMemory(Map<String, Object> shareMemory) {
        this.shareMemory = shareMemory;
    }

    public List<Handler<?>> getAbandonedHandlers() {
        return abandonedHandlers;
    }

    public Set<String> ensureTmpWithTableNameSets() {
        if (tmpWithTableNameSets == null) {
            tmpWithTableNameSets = new HashSet<>();
        }
        return tmpWithTableNameSets;
    }
}
