import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import type { DependencyHealth, ServiceState } from "@project-hub/contracts";

import { PrismaService } from "../database/prisma.service";
import { REDIS_CLIENT, S3_CLIENT } from "./infrastructure.constants";

@Injectable()
export class InfrastructureService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  async checkDependencies(): Promise<DependencyHealth> {
    const [database, redis, objectStorage] = await Promise.all([
      this.check(() => this.prisma.$queryRaw`SELECT 1`),
      this.check(async () => {
        if (this.redis.status === "wait") await this.redis.connect();
        await this.redis.ping();
      }),
      this.check(() =>
        this.s3.send(new HeadBucketCommand({ Bucket: this.config.getOrThrow("S3_BUCKET") })),
      ),
    ]);

    return { database, redis, objectStorage };
  }

  onModuleDestroy(): void {
    if (this.redis.status !== "end") this.redis.disconnect();
    this.s3.destroy();
  }

  private async check(operation: () => Promise<unknown>): Promise<ServiceState> {
    try {
      await operation();
      return "정상";
    } catch {
      return "오류";
    }
  }
}
