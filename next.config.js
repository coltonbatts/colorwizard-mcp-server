/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable image optimization since we're handling images manually
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
