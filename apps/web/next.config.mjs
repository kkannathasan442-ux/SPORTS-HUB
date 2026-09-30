/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@sportshub/types',
    '@sportshub/config',
    '@sportshub/validation',
    '@sportshub/api',
    '@sportshub/shared',
  ],
};

export default nextConfig;
