/**
 * WORKER PROCESS - Write-Behind Asynchronous Database Updater
 * 
 * This worker runs independently in the background and consumes messages
 * from the Redis queue to update the PostgreSQL database.
 * 
 * Flow:
 * 1. Waits for messages in score_updates queue using BRPOP
 * 2. When a message arrives, parses the JSON
 * 3. Executes UPDATE query on PostgreSQL
 * 4. Loops back to waiting
 * 
 * Run with: npm run worker
 */

import redis from './redis';
import { query } from './db';
import dotenv from 'dotenv';
import { ScoreUpdateMessage } from './types/messages';

dotenv.config();

const BRPOP_TIMEOUT = 5; // seconds - how long to wait for messages
const QUEUE_NAME = 'score_updates'; // Redis list key

/**
 * Parse and validate message from queue
 */
function parseMessage(data: string): ScoreUpdateMessage | null {
  try {
    const parsed = JSON.parse(data);
    
    // Validate required fields
    if (
      typeof parsed.matchId !== 'number' ||
      typeof parsed.score_home !== 'number' ||
      typeof parsed.score_away !== 'number' ||
      typeof parsed.timestamp !== 'number'
    ) {
      console.error('❌ Invalid message format:', parsed);
      return null;
    }
    
    return parsed as ScoreUpdateMessage;
  } catch (err) {
    console.error('❌ Failed to parse JSON:', err);
    return null;
  }
}

/**
 * Update database with new score
 */
async function updateMatchScore(message: ScoreUpdateMessage): Promise<boolean> {
  try {
    const { matchId, score_home, score_away } = message;
    
    const result = await query(
      'UPDATE matches SET score_home = $1, score_away = $2, last_updated = NOW() WHERE id = $3 RETURNING *',
      [score_home, score_away, matchId]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️  Match ${matchId} not found in database`);
      return false;
    }

    const updatedMatch = result.rows[0];
    console.log(
      `✅ Database Updated: Match ${matchId} → ${updatedMatch.score_home}-${updatedMatch.score_away}`
    );
    
    return true;
  } catch (err) {
    console.error('❌ Database error:', err);
    return false;
  }
}

/**
 * Main worker loop
 * Uses BRPOP to wait for messages with blocking timeout
 */
async function startWorker(): Promise<void> {
  console.log('🚀 Worker starting...\n');

  try {
    // Test connections
    await redis.ping();
    console.log('✅ Redis connected\n');

    await query('SELECT NOW()');
    console.log('✅ Database connected\n');

    console.log(`📊 Waiting for messages on queue: "${QUEUE_NAME}"\n`);
    console.log(`⏱️  BRPOP timeout: ${BRPOP_TIMEOUT} seconds\n`);
    console.log('─'.repeat(60) + '\n');

    // Main processing loop
    while (true) {
      try {
        // BRPOP: Block and wait for message
        // Waits up to BRPOP_TIMEOUT seconds
        // Returns [key, data] if message arrives, null if timeout
        const message = await redis.brpop(QUEUE_NAME, BRPOP_TIMEOUT);

        if (message) {
          // Message arrived!
          const [key, data] = message;
          
          console.log(`\n📨 Message received from queue:`);
          console.log(`   Data: ${data}\n`);

          // Parse and validate
          const parsed = parseMessage(data);
          
          if (parsed) {
            // Update database
            const success = await updateMatchScore(parsed);
            
            if (success) {
              console.log(`✅ Message processed successfully\n`);
            } else {
              console.warn(`⚠️  Message processed but with warnings\n`);
            }
          } else {
            console.error(`❌ Message invalid, skipped\n`);
          }

          // Continue loop - BRPOP waits again
        } else {
          // Timeout: No message for BRPOP_TIMEOUT seconds
          console.log(`⏳ Waiting for messages... (timeout check at ${new Date().toLocaleTimeString()})`);
          // Loop continues - BRPOP waits again
        }
      } catch (err) {
        console.error('❌ Worker loop error:', err);
        console.log('⚠️  Retrying in 2 seconds...\n');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error('❌ Fatal error - Worker cannot start:', err);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Worker shutting down gracefully...');
  
  try {
    await redis.quit();
    console.log('✅ Redis connection closed');
  } catch (err) {
    console.error('Error closing Redis:', err);
  }
  
  process.exit(0);
});

// Start the worker
startWorker().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
