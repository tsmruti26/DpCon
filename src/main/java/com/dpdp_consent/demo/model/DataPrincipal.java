package com.dpdp_consent.demo.model;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="data_principal")
public class DataPrincipal {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(unique=true, nullable=false, length=64) private String pseudoId;
    private boolean minor = false;
    private LocalDateTime createdAt = LocalDateTime.now();
    public Long getId(){return id;}
    public String getPseudoId(){return pseudoId;}
    public void setPseudoId(String s){this.pseudoId=s;}
    public boolean isMinor(){return minor;}
    public void setMinor(boolean m){this.minor=m;}
    public LocalDateTime getCreatedAt(){return createdAt;}
}