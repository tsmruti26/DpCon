package com.dpdp_consent.demo.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 bytes of cryptographically random data");
        }
        this.key = Keys.hmacShaKeyFor(
                secret.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String create(String subject, long userId) {
        return Jwts.builder()
                .subject(subject)
                .claim("role", "USER")
                .claim("uid", userId)
                .issuedAt(new Date())
                .expiration(
                        new Date(System.currentTimeMillis() + 900_000)
                )
                .signWith(key)
                .compact();
    }

    public String createAdminToken(String username) {
        return Jwts.builder()
                .subject(username)
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(
                        new Date(System.currentTimeMillis() + 900_000)
                )
                .signWith(key)
                .compact();
    }

    public String createMfaPendingToken(String username, long userId) {
        return Jwts.builder()
                .subject(username)
                .claim("role", "MFA_PENDING")
                .claim("uid", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 5 * 60_000))
                .signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        return subject(token);
    }

    public boolean validateToken(String token) {
        try {
            subject(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String subject(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public String role(String token) {
        Object role = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role");

        return role != null ? role.toString() : null;
    }

    public Long userId(String token) {
        Object value = Jwts.parser().verifyWith(key).build().parseSignedClaims(token)
                .getPayload().get("uid");
        return value instanceof Number number ? number.longValue() : null;
    }
}
