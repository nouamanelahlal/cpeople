import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { loadAppConfig } from './common/config/app-config.js';

async function bootstrap(): Promise<void> {
  // Read and check the environment before anything is wired up, so a bad
  // configuration stops the process here with one clear message.
  const config = loadAppConfig();

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

  await app.listen(config.port);
  console.log(
    `CPeople API on http://localhost:${config.port}/api (docs at /api/docs)` +
      (config.tenantHeaderAllowed ? ' — x-tenant-id header accepted (local development)' : ''),
  );
}

void bootstrap();
