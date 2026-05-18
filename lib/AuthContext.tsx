'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { JwtPayload } from './auth';

interface AuthContextType {
  user: JwtPayload | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Cek status login
  const checkAuth = async () => {
    try {
      console.log('🔍 checkAuth: Memeriksa status login...');

      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('📡 /api/auth/me status:', res.status);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          console.log(' User ditemukan:', data.user.username);
          setUser(data.user);
        } else {
          console.log(' Tidak ada user yang valid');
          setUser(null);
        }
      } else {
        console.log(' /api/auth/me gagal');
        setUser(null);
      }
    } catch (err) {
      console.error(' Check auth error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log(' Login attempt:', username);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      console.log(' Login response status:', res.status);

      const data = await res.json();

      if (data.success) {
        console.log(' Login berhasil');
        setUser(data.user);
        return { success: true };
      } else {
        console.error(' Login gagal:', data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error(' Login error:', err);
      return { success: false, error: 'Terjadi kesalahan koneksi' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      }).catch(() => {});
    } catch {}
    
    setUser(null);
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return context;
};