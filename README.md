# Food API Proxy Cloudflare Worker

This Cloudflare Worker acts as a secure proxy for multiple food databases:
- **USDA FoodData Central API** - Comprehensive nutritional data for foundation foods
- **Open Food Facts API** - Community-driven database of commercial food products

The worker allows client applications (like React Native apps) to query both APIs without embedding API keys directly in client-side code and provides unified rate limiting and caching.

## Features

*   **Multi-API Support**: Proxies requests to both USDA and Open Food Facts APIs
*   **Secure Key Handling**: USDA API key stored securely as Cloudflare secret
*   **Rate Limiting**: Intelligent rate limiting respecting each API's limits
*   **Caching**: Edge caching for improved performance
*   **CORS Support**: Full CORS support for web applications
*   **TypeScript**: Full TypeScript support with proper types

## API Endpoints

### USDA FoodData Central
- **Search Endpoint**: `/usda/search?query={search_term}`
- **Purpose**: Search foundation foods from USDA database
- **Rate Limit**: 10 requests per minute per IP
- **Cache**: 5 minutes for search results
- **Backward Compatibility**: `/?query={search_term}` still works

### Open Food Facts
- **Search Endpoint**: `/off/search?query={search_term}`
- **Product Endpoint**: `/off/product/{barcode}` or `/off/product?code={barcode}`
- **Purpose**: Search commercial food products and get detailed product information
- **Rate Limit**: 6 requests per minute per IP (conservative)
- **Cache**: 5 minutes for search, 24 hours for product details

## Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   A [Cloudflare account](https://dash.cloudflare.com/sign-up)
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and configured

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd food-api-proxy-worker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure your USDA API Key:**
    *   **For local development (`wrangler dev`):**
        Create a `.dev.vars` file in the root of your project and add your USDA API key:
        ```
        USDA_KEY="YOUR_USDA_API_KEY_HERE"
        ```
        (Ensure `.dev.vars` is in your `.gitignore` file to prevent committing your key.)
    *   **For deployment:**
        Set the USDA API key as a secret in your Cloudflare Worker:
        ```bash
        npx wrangler secret put USDA_KEY
        ```
        You will be prompted to enter the value for the secret.

## Local Development

1.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This will start a server at `http://localhost:8787`.

2.  **Test the endpoints:**
    
    **USDA Search:**
    ```bash
    curl "http://localhost:8787/usda/search?query=cheddar%20cheese"
    # Backward compatible (legacy):
    curl "http://localhost:8787/?query=cheddar%20cheese"
    ```
    
    **Open Food Facts Search:**
    ```bash
    curl "http://localhost:8787/off/search?query=coca%20cola"
    ```
    
    **Open Food Facts Product:**
    ```bash
    curl "http://localhost:8787/off/product/3017620422003"
    # Or with query param:
    curl "http://localhost:8787/off/product?code=3017620422003"
    ```

## Deployment

1.  **Deploy to Cloudflare:**
    ```bash
    npm run deploy
    ```
    After successful deployment, Wrangler will output the public URL for your worker.

## Client-Side Usage Examples

### TypeScript/React Native Integration

```typescript
// types/food.ts
export interface USDAFoodResult {
  fdcId: number;
  usdaDataType: string;
  name: string;
}

export interface OFFProduct {
  code: string;
  product_name: string;
  brands?: string;
  nutriments: any;
  categories?: string;
}

export interface OFFSearchResult {
  products: OFFProduct[];
  count: number;
  page: number;
  page_count: number;
  page_size: number;
}
```

```typescript
// services/foodApi.ts
const API_BASE = 'https://your-worker.your-subdomain.workers.dev';

/**
 * Search USDA FoodData Central
 */
export async function searchUSDA(query: string): Promise<USDAFoodResult[]> {
  const url = `${API_BASE}/usda/search?query=${encodeURIComponent(query)}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  
  if (!json.foods || !Array.isArray(json.foods)) {
    throw new Error("Failed to parse USDA food data");
  }
  
  return json.foods.map((f: any) => ({
    fdcId: f.fdcId,
    name: f.description,
    usdaDataType: f.dataType,
  }));
}

/**
 * Search Open Food Facts
 */
export async function searchOFF(query: string): Promise<OFFProduct[]> {
  const url = `${API_BASE}/off/search?query=${encodeURIComponent(query)}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OFF API error: ${res.status} ${res.statusText}`);
  }

  const json: OFFSearchResult = await res.json();
  return json.products || [];
}

/**
 * Get Open Food Facts product by barcode
 */
export async function getOFFProduct(barcode: string): Promise<OFFProduct | null> {
  const url = `${API_BASE}/off/product/${barcode}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`OFF API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.product || null;
}

// Usage examples:
async function searchFoods() {
  try {
    // Search both databases
    const [usdaResults, offResults] = await Promise.all([
      searchUSDA("chicken breast"),
      searchOFF("chicken breast")
    ]);
    
    console.log("USDA Results:", usdaResults);
    console.log("OFF Results:", offResults);
  } catch (error) {
    console.error("Search failed:", error);
  }
}

async function getProductDetails() {
  try {
    const product = await getOFFProduct("3017620422003"); // Nutella barcode
    console.log("Product:", product);
  } catch (error) {
    console.error("Product fetch failed:", error);
  }
}
```

## API Response Formats

### USDA Search Response
```json
{
  "totalHits": 1234,
  "currentPage": 1,
  "totalPages": 124,
  "foods": [
    {
      "fdcId": 123456,
      "description": "CHEESE, CHEDDAR",
      "dataType": "Foundation",
      "publicationDate": "2019-04-01",
      "brandOwner": "",
      "foodNutrients": [...]
    }
  ]
}
```

### Open Food Facts Search Response
```json
{
  "count": 156,
  "page": 1,
  "page_count": 8,
  "page_size": 20,
  "products": [
    {
      "code": "3017620422003",
      "product_name": "Nutella",
      "brands": "Ferrero",
      "categories": "Spreads,Sweet spreads,Cocoa and hazelnuts spreads",
      "nutriments": {
        "energy_100g": 2255,
        "fat_100g": 30.9,
        "saturated-fat_100g": 10.6,
        "carbohydrates_100g": 57.5,
        "sugars_100g": 56.3,
        "proteins_100g": 6.3,
        "salt_100g": 0.107
      }
    }
  ]
}
```

### Open Food Facts Product Response
```json
{
  "code": "3017620422003",
  "product": {
    "code": "3017620422003",
    "product_name": "Nutella",
    "brands": "Ferrero",
    "ingredients_text": "Sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%)...",
    "nutriments": { /* detailed nutrition data */ },
    "categories": "Spreads,Sweet spreads,Cocoa and hazelnuts spreads"
  },
  "status": 1,
  "status_verbose": "product found"
}
```

## Rate Limiting

The worker implements intelligent rate limiting using Cloudflare KV:
- **USDA**: 10 requests per minute per IP
- **Open Food Facts**: 6 requests per minute per IP (conservative, as OFF recommends 10/min)

When rate limits are exceeded, the API returns:
```json
{
  "error": "Rate limit exceeded"
}
```
With HTTP status `429` and a `Retry-After` header.

## Caching Strategy

- **USDA Search**: 5 minutes edge cache
- **OFF Search**: 5 minutes edge cache  
- **OFF Product**: 24 hours edge cache (product data changes infrequently)

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": "Description of the error",
  "status": 400  // Optional: upstream API status
}
```

Common error codes:
- `400`: Missing required parameters
- `429`: Rate limit exceeded
- `502`: Upstream API error
- `500`: Internal server error

## Development

The project is structured as a multi-handler Cloudflare Worker:

```
/src
├─ index.ts        ← Main router
├─ usda.ts         ← USDA API handler
├─ off.ts          ← Open Food Facts handler
├─ utils.ts        ← Shared utilities (CORS, rate limiting)
└─ env.d.ts        ← TypeScript environment definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both APIs
5. Submit a pull request

## License

[Your License Here]