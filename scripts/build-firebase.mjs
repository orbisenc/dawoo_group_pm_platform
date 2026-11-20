import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["--filter", "@project-hub/web", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    FIREBASE_STATIC_EXPORT: "true",
    NEXT_PUBLIC_ENABLE_TEST_AUTH: "true",
  },
});

if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
