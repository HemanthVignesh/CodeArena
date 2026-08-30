/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@codearena/ui", "@codearena/judge-shared", "@codearena/db"],
  reactStrictMode: true,
};

export default nextConfig;
