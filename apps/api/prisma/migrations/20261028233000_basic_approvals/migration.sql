CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED');
CREATE TYPE "ApprovalActionType" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED');

ALTER TABLE "drive_file_versions" ADD COLUMN "sha256" CHAR(64);

CREATE TABLE "approval_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "project_id" UUID NOT NULL, "created_by_id" UUID NOT NULL,
  "file_id" UUID NOT NULL, "file_version_id" UUID NOT NULL, "title" VARCHAR(200) NOT NULL, "content" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT', "current_revision" INTEGER NOT NULL DEFAULT 0,
  "submitted_at" TIMESTAMPTZ(3), "approved_at" TIMESTAMPTZ(3), "rejected_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "approval_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_route_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL, "approver_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_route_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL, "project_id" UUID NOT NULL,
  "file_version_id" UUID NOT NULL, "revision" INTEGER NOT NULL, "title_snapshot" VARCHAR(200) NOT NULL,
  "content_snapshot" TEXT NOT NULL, "file_name_snapshot" VARCHAR(255) NOT NULL, "file_version" INTEGER NOT NULL,
  "file_sha256" CHAR(64) NOT NULL, "storage_key_snapshot" VARCHAR(500) NOT NULL, "mime_type_snapshot" VARCHAR(150) NOT NULL,
  "size_snapshot" BIGINT NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_steps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "revision_id" UUID NOT NULL, "approver_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL, "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING', "comment" VARCHAR(1000),
  "decided_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL, "revision_id" UUID, "actor_id" UUID NOT NULL,
  "type" "ApprovalActionType" NOT NULL, "from_status" "ApprovalStatus", "to_status" "ApprovalStatus" NOT NULL,
  "comment" VARCHAR(1000), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL, "project_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "type" VARCHAR(80) NOT NULL, "message" VARCHAR(500) NOT NULL, "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "project_id" UUID NOT NULL, "actor_id" UUID NOT NULL,
  "action" VARCHAR(100) NOT NULL, "resource_type" VARCHAR(100) NOT NULL, "resource_id" UUID NOT NULL,
  "request_id" VARCHAR(100), "summary" JSONB NOT NULL, "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_route_members_document_id_sequence_key" ON "approval_route_members"("document_id", "sequence");
CREATE UNIQUE INDEX "approval_route_members_document_id_approver_id_key" ON "approval_route_members"("document_id", "approver_id");
CREATE UNIQUE INDEX "approval_revisions_document_id_revision_key" ON "approval_revisions"("document_id", "revision");
CREATE UNIQUE INDEX "approval_steps_revision_id_sequence_key" ON "approval_steps"("revision_id", "sequence");
CREATE INDEX "approval_documents_project_id_status_updated_at_idx" ON "approval_documents"("project_id", "status", "updated_at" DESC);
CREATE INDEX "approval_documents_created_by_id_status_idx" ON "approval_documents"("created_by_id", "status");
CREATE INDEX "approval_route_members_approver_id_document_id_idx" ON "approval_route_members"("approver_id", "document_id");
CREATE INDEX "approval_revisions_project_id_created_at_idx" ON "approval_revisions"("project_id", "created_at" DESC);
CREATE INDEX "approval_steps_approver_id_status_created_at_idx" ON "approval_steps"("approver_id", "status", "created_at");
CREATE INDEX "approval_actions_document_id_created_at_idx" ON "approval_actions"("document_id", "created_at");
CREATE INDEX "approval_notifications_user_id_read_at_created_at_idx" ON "approval_notifications"("user_id", "read_at", "created_at" DESC);
CREATE INDEX "audit_logs_project_id_resource_type_resource_id_occurred_at_idx" ON "audit_logs"("project_id", "resource_type", "resource_id", "occurred_at");

ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "drive_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "drive_file_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_route_members" ADD CONSTRAINT "approval_route_members_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "approval_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_route_members" ADD CONSTRAINT "approval_route_members_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_revisions" ADD CONSTRAINT "approval_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "approval_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_revisions" ADD CONSTRAINT "approval_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_revisions" ADD CONSTRAINT "approval_revisions_file_version_id_fkey" FOREIGN KEY ("file_version_id") REFERENCES "drive_file_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "approval_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "approval_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "approval_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_notifications" ADD CONSTRAINT "approval_notifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "approval_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_notifications" ADD CONSTRAINT "approval_notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_notifications" ADD CONSTRAINT "approval_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
