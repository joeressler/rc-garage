import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ForkService } from './fork.service';
import { LikesService } from './likes.service';
import { SetupsController } from './setups.controller';
import { SetupsService } from './setups.service';

@Module({
  imports: [AuthModule],
  controllers: [SetupsController],
  providers: [SetupsService, ForkService, LikesService],
  exports: [SetupsService, ForkService, LikesService],
})
export class SetupsModule {}
