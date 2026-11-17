import type { NextConfig } from "next";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(configDirectory, "../../.env"), quiet: true });

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const isFirebaseStaticExport = process.env.FIREBASE_STATIC_EXPORT === "true";

const nextConfig: NextConfig = isFirebaseStaticExport
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [
          {
            source: "/backend/:path*",
            destination: `${apiOrigin}/api/v1/:path*`,
          },
        ];
      },
    };

export default nextConfig;
