// NovelForge — Universal Streaming API Proxy (Cloudflare Worker)
// Streams responses to avoid 524 timeouts on slow models
// Deploy: npx wrangler deploy --config cf-worker/wrangler.toml

export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        }

        if (request.method !== 'POST') {
            return new Response('NovelForge Proxy running. Send POST with _proxyTarget in body.', {
                status: 200,
                headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
            });
        }

        try {
            const body = await request.json();
            const targetUrl = body._proxyTarget;
            delete body._proxyTarget;

            if (!targetUrl) {
                return jsonRes(400, { error: { message: 'Missing _proxyTarget in body' } });
            }

            // Force streaming to prevent timeout on slow models
            body.stream = true;

            const apiRes = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': request.headers.get('Authorization') || '',
                },
                body: JSON.stringify(body),
            });

            if (!apiRes.ok) {
                // Non-2xx: forward error as-is
                const errBody = await apiRes.text();
                return new Response(errBody, {
                    status: apiRes.status,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                });
            }

            // Stream the SSE response directly to the client
            return new Response(apiRes.body, {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    ...corsHeaders(),
                },
            });

        } catch (err) {
            return jsonRes(502, { error: { message: 'Proxy error: ' + err.message } });
        }
    },
};

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

function jsonRes(status, obj) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}
