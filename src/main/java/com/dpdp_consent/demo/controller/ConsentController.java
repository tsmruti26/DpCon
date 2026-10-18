package com.dpdp_consent.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.dpdp_consent.demo.model.Consent;
import com.dpdp_consent.demo.repository.ConsentRepository;
import com.dpdp_consent.demo.repository.UserRepository;

import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api")
public class ConsentController {

    @Autowired
    private ConsentRepository consentRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/create_consent")
    public Consent createConsent(
            @RequestBody Consent consent,
            Authentication authentication) {

        consent.setUser(userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found")));
        return consentRepository.save(consent);
    }

    @GetMapping("/get_consents")
    public List<Consent> getConsents(
            Authentication authentication) {
        return consentRepository.findByUsername(authentication.getName());
    }

    @GetMapping("/admin/dashboard")
    public Map<String, Long> getDashboardStats() {
        List<Consent> all = consentRepository.findAll();
        Map<String, Long> stats = new HashMap<>();
        stats.put("total", (long) all.size());
        stats.put("approved", all.stream().filter(c -> "Approved".equals(c.getStatus())).count());
        stats.put("rejected", all.stream().filter(c -> "Rejected".equals(c.getStatus())).count());
        stats.put("pending", all.stream().filter(c -> "Pending".equals(c.getStatus())).count());
        return stats;
    }

    @PostMapping("/update_status")
    public ResponseEntity<?> updateStatus(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {

        Long id;
        try {
            id = Long.valueOf(request.get("id").toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid consent ID"));
        }

        Object rawStatus = request.get("status");
        if (!(rawStatus instanceof String status)
                || !List.of("APPROVED", "WITHDRAWN", "PENDING", "REJECTED").contains(status.toUpperCase())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid consent status"));
        }
        String username = authentication.getName();

        Consent consent = consentRepository.findByIdAndUsername(id, username)
                .orElse(null);

        if (consent == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Consent not found"));
        }

        consent.setStatus(status.toUpperCase());
        return ResponseEntity.ok(consentRepository.save(consent));
    }
}
