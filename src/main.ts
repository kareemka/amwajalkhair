import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { initFirebase } from './config/firebase';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initFirebaseCustomers } from './config/firebase-customers';
import { initFirebaseEmployees } from './config/firebase-employees';

async function bootstrap() {
  // initFirebase();

  initFirebaseEmployees();
  // initFirebaseCustomers();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: [
      'https://havana-iq.com',
      'https://www.havana-iq.com',
      'http://localhost:3000',
      'http://localhost:3001',
      /\.havana-iq\.com$/,
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const uploadPath = join(__dirname, '..', 'uploads');
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }

  app.useStaticAssets(uploadPath, {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
