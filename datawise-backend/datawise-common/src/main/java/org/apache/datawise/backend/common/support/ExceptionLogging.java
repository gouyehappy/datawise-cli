package org.apache.datawise.backend.common.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 统一异常日志：所有 catch 块应通过本类输出，确保堆栈可追溯。
 * 同时写入业务 logger（控制台 / datawise.log）与 {@code datawise.exception}（exception.log）。
 */
public final class ExceptionLogging {

    private static final Logger EXCEPTION = LoggerFactory.getLogger("datawise.exception");

    private ExceptionLogging() {
    }

    public static void warn(Logger log, String context, Throwable ex) {
        if (ex == null) {
            return;
        }
        log.warn("{}: {}", context, ex.getMessage(), ex);
        EXCEPTION.warn("[{}] {}: {}", log.getName(), context, ex.getMessage(), ex);
    }

    public static void error(Logger log, String context, Throwable ex) {
        if (ex == null) {
            return;
        }
        log.error("{}: {}", context, ex.getMessage(), ex);
        EXCEPTION.error("[{}] {}: {}", log.getName(), context, ex.getMessage(), ex);
    }

    /** 可降级继续执行的异常（仍打印完整堆栈）。 */
    public static void recoverable(Logger log, String context, Throwable ex) {
        warn(log, context, ex);
    }
}
