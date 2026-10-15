import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { app } from './app.js';

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hardware_store_db';

async function bootstrap() {
  try {
    console.log(`[API] Connecting to MongoDB Atlas database...`);
    await mongoose.connect(MONGODB_URI);
    console.log(`[API] Connected successfully to MongoDB!`);

    app.listen(PORT, () => {
      console.log(`[API] Hardware Store Management Service running on port ${PORT}`);
      console.log(`[API] Base endpoint: http://localhost:${PORT}/api/v1`);
      console.log(`[API] Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error(`[API] Failed to start server:`, error);
    process.exit(1);
  }
}

bootstrap();
