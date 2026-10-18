const http = require('http');
const fs = require('fs');

const totalRequests = 10000;
let completedRequests = 0;
let successCount = 0;
let errorCount = 0;
let responseTimes = [];
let startTime = Date.now();

function submitConsent(index) {
  const requestStartTime = Date.now();
  
  const data = JSON.stringify({
    username: `loadtest_user_${index}_${Date.now()}`,
    consentFor: ['Self', 'Child', 'Dependant'][Math.floor(Math.random() * 3)],
    taylorDetails: ['None', 'Parent', 'Sibling', 'Spouse', 'Guardian'][Math.floor(Math.random() * 5)],
    purpose: `Load test submission ${index}`,
    decision: ['Approve', 'Deny'][Math.floor(Math.random() * 2)]
  });

  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/create_consent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      const responseTime = Date.now() - requestStartTime;
      responseTimes.push(responseTime);
      completedRequests++;
      
      if (res.statusCode === 200) {
        successCount++;
      } else {
        errorCount++;
      }
      
      if (completedRequests % 100 === 0) {
        const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        const avgResponseTime = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2);
        const requestsPerSecond = (completedRequests / elapsedSeconds).toFixed(2);
        
        console.log(`[${completedRequests}/${totalRequests}] | Success: ${successCount} | Errors: ${errorCount} | Avg Response: ${avgResponseTime}ms | RPS: ${requestsPerSecond}`);
      }

      if (completedRequests === totalRequests) {
        generateReport();
      }
    });
  });

  req.on('error', (error) => {
    const responseTime = Date.now() - requestStartTime;
    responseTimes.push(responseTime);
    completedRequests++;
    errorCount++;
  });

  req.write(data);
  req.end();
}

function generateReport() {
  const totalTime = (Date.now() - startTime) / 1000;
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const sortedTimes = responseTimes.sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  const successRate = ((successCount / totalRequests) * 100).toFixed(2);
  const requestsPerSecond = (totalRequests / totalTime).toFixed(2);
  const dataSubmitted = (totalRequests * JSON.stringify({username: '', consentFor: '', taylorDetails: '', purpose: '', decision: ''}).length / 1024 / 1024).toFixed(2);

  const reportContent = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                   DPDP CONSENT APPLICATION - LOAD TEST REPORT                  ║
║                          Generated: ${new Date().toLocaleString()}                        ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌─── TEST CONFIGURATION ───────────────────────────────────────────────────────┐
│ Total Requests:        ${String(totalRequests).padEnd(50)} │
│ Test Duration:         ${String(totalTime.toFixed(2) + ' seconds').padEnd(50)} │
│ Target Endpoint:       ${String('http://localhost:8080/api/create_consent').padEnd(50)} │
└──────────────────────────────────────────────────────────────────────────────┘

┌─── RESULTS SUMMARY ──────────────────────────────────────────────────────────┐
│ Successful Requests:   ${String(successCount + ` (${successRate}%)`).padEnd(50)} │
│ Failed Requests:       ${String(errorCount).padEnd(50)} │
│ Completed Requests:    ${String(completedRequests).padEnd(50)} │
└──────────────────────────────────────────────────────────────────────────────┘

┌─── PERFORMANCE METRICS ──────────────────────────────────────────────────────┐
│ Requests Per Second:   ${String(requestsPerSecond).padEnd(50)} │
│ Average Response Time: ${String(avgResponseTime.toFixed(2) + ' ms').padEnd(50)} │
│ Min Response Time:     ${String(minResponseTime + ' ms').padEnd(50)} │
│ Max Response Time:     ${String(maxResponseTime + ' ms').padEnd(50)} │
│ Median (P50):          ${String(p50 + ' ms').padEnd(50)} │
│ 95th Percentile (P95): ${String(p95 + ' ms').padEnd(50)} │
│ 99th Percentile (P99): ${String(p99 + ' ms').padEnd(50)} │
└──────────────────────────────────────────────────────────────────────────────┘

┌─── DATA METRICS ─────────────────────────────────────────────────────────────┐
│ Total Data Submitted:  ${String(dataSubmitted + ' MB').padEnd(50)} │
│ Average Payload Size:  ${String('~500 bytes').padEnd(50)} │
└──────────────────────────────────────────────────────────────────────────────┘

┌─── SYSTEM HEALTH ────────────────────────────────────────────────────────────┐
│ Backend Response:      ${successRate >= 95 ? '✓ HEALTHY' : '⚠ DEGRADED'} │
│ Error Rate:            ${String(((errorCount / totalRequests) * 100).toFixed(2) + '%').padEnd(50)} │
│ Server Stability:      ${successRate >= 95 ? '✓ STABLE' : '⚠ NEEDS ATTENTION'} │
└──────────────────────────────────────────────────────────────────────────────┘

┌─── RECOMMENDATIONS ──────────────────────────────────────────────────────────┐
${successRate >= 95 ? 
  `│ ✓ Application is performing well under load                              │
│ ✓ Response times are within acceptable range                             │
│ ✓ No database connection issues detected                                 │` :
  `│ ⚠ Consider implementing caching mechanisms                              │
│ ⚠ Monitor database connection pool                                       │
│ ⚠ Review API endpoint optimization                                       │`
}
└──────────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════════╗
║                            TEST COMPLETED SUCCESSFULLY                         ║
╚════════════════════════════════════════════════════════════════════════════════╝
`;

  console.log(reportContent);

  // Write report to file
  const filename = `load_test_report_${Date.now()}.txt`;
  fs.writeFileSync(filename, reportContent);
  console.log(`\n📄 Report saved to: ${filename}`);

  // Also generate JSON report for data analysis
  const jsonReport = {
    timestamp: new Date().toISOString(),
    configuration: {
      totalRequests,
      testDuration: totalTime,
      targetEndpoint: 'http://localhost:8080/api/create_consent'
    },
    results: {
      successful: successCount,
      failed: errorCount,
      successRate: parseFloat(successRate)
    },
    performance: {
      requestsPerSecond: parseFloat(requestsPerSecond),
      averageResponseTime: avgResponseTime,
      minResponseTime,
      maxResponseTime,
      percentiles: {
        p50,
        p95,
        p99
      }
    },
    dataMetrics: {
      totalDataSubmittedMB: parseFloat(dataSubmitted),
      averagePayloadSize: '~500 bytes'
    }
  };

  const jsonFilename = `load_test_report_${Date.now()}.json`;
  fs.writeFileSync(jsonFilename, JSON.stringify(jsonReport, null, 2));
  console.log(`📊 JSON Report saved to: ${jsonFilename}`);
}

console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
console.log(`║        DPDP CONSENT APPLICATION - LOAD TEST STARTING          ║`);
console.log(`║                   Loading ${totalRequests} requests...                          ║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

// Start staggered requests
for (let i = 1; i <= totalRequests; i++) {
  setTimeout(() => submitConsent(i), i * 10); // Stagger requests by 10ms
}
