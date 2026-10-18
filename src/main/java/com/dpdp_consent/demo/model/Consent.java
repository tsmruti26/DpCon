package com.dpdp_consent.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "consents")
public class Consent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne
    @JoinColumn(name = "data_item_id", nullable = false)
    private DataItem dataItem;

    @ManyToOne
    @JoinColumn(name = "purpose_id", nullable = false)
    private Purpose purpose;

    @Column(nullable = false)
    private String status; // APPROVED, WITHDRAWN, EXPIRED

    private LocalDateTime grantedDate = LocalDateTime.now();
    private LocalDateTime withdrawnDate;

    public Consent() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public DataItem getDataItem() { return dataItem; }
    public void setDataItem(DataItem dataItem) { this.dataItem = dataItem; }

    public Purpose getPurpose() { return purpose; }
    public void setPurpose(Purpose purpose) { this.purpose = purpose; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getGrantedDate() { return grantedDate; }
    public void setGrantedDate(LocalDateTime grantedDate) { this.grantedDate = grantedDate; }

    public LocalDateTime getWithdrawnDate() { return withdrawnDate; }
    public void setWithdrawnDate(LocalDateTime withdrawnDate) { this.withdrawnDate = withdrawnDate; }
}