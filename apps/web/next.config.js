/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@market-radar-pl/db", "@market-radar-pl/types"],
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },
};

module.exports = nextConfig;
