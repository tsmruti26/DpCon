package com.dpdp_consent.demo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.annotation.Autowired;

/** Basic per-IP throttle for credential and one-time-code endpoints. */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = Duration.ofMinutes(10).toMillis();
    private static final int MAX_ATTEMPTS = 20;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong calls = new AtomicLong();
    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        String path = request.getRequestURI();
        if (path.equals("/api/ai/analyze-policy") || path.equals("/api/ai/analyze-url")) return false;
        return !switch (path) {
            case "/api/auth/register", "/api/auth/login", "/api/auth/verify-mfa",
                 "/api/auth/request-otp", "/api/auth/verify-otp", "/api/admin/login" -> true;
            default -> false;
        };
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = System.currentTimeMillis();
        boolean aiRequest = request.getRequestURI().startsWith("/api/ai/");
        String identity;
        if (aiRequest) {
            String authorization = request.getHeader("Authorization");
            identity = authorization != null && authorization.startsWith("Bearer ")
                    && jwtUtil.validateToken(authorization.substring(7))
                    ? jwtUtil.extractUsername(authorization.substring(7)) : request.getRemoteAddr();
        } else {
            // X-Real-IP is set by the bundled reverse proxy; backend is loopback-bound in Compose.
            String clientAddress = request.getHeader("X-Real-IP");
            if (clientAddress == null || clientAddress.isBlank()) clientAddress = request.getRemoteAddr();
            identity = clientAddress + ':' + request.getRequestURI();
        }
        String key = aiRequest ? "ai:" + identity : identity;
        Window window = windows.compute(key, (ignored, current) ->
                current == null || now - current.startedAt >= WINDOW_MS ? new Window(now) : current);

        if (!window.allow(aiRequest ? 20 : MAX_ATTEMPTS)) {
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(WINDOW_MS / 1000));
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many authentication attempts. Try again later.\"}");
            return;
        }

        if (calls.incrementAndGet() % 256 == 0) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt >= WINDOW_MS);
        }
        chain.doFilter(request, response);
    }

    private static final class Window {
        private final long startedAt;
        private int attempts;

        private Window(long startedAt) { this.startedAt = startedAt; }

        private synchronized boolean allow(int maxAttempts) { return ++attempts <= maxAttempts; }
    }
}
