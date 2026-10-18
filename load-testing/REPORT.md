# DpCon local scalability report

**Run date:** 2026-10-18  
**Target:** local Spring Boot API at `http://127.0.0.1:8080` using the local H2 file database  
**Workload:** authenticated wallet reads plus occasional consent create/withdraw; 1–3 seconds of user think time; each profile ran for two minutes total, including ramp-up  
**Account handling:** Locust created one disposable account outside the measured statistics and attempted to delete it after each run.  

## Results

| Concurrent users | Requests | Failures | Throughput | Mean response | P95 | Max |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 1,287 | 0 (0%) | 10.80 req/s | 10.00 ms | 22 ms | 79 ms |
| 40 | 2,564 | 0 (0%) | 21.57 req/s | 10.14 ms | 16 ms | 57 ms |
| 80 | 4,933 | 0 (0%) | 41.51 req/s | 11.14 ms | 21 ms | 52 ms |

The observed throughput scaled close to linearly across these three local profiles. Response times stayed low and no
HTTP errors or Locust exceptions were recorded. These figures describe this machine and this workload; they are not a
production capacity guarantee.

## Coverage and limits

- About 53% of wallet actions read the inventory, 27% read the privacy score, 7% export a passport, and 13% create a
  share followed by a withdrawal.
- All virtual users share one test account to avoid measuring the app's deliberate per-IP login throttle as API
  capacity. Credential throughput and simultaneous account isolation were not measured.
- AI policy analysis and external Groq latency were excluded. No CPU, memory, or database saturation metrics were
  collected.
- Account cleanup removes consent rows, but shared catalog rows (organization, data item, and purpose) may remain in
  the local H2 database.

## Reproduce

Install the pinned tool and start the application with `..\start-local.ps1` first:

```powershell
python -m pip install -r .\load-testing\requirements.txt
python -m locust -f .\load-testing\locustfile.py --headless `
  -H http://127.0.0.1:8080 -u 80 -r 4 -t 2m `
  --csv .\load-testing\results\wallet-80-users `
  --html .\load-testing\results\wallet-80-users.html --stop-timeout 10
```

The detailed CSV and HTML reports are under the Git-ignored `load-testing/results/` directory.
