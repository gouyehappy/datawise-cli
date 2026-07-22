package org.apache.datawise.backend.connector.support;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.common.support.ConnectionTargetSupport;
import org.apache.datawise.backend.common.support.ThrowableSupport;

import java.util.Locale;

/** Maps connector client errors to user-facing messages. */
public final class ConnectorErrorSupport {

    private ConnectorErrorSupport() {
    }

    public static String toUserMessage(
            ConnectionEntity entity,
            Throwable error,
            ConnectorErrorTemplate template
    ) {
        String target = ConnectionTargetSupport.describeHostPort(entity, template.multiHostBootstrap());
        String root = ThrowableSupport.rootMessage(error);
        if (root == null || root.isBlank()) {
            return "Cannot connect to " + template.productName()
                    + (target.isBlank() ? "" : " at " + target)
                    + ". " + template.emptyRootHint();
        }
        String lower = root.toLowerCase(Locale.ROOT);
        if (lower.contains("connection refused") || lower.contains("connect timed out")
                || lower.contains("timed out") || lower.contains("timeout")) {
            return withDetails(
                    "Cannot reach " + template.productName()
                            + (target.isBlank() ? "" : " at " + target)
                            + ". " + template.unreachableHint(),
                    root
            );
        }
        if (lower.contains("unknown host") || lower.contains("name or service not known")) {
            return withDetails(
                    template.productName() + " host could not be resolved"
                            + (target.isBlank() ? "" : " (" + target + ").")
                            + " " + template.unknownHostHint(),
                    root
            );
        }
        if (template.authHint() != null && template.authMatcher().test(lower)) {
            return withDetails(
                    template.productName() + " authentication failed"
                            + (target.isBlank() ? "" : " at " + target)
                            + ". " + template.authHint(),
                    root
            );
        }
        return withDetails(
                template.productName() + " operation failed"
                        + (target.isBlank() ? "" : " at " + target)
                        + ". " + template.fallbackHint(),
                root
        );
    }

    private static String withDetails(String message, String root) {
        if (root == null || root.isBlank() || message.contains(root)) {
            return message;
        }
        return message + " Details: " + root.trim();
    }
}
