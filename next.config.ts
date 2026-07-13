import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker runner image small.
  output: "standalone",
  experimental: {
    // Server Actions reject requests whose Origin != forwarded Host (CSRF guard).
    // VS Code Dev Tunnels rewrites Origin to the forward target (localhost:3000)
    // while x-forwarded-host is the public tunnel URL, so allow both.
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.devtunnels.ms"],
    },
  },
};

export default nextConfig;
