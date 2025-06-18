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

import { handleUSDA } from "./usda";
import { handleOFF } from "./off";
import { cors } from "./utils";

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname;

		// Standardized endpoints
		if (path.startsWith("/usda/")) {
			return handleUSDA(req, env, ctx);
		} else if (path.startsWith("/off/")) {
			return handleOFF(req, env, ctx);
		}
		
		// Backward compatibility: root path with query parameter goes to USDA
		else if ((path === "/" || path.startsWith("/?")) && url.searchParams.get("query")) {
			// Rewrite the URL to use the new standardized endpoint
			const newUrl = new URL(req.url);
			newUrl.pathname = "/usda/search";
			const newRequest = new Request(newUrl.toString(), {
				method: req.method,
				headers: req.headers,
				body: req.body
			});
			return handleUSDA(newRequest, env, ctx);
		}

		// 404 for unknown paths
		return new Response("Not found. Use /usda/search or /off/search endpoints.", { 
			status: 404,
			headers: cors().headers
		});
	}
} satisfies ExportedHandler<Env>;
