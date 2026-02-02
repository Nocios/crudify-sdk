/**
 * Response types for testing - mirrors API response structures
 */

export interface PermissionsResponseData {
  modules: string[];
  actions: string[];
}

export interface UserResponseData {
  _id: string;
  name: string;
  email?: string;
  profileImage?: string;
}

export interface LoginResponseData {
  loginStatus: 'successful';
  token: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

export interface RefreshTokenResponseData {
  token: string;
  refreshToken: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
}

export interface SignedUrlResponseData {
  url: string;
}

export interface SequenceResponseData {
  value: number;
}

export interface StructureResponseData {
  modules?: {
    posts?: unknown;
    [key: string]: unknown;
  };
}
