/**
 * Test Scenarios for Write-Behind Write Strategy
 * Use this file to easily test different score update patterns
 */

const BASE_URL = 'http://localhost:3000';
let currentScore = { home: 0, away: 0 }; // Track current score

interface ScoreUpdate {
  matchId: number;
  score_home: number;
  score_away: number;
}

/**
 * Fetch current score from API (Redis cache)
 * This ensures each test starts with the actual current state
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

async function sendGoal(matchId: number, score_home: number, score_away: number): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/goal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ score_home, score_away }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        `✅ Goal sent - Match ${matchId}: ${score_home}-${score_away} at ${new Date().toLocaleTimeString()}`
      );
      currentScore = { home: score_home, away: score_away };
    } else {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('❌ Error:', err);
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
  
  // Fetch current state from cache
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
  
  // Fetch current state from cache
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
 * SCENARIO 3: Reset Match (0-0 and Clear Redis Cache)
 * Resets the score to 0-0 and clears match history from Redis
 */
async function scenario_resetMatch(): Promise<void> {
  console.log('\n🎯 SCENARIO 3: Reset Match (0-0 + Clear History)\n');
  
  // Reset score
  await sendGoal(1, 0, 0);
  console.log('🔄 Score reset to 0-0\n');
  
  // Note: Queue messages remain for database consistency
  // But you can clear them manually in Redis if needed
  console.log('💾 Match reset complete. Message queue preserved for database sync.\n');
}

/**
 * SCENARIO 4: Rapid Fire Goals (Simulate Viral Traffic)
 * Simulates quick succession of goals
 */
async function scenario_rapidFireGoals(): Promise<void> {
  console.log('\n🎯 SCENARIO 4: Rapid Fire Goals (Viral Traffic Spike)\n');
  
  // Fetch current state from cache
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  let score_home = current.home;
  let score_away = current.away;
  
  for (let i = 0; i < 5; i++) {
    score_home++;
    console.log(`Goal ${i + 1} - Home Team scores! ${score_home}-${score_away}`);
    await sendGoal(1, score_home, score_away);
    await sleep(100);
  }
  console.log('🚀 5 rapid goals sent! Check Redis queue size.\n');
}

/**
 * SCENARIO 5: Back and Forth Match
 * Both teams scoring alternately
 */
async function scenario_backAndForth(): Promise<void> {
  console.log('\n🎯 SCENARIO 5: Back and Forth Match (Teams Alternating Goals)\n');
  
  // Fetch current state from cache
  const current = await getCurrentScore();
  if (!current) {
    console.error('❌ Could not fetch current score');
    return;
  }
  
  let score_home = current.home;
  let score_away = current.away;
  
  // Home team scores
  score_home++;
  console.log(`🏠 Home scores! ${score_home}-${score_away}`);
  await sendGoal(1, score_home, score_away);
  await sleep(300);
  
  // Away team scores
  score_away++;
  console.log(`✈️  Away scores! ${score_home}-${score_away}`);
  await sendGoal(1, score_home, score_away);
  await sleep(300);
  
  // Home team scores again
  score_home++;
  console.log(`🏠 Home scores again! ${score_home}-${score_away}`);
  await sendGoal(1, score_home, score_away);
  
  console.log(`\n⚽ Match update: Final score: ${score_home}-${score_away}\n`);
}

/**
 * Main menu - Choose which scenario to run
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioNumber = args[0];

  console.log('🏟️  Football Score API - Test Scenarios\n');
  console.log('📊 Realistic Match Simulation\n');

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
      console.log('❓ Usage: npm run test:<scenario>\n');
      console.log('Available scenarios:');
      console.log('  1 - Home Team Scores 1 Goal');
      console.log('  2 - Away Team Scores 1 Goal');
      console.log('  3 - Reset Match (0-0 + Clear History)');
      console.log('  4 - Rapid Fire Goals (5 goals quick succession)');
      console.log('  5 - Back and Forth Match (Teams alternating)\n');
      console.log('Examples:');
      console.log('  npm run test:home       # Home team scores');
      console.log('  npm run test:away       # Away team scores');
      console.log('  npm run test:reset      # Reset to 0-0\n');
  }
}

main().catch(console.error);
