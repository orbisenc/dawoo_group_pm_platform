CREATE TYPE "GoogleDriveInvitationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "google_drive_invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "drive_name" VARCHAR(200) NOT NULL DEFAULT '다우그룹_공유 드라이브',
    "role" VARCHAR(30) NOT NULL DEFAULT 'writer',
    "status" "GoogleDriveInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "permission_id" VARCHAR(255),
    "last_error" VARCHAR(500),
    "invited_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_drive_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_invitations_user_id_key" ON "google_drive_invitations"("user_id");
CREATE INDEX "google_drive_invitations_status_updated_at_idx" ON "google_drive_invitations"("status", "updated_at");

ALTER TABLE "google_drive_invitations"
ADD CONSTRAINT "google_drive_invitations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_drive_invitations"
ADD CONSTRAINT "google_drive_invitations_requested_by_id_fkey"
FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
