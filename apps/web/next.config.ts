import type { NextConfig } from "next";
import { config } from "dotenv";

config({ path: "../../.env", quiet: true });

const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
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
