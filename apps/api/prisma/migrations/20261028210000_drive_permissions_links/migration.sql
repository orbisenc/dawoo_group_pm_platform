CREATE TABLE "drive_folder_group_accesses" (
    "id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_folder_group_accesses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drive_file_issue_links" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_file_issue_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drive_folder_group_accesses_folder_id_group_id_key" ON "drive_folder_group_accesses"("folder_id", "group_id");
CREATE INDEX "drive_folder_group_accesses_group_id_can_write_idx" ON "drive_folder_group_accesses"("group_id", "can_write");
CREATE UNIQUE INDEX "drive_file_issue_links_file_id_post_id_key" ON "drive_file_issue_links"("file_id", "post_id");
CREATE INDEX "drive_file_issue_links_project_id_post_id_idx" ON "drive_file_issue_links"("project_id", "post_id");

ALTER TABLE "drive_folder_group_accesses" ADD CONSTRAINT "drive_folder_group_accesses_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "drive_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_folder_group_accesses" ADD CONSTRAINT "drive_folder_group_accesses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "collaboration_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_issue_links" ADD CONSTRAINT "drive_file_issue_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_issue_links" ADD CONSTRAINT "drive_file_issue_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "drive_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_issue_links" ADD CONSTRAINT "drive_file_issue_links_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_file_issue_links" ADD CONSTRAINT "drive_file_issue_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
