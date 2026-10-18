package com.dpdp_consent.demo.service;

import com.dpdp_consent.demo.model.*;
import com.dpdp_consent.demo.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WalletService {

    @Autowired
    private ConsentRepository consentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private DataItemRepository dataItemRepository;

    @Autowired
    private PurposeRepository purposeRepository;

    @Transactional
    public Consent recordConsent(Long userId, String orgName, String dataItemName, String purposeDesc) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Organization org = organizationRepository.findByName(orgName)
                .orElseGet(() -> {
                    Organization newOrg = new Organization(orgName, "General");
                    newOrg.setRiskLevel("Low");
                    return organizationRepository.save(newOrg);
                });

        DataItem item = dataItemRepository.findByName(dataItemName)
                .orElseGet(() -> {
                    String sensitivity = "Medium"; // Default
                    if (dataItemName.toLowerCase().contains("aadhaar")) sensitivity = "High";
                    if (dataItemName.toLowerCase().contains("email")) sensitivity = "Low";
                    return dataItemRepository.save(new DataItem(dataItemName, sensitivity));
                });

        Purpose purpose = purposeRepository.findByDescription(purposeDesc)
                .orElseGet(() -> purposeRepository.save(new Purpose(purposeDesc)));

        Consent consent = new Consent();
        consent.setUser(user);
        consent.setOrganization(org);
        consent.setDataItem(item);
        consent.setPurpose(purpose);
        consent.setStatus("APPROVED");

        return consentRepository.save(consent);
    }

    public List<Consent> getUserInventory(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return consentRepository.findByUser(user);
    }

    @Transactional
    public int importConsents(Long userId, List<Map<String, String>> records) {
        if (records == null || records.size() > 500) {
            throw new IllegalArgumentException("Passport must contain at most 500 consent records");
        }
        int imported = 0;
        for (Map<String, String> record : records) {
            String organization = record.get("organization");
            String dataItem = record.get("dataItem");
            String purpose = record.get("purpose");
            if (organization == null || dataItem == null || purpose == null
                    || organization.isBlank() || dataItem.isBlank() || purpose.isBlank()) {
                continue;
            }
            Consent consent = recordConsent(userId, organization.trim(), dataItem.trim(), purpose.trim());
            if ("WITHDRAWN".equalsIgnoreCase(record.get("status"))) {
                consent.setStatus("WITHDRAWN");
                consent.setWithdrawnDate(LocalDateTime.now());
                consentRepository.save(consent);
            }
            imported++;
        }
        return imported;
    }

    @Transactional
    public void eraseUserData(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        consentRepository.deleteByUser(user);
        userRepository.delete(user);
    }

    @Transactional
    public void withdrawConsent(Long consentId, String username) {
        Consent consent = consentRepository.findById(consentId)
                .orElseThrow(() -> new NoSuchElementException("Consent record not found"));
        if (!consent.getUser().getUsername().equals(username)) {
            throw new org.springframework.security.access.AccessDeniedException("Consent belongs to another user");
        }
        consent.setStatus("WITHDRAWN");
        consent.setWithdrawnDate(LocalDateTime.now());
        consentRepository.save(consent);
    }

    public Map<String, Object> calculatePrivacyScore(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<Consent> consents = consentRepository.findByUser(user);

        if (consents.isEmpty()) {
            return Map.of("score", 100, "message", "No data shared. Maximum privacy!");
        }

        int penalty = 0;
        for (Consent c : consents) {
            if ("WITHDRAWN".equals(c.getStatus())) continue;

            // Penalty based on sensitivity
            String sensitivity = c.getDataItem().getSensitivity();
            if ("High".equalsIgnoreCase(sensitivity)) penalty += 15;
            else if ("Medium".equalsIgnoreCase(sensitivity)) penalty += 5;

            // Penalty based on org risk
            String risk = c.getOrganization().getRiskLevel();
            if ("High".equalsIgnoreCase(risk)) penalty += 10;
        }

        int score = Math.max(0, 100 - penalty);
        return Map.of(
            "score", score,
            "total_shares", consents.size(),
            "risk_level", score < 50 ? "High" : (score < 80 ? "Medium" : "Low")
        );
    }
}
