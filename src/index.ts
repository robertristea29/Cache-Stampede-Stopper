import express, { Request, Response } from 'express';
import { query } from './db';
import redis from './redis';
import dotenv from 'dotenv';
import { ScoreUpdateMessage, serializeMessage } from './types/messages';

dotenv.config();

const app = express();

// Debug middleware to log raw body
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('Raw headers:', req.headers);
  }
  next();
});

app.use(express.json());

const port = process.env.PORT || 3000;

console.log('Server is starting... 🚀');

const CACHE_TTL = 30; 
const LOCK_TTL = 5000; // Fixed: 5 seconds safety 
const RETRY_DELAY = 50; 

// 1. DEFINE THE ROUTE FIRST
app.get('/matches/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `match:${id}`;
  const lockKey = `lock:match:${id}`;
  
  console.log(`Request for Match ${id} received. Checking cache... 🔍`);

  const fetchMatchData = async (): Promise<any> => {
    // Check Redis "Hot Layer" [cite: 13, 14]
    const cachedMatch = await redis.get(cacheKey);

    if (cachedMatch) {
      console.log(`Cache Hit for Match ${id}! 🚀`);
      return JSON.parse(cachedMatch);
    }

    console.log(`Cache Miss for Match ${id}. Attempting to acquire lock... 🕵️‍♂️`);
    
    // Acquire Mutex Lock (SET NX) to prevent Cache Stampede [cite: 21, 141, 153]
    const lockAcquired = await redis.set(lockKey, 'locked', 'PX', LOCK_TTL, 'NX');

    if (lockAcquired === 'OK') {
      console.log(`[Lock Acquired] Fetching Match ${id} from DB... 🐢`);
      try {
        // Query PostgreSQL "Source of Truth" [cite: 16]
        const result = await query('SELECT * FROM matches WHERE id = $1', [id]);

        if (result.rows.length === 0) {
          await redis.del(lockKey);
          return null;
        }

        const match = result.rows[0];
        //Cache is update by the user in this line
        await redis.set(cacheKey, JSON.stringify(match), 'EX', CACHE_TTL);
        await redis.del(lockKey); // Release lock [cite: 157]
        
        return match;
      } catch (err) {
        await redis.del(lockKey); // Recoverability safety [cite: 60]
        throw err;
      }
    } else {
      // Wait and retry if stampede is happening [cite: 154, 155]
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchMatchData(); 
    }
  };

  try {
    const match = await fetchMatchData();
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/matches/:id/goal', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { score_home, score_away } = req.body;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Match ID is required' });
  }

  if (typeof score_home !== 'number' || typeof score_away !== 'number') {
    return res.status(400).json({ error: 'score_home and score_away must be numbers' });
  }

  const matchId = parseInt(id, 10);
  if (isNaN(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  const cacheKey = `match:${matchId}`;

  try {
    // Fetch the FULL match object (from cache or DB)
    let fullMatch: any = null;
    
    const cachedMatch = await redis.get(cacheKey);
    if (cachedMatch) {
      fullMatch = JSON.parse(cachedMatch);
    } else {
      // If not in cache, fetch from database
      const result = await query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }
      fullMatch = result.rows[0];
    }

    // Update only the score fields
    fullMatch.score_home = score_home;
    fullMatch.score_away = score_away;
    fullMatch.last_updated = new Date().toISOString();

    // Cache the FULL updated match object
    await redis.set(cacheKey, JSON.stringify(fullMatch), 'EX', CACHE_TTL);

    // Queue message for async database update
    const message: ScoreUpdateMessage = {
      matchId,
      score_home,
      score_away,
      timestamp: Date.now(),
    };
    // Queue message for background worker
    await redis.lpush('score_updates', serializeMessage(message));

    console.log(`Goal recorded! Match ${matchId}: ${score_home}-${score_away}. Message queued for async processing.`);

    res.json({
      success: true,
      message: 'Goal recorded and queued for database update',
      data: fullMatch,
    });
  } catch (err) {
    console.error('Error recording goal:', err);
    res.status(500).json({ error: 'Failed to record goal' });
  }
});

// Write-Through Endpoint: Sync database update THEN cache update
app.post('/matches/:id/goal/write-through', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { score_home, score_away } = req.body;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Match ID is required' });
  }

  if (typeof score_home !== 'number' || typeof score_away !== 'number') {
    return res.status(400).json({ error: 'score_home and score_away must be numbers' });
  }

  const matchId = parseInt(id, 10);
  if (isNaN(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  const cacheKey = `match:${matchId}`;

  try {
    // Fetch full match from cache or DB
    let fullMatch: any = null;
    
    const cachedMatch = await redis.get(cacheKey);
    if (cachedMatch) {
      fullMatch = JSON.parse(cachedMatch);
    } else {
      const result = await query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Match not found' });
      }
      fullMatch = result.rows[0];
    }

    // Update score fields
    fullMatch.score_home = score_home;
    fullMatch.score_away = score_away;
    fullMatch.last_updated = new Date().toISOString();

    // STEP 1: Update database FIRST (Write-Through strategy)
    await query(
      'UPDATE matches SET score_home = $1, score_away = $2, last_updated = NOW() WHERE id = $3',
      [score_home, score_away, matchId]
    );

    // STEP 2: Update cache AFTER database confirms
    await redis.set(cacheKey, JSON.stringify(fullMatch), 'EX', CACHE_TTL);

    console.log(`Goal recorded (Write-Through)! Match ${matchId}: ${score_home}-${score_away}. Database updated immediately.`);

    res.json({
      success: true,
      message: 'Goal recorded and database updated',
      data: fullMatch,
    });
  } catch (err) {
    console.error('Error recording goal (Write-Through):', err);
    res.status(500).json({ error: 'Failed to record goal' });
  }
});

// 2. START THE LISTENER LAST
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});