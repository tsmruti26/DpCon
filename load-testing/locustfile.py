"""Read-heavy, authenticated workload for the DpCon wallet API.

The seed account is created outside Locust's measured request statistics and
deleted after the run. All virtual users share it to avoid triggering the
application's intentional per-IP login/register throttle during a load test.
"""

from __future__ import annotations

import os
import uuid

import requests
from locust import HttpUser, between, events, task


_run_id = uuid.uuid4().hex[:12]
_test_user: dict[str, str] = {}
_password = "LoadTest!" + uuid.uuid4().hex + "Aa1"


@events.test_start.add_listener
def create_test_account(environment, **_kwargs):
    base_url = environment.host or os.getenv("LOCUST_HOST", "http://127.0.0.1:8080")
    username = f"locust_{_run_id}"
    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/api/auth/register",
            json={"username": username, "password": _password},
            timeout=10,
        )
        response.raise_for_status()
        body = response.json()
        token = body.get("token")
        if not token:
            raise RuntimeError("Registration did not return an access token")
        _test_user.update(base_url=base_url, username=username, token=token)
    except Exception as exc:
        environment.runner.quit()
        raise RuntimeError(f"Could not create Locust test account: {exc}") from exc


@events.test_stop.add_listener
def delete_test_account(environment, **_kwargs):
    if not _test_user:
        return
    try:
        response = requests.delete(
            f"{_test_user['base_url'].rstrip('/')}/api/wallet/account",
            headers={"Authorization": f"Bearer {_test_user['token']}"},
            timeout=10,
        )
        if response.status_code not in (204, 404):
            environment.process_exit_code = 1
            print(f"WARNING: test-account cleanup returned HTTP {response.status_code}")
    except requests.RequestException as exc:
        environment.process_exit_code = 1
        print(f"WARNING: could not clean up the Locust test account: {exc}")


class WalletUser(HttpUser):
    wait_time = between(1.0, 3.0)

    def on_start(self):
        if not _test_user:
            self.environment.runner.quit()
            return
        self.client.headers["Authorization"] = f"Bearer {_test_user['token']}"

    @task(8)
    def view_inventory(self):
        self.client.get("/api/wallet/inventory", name="GET /api/wallet/inventory")

    @task(4)
    def view_privacy_score(self):
        self.client.get("/api/wallet/score", name="GET /api/wallet/score")

    @task(1)
    def export_passport(self):
        self.client.get("/api/wallet/passport", name="GET /api/wallet/passport")

    @task(2)
    def add_and_withdraw_share(self):
        with self.client.post(
            "/api/wallet/add",
            name="POST /api/wallet/add",
            json={
                "organization": "Locust Sample Organization",
                "dataItem": "Email address",
                "purpose": "Service delivery",
            },
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"create share returned HTTP {response.status_code}")
                return
            try:
                consent_id = response.json()["id"]
            except (ValueError, KeyError, TypeError):
                response.failure("create share response did not contain an id")
                return
            response.success()

        self.client.post(
            f"/api/wallet/withdraw/{consent_id}",
            name="POST /api/wallet/withdraw/[id]",
        )
