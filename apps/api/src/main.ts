import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());

  // Naikkan limit body JSON: lampiran gambar dikirim sebagai data-URL base64
  // (4 gambar terkompresi ≈ 2-4MB). Default Express 100KB bakal 413.
  app.use(json({ limit: '15mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BroAgent API')
    .setDescription('AI Personal Education Agent API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // BroAgent talks to Gemini directly through Google's OpenAI-compatible API.
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY is not set. Chat requests will fail until it is configured.');
  }

  // Validate Supabase environment variables for direct Supabase client access
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is not set in .env. Supabase client operations will fail until configured.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set in .env. Server-side operations will fail until configured.');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 BroAgent API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/docs`);
}
bootstrap();
