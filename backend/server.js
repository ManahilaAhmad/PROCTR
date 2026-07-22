import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'PROCTR Backend Server is healthy and running.',
  });
});

// Database connectivity check endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'success',
      message: 'Successfully queried PostgreSQL/Neon Database.',
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Neon PostgreSQL.',
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`PROCTR Backend Server is listening on port ${PORT}`);
});
