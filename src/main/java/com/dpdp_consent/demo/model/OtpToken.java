package com.dpdp_consent.demo.model;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="otp_token")
public class OtpToken {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false, length=64) private String pseudoId;
    @Column(nullable=false) private String otpHash;
    private LocalDateTime expiresAt;
    private int attempts = 0;
    private boolean used = false;
    public Long getId(){return id;}
    public String getPseudoId(){return pseudoId;}
    public void setPseudoId(String s){pseudoId=s;}
    public String getOtpHash(){return otpHash;}
    public void setOtpHash(String s){otpHash=s;}
    public LocalDateTime getExpiresAt(){return expiresAt;}
    public void setExpiresAt(LocalDateTime t){expiresAt=t;}
    public int getAttempts(){return attempts;}
    public void setAttempts(int a){attempts=a;}
    public boolean isUsed(){return used;}
    public void setUsed(boolean u){used=u;}
}