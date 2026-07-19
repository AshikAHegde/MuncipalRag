import React, { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { AuthContext } from './auth-context.js';
const TOKEN_KEY = 'muni-rag-token';
const USER_KEY = 'muni-rag-user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const savedUser = window.localStorage.getItem(USER_KEY);
    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(Boolean(window.localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);

    let isCancelled = false;

    const loadCurrentUser = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/api/auth/me');

        if (!isCancelled) {
          setUser(response.data.user);
        }
      } catch {
        if (!isCancelled) {
          setToken(null);
          setUser(null);
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const saveSession = (nextToken, nextUser) => {
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const login = async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    saveSession(response.data.token, response.data.user);
    return response.data;
  };

  const register = async (payload) => {
    const response = await api.post('/api/auth/register', payload);
    saveSession(response.data.token, response.data.user);
    return response.data;
  };

  const updateProfile = async (payload) => {
    const response = await api.put('/api/auth/profile', payload);
    const nextUser = response.data.user;
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return response.data;
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
