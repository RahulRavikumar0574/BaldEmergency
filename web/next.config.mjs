/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: this allows production builds to succeed even if
    // there are ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
