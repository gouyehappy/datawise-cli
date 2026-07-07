package org.apache.datawise.backend.common.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Unified exception logging for client troubleshooting.
 *
 * <p>Business logs stay as one-line summaries; {@code datawise.exception}
 * keeps the full stack trace for deeper diagnosis.</p>
 */
public final class ExceptionLogging {

    private static final Logger EXCEPTION = LoggerFactory.getLogger("datawise.exception");
    private static final int MAX_ERROR_MESSAGE_CHARS = 800;

    private ExceptionLogging() {
    }

    public static void warn(Logger log, String context, Throwable ex) {
        if (ex == null) {
            return;
        }
        String errorType = errorType(ex);
        String errorMessage = errorMessage(ex);
        log.warn("{} | level=warn | errorType={} | error={}", context, errorType, errorMessage);
        EXCEPTION.warn(
                "{} | source={} | level=warn | errorType={} | error={}",
                context,
                sourceName(log),
                errorType,
                errorMessage,
                ex
        );
    }

    public static void error(Logger log, String context, Throwable ex) {
        if (ex == null) {
            return;
        }
        String errorType = errorType(ex);
        String errorMessage = errorMessage(ex);
        log.error("{} | level=error | errorType={} | error={}", context, errorType, errorMessage);
        EXCEPTION.error(
                "{} | source={} | level=error | errorType={} | error={}",
                context,
                sourceName(log),
                errorType,
                errorMessage,
                ex
        );
    }

    /** Recoverable exception; callers can continue after logging it. */
    public static void recoverable(Logger log, String context, Throwable ex) {
        warn(log, context, ex);
    }

    private static String errorType(Throwable ex) {
        return ex.getClass().getSimpleName();
    }

    private static String errorMessage(Throwable ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return errorType(ex);
        }
        return truncate(message.replaceAll("\\s+", " ").trim(), MAX_ERROR_MESSAGE_CHARS);
    }

    private static String sourceName(Logger log) {
        String name = log.getName();
        int lastDot = name.lastIndexOf('.');
        if (lastDot < 0 || lastDot == name.length() - 1) {
            return name;
        }
        return name.substring(lastDot + 1);
    }

    private static String truncate(String value, int maxLen) {
        if (value.length() <= maxLen) {
            return value;
        }
        return value.substring(0, maxLen) + "...";
    }
}
