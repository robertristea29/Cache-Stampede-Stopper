import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load the variables from your .env file
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// A helper function to run queries
export const query = (text: string, params?: any[]) => pool.query(text, params);


/* 1. The Connection: .env → db.ts
The .env file: This is a "Secret Vault." It stores sensitive data like your database password.
 You never want to hardcode these into your main code because if you share your code,
  everyone would see your passwords.

dotenv.config(): This command reads your .env file and temporarily injects those values into your
 computer's memory while the app is running.

process.env.DATABASE_URL: This is how TypeScript reaches into that memory and grabs the
 connection string to tell the pg library exactly where the database lives.




2. How the Database is Structured
Your database follows a Relational Structure.

The Container: You have a "Database Server" (the Postgres container).

The Database: Inside that server, you created a specific database named football_db.

The Table: Inside football_db, you created a table called matches. 
This table acts like a structured spreadsheet where every column (id, teams, score)
 has a specific data type that must be followed.



 3. How it Works in Your Environment
When you run your future API, the flow looks like this:

User Request: Someone asks for a match.

Node.js App: Your code in src wakes up.

The "Pool": db.ts opens a "pipe" (connection) to your Docker container.

The Query: Your app sends an SQL command through that pipe.

Docker: The Postgres container processes the SQL and sends back the data (Ajax vs PSV).

Response: Your app sends that data back to the user.
*/