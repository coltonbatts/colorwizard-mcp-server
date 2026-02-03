const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  // Disable image optimization since we're handling images manually
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
