import { createHmac, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TokenPayload = { sub: string; exp: number };

@Injectable()
export class AuthTokenService {
  constructor(private readonly config: ConfigService) {}

  sign(userId: string, expiresInSeconds = 3600) {
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + expiresInSeconds } satisfies TokenPayload)).toString("base64url");
    return `${payload}.${this.signature(payload)}`;
  }

  verify(token: string): string | null {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(this.signature(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TokenPayload>;
      if (typeof decoded.sub !== "string" || typeof decoded.exp !== "number" || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
      return decoded.sub;
    } catch {
      return null;
    }
  }

  private signature(payload: string) {
    return createHmac("sha256", this.config.getOrThrow<string>("AUTH_TOKEN_SECRET")).update(payload).digest("base64url");
  }
}
