import { Module } from "@nestjs/common";

import { ApiAuthGuard } from "../auth/api-auth.guard";
import { AuthTokenService } from "../auth/auth-token.service";
import { InputSecurityService } from "../feed/input-security.service";
import { CollaborationModule } from "../projects/collaboration.module";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({ imports: [CollaborationModule], controllers: [CalendarController], providers: [CalendarService, InputSecurityService, ApiAuthGuard, AuthTokenService] })
export class CalendarModule {}
