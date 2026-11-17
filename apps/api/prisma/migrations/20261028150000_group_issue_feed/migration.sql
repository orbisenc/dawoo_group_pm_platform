CREATE TYPE "FeedPostType" AS ENUM ('NOTICE', 'GENERAL', 'QUESTION', 'ISSUE', 'DECISION');
CREATE TYPE "IssueStatus" AS ENUM ('REGISTERED', 'UNDER_REVIEW', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "AttachmentStatus" AS ENUM ('PREPARED', 'AVAILABLE', 'FAILED');

CREATE TABLE "feed_posts" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "assignee_id" UUID,
  "type" "FeedPostType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT NOT NULL,
  "priority" "IssuePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "IssueStatus" NOT NULL DEFAULT 'REGISTERED',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feed_comments" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "parent_id" UUID,
  "content" VARCHAR(4000) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feed_attachments" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(150) NOT NULL,
  "size" BIGINT NOT NULL,
  "status" "AttachmentStatus" NOT NULL DEFAULT 'PREPARED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "feed_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feed_posts_project_id_group_id_archived_at_created_at_idx" ON "feed_posts"("project_id", "group_id", "archived_at", "created_at" DESC);
CREATE INDEX "feed_posts_project_id_group_id_type_status_priority_idx" ON "feed_posts"("project_id", "group_id", "type", "status", "priority");
CREATE INDEX "feed_posts_assignee_id_status_idx" ON "feed_posts"("assignee_id", "status");
CREATE INDEX "feed_comments_project_id_group_id_post_id_archived_at_created_at_idx" ON "feed_comments"("project_id", "group_id", "post_id", "archived_at", "created_at");
CREATE INDEX "feed_comments_parent_id_created_at_idx" ON "feed_comments"("parent_id", "created_at");
CREATE UNIQUE INDEX "feed_attachments_storage_key_key" ON "feed_attachments"("storage_key");
CREATE INDEX "feed_attachments_project_id_group_id_post_id_status_idx" ON "feed_attachments"("project_id", "group_id", "post_id", "status");

ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "feed_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_attachments" ADD CONSTRAINT "feed_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_attachments" ADD CONSTRAINT "feed_attachments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_attachments" ADD CONSTRAINT "feed_attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_attachments" ADD CONSTRAINT "feed_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
