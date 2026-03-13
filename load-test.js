import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 500,    // Lowering to 200 VUs ensures your OS can handle the sockets
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/matches/1');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Increasing sleep to 0.5s simulates fans who aren't clicking 10 times a second
  sleep(0.5); 
}

/* 2. Understanding the Mutex (Locking) Logic
In a Redis environment, we use a distributed lock to act as a "Gatekeeper."
The Problem: Without a lock, when the cache expires, 100 requests see a
 "Miss" and all 100 try to query PostgreSQL. 
 
 The Solution (SET NX): We use the Redis command SET key value NX PX 5000.
 NX (Not eXists): Only sets the key if it doesn't already exist. 
 PX (Expiry): Automatically deletes the lock after 5 seconds (safety against a crashed worker).
 
 The Result: The first request "grabs the lock." The other 99 requests fail to grab
  it and must either wait/retry or return a slightly stale value if available.*/

