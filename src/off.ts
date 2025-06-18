import { cors, json, rateGate } from "./utils";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2";
const USER_AGENT = "USDAFoodProxy/1.0 (+https://github.com/yourproject)"; // Required by OFF

export async function handleOFF(
  req: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  // Pre-flight CORS
  if (req.method === "OPTIONS") return cors(null);

  // OFF says 10 search req/min; we allow 6 to be conservative
  const { allowed, retryAfter } = await rateGate(req, env, 6, 60);
  if (!allowed) return json({ error: "Rate limit exceeded" }, 429, { "Retry-After": retryAfter });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const endpoint = pathParts[2]; // "search" or "product"
  
  if (endpoint === "search") {
    return handleOFFSearch(url);
  } else if (endpoint === "product") {
    return handleOFFProduct(url, pathParts[3]); // product code
  } else {
    return json({ error: "Invalid endpoint. Use /off/search or /off/product" }, 400);
  }
}

async function handleOFFSearch(url: URL): Promise<Response> {
  const query = url.searchParams.get("query");
  if (!query) {
    return json({ error: "Missing ?query parameter" }, 400);
  }

  // Build OFF search URL with correct v2 API parameters
  const searchParams = new URLSearchParams({
    search_terms: query,            // Correct parameter for v2 API
    page_size: "20",
    lc: "en",                       // Language preference for English
    fields: [
      "code","product_name","product_name_en","brands","categories","nutriments","nutrition_grades_tags",
      "image_url","image_small_url","serving_size","quantity"
    ].join(",")
  });
  
  const offURL = `${OFF_BASE}/search?${searchParams}`;

  try {
    const res = await fetch(offURL, {
      cf: { 
        cacheEverything: true, 
        cacheTtl: 300 // Cache search results for 5 minutes
      },
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      return json({ error: "OFF API error", status: res.status }, 502);
    }

    const data = await res.json() as any;
    
    // Enhance products with better names and metadata
    const products = data.products?.map((product: any) => ({
      ...product,
      // Get the best available product name
      product_name: product.product_name || product.product_name_en || `Product ${product.code}`,
      // Add helpful flags
      has_nutrition: !!product.nutriments && Object.keys(product.nutriments).length > 0,
      has_image: !!product.image_url,
      // Add nutrition grade if available
      nutrition_grade: product.nutrition_grades_tags?.[0]?.replace('en:', '') || null
    })) || [];

    const enhancedData = {
      ...data,
      products: products
    };

    return new Response(JSON.stringify(enhancedData), {
      status: res.status,
      headers: {
        ...cors().headers,
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=300"
      }
    });
  } catch (error) {
    return json({ error: "Failed to fetch from Open Food Facts API" }, 500);
  }
}

async function handleOFFProduct(url: URL, code?: string): Promise<Response> {
  const productCode = code || url.searchParams.get("code");
  if (!productCode) {
    return json({ error: "Missing product code. Use /off/product/{code} or ?code parameter" }, 400);
  }

  // Build OFF product URL with comprehensive fields including multiple languages
  const productParams = new URLSearchParams({
    fields: [
      "code","product_name","product_name_en","product_name_fr","product_name_de","product_name_it","product_name_es",
      "brands","categories","ingredients_text","nutriments","nutrition_grades_tags","nova_group","nutriscore_grade","ecoscore_grade",
      "image_url","image_small_url","serving_size","quantity","packaging"
    ].join(",")
  });

  const offURL = `${OFF_BASE}/product/${productCode}?${productParams}`;

  try {
    const res = await fetch(offURL, {
      cf: { 
        cacheEverything: true, 
        cacheTtl: 86400 // Cache product data for 24 hours
      },
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      return json({ error: "OFF API error", status: res.status }, 502);
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        ...cors().headers,
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400"
      }
    });
  } catch (error) {
    return json({ error: "Failed to fetch from Open Food Facts API" }, 500);
  }
} 