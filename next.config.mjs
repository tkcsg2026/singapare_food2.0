/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  webpack: (config, { dev }) => {
    // Use a single RegExp so Windows drive-root system files (pagefile.sys,
    // hiberfil.sys, "System Volume Information", etc.) are skipped during the
    // initial watch scan. Glob arrays don't match these absolute root paths,
    // which produced the noisy "Watchpack Error (initial scan): EINVAL lstat" lines.
    config.watchOptions = {
      ...config.watchOptions,
      ignored:
        /[\\/](?:node_modules|\.git|System Volume Information|\$RECYCLE\.BIN|DumpStack\.log\.tmp|hiberfil\.sys|pagefile\.sys|swapfile\.sys)([\\/]|$)/,
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
