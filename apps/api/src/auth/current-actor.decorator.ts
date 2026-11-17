import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { Actor } from "../projects/collaboration.types";

type RequestWithActor = { user: Actor };

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  return context.switchToHttp().getRequest<RequestWithActor>().user;
});
