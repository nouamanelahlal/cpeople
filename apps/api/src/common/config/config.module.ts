import { Global, Module } from '@nestjs/common';
import { AppConfigService, loadAppConfig } from './app-config.js';

@Global()
@Module({
  providers: [
    {
      // Built by hand: the settings come from the environment, not from the
      // injector, and loadAppConfig() is what checks them.
      provide: AppConfigService,
      useFactory: () => new AppConfigService(loadAppConfig()),
    },
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}
