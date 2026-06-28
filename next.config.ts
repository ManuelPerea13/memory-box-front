import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.88.100"],
  ...(process.env.STATIC_EXPORT === "1"
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {
        output: "standalone",
      }),
};

export default nextConfig;
