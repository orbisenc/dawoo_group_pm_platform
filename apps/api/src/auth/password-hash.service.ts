import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { Injectable } from "@nestjs/common";

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordHashService {
  async hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derived.toString("hex")}`;
  }

  async verify(password: string, storedHash: string) {
    const [algorithm, salt, expectedHex] = storedHash.split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const derived = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
}
