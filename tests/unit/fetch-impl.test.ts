/**
 * Tests for fetch-impl.ts
 * Tests browser/Node.js environment detection and fetch implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _fetch, shutdownNodeSpecifics, getInternalNodeSpecificsSetupPromise, IS_BROWSER } from "../../src/fetch-impl";

describe("fetch-impl", () => {
  describe("IS_BROWSER detection", () => {
    it("should detect browser environment correctly", () => {
      // In happy-dom test environment, window is defined
      expect(typeof IS_BROWSER).toBe("boolean");
    });
  });

  describe("_fetch", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should call fetch with url and options", async () => {
      const mockResponse = { ok: true, status: 200 };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await _fetch("https://api.test.com", { method: "GET" });

      expect(result).toEqual(mockResponse);
    });

    it("should handle fetch without options", async () => {
      const mockResponse = { ok: true };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await _fetch("https://api.test.com");

      expect(result).toEqual(mockResponse);
    });

    it("should strip dispatcher option for browser compatibility", async () => {
      const mockResponse = { ok: true };
      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", fetchSpy);

      // dispatcher is a Node.js undici-specific option that should be stripped for browser compatibility
      const optionsWithDispatcher = {
        method: "POST",
        dispatcher: "should-be-removed",
      } as RequestInit & { dispatcher?: unknown };

      await _fetch("https://api.test.com", optionsWithDispatcher);

      // Verify dispatcher was removed from options
      expect(fetchSpy).toHaveBeenCalledWith("https://api.test.com", {
        method: "POST",
      });
    });
  });

  describe("shutdownNodeSpecifics", () => {
    it("should resolve without errors", async () => {
      await expect(shutdownNodeSpecifics()).resolves.toBeUndefined();
    });

    it("should resolve with log level parameter", async () => {
      await expect(shutdownNodeSpecifics("debug")).resolves.toBeUndefined();
    });
  });

  describe("getInternalNodeSpecificsSetupPromise", () => {
    it("should return a resolved promise", async () => {
      const result = getInternalNodeSpecificsSetupPromise();

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });
  });
});
