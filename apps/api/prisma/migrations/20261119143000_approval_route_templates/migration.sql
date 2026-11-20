-- 결재 문서는 첨부 없이도 기안할 수 있고, 첨부한 경우 기존 불변 리비전 정책을 유지한다.
ALTER TABLE "approval_documents" ALTER COLUMN "file_id" DROP NOT NULL;
ALTER TABLE "approval_documents" ALTER COLUMN "file_version_id" DROP NOT NULL;

ALTER TABLE "approval_revisions" ALTER COLUMN "file_version_id" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "file_name_snapshot" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "file_version" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "file_sha256" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "storage_key_snapshot" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "mime_type_snapshot" DROP NOT NULL;
ALTER TABLE "approval_revisions" ALTER COLUMN "size_snapshot" DROP NOT NULL;

CREATE TABLE "approval_route_templates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "approval_route_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_route_template_members" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_route_template_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_route_templates_project_id_name_key" ON "approval_route_templates"("project_id", "name");
CREATE INDEX "approval_route_templates_project_id_updated_at_idx" ON "approval_route_templates"("project_id", "updated_at" DESC);
CREATE UNIQUE INDEX "approval_route_template_members_template_id_sequence_key" ON "approval_route_template_members"("template_id", "sequence");
CREATE UNIQUE INDEX "approval_route_template_members_template_id_approver_id_key" ON "approval_route_template_members"("template_id", "approver_id");
CREATE INDEX "approval_route_template_members_approver_id_template_id_idx" ON "approval_route_template_members"("approver_id", "template_id");

ALTER TABLE "approval_route_templates" ADD CONSTRAINT "approval_route_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_route_templates" ADD CONSTRAINT "approval_route_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_route_template_members" ADD CONSTRAINT "approval_route_template_members_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "approval_route_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_route_template_members" ADD CONSTRAINT "approval_route_template_members_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
