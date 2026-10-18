package com.dpdp_consent.demo.controller;

import com.dpdp_consent.demo.model.User;
import com.dpdp_consent.demo.repository.UserRepository;
import com.dpdp_consent.demo.service.MfaService;
import com.dpdp_consent.demo.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Pattern USERNAME_PATTERN = Pattern.compile("[A-Za-z0-9._-]{3,64}");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MfaService mfaService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        if (request == null) return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        String username = request.get("username");
        String password = request.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }
        username = username.trim();
        if (!USERNAME_PATTERN.matcher(username).matches())
            return ResponseEntity.badRequest().body(Map.of("error", "Username must be 3-64 characters using letters, numbers, dot, underscore, or hyphen"));
        if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 12 characters and no more than 72 UTF-8 bytes"));

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
        }

        // Hash the password before storing
        String hashedPassword = passwordEncoder.encode(password);
        User user = new User(username, hashedPassword);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "token", jwtUtil.create(username, user.getId()),
                "username", username
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        if (request == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid username or password"));
        String username = request.get("username");
        String password = request.get("password");

        if (username == null || password == null || username.length() > 64 || password.length() > 128) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid username or password"));
        }
        username = username.trim();

        Optional<User> userOptional = userRepository.findByUsername(username);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(401).body("Invalid username or password");
        }

        User user = userOptional.get();
        if (!passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(401).body("Invalid username or password");
        }

        if (user.isMfaEnabled()) {
            return ResponseEntity.ok(Map.of(
                "status", "MFA_REQUIRED",
                "message", "Please enter your Authenticator code",
                "token", jwtUtil.createMfaPendingToken(username, user.getId())
            ));
        }

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Login successful",
                "token", jwtUtil.create(username, user.getId()),
                "username", username
        ));
    }

    @GetMapping("/mfa-status")
    public ResponseEntity<?> mfaStatus(org.springframework.security.core.Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("enabled", user.isMfaEnabled()));
    }

    @PostMapping("/setup-mfa")
    public ResponseEntity<?> setupMfa(org.springframework.security.core.Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String secret = mfaService.generateNewSecret();
        // Keep the current authenticator working until the replacement key is verified.
        user.setMfaPendingSecret(secret);
        userRepository.save(user);

        String qrCodeUrl = mfaService.getQrCodeUrl(URLEncoder.encode(username, StandardCharsets.UTF_8), secret);
        return ResponseEntity.ok(Map.of(
                "secret", secret,
                "qrCodeUrl", qrCodeUrl,
                "enabled", user.isMfaEnabled(),
                "message", "Scan this QR code in your Google Authenticator app"
        ));
    }

    @PostMapping("/verify-mfa")
    public ResponseEntity<?> verifyMfa(@RequestBody Map<String, String> request,
                                       org.springframework.security.core.Authentication authentication) {
        String code = request == null ? null : request.get("code");
        if (code == null || !code.matches("\\d{6}"))
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid six-digit code"));
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean loginChallenge = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_MFA_PENDING".equals(authority.getAuthority()));
        String secretToVerify = loginChallenge ? user.getMfaSecret() : user.getMfaPendingSecret();
        if (secretToVerify == null || !mfaService.verifyCode(secretToVerify, Integer.parseInt(code))) {
            return ResponseEntity.status(401).body("Invalid MFA code");
        }

        if (!loginChallenge) {
            user.setMfaSecret(secretToVerify);
            user.setMfaPendingSecret(null);
            user.setMfaEnabled(true);
            userRepository.save(user);
        }
        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", loginChallenge ? "MFA verification successful" : "MFA enabled successfully",
                "token", jwtUtil.create(username, user.getId()),
                "username", username
        ));
    }
}
