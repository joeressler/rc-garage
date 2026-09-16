import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ForkService } from './fork.service';
import { SetupsController } from './setups.controller';
import { SetupsService } from './setups.service';

@Module({
  imports: [AuthModule],
  controllers: [SetupsController],
  providers: [SetupsService, ForkService],
  exports: [SetupsService, ForkService],
})
export class SetupsModule {}
