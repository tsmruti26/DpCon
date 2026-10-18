package com.dpdp_consent.demo.controller;

import com.dpdp_consent.demo.model.Consent;
import com.dpdp_consent.demo.service.WalletService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.time.Instant;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    @Autowired
    private WalletService walletService;

    @Autowired
    private com.dpdp_consent.demo.repository.UserRepository userRepository;

    private Long getCurrentUserId(Authentication authentication) {
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }

    @PostMapping("/add")
    public ResponseEntity<?> addConsent(@RequestBody Map<String, String> request, Authentication authentication) {
        if (request.get("organization") == null || request.get("organization").isBlank()
                || request.get("dataItem") == null || request.get("dataItem").isBlank()
                || request.get("purpose") == null || request.get("purpose").isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Organization, data item, and purpose are required"));
        }
        Long userId = getCurrentUserId(authentication);

        Consent consent = walletService.recordConsent(
                userId,
                request.get("organization"),
                request.get("dataItem"),
                request.get("purpose")
        );

        return ResponseEntity.ok(consent);
    }

    @GetMapping("/inventory")
    public ResponseEntity<List<Consent>> getInventory(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        return ResponseEntity.ok(walletService.getUserInventory(userId));
    }

    @PostMapping("/withdraw/{id}")
    public ResponseEntity<?> withdraw(@PathVariable Long id, Authentication authentication) {
        try {
            walletService.withdrawConsent(id, authentication.getName());
            return ResponseEntity.ok("Consent withdrawn successfully");
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(403).body(Map.of("error", "Consent belongs to another user"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/score")
    public ResponseEntity<Map<String, Object>> getScore(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        return ResponseEntity.ok(walletService.calculatePrivacyScore(userId));
    }

    @GetMapping("/passport")
    public ResponseEntity<Map<String, Object>> exportPassport(Authentication authentication) {
        List<Map<String, String>> records = walletService.getUserInventory(getCurrentUserId(authentication))
                .stream().map(consent -> Map.of(
                        "organization", consent.getOrganization().getName(),
                        "dataItem", consent.getDataItem().getName(),
                        "purpose", consent.getPurpose().getDescription(),
                        "status", consent.getStatus()
                )).toList();
        return ResponseEntity.ok(Map.of(
                "format", "DpCon Passport",
                "version", 1,
                "exportedAt", Instant.now().toString(),
                "consents", records
        ));
    }

    @PostMapping("/passport")
    public ResponseEntity<?> importPassport(@RequestBody Map<String, Object> passport,
                                            Authentication authentication) {
        if (!("DpCon Passport".equals(passport.get("format")) || "PrivacyPocket Passport".equals(passport.get("format")))
                || !(passport.get("consents") instanceof List<?> rawRecords)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unsupported passport format"));
        }
        List<Map<String, String>> records = new ArrayList<>();
        for (Object raw : rawRecords) {
            if (!(raw instanceof Map<?, ?> record)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid consent record"));
            }
            Map<String, String> normalized = new HashMap<>();
            for (String field : List.of("organization", "dataItem", "purpose")) {
                Object value = record.get(field);
                if (value instanceof String text) normalized.put(field, text);
            }
            records.add(normalized);
        }
        try {
            int imported = walletService.importConsents(getCurrentUserId(authentication), records);
            return ResponseEntity.ok(Map.of("imported", imported));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(Authentication authentication) {
        walletService.eraseUserData(authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
