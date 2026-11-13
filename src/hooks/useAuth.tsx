import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@/types";
import { getMe, logout as apiLogout } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isModerator: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
  isAdmin: false,
  isModerator: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.isAdmin === true;
  const isModerator = user?.isModerator === true;

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      if (data?.user?.id) {
        setUser(data.user);
      } else {
        setUser(null);
        localStorage.removeItem("token");
      }
    } catch {
      setUser(null);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem("token", token);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { }
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAdmin, isModerator }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
