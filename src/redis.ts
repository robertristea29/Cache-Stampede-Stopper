import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

// Connect to the Redis container running in Docker
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => console.log('Redis Layer: Connected ⚡'));
redis.on('error', (err) => console.error('Redis Error:', err));

export default redis;