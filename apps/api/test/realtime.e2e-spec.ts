import { type INestApplication, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";

import { AuthTokenService } from "../src/auth/auth-token.service";
import { CollaborationRepository } from "../src/projects/collaboration.types";
import { CollaborationService } from "../src/projects/collaboration.service";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";
import { RealtimeService } from "../src/realtime/realtime.service";
import type { RealtimeEnvelope } from "../src/realtime/realtime.types";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const GROUP_ID = "20000000-0000-4000-8000-000000000001";
const USER_A = "30000000-0000-4000-8000-000000000001";
const USER_B = "30000000-0000-4000-8000-000000000002";
const OUTSIDER = "30000000-0000-4000-8000-000000000099";

class FakeRealtimeService {
  private listener?: (event: RealtimeEnvelope) => void;
  private readonly delivered = new Set<string>();
  readonly history: RealtimeEnvelope[] = [];
  onEvent(listener: (event: RealtimeEnvelope) => void) { this.listener = listener; return () => undefined; }
  emit(event: RealtimeEnvelope) { this.history.push(event); if (this.delivered.has(event.eventId)) return; this.delivered.add(event.eventId); this.listener?.(event); }
  sync() { return Promise.resolve(this.history); }
  listUnread() { return Promise.resolve([]); }
}

function once<T>(socket: Socket, event: string) { return new Promise<T>((resolve) => socket.once(event, resolve)); }
function ack<T>(socket: Socket, event: string, payload: unknown) { return new Promise<T>((resolve, reject) => socket.timeout(2500).emit(event, payload, (error: Error | null, response: T) => error ? reject(error) : resolve(response))); }

describe("실시간 협업 WebSocket 두 사용자 (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let tokens: AuthTokenService;
  let realtime: FakeRealtimeService;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    realtime = new FakeRealtimeService();
    const module = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        AuthTokenService,
        { provide: ConfigService, useValue: { getOrThrow: () => "realtime-e2e-secret" } },
        { provide: CollaborationRepository, useValue: { findActor: (id: string) => Promise.resolve({ id, isActive: true, platformRole: "USER" }) } },
        { provide: CollaborationService, useValue: { authorizeGroup: (actor: { id: string }) => actor.id === OUTSIDER ? Promise.reject(new NotFoundException()) : Promise.resolve({}) } },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0);
    const server = app.getHttpServer() as { address: () => AddressInfo | string | null };
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    tokens = module.get(AuthTokenService);
  });

  afterAll(async () => { for (const socket of sockets) socket.disconnect(); await app.close(); });

  const connect = async (userId: string) => {
    const socket = io(baseUrl, { transports: ["websocket"], auth: { token: tokens.sign(userId) }, forceNew: true });
    sockets.push(socket);
    await once(socket, "connect");
    return socket;
  };

  it("두 사용자는 같은 그룹 댓글을 실시간으로 받고 중복 이벤트는 한 번만 처리한다", async () => {
    const [userA, userB] = await Promise.all([connect(USER_A), connect(USER_B)]);
    await Promise.all([ack(userA, "group:subscribe", { projectId: PROJECT_ID, groupId: GROUP_ID }), ack(userB, "group:subscribe", { projectId: PROJECT_ID, groupId: GROUP_ID })]);
    const receivedA: RealtimeEnvelope[] = [];
    const receivedB: RealtimeEnvelope[] = [];
    userA.on("realtime:event", (event: RealtimeEnvelope) => receivedA.push(event));
    userB.on("realtime:event", (event: RealtimeEnvelope) => receivedB.push(event));
    const event: RealtimeEnvelope = { eventId: "40000000-0000-4000-8000-000000000001", projectId: PROJECT_ID, groupId: GROUP_ID, postId: null, type: "comment.created", payload: { content: "실시간 댓글" }, occurredAt: new Date().toISOString(), recipientIds: [] };

    realtime.emit(event);
    realtime.emit(event);
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
  });

  it("권한 없는 사용자는 그룹 룸 구독과 이벤트 수신이 차단된다", async () => {
    const outsider = await connect(OUTSIDER);
    const exception = once<{ message: string }>(outsider, "exception");
    outsider.emit("group:subscribe", { projectId: PROJECT_ID, groupId: GROUP_ID });
    await expect(exception).resolves.toBeDefined();
    const received = jest.fn();
    outsider.on("realtime:event", received);
    realtime.emit({ eventId: "40000000-0000-4000-8000-000000000002", projectId: PROJECT_ID, groupId: GROUP_ID, postId: null, type: "issue.status.changed", payload: {}, occurredAt: new Date().toISOString(), recipientIds: [] });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(received).not.toHaveBeenCalled();
  });

  it("재접속 사용자는 저장된 이벤트를 동기화한다", async () => {
    const user = await connect(USER_B);
    await ack(user, "group:subscribe", { projectId: PROJECT_ID, groupId: GROUP_ID });
    user.disconnect();
    realtime.emit({ eventId: "40000000-0000-4000-8000-000000000003", projectId: PROJECT_ID, groupId: GROUP_ID, postId: null, type: "mention.created", payload: {}, occurredAt: new Date().toISOString(), recipientIds: [USER_B] });
    const reconnected = await connect(USER_B);
    await ack(reconnected, "group:subscribe", { projectId: PROJECT_ID, groupId: GROUP_ID });
    const sync = await ack<{ events: RealtimeEnvelope[] }>(reconnected, "group:sync", { projectId: PROJECT_ID, groupId: GROUP_ID, since: new Date(0).toISOString() });
    expect(sync.events.some((event) => event.eventId === "40000000-0000-4000-8000-000000000003")).toBe(true);
  });
});
