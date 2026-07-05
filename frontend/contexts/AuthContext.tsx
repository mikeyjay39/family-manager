import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getStoredToken, setStoredToken, clearStoredToken } from '@/lib/auth/storage';
import { apiFetch } from '@/lib/api/client';
import type { LoginRequest, LoginResponse } from '@/lib/api/types';
import { useTenant } from '@/lib/tenant/TenantContext';

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
};

type LoginResult = {
  success: boolean;
  error?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreToken = async () => {
      setIsLoading(true);
      try {
        const storedToken = await getStoredToken(tenant.id);
        if (!cancelled && storedToken) {
          setToken(storedToken);
        } else if (!cancelled) {
          setToken(null);
        }
      } catch (error) {
        console.error('Failed to restore token:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void restoreToken();

    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const clearAuthState = useCallback(async () => {
    await clearStoredToken(tenant.id);
    setToken(null);
  }, [tenant.id]);

  const handleUnauthorized = useCallback(async () => {
    try {
      await clearAuthState();
    } catch (error) {
      console.error('Unauthorized handler error:', error);
    }
  }, [clearAuthState]);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const body: LoginRequest = { username, password };
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: 'Server error. Please try again later.',
        };
      }

      const data = (await response.json()) as LoginResponse;
      const newToken = data.token;

      await setStoredToken(tenant.id, newToken);
      setToken(newToken);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Could not connect to server. Please check your connection.',
      };
    }
  };

  const logout = async () => {
    try {
      await clearAuthState();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value: AuthContextType = {
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    handleUnauthorized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
