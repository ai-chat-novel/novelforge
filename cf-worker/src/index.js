// NovelForge — Universal API Proxy (Cloudflare Worker)
// Proxies any OpenAI-compatible API to bypass CORS
// Deploy: cd cf-worker && npx wrangler deploy
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
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Target-URL',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        if (request.method !== 'POST') {
            return new Response('NovelForge Proxy is running. Send POST requests with X-Target-URL header.', {
                status: 200,
                headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
            });
        }

        // Get the target URL from the header
        const targetUrl = request.headers.get('X-Target-URL');
        if (!targetUrl) {
            return new Response(JSON.stringify({ error: { message: 'Missing X-Target-URL header' } }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        try {
            // Forward the request to the target API
            const apiRes = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': request.headers.get('Authorization') || '',
                },
                body: request.body,
            });

            // Forward the response back with CORS headers
            const responseBody = await apiRes.text();
            return new Response(responseBody, {
                status: apiRes.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
    },
};
