import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

import { GoogleDriveInvitationService, invitationJobName } from "./google-drive-invitation.service";

@Processor("google-drive-invitations")
export class GoogleDriveInvitationProcessor extends WorkerHost {
  constructor(private readonly invitations: GoogleDriveInvitationService) {
    super();
  }

  async process(job: Job<{ userId?: string }>) {
    if (job.name !== invitationJobName || !job.data.userId) return;
    await this.invitations.process(job.data.userId);
  }
}
