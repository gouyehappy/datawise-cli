package org.apache.datawise.backend.common.support;

import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class ExceptionLoggingTest {

    @Test
    void recoverable_acceptsNullWithoutThrowing() {
        var log = LoggerFactory.getLogger(ExceptionLoggingTest.class);
        assertDoesNotThrow(() -> ExceptionLogging.recoverable(log, "ctx", null));
    }
}
