"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/hooks/use-poll";

export interface UserDetail {
  id: number;
  name: string | null;
  email: string;
  imageUrl: string | null;
  timezone: string | null;
  plan: string | null;
  agentCredits: number | null;
  usageCredits: number | null;
  createdAt: string;
}

interface UserContextValue {
  user: UserDetail | null;
  loading: boolean;
  setUser: (user: UserDetail | null) => void;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserDetail }>("/api/users");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, loading, setUser, refresh }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
