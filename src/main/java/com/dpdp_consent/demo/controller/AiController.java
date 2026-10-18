package com.dpdp_consent.demo.controller;

import com.dpdp_consent.demo.service.AiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @Autowired
    private AiClient aiClient;

    @PostMapping("/analyze-policy")
    public ResponseEntity<?> analyze(@RequestBody Map<String, String> request) {
        if (request == null) return ResponseEntity.badRequest().body(Map.of("error", "Policy text is required"));
        String policyText = request.get("text");

        if (policyText == null || policyText.trim().length() < 30 || policyText.length() > 100_000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Policy text must contain 30 to 100,000 characters"));
        }

        Map<String, Object> result = aiClient.analyzePolicy(policyText);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/analyze-url")
    public ResponseEntity<?> analyzeUrl(@RequestBody Map<String, String> request) {
        if (request == null) return ResponseEntity.badRequest().body(Map.of("error", "Policy URL is required"));
        String url = request.get("url");
        if (url == null || url.isBlank() || url.length() > 2048) {
            return ResponseEntity.badRequest().body(Map.of("error", "Policy URL is required"));
        }
        String text = aiClient.fetchPolicyText(url);
        Map<String, Object> result = new java.util.HashMap<>(aiClient.analyzePolicy(text));
        result.put("url", url);
        result.put("characters_analyzed", text.length());
        return ResponseEntity.ok(result);
    }
}
