import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3100;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CPeople API')
      .setDescription('HR and payroll API. Multi-tenant: every request is scoped to one tenant.')
      .setVersion('0.0.1')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  console.log(`CPeople API on http://localhost:${port}/api (docs at /api/docs)`);
}

void bootstrap();
