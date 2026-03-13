import express, { Request, Response } from 'express';
import { query } from './db';
import redis from './redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
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

// 2. START THE LISTENER LAST
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});