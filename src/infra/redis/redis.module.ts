import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const parsedPort = Number(configService.get<string>('REDIS_PORT'));
        const port = Number.isFinite(parsedPort) ? parsedPort : 6379;
        const password = configService.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          password: password && password.length > 0 ? password : undefined,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
