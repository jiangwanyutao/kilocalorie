import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 20 * 1024 * 1024 }),
    { bufferLogs: false },
  );

  await app.register(multipart as any, {
    limits: { fileSize: 15 * 1024 * 1024, files: 4 },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:7110').split(','),
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const cfg = new DocumentBuilder()
      .setTitle('千卡日记 API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, cfg);
    SwaggerModule.setup('api/docs', app, doc);
  }

  const port = Number(process.env.PORT ?? 7100);
  await app.listen(port, '0.0.0.0');
  logger.log(`千卡日记 API on http://localhost:${port}/api`);
}

bootstrap();

