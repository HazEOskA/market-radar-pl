/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@market-radar-pl/db", "@market-radar-pl/types"],
  // `postgres` uses native bindings that must not be bundled by webpack.
  // The key moved from experimental.serverComponentsExternalPackages in
  // Next.js 14.1 to top-level serverExternalPackages in Next.js 14.2+.
  serverExternalPackages: ["postgres"],
};

module.exports = nextConfig;
