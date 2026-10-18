package com.dpdp_consent.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "data_items")
public class DataItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name; // e.g., "Email", "Phone Number", "Aadhaar", "Location"

    private String sensitivity; // Low, Medium, High

    public DataItem() {}

    public DataItem(String name, String sensitivity) {
        this.name = name;
        this.sensitivity = sensitivity;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSensitivity() { return sensitivity; }
    public void setSensitivity(String sensitivity) { this.sensitivity = sensitivity; }
}