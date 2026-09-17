import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeedModule } from './modules/feed/feed.module';
import { QrModule } from './modules/qr/qr.module';
import { SetupsModule } from './modules/setups/setups.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    VehiclesModule,
    SetupsModule,
    QrModule,
    FeedModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
