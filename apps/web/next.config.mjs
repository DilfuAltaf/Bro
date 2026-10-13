/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Halaman voice-call (LiveKit) sudah dihapus — ganti speech-to-text di kolom chat.
  // Redirect agar bookmark/link lama tidak 404.
  async redirects() {
    return [
      {
        source: '/voice',
        destination: '/chat',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
