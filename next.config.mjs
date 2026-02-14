/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.fazag.edu.br',
            },
        ],
    },
};

export default nextConfig;
