/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  webpack: (config, { dev }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/System Volume Information/**", "**/$RECYCLE.BIN/**"],
    };
    // Limit parallel processing to reduce V8 zone memory pressure
    if (dev) {
      config.parallelism = 1;
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    const revalidate = [
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
    ];
    return [
      { source: "/favicon.ico", headers: revalidate },
      { source: "/icon", headers: revalidate },
      { source: "/icon.png", headers: revalidate },
      { source: "/apple-icon", headers: revalidate },
      { source: "/apple-icon.png", headers: revalidate },
    ];
  },
};

export default nextConfig;
