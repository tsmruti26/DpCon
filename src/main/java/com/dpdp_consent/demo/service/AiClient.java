package com.dpdp_consent.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpStatusCodeException;
import java.util.Map;
import java.util.HashMap;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AiClient {
    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;
    private final String serviceToken;
    private final ObjectMapper objectMapper;

    public AiClient(@Value("${ai.service.url}") String aiServiceUrl,
                   @Value("${ai.service.token}") String serviceToken,
                   ObjectMapper objectMapper) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(40));
        this.restTemplate = new RestTemplate(requestFactory);
        this.aiServiceUrl = aiServiceUrl;
        this.serviceToken = serviceToken;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> analyzePolicy(String policyText) {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("text", policyText);
            Map<?, ?> response = restTemplate.postForObject(aiServiceUrl + "/analyze", internalRequest(request), Map.class);
            if (response == null) throw new IllegalStateException("AI service returned an empty response");
            Map<String, Object> result = new HashMap<>();
            response.forEach((key, value) -> result.put(String.valueOf(key), value));
            return result;
        } catch (Exception e) {
            log.error("AI analysis request to {} failed: {}: {}", aiServiceUrl, e.getClass().getSimpleName(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI service is unavailable", e);
        }
    }

    public String fetchPolicyText(String url) {
        try {
            Map<?, ?> response = restTemplate.postForObject(aiServiceUrl + "/crawl", internalRequest(Map.of("url", url)), Map.class);
            if (response == null || !(response.get("text") instanceof String text) || text.isBlank()) {
                throw new IllegalStateException("AI service returned no policy text");
            }
            return text;
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            if (status == 400 || status == 413 || status == 415 || status == 422 || status == 504) {
                throw new ResponseStatusException(e.getStatusCode(), "Policy URL could not be processed");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not fetch policy URL");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not fetch policy URL", e);
        }
    }

    private HttpEntity<byte[]> internalRequest(Map<String, ?> body) throws JsonProcessingException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(serviceToken);
        byte[] json = objectMapper.writeValueAsBytes(body);
        headers.setContentLength(json.length);
        return new HttpEntity<>(json, headers);
    }
}
