import { S3Client } from "@aws-sdk/client-s3";
import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { PrismaService } from "../database/prisma.service";
import { REDIS_CLIENT, S3_CLIENT } from "./infrastructure.constants";
import { InfrastructureService } from "./infrastructure.service";

function redisConnection(urlValue: string) {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.getOrThrow<string>("REDIS_URL")),
        prefix: "project-hub",
      }),
    }),
    BullModule.registerQueue({ name: "system-events" }),
    BullModule.registerQueue({ name: "google-drive-invitations" }),
  ],
  providers: [
    PrismaService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>("REDIS_URL"), {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        }),
    },
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
          region: config.getOrThrow<string>("S3_REGION"),
          forcePathStyle: config.get<string>("S3_FORCE_PATH_STYLE", "true") === "true",
          credentials: {
            accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
            secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
          },
        }),
    },
    InfrastructureService,
  ],
  exports: [PrismaService, InfrastructureService, BullModule, REDIS_CLIENT, S3_CLIENT],
})
export class InfrastructureModule {}
