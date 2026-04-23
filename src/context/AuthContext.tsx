import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import cloudbase, { app as tcbApp, checkLogin } from "../utils/cloudbase";

interface User {
  uid: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await checkLogin();
        if (session && (session as any).isLoggedIn !== false) {
          const uid = (session as any).user?.uid || (session as any).uid || "";
          const uname =
            (session as any).user?.username || (session as any).username || "";
          if (uid) {
            setUser({ uid, username: uname });
          }
        }
      } catch {
        // not logged in
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (username: string, password: string) => {
    const auth = tcbApp.auth();
    const res = await auth.signInWithPassword({ username, password });
    if (res?.data?.session) {
      setUser({ uid: String((res.data.session as any).uid || ""), username });
    }
  };

  const register = async (username: string, password: string) => {
    const auth = tcbApp.auth();
    await auth.signUp({ username, password });
    const res = await auth.signInWithPassword({ username, password });
    if (res?.data?.session) {
      setUser({ uid: String((res.data.session as any).uid || ""), username });
    }
  };

  const logout = async () => {
    await cloudbase.logout();
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
