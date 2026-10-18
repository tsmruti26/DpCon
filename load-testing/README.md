# DpCon scalability workload

`locustfile.py` simulates authenticated users browsing a wallet: inventory and
score reads are common, passport exports are occasional, and a small share of
activity creates then withdraws a consent. Users pause for 1–3 seconds between
actions. A dedicated test account is created before measurement and removed
after the run.

From the repository root, start the app with `.\start-local.ps1`, then run:

```powershell
python -m locust -f .\load-testing\locustfile.py --headless `
  -H http://127.0.0.1:8080 -u 20 -r 2 -t 2m `
  --csv .\load-testing\results\wallet-20-users `
  --html .\load-testing\results\wallet-20-users.html
```

This starts 20 users at 2 users per second for two minutes. The workload uses
one test account so it measures wallet/API and database throughput without
mistaking the app's per-IP sign-in throttle for API capacity. It writes test
consents and deletes the test user's account at shutdown. Reference catalog
rows may remain in the local H2 file database.

To scale gradually, repeat with `-u 40 -r 2 -t 2m`, then `-u 80 -r 4 -t 2m`.
Run one level at a time and compare the CSV/HTML response-time percentiles,
failure rate, and requests per second. Do not target a public/production host
without explicit authorization.
