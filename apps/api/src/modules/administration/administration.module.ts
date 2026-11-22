import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { MeController } from './me.controller.js';

@Module({ imports: [AccessModule], controllers: [MeController] })
export class AdministrationModule {}
