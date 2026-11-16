import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 là native module -> không bundle, để Node require trực tiếp.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
