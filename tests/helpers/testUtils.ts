/**
 * Test utilities for crudify-sdk
 * Provides helper functions for testing Crudify SDK
 */

import { CrudifyInstance } from "../../src/crudify";

/**
 * Reset Crudify singleton state completely between tests
 * CRITICAL: This resets the isInitialized flag to allow re-initialization
 */
export function resetCrudifyState(): void {
  const instance = CrudifyInstance as any;

  // Reset authentication state
  instance.token = "";
  instance.refreshToken = "";
  instance.tokenExpiresAt = 0;
  instance.refreshExpiresAt = 0;

  // Reset configuration
  instance.endpoint = "";
  instance.apiKey = "";
  instance.publicApiKey = "";
  instance.logLevel = "none";
  instance.apiEndpointAdmin = "";
  instance.apiKeyEndpointAdmin = "";

  // Reset interceptors and callbacks
  instance.responseInterceptor = null;
  instance.onTokensInvalidated = null;

  // Reset refresh state (race condition prevention)
  instance.refreshPromise = null;
  instance.isRefreshing = false;

  // ✅ CRITICAL: Reset initialization guards
  // Without this, init() will skip re-initialization in tests
  instance.isInitialized = false;
  instance.initPromise = null;
}

/**
 * Create a valid JWT token for testing
 * @param payload - JWT payload object
 * @param expiresIn - Expiration time in seconds from now (default: 3600 = 1 hour)
 * @returns Base64-encoded JWT token
 */
export function createMockJWT(payload: Record<string, any>, expiresIn: number = 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    sub: payload.sub || "user123",
    exp: now + expiresIn,
    iat: now,
    type: "access",
    ...payload,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(fullPayload));
  const signature = "mock-signature";

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create an expired JWT token for testing
 * @param payload - JWT payload object
 * @param expiredBySeconds - How many seconds ago the token expired (default: 60)
 * @returns Expired Base64-encoded JWT token
 */
export function createExpiredJWT(payload: Record<string, any> = {}, expiredBySeconds: number = 60): string {
  return createMockJWT(payload, -expiredBySeconds);
}

/**
 * Mock fetch response for successful init
 */
export function mockInitSuccess(endpoint: string = "https://api.test.com/graphql", apiKey: string = "test-endpoint-key") {
  return {
    json: async () => ({
      data: {
        response: {
          apiEndpoint: endpoint,
          apiKeyEndpoint: apiKey,
          apiEndpointAdmin: endpoint.replace("/graphql", "/admin"),
          apiKeyEndpointAdmin: apiKey + "-admin",
        },
      },
    }),
  };
}

/**
 * Mock fetch response for failed init
 */
export function mockInitFailure(errorMessage: string = "Invalid API key") {
  return {
    json: async () => ({
      errors: [{ message: errorMessage }],
    }),
  };
}

/**
 * Mock fetch response for successful login
 */
export function mockLoginSuccess(token?: string, refreshToken?: string, expiresIn: number = 900, refreshExpiresIn: number = 604800) {
  const mockToken = token || createMockJWT({ username: "testuser" });
  const mockRefreshToken = refreshToken || "refresh-token-123";

  return {
    json: async () => ({
      data: {
        response: {
          status: "OK",
          data: JSON.stringify({
            token: mockToken,
            refreshToken: mockRefreshToken,
            expiresIn,
            refreshExpiresIn,
            version: "1.0.0",
          }),
        },
      },
    }),
  };
}

/**
 * Mock fetch response for login with field errors
 */
export function mockLoginFieldError(errors: Array<{ path: string[]; message: string }>) {
  return {
    json: async () => ({
      data: {
        response: {
          status: "FIELD_ERROR",
          data: JSON.stringify(errors),
        },
      },
    }),
  };
}

/**
 * Mock fetch response for general error
 */
export function mockError(errorMessage: string = "UNKNOWN_ERROR") {
  return {
    json: async () => ({
      data: {
        response: {
          status: "ERROR",
          data: JSON.stringify({ message: errorMessage }),
        },
      },
    }),
  };
}

/**
 * Mock fetch response for successful refresh token
 */
export function mockRefreshSuccess(newToken?: string, newRefreshToken?: string, expiresIn: number = 900) {
  const mockNewToken = newToken || createMockJWT({ username: "testuser" });
  const mockNewRefreshToken = newRefreshToken || "new-refresh-token";

  return {
    json: async () => ({
      data: {
        response: {
          status: "OK",
          data: JSON.stringify({
            token: mockNewToken,
            refreshToken: mockNewRefreshToken,
            expiresIn,
            refreshExpiresIn: 604800,
          }),
        },
      },
    }),
  };
}

/**
 * Mock fetch response for successful CRUD operation
 */
export function mockCrudSuccess(data: any) {
  return {
    json: async () => ({
      data: {
        response: {
          status: "OK",
          data: JSON.stringify(data),
        },
      },
    }),
  };
}

/**
 * Mock fetch response for 401 Unauthorized (for testing auto-retry)
 */
export function mockUnauthorizedError() {
  return {
    json: async () => ({
      errors: [
        {
          message: "Unauthorized: Invalid token",
          extensions: { code: "UNAUTHENTICATED" },
        },
      ],
    }),
  };
}

/**
 * Wait for a promise to resolve with a timeout
 * Useful for testing async operations
 */
export async function waitFor(condition: () => boolean, timeout: number = 1000, interval: number = 50): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Setup mock fetch for a sequence of responses
 * Useful for testing retry logic and multiple requests
 */
export function mockFetchSequence(responses: Array<any>): typeof globalThis.fetch {
  let callCount = 0;

  return (async () => {
    const response = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return response;
  }) as any;
}
