CREATE TYPE "AccountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users"
  ADD COLUMN "username" VARCHAR(50),
  ADD COLUMN "approval_status" "AccountApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approved_at" TIMESTAMPTZ(3),
  ADD COLUMN "approved_by_id" UUID;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
