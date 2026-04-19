/**
 * Test Scenarios for Write-Through Write Strategy
 * Same scenarios as Write-Behind, but tests the /goal/write-through endpoint
 * Measures response times to show the performance difference
 */

const BASE_URL = 'http://localhost:3000';
const ENDPOINT = '/matches/:id/goal/write-through'; // Write-Through endpoint

interface ScoreUpdate {
  matchId: number;
  score_home: number;
  score_away: number;
}

/**
 * Fetch current score from API (Redis cache)
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
 * Send goal to Write-Through endpoint and measure response time
 */
async function sendGoal(matchId: number, score_home: number, score_away: number): Promise<number> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/goal/write-through`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ score_home, score_away }),
    });

    const responseTime = performance.now() - startTime;

    if (response.ok) {
      console.log(
        `✅ Goal sent - Match ${matchId}: ${score_home}-${score_away} (${responseTime.toFixed(2)}ms)`
      );
      return responseTime;
    } else {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      return responseTime;
    }
  } catch (err) {
    const responseTime = performance.now() - startTime;
    console.error('❌ Error:', err);
    return responseTime;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * SCENARIO 1: Home Team Scores 1 Goal
 */
async function scenario_homeTeamScores(): Promise<void> {
  console.log('\n🎯 SCENARIO 1: Home Team Scores 1 Goal\n');
  
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  const newScore = { home: current.home + 1, away: current.away };
  console.log(`⚽ Home Team Goal! ${current.home}-${current.away} → ${newScore.home}-${newScore.away}\n`);
  await sendGoal(1, newScore.home, newScore.away);
}

/**
 * SCENARIO 2: Away Team Scores 1 Goal
 */
async function scenario_awayTeamScores(): Promise<void> {
  console.log('\n🎯 SCENARIO 2: Away Team Scores 1 Goal\n');
  
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  const newScore = { home: current.home, away: current.away + 1 };
  console.log(`⚽ Away Team Goal! ${current.home}-${current.away} → ${newScore.home}-${newScore.away}\n`);
  await sendGoal(1, newScore.home, newScore.away);
}

/**
 * SCENARIO 3: Reset Match (0-0)
 */
async function scenario_resetMatch(): Promise<void> {
  console.log('\n🎯 SCENARIO 3: Reset Match (0-0)\n');
  
  await sendGoal(1, 0, 0);
  console.log('🔄 Score reset to 0-0\n');
}

/**
 * SCENARIO 4: Rapid Fire Goals
 * Note: Write-Through will be slower due to waiting for DB updates
 */
async function scenario_rapidFireGoals(): Promise<void> {
  console.log('\n🎯 SCENARIO 4: Rapid Fire Goals (5 goals)\n');
  
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  let score_home = current.home;
  let score_away = current.away;
  let totalTime = 0;
  
  for (let i = 0; i < 5; i++) {
    score_home++;
    console.log(`Goal ${i + 1}/5`);
    const responseTime = await sendGoal(1, score_home, score_away);
    totalTime += responseTime;
    await sleep(100);
  }
  
  const avgTime = totalTime / 5;
  console.log(`\n📊 Average response time: ${avgTime.toFixed(2)}ms\n`);
}

/**
 * SCENARIO 5: Back and Forth Match
 */
async function scenario_backAndForth(): Promise<void> {
  console.log('\n🎯 SCENARIO 5: Back and Forth Match (Teams Alternating)\n');
  
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  let score_home = current.home;
  let score_away = current.away;
  let totalTime = 0;
  
  console.log(`🏠 Home scores!`);
  score_home++;
  totalTime += await sendGoal(1, score_home, score_away);
  await sleep(300);
  
  console.log(`✈️  Away scores!`);
  score_away++;
  totalTime += await sendGoal(1, score_home, score_away);
  await sleep(300);
  
  console.log(`🏠 Home scores again!`);
  score_home++;
  totalTime += await sendGoal(1, score_home, score_away);
  
  const avgTime = totalTime / 3;
  console.log(`\n📊 Average response time: ${avgTime.toFixed(2)}ms`);
  console.log(`⚽ Final score: ${score_home}-${score_away}\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioNumber = args[0];

  console.log('🏟️  Football Score API - Write-Through Test Scenarios\n');
  console.log('📊 Testing Synchronous Database Updates\n');

  switch (scenarioNumber) {
    case '1':
      await scenario_homeTeamScores();
      break;
    case '2':
      await scenario_awayTeamScores();
      break;
    case '3':
      await scenario_resetMatch();
      break;
    case '4':
      await scenario_rapidFireGoals();
      break;
    case '5':
      await scenario_backAndForth();
      break;
    default:
      console.log('❓ Usage: npm run test:wt-<scenario>\n');
      console.log('Available scenarios:');
      console.log('  1 - Home Team Scores 1 Goal');
      console.log('  2 - Away Team Scores 1 Goal');
      console.log('  3 - Reset Match (0-0)');
      console.log('  4 - Rapid Fire Goals (5 goals quick succession)');
      console.log('  5 - Back and Forth Match (Teams alternating)\n');
      console.log('Examples:');
      console.log('  npm run test:wt-home       # Home team scores');
      console.log('  npm run test:wt-away       # Away team scores');
      console.log('  npm run test:wt-reset      # Reset to 0-0');
      console.log('  npm run test:wt-rapid-fire # 5 rapid goals');
      console.log('  npm run test:wt-backforth  # Teams alternating\n');
      break;
  }
}

main().catch(console.error);
