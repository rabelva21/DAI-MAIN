/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // <-- HAPUS BARIS INI
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;