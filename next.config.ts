import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // مكتبات بتستخدم binaries أصلية – تفضل خارج الـ bundle
  serverExternalPackages: ["@libsql/client", "libsql"],
  // السماح للبروكسي/المعاينة بالوصول في وضع التطوير
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost"],
  experimental: {
    optimizePackageImports: ["drizzle-orm"],
  },
};

export default nextConfig;
