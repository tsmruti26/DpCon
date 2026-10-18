import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class AiServiceApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_reports_offline_fallback_mode(self):
        with patch.object(main, "MOCK_MODE", "true"), patch.object(main, "GROQ_API_KEY", ""):
            response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mode"], "mock")

    def test_analysis_requires_internal_bearer_token(self):
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": "test-ai-service-token-with-at-least-32-bytes"}):
            response = self.client.post("/analyze", json={"text": "A sufficiently long privacy policy mentions email and analytics."})
        self.assertEqual(response.status_code, 401)

    def test_mock_analysis_returns_structured_privacy_summary(self):
        token = "test-ai-service-token-with-at-least-32-bytes"
        text = "We collect your email and precise location to provide our services, use analytics, and share data with third parties."
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": token}), patch.object(main, "MOCK_MODE", "true"):
            response = self.client.post("/analyze", headers={"Authorization": f"Bearer {token}"}, json={"text": text})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["source"], "offline_mock")
        self.assertEqual(data["risk_score"], "High")
        self.assertIn("Contact details", data["data_collected"])
        self.assertIn("Service delivery", data["purposes"])

    def test_short_policy_is_rejected(self):
        token = "test-ai-service-token-with-at-least-32-bytes"
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": token}):
            response = self.client.post("/analyze", headers={"Authorization": f"Bearer {token}"}, json={"text": "too short"})
        self.assertEqual(response.status_code, 422)

    def test_crawler_rejects_localhost_before_fetch(self):
        token = "test-ai-service-token-with-at-least-32-bytes"
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": token}):
            response = self.client.post("/crawl", headers={"Authorization": f"Bearer {token}"}, json={"url": "http://localhost/privacy"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
