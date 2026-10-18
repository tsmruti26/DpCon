package com.dpdp_consent.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password; // Hashed password

    @Column(name = "mfa_secret")
    private String mfaSecret; // Secret key for TOTP (Authenticator App)

    @Column(name = "mfa_pending_secret")
    private String mfaPendingSecret;

    @Column(name = "is_mfa_enabled")
    private boolean isMfaEnabled = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public User() {}

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getMfaSecret() { return mfaSecret; }
    public void setMfaSecret(String mfaSecret) { this.mfaSecret = mfaSecret; }

    public String getMfaPendingSecret() { return mfaPendingSecret; }
    public void setMfaPendingSecret(String mfaPendingSecret) { this.mfaPendingSecret = mfaPendingSecret; }

    public boolean isMfaEnabled() { return isMfaEnabled; }
    public void setMfaEnabled(boolean isMfaEnabled) { this.isMfaEnabled = isMfaEnabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
