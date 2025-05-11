# USDA API Proxy Cloudflare Worker

This Cloudflare Worker acts as a secure proxy for the USDA FoodData Central API. It allows client applications (like a React Native app) to query the USDA API without embedding the API key directly in the client-side code. The worker appends the `USDA_KEY` (stored as a secret in Cloudflare) to requests before forwarding them to the USDA API.

## Features

*   Proxies requests to the USDA `/fdc/v1/foods/search` endpoint.
*   Securely handles the USDA API key.
*   Returns JSON responses from the USDA API.

## Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   A [Cloudflare account](https://dash.cloudflare.com/sign-up)
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and configured

## Setup

1.  **Clone the repository (or create your project):**
    ```bash
    # If you have a git repo already, navigate to its directory
    # Otherwise, for a new project:
    # npx wrangler init usda-api-proxy-worker
    # cd usda-api-proxy-worker
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
        You need to set this as a secret in your Cloudflare Worker settings. If you followed the interactive deployment, you might have already done this. Otherwise, you can set it using Wrangler:
        ```bash
        npx wrangler secret put USDA_KEY
        ```
        You will be prompted to enter the value for the secret.

## Local Development

1.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This will typically start a server at `http://localhost:8787`.

2.  **Test the worker:**
    Open your browser or use a tool like `curl` to send a request:
    `http://localhost:8787/?query=YOUR_SEARCH_TERM`
    For example:
    `http://localhost:8787/?query=cheddar%20cheese`

## Deployment

1.  **Deploy to Cloudflare:**
    ```bash
    npm run deploy
    ```
    After successful deployment, Wrangler will output the public URL for your worker (e.g., `https://usda-api-proxy-worker.your-subdomain.workers.dev`).

## Usage Example (React Native App)

You can call this worker from your client-side application. Here's an example of how you might use it in a React Native app using TypeScript:

**Worker URL:** `https://usda-api-proxy-worker.usda-data-proxy.workers.dev` (Replace `usda-data-proxy` with your actual `workers.dev` subdomain if it's different)

```typescript
// src/db/services/usda.ts

export interface ExternalFoodResult {
  fdcId: number;
  usdaDataType: string;
  name: string;
}

/**
 * Search our Cloudflare Worker proxy instead of calling USDA directly.
 * The worker will append your API key securely.
 */
export async function searchUSDA(query: string): Promise<ExternalFoodResult[]> {
  // !!! IMPORTANT: Replace with your deployed worker URL !!!
  const proxyUrl = 'https://usda-api-proxy-worker.usda-data-proxy.workers.dev'; 
  const url = `${proxyUrl}/?query=${encodeURIComponent(query)}`; // Note: /search is not needed if worker handles root path

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA proxy error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  
  // Assuming the worker simply forwards USDA's shape, 
  // and the response structure from USDA for /foods/search is an object containing a 'foods' array.
  if (!json.foods || !Array.isArray(json.foods)) {
    console.error("Unexpected JSON structure from proxy:", json);
    throw new Error("Failed to parse food data from proxy.");
  }
  
  return (json.foods as any[]).map(f => ({
    fdcId:       f.fdcId,
    name:        f.description,
    usdaDataType: f.dataType,
  }));
}

// Example usage:
// searchUSDA("cheddar cheese")
//   .then(results => console.log(results))
//   .catch(error => console.error(error));
```

**Note on the client-side code:**
The provided `searchUSDA` function assumes your Cloudflare worker's `fetch` handler is triggered by requests to the root path (`/`) with a `query` parameter (e.g., `https://your-worker.workers.dev/?query=...`). The example has been updated to reflect this common setup for a simple proxy. If your worker is specifically listening on a `/search` path, adjust the `url` in the client code accordingly.

The USDA API response for a search often looks like this:
```json
{
  "totalHits": 1234,
  "currentPage": 1,
  "totalPages": 124,
  "pageList": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "foodSearchCriteria": {
    "query": "cheddar cheese",
    "generalSearchInput": "cheddar cheese",
    // ... other criteria
  },
  "foods": [
    {
      "fdcId": 123456,
      "description": "CHEESE, CHEDDAR",
      "dataType": "Branded",
      // ... other food properties
    }
    // ... more food items
  ]
}
```
The `searchUSDA` function correctly maps over the `foods` array from this structure. 