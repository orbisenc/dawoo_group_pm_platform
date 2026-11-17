import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from "@nestjs/websockets";
import { IsISO8601, IsOptional, IsUUID } from "class-validator";
import type { Server, Socket } from "socket.io";

import { AuthTokenService } from "../auth/auth-token.service";
import type { Actor } from "../projects/collaboration.types";
import { CollaborationRepository } from "../projects/collaboration.types";
import { CollaborationService } from "../projects/collaboration.service";
import { RealtimeService } from "./realtime.service";
import type { RealtimeEnvelope } from "./realtime.types";

class GroupSubscriptionDto { @IsUUID() projectId: string; @IsUUID() groupId: string; }
class GroupSyncDto extends GroupSubscriptionDto { @IsOptional() @IsISO8601() since?: string; }
type AuthenticatedSocket = Socket & { data: { actor?: Actor } };

@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3004", credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(
    private readonly tokens: AuthTokenService,
    private readonly repository: CollaborationRepository,
    private readonly collaboration: CollaborationService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit() {
    this.realtime.onEvent((event) => this.broadcast(event));
  }

  async handleConnection(client: AuthenticatedSocket) {
    const authToken = typeof client.handshake.auth.token === "string" ? client.handshake.auth.token : this.bearerToken(client.handshake.headers.authorization);
    const userId = authToken ? this.tokens.verify(authToken) : null;
    const actor = userId ? await this.repository.findActor(userId) : null;
    if (!actor?.isActive) { client.disconnect(true); return; }
    client.data.actor = actor;
    await client.join(this.userRoom(actor.id));
  }

  @SubscribeMessage("group:subscribe")
  async subscribe(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: GroupSubscriptionDto) {
    const actor = this.actor(client);
    await this.collaboration.authorizeGroup(actor, dto.projectId, dto.groupId, false);
    await client.join(this.groupRoom(dto.projectId, dto.groupId));
    return { subscribed: true, projectId: dto.projectId, groupId: dto.groupId };
  }

  @SubscribeMessage("group:unsubscribe")
  async unsubscribe(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: GroupSubscriptionDto) {
    await client.leave(this.groupRoom(dto.projectId, dto.groupId));
    return { subscribed: false };
  }

  @SubscribeMessage("group:sync")
  async sync(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() dto: GroupSyncDto) {
    const actor = this.actor(client);
    await this.collaboration.authorizeGroup(actor, dto.projectId, dto.groupId, false);
    return { events: await this.realtime.sync(dto.projectId, dto.groupId, dto.since), syncedAt: new Date().toISOString() };
  }

  @SubscribeMessage("notifications:unread")
  async unread(@ConnectedSocket() client: AuthenticatedSocket) {
    return { items: await this.realtime.listUnread(this.actor(client).id) };
  }

  private broadcast(event: RealtimeEnvelope) {
    const publicEvent = { eventId: event.eventId, projectId: event.projectId, groupId: event.groupId, postId: event.postId, type: event.type, payload: event.payload, occurredAt: event.occurredAt };
    this.server.to(this.groupRoom(event.projectId, event.groupId)).emit("realtime:event", publicEvent);
    if (event.notificationMessage) {
      for (const userId of event.recipientIds) this.server.to(this.userRoom(userId)).emit("notification:new", { eventId: event.eventId, type: event.type, message: event.notificationMessage, projectId: event.projectId, groupId: event.groupId, postId: event.postId, occurredAt: event.occurredAt });
    }
  }

  private actor(client: AuthenticatedSocket): Actor {
    const value: unknown = client.data.actor;
    if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !("isActive" in value) || typeof value.isActive !== "boolean" || !("platformRole" in value) || (value.platformRole !== "USER" && value.platformRole !== "PLATFORM_ADMIN")) throw new WsException("인증된 연결이 아닙니다.");
    return { id: value.id, isActive: value.isActive, platformRole: value.platformRole };
  }
  private bearerToken(value: string | string[] | undefined): string | null { const header = Array.isArray(value) ? value[0] : value; return header?.startsWith("Bearer ") ? header.slice(7) : null; }
  private groupRoom(projectId: string, groupId: string) { return `project:${projectId}:group:${groupId}`; }
  private userRoom(userId: string) { return `user:${userId}`; }
}
