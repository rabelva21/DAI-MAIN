/** @type {import('next').NextConfig} */
const path = require('path'); 

const nextConfig = {
 
  outputFileTracingRoot: path.join(__dirname, '../../'), 
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;