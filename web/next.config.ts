import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'places.googleapis.com' },
    ],
  },
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'jimp',
    'qrcode',
  ],
}

export default nextConfig
