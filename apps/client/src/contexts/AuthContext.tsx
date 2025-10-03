/**
 * Authentication context for managing auth state and token management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, User, AuthResponse, ApiError } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      // Check if we have a token
      const token = apiService.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Try to get current user
      const currentUser = await apiService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // If error, clear any existing token
      apiService.clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const authResponse: AuthResponse = await apiService.login({ email, password });
      setUser(authResponse.user);
      
      // Store refresh token for later use (in memory only)
      // In a real app, you might want to store this more securely
      sessionStorage.setItem('refreshToken', authResponse.refreshToken);
    } catch (error) {
      const apiError = error as ApiError;
      setError(apiError.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await apiService.logout();
    } catch (error) {
      // Even if logout fails on server, clear local state
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      setUser(null);
      apiService.clearToken();
      sessionStorage.removeItem('refreshToken');
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = await apiService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // If refresh fails, user might need to login again
      console.error('Failed to refresh user:', error);
      await logout();
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Token refresh logic
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (user) {
      // Set up token refresh interval (every 30 minutes)
      refreshInterval = setInterval(async () => {
        try {
          const refreshToken = sessionStorage.getItem('refreshToken');
          if (refreshToken) {
            const authResponse = await apiService.refreshToken(refreshToken);
            sessionStorage.setItem('refreshToken', authResponse.refreshToken);
            // User data should be the same, but refresh just in case
            setUser(authResponse.user);
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          // If refresh fails, logout user
          await logout();
        }
      }, 30 * 60 * 1000); // 30 minutes
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;