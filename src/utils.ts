export const cors = (body: BodyInit | null = null) =>
  new Response(body, {
    status: body ? 200 : 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

export const json = (x: unknown, status = 200, extra = {}) =>
  new Response(JSON.stringify(x), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

// Naïve IP-based KV rate limiting
export async function rateGate(
  req: Request,
  env: Env,
  limit: number,
  windowSec: number
) {
  // If no KV binding, allow all requests (graceful degradation)
  if (!env.RATE) {
    return { allowed: true, retryAfter: 0 };
  }
  
  const ip = req.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const key = `rl:${ip}`;
  const hits = parseInt((await env.RATE.get(key)) ?? "0");
  if (hits >= limit) return { allowed: false, retryAfter: windowSec };
  await env.RATE.put(key, String(hits + 1), { expirationTtl: windowSec });
  return { allowed: true, retryAfter: 0 };
} 