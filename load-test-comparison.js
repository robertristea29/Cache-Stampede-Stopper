/**
 * k6 Load Test: Write-Behind vs Write-Through Comparison
 * Run: k6 run load-test-comparison.js
 * Measures throughput, response time, and error rate under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const writeBehindRate = new Rate('wb_success_rate');
const writeThroughRate = new Rate('wt_success_rate');
const writeBehindDuration = new Trend('wb_duration');
const writeThroughDuration = new Trend('wt_duration');

// Test configuration
const BASE_URL = 'http://localhost:3000';
let matchScore = { home: 0, away: 0 };

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp up: 0 to 10 users over 10s
    { duration: '20s', target: 50 },  // Ramp up: 10 to 50 users over 20s
    { duration: '30s', target: 50 },  // Stay at 50 users for 30s
    { duration: '10s', target: 0 },   // Ramp down: 50 to 0 users over 10s
  ],
  thresholds: {
    wb_duration: ['p(95)<100', 'p(99)<200'],    // Write-Behind: 95th % < 100ms, 99th % < 200ms
    wt_duration: ['p(95)<500', 'p(99)<1000'],   // Write-Through: 95th % < 500ms, 99th % < 1000ms
  },
};

/**
 * Test Write-Behind endpoint under load
 */
function testWriteBehind() {
  const payload = JSON.stringify({
    score_home: matchScore.home++,
    score_away: matchScore.away,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(
    `${BASE_URL}/matches/1/goal`,
    payload,
    params
  );

  const isSuccess = check(response, {
    'Write-Behind status 200': (r) => r.status === 200,
  });

  writeBehindRate.add(isSuccess);
  writeBehindDuration.add(response.timings.duration);
  
  sleep(0.1);
}

/**
 * Test Write-Through endpoint under load
 */
function testWriteThrough() {
  const payload = JSON.stringify({
    score_home: matchScore.home++,
    score_away: matchScore.away,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(
    `${BASE_URL}/matches/1/goal/write-through`,
    payload,
    params
  );

  const isSuccess = check(response, {
    'Write-Through status 200': (r) => r.status === 200,
  });

  writeThroughRate.add(isSuccess);
  writeThroughDuration.add(response.timings.duration);
  
  sleep(0.1);
}

/**
 * Main test function - runs scenarios
 */
export default function () {
  // 50% of traffic goes to Write-Behind
  if (Math.random() < 0.5) {
    testWriteBehind();
  }
  // 50% of traffic goes to Write-Through
  else {
    testWriteThrough();
  }
}

/**
 * Runs after test completes - summary of results
 */
export function handleSummary(data) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 LOAD TEST RESULTS: Write-Behind vs Write-Through');
  console.log('='.repeat(70));
  
  const wbMetrics = data.metrics.wb_duration;
  const wtMetrics = data.metrics.wt_duration;
  
  if (wbMetrics && wtMetrics && wbMetrics.values && wtMetrics.values) {
    const wb = wbMetrics.values;
    const wt = wtMetrics.values;
    
    console.log('\n🟢 Write-Behind (Async Queue):');
    console.log(`   Average: ${(wb.avg || 0).toFixed(2)}ms`);
    console.log(`   P95:     ${(wb['p(95)'] || 0).toFixed(2)}ms`);
    console.log(`   P99:     ${(wb['p(99)'] || 0).toFixed(2)}ms`);
    console.log(`   Max:     ${(wb.max || 0).toFixed(2)}ms`);
    
    console.log('\n🔴 Write-Through (Sync DB):');
    console.log(`   Average: ${(wt.avg || 0).toFixed(2)}ms`);
    console.log(`   P95:     ${(wt['p(95)'] || 0).toFixed(2)}ms`);
    console.log(`   P99:     ${(wt['p(99)'] || 0).toFixed(2)}ms`);
    console.log(`   Max:     ${(wt.max || 0).toFixed(2)}ms`);
    
    const speedDiff = wt.avg / wb.avg;
    console.log(`\n💡 Write-Through is ${speedDiff.toFixed(1)}x slower due to DB waits`);
  } else {
    console.log('\n⚠️  Could not retrieve detailed metrics');
  }
  
  console.log('='.repeat(70) + '\n');
  
  return {
    'stdout': data.metrics,
  };
}
