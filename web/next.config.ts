import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'places.googleapis.com' },
    ],
  },
  // Prevent Baileys and its heavy native dependencies from being bundled.
  // These are only used at runtime on long-lived Node servers, not in
  // Vercel serverless functions where WhatsApp sessions can't persist.
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'jimp',
    'qrcode',
    'link-preview-js',
    'pdf-parse',
  ],
  // Turbopack config (Next.js 16 default bundler) — the serverExternalPackages
  // above handles externalization. This empty config silences the webpack
  // migration warning.
  turbopack: {},
  // Webpack fallback for environments that use `next build --webpack`
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          '@whiskeysockets/baileys': 'commonjs @whiskeysockets/baileys',
          'pino': 'commonjs pino',
          'jimp': 'commonjs jimp',
          'qrcode': 'commonjs qrcode',
          'link-preview-js': 'commonjs link-preview-js',
          'pdf-parse': 'commonjs pdf-parse',
        })
      }
    }
    return config
  },
}

export default nextConfig
