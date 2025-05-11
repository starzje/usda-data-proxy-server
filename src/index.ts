/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		const url = new URL(request.url);
		const query = url.searchParams.get("query");
		if (!query) {
			return new Response("Missing `?query=` parameter", { 
				status: 400,
				headers: corsHeaders 
			});
		}

		// Forward to USDA, using the secret stored in env.USDA_KEY
		const usdaRes = await fetch(
			`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${env.USDA_KEY}`
		);

		// Return USDA's JSON back to the client
		return new Response(usdaRes.body, {
			status: usdaRes.status,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json'
			}
		});
	}
} satisfies ExportedHandler<Env>;
