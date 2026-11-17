export type RealtimeEventType = "comment.created" | "issue.status.changed" | "mention.created" | "assignee.assigned";

export type RealtimeEnvelope = {
  eventId: string;
  projectId: string;
  groupId: string;
  postId: string | null;
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
  recipientIds: string[];
  notificationMessage?: string;
};

export type PublishRealtimeInput = Omit<RealtimeEnvelope, "eventId" | "occurredAt"> & { eventId?: string };
