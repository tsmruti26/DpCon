package com.dpdp_consent.demo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "jwt.secret=test-only-secret-with-at-least-32-random-bytes",
    "ai.service.token=test-only-ai-service-token"
})
class DemoApplicationTests {

    @Test
    void contextLoads() {
    }
}
