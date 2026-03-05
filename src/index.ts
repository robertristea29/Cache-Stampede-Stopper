import express, { Request, Response } from 'express';
import { query } from './db';
import redis from './redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/matches/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `match:${id}`;

  try {
    // 1. Try to get data from Redis
    const cachedMatch = await redis.get(cacheKey);

    if (cachedMatch) {
      console.log('Cache Hit! ⚡');
      return res.json(JSON.parse(cachedMatch));
    }

    // 2. If not in cache, query Postgres
    console.log('Cache Miss - Querying DB... 🐢');
    const result = await query('SELECT * FROM matches WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = result.rows[0];

    // 3. Save to Redis for 30 seconds so next time is fast
    await redis.set(cacheKey, JSON.stringify(match), 'EX', 30);

    res.json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});