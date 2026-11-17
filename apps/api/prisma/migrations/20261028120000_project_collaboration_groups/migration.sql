ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'CLIENT_ADMIN';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'PROJECT_PM';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'GROUP_ADMIN';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'PARTICIPANT';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'EXTERNAL_PARTNER';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'READ_ONLY';

CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN', 'USER');
CREATE TYPE "GroupRole" AS ENUM ('GROUP_ADMIN', 'MEMBER', 'READ_ONLY');

ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "project_memberships" ADD COLUMN "organization_id" UUID;

UPDATE "project_memberships" AS membership
SET "organization_id" = project."organization_id"
FROM "projects" AS project
WHERE membership."project_id" = project."id";

ALTER TABLE "project_memberships" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE TABLE "collaboration_groups" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "is_private" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "collaboration_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_memberships" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "project_membership_id" UUID NOT NULL,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_memberships_project_id_organization_id_status_idx" ON "project_memberships"("project_id", "organization_id", "status");
CREATE UNIQUE INDEX "collaboration_groups_project_id_name_key" ON "collaboration_groups"("project_id", "name");
CREATE INDEX "collaboration_groups_project_id_is_private_idx" ON "collaboration_groups"("project_id", "is_private");
CREATE UNIQUE INDEX "group_memberships_group_id_project_membership_id_key" ON "group_memberships"("group_id", "project_membership_id");
CREATE INDEX "group_memberships_project_membership_id_role_idx" ON "group_memberships"("project_membership_id", "role");

ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_groups" ADD CONSTRAINT "collaboration_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_groups" ADD CONSTRAINT "collaboration_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_project_membership_id_fkey" FOREIGN KEY ("project_membership_id") REFERENCES "project_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
