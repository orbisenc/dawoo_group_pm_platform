CREATE TABLE "realtime_events" (
  "id" UUID NOT NULL,
  "event_key" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "post_id" UUID,
  "type" VARCHAR(80) NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "post_id" UUID,
  "type" VARCHAR(80) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "realtime_events_event_key_key" ON "realtime_events"("event_key");
CREATE INDEX "realtime_events_project_id_group_id_occurred_at_event_key_idx" ON "realtime_events"("project_id", "group_id", "occurred_at", "event_key");
CREATE UNIQUE INDEX "notifications_user_id_event_id_key" ON "notifications"("user_id", "event_id");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);
CREATE INDEX "notifications_project_id_group_id_post_id_idx" ON "notifications"("project_id", "group_id", "post_id");

ALTER TABLE "realtime_events" ADD CONSTRAINT "realtime_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "realtime_events" ADD CONSTRAINT "realtime_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "realtime_events" ADD CONSTRAINT "realtime_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "realtime_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
