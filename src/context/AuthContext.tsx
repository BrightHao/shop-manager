import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import cloudbase, { app as tcbApp } from "../utils/cloudbase";

interface User {
  uid: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function extractUser(session: any): User | null {
  const uid =
    session.user?.uid || session.uid || session.user?.id || session.sub || "";
  const uname =
    session.user?.username ||
    session.username ||
    session.user?.user_metadata?.username ||
    session.user?.user_metadata?.name ||
    session.user?.user_metadata?.nickName ||
    session.user?.user_metadata?.nickname ||
    "";
  return uid ? { uid, username: uname } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const auth = tcbApp.auth();
        const { data } = await auth.getSession();
        if (data?.session && !(data.session as any).is_anonymous) {
          const u = extractUser(data.session);
          if (u) setUser(u);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (username: string, password: string) => {
    const auth = tcbApp.auth();
    const result = await auth.signInWithPassword({
      username,
      password,
    });
    if (result.error) {
      throw new Error(result.error.message || "登录失败");
    }
    if (result.data?.session) {
      const u = extractUser(result.data.session);
      if (u) {
        setUser(u);
        // Sync user profile to MySQL
        try {
          const { callShopApi } = await import("../api/shop");
          await callShopApi("users.sync", { tcbUid: u.uid });
        } catch (e) {
          console.warn("Failed to sync user to MySQL:", e);
        }
      }
    }
  };

  const register = async (
    username: string,
    phone: string,
    password: string,
  ) => {
    const auth = tcbApp.auth();
    const result = await auth.signUp({
      username,
      phone_number: phone,
      password,
    });
    if (result.error) {
      throw new Error(result.error.message || "注册失败");
    }
    // Auto sign-in after registration
    const loginResult = await auth.signInWithPassword({ username, password });
    if (loginResult.error) {
      throw new Error("注册成功，请重新登录");
    }
    if (loginResult.data?.session) {
      const u = extractUser(loginResult.data.session);
      if (u) {
        setUser(u);
        // Sync user profile to MySQL
        try {
          const { callShopApi } = await import("../api/shop");
          await callShopApi("users.sync", { tcbUid: u.uid });
        } catch (e) {
          console.warn("Failed to sync user to MySQL:", e);
        }
      }
    }
  };

  const logout = async () => {
    try {
      await cloudbase.logout();
    } catch {
      // ignore logout errors
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
