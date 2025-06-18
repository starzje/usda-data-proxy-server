import { cors, json, rateGate } from "./utils";

export async function handleUSDA(
  req: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  // Pre-flight CORS
  if (req.method === "OPTIONS") return cors(null);

  // Basic rate limiting - USDA allows reasonable requests
  const { allowed, retryAfter } = await rateGate(req, env, 10, 60);
  if (!allowed) return json({ error: "Rate limit exceeded" }, 429, { "Retry-After": retryAfter });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const endpoint = pathParts[2]; // "search"
  
  // Only support search endpoint for consistency
  if (endpoint !== "search") {
    return json({ error: "Invalid endpoint. Use /usda/search" }, 400);
  }

  const query = url.searchParams.get("query");
  if (!query) {
    return json({ error: "Missing ?query parameter" }, 400);
  }

  try {
    // Forward to USDA, using the secret stored in env.USDA_KEY
    const usdaRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Foundation&pageSize=20&api_key=${env.USDA_KEY}`
    );

    if (!usdaRes.ok) {
      return json({ error: "USDA API error", status: usdaRes.status }, 502);
    }

    // Return USDA's JSON back to the client with proper CORS
    return new Response(usdaRes.body, {
      status: usdaRes.status,
      headers: {
        ...cors().headers,
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300" // Cache search results for 5 minutes
      }
    });
  } catch (error) {
    return json({ error: "Failed to fetch from USDA API" }, 500);
  }
} 