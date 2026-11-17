import type { PrismaService } from "../database/prisma.service";
import type Redis from "ioredis";

import { RealtimeService } from "./realtime.service";

describe("RealtimeService 이벤트 중복 방지", () => {
  it("같은 eventId를 다시 발행해도 저장·전달을 한 번만 수행한다", async () => {
    const event = { id: "db-event-1", eventKey: "10000000-0000-4000-8000-000000000099", projectId: "10000000-0000-4000-8000-000000000001", groupId: "20000000-0000-4000-8000-000000000001", postId: null, type: "comment.created", payload: {}, occurredAt: new Date() };
    let stored = false;
    const findUnique = jest.fn().mockImplementation(() => Promise.resolve(stored ? event : null));
    const create = jest.fn().mockImplementation(() => { stored = true; return Promise.resolve(event); });
    const transaction = jest.fn().mockImplementation((operation: (client: unknown) => Promise<unknown>) => operation({ realtimeEvent: { create }, notification: { createMany: jest.fn() } }));
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { status: "ready", publish, duplicate: jest.fn() } as unknown as Redis;
    const service = new RealtimeService({ realtimeEvent: { findUnique }, $transaction: transaction } as unknown as PrismaService, redis);
    const listener = jest.fn();
    service.onEvent(listener);
    const input = { eventId: event.eventKey, projectId: event.projectId, groupId: event.groupId, postId: null, type: "comment.created" as const, payload: {}, recipientIds: [] };

    await service.publish(input);
    await service.publish(input);

    expect(create).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
