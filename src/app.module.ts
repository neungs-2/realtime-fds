import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AlertsModule } from './alerts/alerts.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { DetectionEventEntity } from './common/entities/detection-event.entity';
import { DetectionModule } from './detection/detection.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './infra/redis/redis.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const parsedPort = Number(configService.get<string>('DB_PORT'));
        const dbPort = Number.isFinite(parsedPort) ? parsedPort : 5432;

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: dbPort,
          username: configService.get<string>('DB_USER', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'realtime_fds'),
          entities: [DetectionEventEntity],
          synchronize: true,
        };
      },
    }),
    RedisModule,
    BlockchainModule,
    DetectionModule,
    AlertsModule,
    TransactionsModule,
    HealthModule,
  ],
})
export class AppModule {}
