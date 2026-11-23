import { Global, Module } from '@nestjs/common';
import { TokenVerifierService } from './token-verifier.service.js';

@Global()
@Module({
  providers: [TokenVerifierService],
  exports: [TokenVerifierService],
})
export class AuthModule {}
