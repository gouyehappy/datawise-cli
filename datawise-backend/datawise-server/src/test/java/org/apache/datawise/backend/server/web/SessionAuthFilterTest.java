package org.apache.datawise.backend.server.web;

import jakarta.servlet.FilterChain;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.security.ApiTokenScopes;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ApiTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionAuthFilterTest {

    @Mock
    private SessionStore sessionStore;
    @Mock
    private ApiTokenService apiTokenService;
    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private SessionAuthFilter filter;

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void setsUserContextForValidSessionHeader() throws Exception {
        SessionEntity session = new SessionEntity();
        session.setId("session-1");
        session.setUserId(7L);
        session.setGuest(false);
        when(sessionStore.authenticate("session-1")).thenReturn(Optional.of(session));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void populatesUserContextDuringFilterChain() throws Exception {
        SessionEntity session = new SessionEntity();
        session.setId("session-2");
        session.setUserId(9L);
        session.setGuest(true);
        when(sessionStore.authenticate("session-2")).thenReturn(Optional.of(session));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-2");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals(9L, UserContext.getUserId());
            assertEquals("session-2", UserContext.getSessionId());
        });
    }

    @Test
    void ignoresExpiredSession() throws Exception {
        SessionEntity session = new SessionEntity();
        session.setId("session-expired");
        session.setUserId(3L);
        session.setExpiresAt(Instant.now().minusSeconds(60));
        when(sessionStore.authenticate("session-expired")).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-expired");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> assertNull(UserContext.getUserId()));
    }

    @Test
    void authenticatesApiTokenHeader() throws Exception {
        ApiTokenEntity token = new ApiTokenEntity();
        token.setId("tok-1");
        token.setUserId(1L);
        token.setScopes(List.of(ApiTokenScopes.MIGRATION));
        when(apiTokenService.authenticate("dw_secret")).thenReturn(Optional.of(token));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthFilter.API_TOKEN_HEADER, "dw_secret");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals(1L, UserContext.getUserId());
            assertEquals("api-token:tok-1", UserContext.getSessionId());
        });
    }

    @Test
    void prefersSessionOverApiToken() throws Exception {
        SessionEntity session = new SessionEntity();
        session.setId("session-1");
        session.setUserId(7L);
        session.setGuest(false);
        when(sessionStore.authenticate("session-1")).thenReturn(Optional.of(session));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-1");
        request.addHeader(SessionAuthFilter.API_TOKEN_HEADER, "dw_secret");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals(7L, UserContext.getUserId());
            assertEquals("session-1", UserContext.getSessionId());
        });
    }

    @Test
    void clearsUserContextAfterRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertNull(UserContext.getUserId());
        verify(filterChain).doFilter(request, response);
    }
}
