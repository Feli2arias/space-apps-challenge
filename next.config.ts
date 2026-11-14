import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // English used to live under /en; it is now the default language at the root.
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: false },
      { source: "/en/app", destination: "/app", permanent: false },
    ];
  },
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
