package com.dpdp_consent.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "purposes")
public class Purpose {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String description; // e.g., "Marketing", "Account Verification", "Service Delivery"

    public Purpose() {}

    public Purpose(String description) {
        this.description = description;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}