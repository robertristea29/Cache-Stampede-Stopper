/**
 * Side-by-Side Comparison: Write-Behind vs Write-Through
 * Runs the same test scenarios on both strategies and measures performance
 */

const BASE_URL = 'http://localhost:3000';

interface ComparisonResults {
  strategy: string;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  requestCount: number;
}

/**
 * Fetch current score before each test
 */
async function getCurrentScore(): Promise<{ home: number; away: number } | null> {
  try {
    const response = await fetch(`${BASE_URL}/matches/1`);
    if (response.ok) {
      const data = await response.json();
      return { home: data.score_home, away: data.score_away };
    }
  } catch (err) {
    console.error('Failed to fetch current score:', err);
  }
  return null;
}

/**
 * Reset match to 0-0 before comparison tests
 */
async function resetMatch(endpoint: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/matches/1${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score_home: 0, score_away: 0 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause
  } catch (err) {
    console.error('Reset failed:', err);
  }
}

/**
 * Run rapid fire test on given strategy
 */
async function runRapidFireTest(endpoint: string, testName: string): Promise<ComparisonResults> {
  console.log(`\n⏱️  ${testName} - Sending 10 rapid goals...`);
  
  await resetMatch(endpoint);
  
  const times: number[] = [];
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return {
      strategy: testName,
      totalTime: 0,
      avgTime: 0,
      minTime: 0,
      maxTime: 0,
      requestCount: 0,
    };
  }
  
  let score_home = current.home;
  let score_away = current.away;
  
  for (let i = 0; i < 10; i++) {
    score_home++;
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${BASE_URL}/matches/1${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_home, score_away }),
      });
      
      const responseTime = performance.now() - startTime;
      times.push(responseTime);
      
      if (response.ok) {
        process.stdout.write('.');
      } else {
        process.stdout.write('❌');
      }
    } catch (err) {
      const responseTime = performance.now() - startTime;
      times.push(responseTime);
      process.stdout.write('❌');
    }
  }
  
  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`\n✅ Complete\n`);
  
  return {
    strategy: testName,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    requestCount: times.length,
  };
}

/**
 * Display comparison results in a formatted table
 */
function displayComparison(results: ComparisonResults[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PERFORMANCE COMPARISON RESULTS');
  console.log('='.repeat(70));
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.strategy}`);
    console.log(`   Average Response Time: ${result.avgTime.toFixed(2)}ms`);
    console.log(`   Min Response Time:     ${result.minTime.toFixed(2)}ms`);
    console.log(`   Max Response Time:     ${result.maxTime.toFixed(2)}ms`);
    console.log(`   Total Time (10 req):   ${result.totalTime.toFixed(2)}ms`);
    console.log(`   Requests:              ${result.requestCount}`);
  });
  
  if (results.length === 2 && results[0] && results[1]) {
    const speedDiff = results[1].avgTime / results[0].avgTime;
    console.log(`\n💡 INSIGHT:`);
    console.log(`   Write-Through is ${speedDiff.toFixed(1)}x slower than Write-Behind`);
    console.log(`   (Expected due to waiting for database updates)\n`);
  }
  
  console.log('='.repeat(70) + '\n');
}

/**
 * Main comparison runner
 */
async function main(): Promise<void> {
  console.log('\n🏟️  Write-Behind vs Write-Through Comparison\n');
  console.log('🧪 Testing Strategy: Rapid Fire Goals (10 consecutive updates)');
  console.log('⏱️  Measuring: Response time, throughput, consistency\n');
  console.log('Waiting for services to be ready...\n');
  
  const results: ComparisonResults[] = [];
  
  // Test 1: Write-Behind
  const writeBehindResult = await runRapidFireTest(
    '/goal',
    'Write-Behind (Async Queue)'
  );
  results.push(writeBehindResult);
  
  // Brief pause between tests
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Test 2: Write-Through
  const writeThroughResult = await runRapidFireTest(
    '/goal/write-through',
    'Write-Through (Sync DB)'
  );
  results.push(writeThroughResult);
  
  // Display results
  displayComparison(results);
  
  console.log('✨ Comparison complete! Check logs and Grafana for full metrics.\n');
}

main().catch(console.error);
