import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src';

// Mock KV namespace with proper methods
const mockKV = {
	get: async (key: string, options?: any) => null, // Return null for all keys (no rate limit hits)
	put: async (key: string, value: string, options?: any) => Promise.resolve(),
	delete: async (key: string) => Promise.resolve(),
	list: async (options?: any) => ({ keys: [], list_complete: true, cursor: undefined }),
	getWithMetadata: async (key: string, options?: any) => ({ value: null, metadata: null, cacheStatus: null }),
	// Add other required methods with minimal implementations
} as unknown as KVNamespace;

// Mock environment with a test API key and proper KV mock
const testEnv: Env = {
	USDA_KEY: 'test-api-key',
	RATE: mockKV // Use proper mock KV namespace
};

describe('Food API Proxy Worker', () => {
	describe('USDA API endpoints', () => {

		it('returns 400 for /usda/search without query parameter', async () => {
			const request = new Request('http://example.com/usda/search');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as { error: string };
			expect(json.error).toBe('Missing ?query parameter');
		});

		it('returns 400 for invalid USDA endpoint', async () => {
			const request = new Request('http://example.com/usda/invalid');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as { error: string };
			expect(json.error).toBe('Invalid endpoint. Use /usda/search');
		});


	});

	describe('Open Food Facts API endpoints', () => {


		it('returns 400 for /off/search without query parameter', async () => {
			const request = new Request('http://example.com/off/search');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as { error: string };
			expect(json.error).toBe('Missing ?query parameter');
		});

		it('responds to /off/product with barcode in path', async () => {
			const request = new Request('http://example.com/off/product/3017620422003');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('responds to /off/product with code query parameter', async () => {
			const request = new Request('http://example.com/off/product?code=3017620422003');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('returns 400 for /off/product without code', async () => {
			const request = new Request('http://example.com/off/product');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as { error: string };
			expect(json.error).toContain('Missing product code');
		});

		it('returns 400 for invalid OFF endpoint', async () => {
			const request = new Request('http://example.com/off/invalid');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as { error: string };
			expect(json.error).toBe('Invalid endpoint. Use /off/search or /off/product');
		});
	});

	describe('CORS handling', () => {
		it('handles OPTIONS requests for CORS preflight', async () => {
			const request = new Request('http://example.com/usda/search', { method: 'OPTIONS' });
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(204);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, OPTIONS');
		});
	});

	describe('404 handling', () => {
		it('returns 404 for unknown paths', async () => {
			const request = new Request('http://example.com/unknown');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(404);
			const text = await response.text();
			expect(text).toBe('Not found. Use /usda/search or /off/search endpoints.');
		});

		it('returns 404 for root path without query parameter', async () => {
			const request = new Request('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(404);
		});
	});

	describe('Integration tests', () => {
		it('USDA search endpoint works (integration)', async () => {
			const request = new Request('http://example.com/usda/search?query=apple');
			const response = await SELF.fetch(request);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('OFF search endpoint works (integration)', async () => {
			const request = new Request('http://example.com/off/search?query=apple');
			const response = await SELF.fetch(request);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});
	});
});
