// NovelForge — NVIDIA NIM Proxy (Cloudflare Worker)
// Deploy: npx wrangler deploy
// Free tier: 100K requests/day

export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // Forward the request to NVIDIA NIM
        const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
            },
            body: request.body,
        });

        // Forward the response back with CORS headers
        const responseBody = await nvidiaRes.text();
        return new Response(responseBody, {
            status: nvidiaRes.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    },
};
