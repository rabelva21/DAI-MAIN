/** @type {import('next').NextConfig} */
const nextConfig = {
  // HAPUS outputFileTracingRoot yang menyebabkan error path
  
  // Opsi ini penting untuk mengatasi beberapa error lint saat build di Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Opsi ini mencegah error optimasi gambar jika kuota Vercel habis
  images: { 
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Pastikan trailing slash dimatikan (default) untuk menghindari masalah routing
  trailingSlash: false,
};

module.exports = nextConfig;