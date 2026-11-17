CREATE TYPE "DriveVersionStatus" AS ENUM ('PREPARED', 'AVAILABLE', 'FAILED');

CREATE TABLE "drive_folders" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drive_files" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "folder_id" UUID,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "drive_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drive_file_versions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "DriveVersionStatus" NOT NULL DEFAULT 'PREPARED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "drive_file_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drive_folders_project_id_parent_id_deleted_at_name_idx" ON "drive_folders"("project_id", "parent_id", "deleted_at", "name");
CREATE INDEX "drive_files_project_id_folder_id_deleted_at_name_idx" ON "drive_files"("project_id", "folder_id", "deleted_at", "name");
CREATE UNIQUE INDEX "drive_file_versions_storage_key_key" ON "drive_file_versions"("storage_key");
CREATE UNIQUE INDEX "drive_file_versions_file_id_version_key" ON "drive_file_versions"("file_id", "version");
CREATE INDEX "drive_file_versions_project_id_file_id_status_version_idx" ON "drive_file_versions"("project_id", "file_id", "status", "version" DESC);

ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "drive_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "drive_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "drive_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_versions" ADD CONSTRAINT "drive_file_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
