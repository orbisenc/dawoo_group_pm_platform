import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { CollaborationModule } from "../projects/collaboration.module";
import { CadController } from "./cad.controller";
import { BimController } from "./bim.controller";
import { CadService } from "./cad.service";

@Module({
  imports: [CollaborationModule],
  controllers: [CadController, BimController],
  providers: [CadService, ApiAuthGuard, AuthTokenService],
})
export class CadModule {}
