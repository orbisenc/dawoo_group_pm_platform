CREATE TYPE "CalendarEventKind" AS ENUM ('EVENT', 'MILESTONE');

CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "group_id" UUID,
    "created_by_id" UUID NOT NULL,
    "assignee_id" UUID,
    "issue_id" UUID,
    "kind" "CalendarEventKind" NOT NULL DEFAULT 'EVENT',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "milestone_name" VARCHAR(100),
    "reminder_minutes" INTEGER NOT NULL DEFAULT 1440,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_event_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_attachments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PREPARED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "calendar_event_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_reminders" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_events_project_id_starts_at_ends_at_archived_at_idx" ON "calendar_events"("project_id", "starts_at", "ends_at", "archived_at");
CREATE INDEX "calendar_events_project_id_group_id_kind_idx" ON "calendar_events"("project_id", "group_id", "kind");
CREATE INDEX "calendar_events_assignee_id_starts_at_idx" ON "calendar_events"("assignee_id", "starts_at");
CREATE UNIQUE INDEX "calendar_event_participants_event_id_user_id_key" ON "calendar_event_participants"("event_id", "user_id");
CREATE INDEX "calendar_event_participants_user_id_event_id_idx" ON "calendar_event_participants"("user_id", "event_id");
CREATE UNIQUE INDEX "calendar_event_attachments_storage_key_key" ON "calendar_event_attachments"("storage_key");
CREATE INDEX "calendar_event_attachments_project_id_event_id_status_idx" ON "calendar_event_attachments"("project_id", "event_id", "status");
CREATE UNIQUE INDEX "calendar_reminders_event_id_user_id_key" ON "calendar_reminders"("event_id", "user_id");
CREATE INDEX "calendar_reminders_user_id_read_at_scheduled_at_idx" ON "calendar_reminders"("user_id", "read_at", "scheduled_at");

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "feed_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_attachments" ADD CONSTRAINT "calendar_event_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_reminders" ADD CONSTRAINT "calendar_reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_reminders" ADD CONSTRAINT "calendar_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
