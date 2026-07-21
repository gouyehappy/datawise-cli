package org.apache.datawise.backend.server.web;

import jakarta.servlet.FilterChain;
import org.apache.datawise.backend.config.AuthSecurityProperties;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.security.ApiTokenScopes;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ApiTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.never;
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

    private SessionAuthFilter filter;
    private AuthSecurityProperties authSecurityProperties;

    @BeforeEach
    void setUp() {
        authSecurityProperties = new AuthSecurityProperties();
        authSecurityProperties.setRequireAuthentication(true);
        filter = new SessionAuthFilter(sessionStore, apiTokenService, authSecurityProperties);
    }

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

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    @Test
    void populatesUserContextDuringFilterChain() throws Exception {
        SessionEntity session = new SessionEntity();
        session.setId("session-2");
        session.setUserId(9L);
        session.setGuest(true);
        when(sessionStore.authenticate("session-2")).thenReturn(Optional.of(session));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-2");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            assertEquals(9L, UserContext.getUserId());
            assertEquals("session-2", UserContext.getSessionId());
        });
    }

    @Test
    void rejectsExpiredSessionOnProtectedPath() throws Exception {
        when(sessionStore.authenticate("session-expired")).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
        request.addHeader(SessionAuthFilter.SESSION_HEADER, "session-expired");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(401, response.getStatus());
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void rejectsAnonymousOnProtectedPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(401, response.getStatus());
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void allowsAnonymousOnPublicHealthPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    @Test
    void rejectsAnonymousOnProtectedAuthSessionPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/session");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(401, response.getStatus());
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void allowsAnonymousGuestLogin() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login/guest");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    @Test
    void authenticatesApiTokenHeader() throws Exception {
        ApiTokenEntity token = new ApiTokenEntity();
        token.setId("tok-1");
        token.setUserId(1L);
        token.setScopes(List.of(ApiTokenScopes.MIGRATION));
        when(apiTokenService.authenticate("dw_secret")).thenReturn(Optional.of(token));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/migration/jobs");
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

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
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
        authSecurityProperties.setRequireAuthentication(false);
        filter = new SessionAuthFilter(sessionStore, apiTokenService, authSecurityProperties);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/explorer/tree");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertNull(UserContext.getUserId());
        verify(filterChain).doFilter(request, response);
    }
}
