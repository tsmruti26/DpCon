package com.dpdp_consent.demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:dpcon-api-tests;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.secret=test-only-secret-with-at-least-32-random-bytes",
        "ai.service.token=test-only-ai-service-token"
})
@AutoConfigureMockMvc
class WalletApiIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;

    @Test
    void registrationLoginAndWalletLifecycleWorkEndToEnd() throws Exception {
        String username = "test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String password = "Strong-Test-Password-42!";

        String registerBody = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new Credentials(username, password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(registerBody).get("token").asText();

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new Credentials(username, password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.token").isNotEmpty());

        mvc.perform(get("/api/wallet/inventory"))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/wallet/inventory").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(0)));

        String consentBody = "{\"organization\":\"Example Org\",\"dataItem\":\"Email\",\"purpose\":\"Account updates\"}";
        String saved = mvc.perform(post("/api/wallet/add").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(consentBody))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"))
                .andReturn().getResponse().getContentAsString();
        JsonNode consent = objectMapper.readTree(saved);
        long consentId = consent.get("id").asLong();

        mvc.perform(get("/api/wallet/score").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(100));
        mvc.perform(post("/api/wallet/withdraw/" + consentId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(get("/api/wallet/inventory").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("WITHDRAWN"));
    }

    @Test
    void registrationRejectsWeakPasswordsAndWalletRejectsMissingFields() throws Exception {
        String username = "test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new Credentials(username, "short"))))
                .andExpect(status().isBadRequest());

        String validUser = username + "x";
        String response = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new Credentials(validUser, "Strong-Test-Password-42!"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(response).get("token").asText();
        mvc.perform(post("/api/wallet/add").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selectedPolicyFindingsCanBeImportedAsWalletShares() throws Exception {
        String username = "bulk_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String response = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new Credentials(username, "Strong-Test-Password-42!"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(response).get("token").asText();
        String passport = """
                {"format":"DpCon Passport","version":1,"consents":[
                  {"organization":"Policy Demo Co","dataItem":"Email address","purpose":"Service delivery","status":"APPROVED"},
                  {"organization":"Policy Demo Co","dataItem":"Email address","purpose":"Analytics","status":"APPROVED"}
                ]}
                """;

        mvc.perform(post("/api/wallet/passport").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(passport))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(2));
        mvc.perform(get("/api/wallet/inventory").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$[0].organization.name").value("Policy Demo Co"))
                .andExpect(jsonPath("$[1].status").value("APPROVED"));
    }

    private record Credentials(String username, String password) {}
}
