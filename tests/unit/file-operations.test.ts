/**
 * File Operations Unit Tests
 * Tests for generateSignedUrl, disableFile, and getFileUrl methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the fetch implementation
const mockExecuteQuery = vi.fn();

// Create a mock Crudify class for testing the file operations logic
class MockCrudify {
  private endpoint: string | null = 'https://api.test.com';
  private token: string | null = 'test-token';

  public formatResponseInternal(rawResponse: any) {
    if (!rawResponse?.data?.response) {
      return {
        success: false,
        errors: 'Invalid response format',
        errorCode: 'INVALID_RESPONSE',
      };
    }

    const response = rawResponse.data.response;
    const status = response.status;
    const data = response.data ? JSON.parse(response.data) : null;

    if (status === 'ok' || status === '200') {
      return { success: true, data };
    }

    return {
      success: false,
      errors: data?.message || 'Unknown error',
      errorCode: status,
    };
  }

  public adaptToPublicResponse(internalResponse: any) {
    return internalResponse;
  }

  public async generateSignedUrl(data: { fileName: string; contentType: string; visibility?: 'public' | 'private' }) {
    if (!this.endpoint || !this.token) {
      throw new Error('Crudify: Not initialized. Call init() first.');
    }

    const requestData = {
      fileName: data.fileName,
      contentType: data.contentType,
      visibility: data.visibility || 'private',
    };

    const rawResponse = await mockExecuteQuery('mutationGenerateSignedUrl', { data: JSON.stringify(requestData) });

    return this.adaptToPublicResponse(this.formatResponseInternal(rawResponse));
  }

  public async disableFile(data: { filePath: string }) {
    if (!this.endpoint || !this.token) {
      throw new Error('Crudify: Not initialized. Call init() first.');
    }

    const rawResponse = await mockExecuteQuery('mutationDisableFile', { data: JSON.stringify(data) });

    return this.adaptToPublicResponse(this.formatResponseInternal(rawResponse));
  }

  public async getFileUrl(data: { filePath: string; expiresIn?: number }) {
    if (!this.endpoint || !this.token) {
      throw new Error('Crudify: Not initialized. Call init() first.');
    }

    const rawResponse = await mockExecuteQuery('queryGetFileUrl', { data: JSON.stringify(data) });

    return this.adaptToPublicResponse(this.formatResponseInternal(rawResponse));
  }

  // For testing uninitialized state
  public setNotInitialized() {
    this.endpoint = null;
    this.token = null;
  }
}

describe('File Operations', () => {
  let crudify: MockCrudify;

  beforeEach(() => {
    crudify = new MockCrudify();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateSignedUrl', () => {
    it('should throw error when not initialized', async () => {
      crudify.setNotInitialized();

      await expect(
        crudify.generateSignedUrl({
          fileName: 'test.pdf',
          contentType: 'application/pdf',
        })
      ).rejects.toThrow('Crudify: Not initialized. Call init() first.');
    });

    it('should send request with private visibility by default', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              uploadUrl: 'https://s3.amazonaws.com/bucket/key?signed',
              s3Key: 'subscriber/private/test.pdf',
              visibility: 'private',
              publicUrl: null,
            }),
          },
        },
      });

      await crudify.generateSignedUrl({
        fileName: 'test.pdf',
        contentType: 'application/pdf',
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith('mutationGenerateSignedUrl', {
        data: JSON.stringify({
          fileName: 'test.pdf',
          contentType: 'application/pdf',
          visibility: 'private',
        }),
      });
    });

    it('should send request with public visibility when specified', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              uploadUrl: 'https://s3.amazonaws.com/bucket/key?signed',
              s3Key: 'subscriber/public/avatar.jpg',
              visibility: 'public',
              publicUrl: 'https://subscriber.crudia.com/public/avatar.jpg',
            }),
          },
        },
      });

      await crudify.generateSignedUrl({
        fileName: 'avatar.jpg',
        contentType: 'image/jpeg',
        visibility: 'public',
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith('mutationGenerateSignedUrl', {
        data: JSON.stringify({
          fileName: 'avatar.jpg',
          contentType: 'image/jpeg',
          visibility: 'public',
        }),
      });
    });

    it('should return success response with uploadUrl and s3Key', async () => {
      const expectedData = {
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?signed',
        s3Key: 'subscriber/private/document.pdf',
        visibility: 'private',
        publicUrl: null,
      };

      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify(expectedData),
          },
        },
      });

      const result = await crudify.generateSignedUrl({
        fileName: 'document.pdf',
        contentType: 'application/pdf',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedData);
    });

    it('should return publicUrl for public files', async () => {
      const expectedData = {
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?signed',
        s3Key: 'subscriber/public/logo.png',
        visibility: 'public',
        publicUrl: 'https://subscriber.crudia.com/public/logo.png',
      };

      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify(expectedData),
          },
        },
      });

      const result = await crudify.generateSignedUrl({
        fileName: 'logo.png',
        contentType: 'image/png',
        visibility: 'public',
      });

      expect(result.success).toBe(true);
      expect(result.data.publicUrl).toBe('https://subscriber.crudia.com/public/logo.png');
    });
  });

  describe('disableFile', () => {
    it('should throw error when not initialized', async () => {
      crudify.setNotInitialized();

      await expect(crudify.disableFile({ filePath: 'private/document.pdf' })).rejects.toThrow(
        'Crudify: Not initialized. Call init() first.'
      );
    });

    it('should send request with filePath', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              filePath: 'private/document.pdf',
              disabled: true,
            }),
          },
        },
      });

      await crudify.disableFile({ filePath: 'private/document.pdf' });

      expect(mockExecuteQuery).toHaveBeenCalledWith('mutationDisableFile', {
        data: JSON.stringify({ filePath: 'private/document.pdf' }),
      });
    });

    it('should return success response', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              filePath: 'private/document.pdf',
              disabled: true,
            }),
          },
        },
      });

      const result = await crudify.disableFile({ filePath: 'private/document.pdf' });

      expect(result.success).toBe(true);
      expect(result.data.disabled).toBe(true);
    });
  });

  describe('getFileUrl', () => {
    it('should throw error when not initialized', async () => {
      crudify.setNotInitialized();

      await expect(crudify.getFileUrl({ filePath: 'private/document.pdf' })).rejects.toThrow(
        'Crudify: Not initialized. Call init() first.'
      );
    });

    it('should send request with filePath', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              url: 'https://subscriber.crudia.com/public/avatar.jpg',
              isPublic: true,
              expiresAt: null,
            }),
          },
        },
      });

      await crudify.getFileUrl({ filePath: 'public/avatar.jpg' });

      expect(mockExecuteQuery).toHaveBeenCalledWith('queryGetFileUrl', {
        data: JSON.stringify({ filePath: 'public/avatar.jpg' }),
      });
    });

    it('should send request with expiresIn for private files', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              url: 'https://s3.amazonaws.com/bucket/key?signed',
              isPublic: false,
              expiresAt: Date.now() + 7200000,
            }),
          },
        },
      });

      await crudify.getFileUrl({
        filePath: 'private/document.pdf',
        expiresIn: 7200,
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith('queryGetFileUrl', {
        data: JSON.stringify({
          filePath: 'private/document.pdf',
          expiresIn: 7200,
        }),
      });
    });

    it('should return public URL for public files', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              url: 'https://subscriber.crudia.com/public/avatar.jpg',
              isPublic: true,
              expiresAt: null,
            }),
          },
        },
      });

      const result = await crudify.getFileUrl({ filePath: 'public/avatar.jpg' });

      expect(result.success).toBe(true);
      expect(result.data.isPublic).toBe(true);
      expect(result.data.expiresAt).toBeNull();
    });

    it('should return signed URL for private files', async () => {
      const futureTime = Date.now() + 3600000;

      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ok',
            data: JSON.stringify({
              url: 'https://s3.amazonaws.com/bucket/key?signed=...',
              isPublic: false,
              expiresAt: futureTime,
            }),
          },
        },
      });

      const result = await crudify.getFileUrl({ filePath: 'private/document.pdf' });

      expect(result.success).toBe(true);
      expect(result.data.isPublic).toBe(false);
      expect(result.data.expiresAt).toBe(futureTime);
    });
  });

  describe('Error Handling', () => {
    it('should return error response for failed generateSignedUrl', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'BadRequest',
            data: JSON.stringify({ message: 'Invalid file name' }),
          },
        },
      });

      const result = await crudify.generateSignedUrl({
        fileName: '../invalid.pdf',
        contentType: 'application/pdf',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBe('Invalid file name');
    });

    it('should return error response for file not found', async () => {
      mockExecuteQuery.mockResolvedValue({
        data: {
          response: {
            status: 'ItemNotFound',
            data: JSON.stringify({ message: 'File not found' }),
          },
        },
      });

      const result = await crudify.getFileUrl({ filePath: 'private/missing.pdf' });

      expect(result.success).toBe(false);
      expect(result.errors).toBe('File not found');
    });
  });
});
