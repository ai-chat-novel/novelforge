// NovelForge — Universal API Proxy (Cloudflare Worker)
// Proxies any OpenAI-compatible API to bypass CORS
// Target URL is passed in the request body as "_proxyTarget"
// Deploy: npx wrangler deploy --config cf-worker/wrangler.toml
// Free tier: 100K requests/day

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
            return new Response('NovelForge Proxy is running. Send POST with _proxyTarget in body.', {
                status: 200,
                headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
            });
        }

        try {
            // Parse the body
            const body = await request.json();

            // Extract and remove the proxy target from the body
            const targetUrl = body._proxyTarget;
            delete body._proxyTarget;

            if (!targetUrl) {
                return jsonResponse(400, { error: { message: 'Missing _proxyTarget in request body' } });
            }

            // Forward the cleaned request to the target API
            const apiRes = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': request.headers.get('Authorization') || '',
                },
                body: JSON.stringify(body),
            });

            // Forward the response back with CORS headers
            const responseBody = await apiRes.text();
            return new Response(responseBody, {
                status: apiRes.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
            });
        } catch (err) {
            return jsonResponse(502, { error: { message: 'Proxy error: ' + err.message } });
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

function jsonResponse(status, obj) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}
