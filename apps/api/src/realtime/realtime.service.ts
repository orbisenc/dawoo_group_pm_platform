import { randomUUID } from "node:crypto";

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, type RealtimeEvent } from "@prisma/client";
import Redis from "ioredis";

import { PrismaService } from "../database/prisma.service";
import { REDIS_CLIENT } from "../infrastructure/infrastructure.constants";
import type { PublishRealtimeInput, RealtimeEnvelope, RealtimeEventType } from "./realtime.types";

const CHANNEL = "project-hub:realtime:v1";

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private subscriber?: Redis;
  private readonly listeners = new Set<(event: RealtimeEnvelope) => void>();
  private readonly delivered = new Set<string>();

  constructor(private readonly prisma: PrismaService, @Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit() { void this.connectSubscriber(); }

  onModuleDestroy() {
    this.subscriber?.disconnect();
  }

  onEvent(listener: (event: RealtimeEnvelope) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(input: PublishRealtimeInput) {
    const eventKey = input.eventId ?? randomUUID();
    const existing = await this.prisma.realtimeEvent.findUnique({ where: { eventKey } });
    if (existing) return this.toEnvelope(existing, input.recipientIds, input.notificationMessage);

    let event: RealtimeEvent;
    try {
      event = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.realtimeEvent.create({ data: {
          eventKey, projectId: input.projectId, groupId: input.groupId, postId: input.postId,
          type: input.type, payload: input.payload as Prisma.InputJsonValue,
        } });
        const recipients = [...new Set(input.recipientIds)];
        if (recipients.length && input.notificationMessage) {
          await transaction.notification.createMany({ data: recipients.map((userId) => ({
            userId, eventId: created.id, projectId: input.projectId, groupId: input.groupId, postId: input.postId,
            type: input.type, message: input.notificationMessage!,
          })), skipDuplicates: true });
        }
        return created;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const duplicate = await this.prisma.realtimeEvent.findUnique({ where: { eventKey } });
      if (!duplicate) throw error;
      return this.toEnvelope(duplicate, input.recipientIds, input.notificationMessage);
    }
    const envelope = this.toEnvelope(event, [...new Set(input.recipientIds)], input.notificationMessage);
    this.dispatch(envelope);
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.publish(CHANNEL, JSON.stringify(envelope));
    } catch {
      // DB 이벤트과 현재 인스턴스 전달은 완료되었으므로 Redis 복구 후 재접속 동기화로 보완한다.
    }
    return envelope;
  }

  async sync(projectId: string, groupId: string, since?: string) {
    const parsed = since ? new Date(since) : new Date(Date.now() - 5 * 60 * 1000);
    const after = Number.isNaN(parsed.getTime()) ? new Date(Date.now() - 5 * 60 * 1000) : parsed;
    const events = await this.prisma.realtimeEvent.findMany({
      where: { projectId, groupId, occurredAt: { gte: after } }, orderBy: [{ occurredAt: "asc" }, { eventKey: "asc" }], take: 500,
    });
    return events.map((event) => this.toEnvelope(event, []));
  }

  listUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, type: true, message: true, projectId: true, groupId: true, postId: true, createdAt: true },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
    if (!notification) return null;
    return this.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  }

  private async connectSubscriber() {
    try {
      this.subscriber = this.redis.duplicate({ lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
      await this.subscriber.connect();
      await this.subscriber.subscribe(CHANNEL);
      this.subscriber.on("message", (_channel, message) => {
        try { this.dispatch(JSON.parse(message) as RealtimeEnvelope); } catch { /* 잘못된 Redis 메시지는 폐기한다. */ }
      });
    } catch {
      this.subscriber?.disconnect();
      this.subscriber = undefined;
    }
  }

  private dispatch(event: RealtimeEnvelope) {
    if (this.delivered.has(event.eventId)) return;
    this.delivered.add(event.eventId);
    if (this.delivered.size > 2000) this.delivered.delete(this.delivered.values().next().value as string);
    for (const listener of this.listeners) listener(event);
  }

  private toEnvelope(event: { eventKey: string; projectId: string; groupId: string; postId: string | null; type: string; payload: Prisma.JsonValue; occurredAt: Date }, recipientIds: string[], notificationMessage?: string): RealtimeEnvelope {
    return { eventId: event.eventKey, projectId: event.projectId, groupId: event.groupId, postId: event.postId, type: event.type as RealtimeEventType, payload: event.payload as Record<string, unknown>, occurredAt: event.occurredAt.toISOString(), recipientIds, notificationMessage };
  }
}
