import type { NextConfig } from "next";

// Pin the project root; otherwise Next picks up a stray lockfile in a parent folder.
const nextConfig: NextConfig = { outputFileTracingRoot: __dirname };

export default nextConfig;
