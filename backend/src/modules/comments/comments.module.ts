import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  CommentsController,
  SetupCommentsController,
} from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule],
  controllers: [SetupCommentsController, CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
