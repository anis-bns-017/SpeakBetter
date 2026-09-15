// server/src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    const config = app.get(ConfigService);

    app.use(cookieParser());

    // ✅ Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads', 'audio');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
      logger.log(`📁 Created uploads directory: ${uploadsDir}`);
    }

    // ✅ Serve static files
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const allowedOrigins = [
      frontendUrl,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];

    app.enableCors({
      origin: (origin, callback) => {
        // Requests without an Origin header (Postman, server-side requests, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Configured frontend or known local development origins
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow any localhost/127.0.0.1 development port
        const isLocalDevelopment =
          /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

        if (isLocalDevelopment) {
          return callback(null, true);
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cookie',
        'Accept',
        'X-Requested-With',
      ],
    });

    // ✅ Get port from config or use 3000
    const port = config.get<number>('PORT') || 3000;

    // ✅ Log all configuration on startup
    const livekitHttpUrl = config.get<string>('LIVEKIT_HTTP_URL');
    const livekitWsUrl = config.get<string>('LIVEKIT_WS_URL');
    const livekitApiKey = config.get<string>('LIVEKIT_API_KEY');

    logger.log('═══════════════════════════════════════════════');
    logger.log('🚀 SERVER STARTING');
    logger.log(`   HTTP Port: ${port}`);
    logger.log(`   Frontend URL: ${frontendUrl}`);
    logger.log(`   Uploads Directory: ${uploadsDir}`);
    logger.log('───────────────────────────────────────────────');
    logger.log('🎙️ LIVEKIT CONFIGURATION:');
    logger.log(`   HTTP URL: ${livekitHttpUrl || 'NOT SET'}`);
    logger.log(`   WebSocket URL: ${livekitWsUrl || 'NOT SET'}`);
    logger.log(`   API Key: ${livekitApiKey ? '✅ SET' : '❌ NOT SET'}`);
    logger.log('───────────────────────────────────────────────');
    logger.log('🔌 WebSocket endpoint (Socket.IO):');
    logger.log(`   http://localhost:${port}/voice`);
    logger.log(`   ws://localhost:${port}/voice`);
    logger.log('═══════════════════════════════════════════════');

    // ✅ Try to listen on the port with error handling
    await app.listen(port, '0.0.0.0', () => {
      logger.log(`✅ Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      const logger = new Logger('Bootstrap');
      logger.error(`❌ Port 3000 is already in use!`);
      logger.error(`💡 To fix this:`);
      logger.error(
        `   1. Find the process: lsof -i :3000 (Mac/Linux) or netstat -ano | findstr :3000 (Windows)`,
      );
      logger.error(
        `   2. Kill the process: kill -9 <PID> (Mac/Linux) or taskkill /PID <PID> /F (Windows)`,
      );
      logger.error(`   3. Or change the port in your .env file: PORT=3002`);
      process.exit(1);
    }
    throw error;
  }
}

bootstrap();
