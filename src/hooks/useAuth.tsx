import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isPaid: boolean;
  entitlementsLoading: boolean;
  signOut: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isPaid: false,
  entitlementsLoading: true,
  signOut: async () => {},
  refreshEntitlements: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);

  const refreshEntitlements = useCallback(async (userId?: string) => {
    const uid = userId ?? user?.id;
    if (!uid) {
      setIsAdmin(false);
      setIsPaid(false);
      setEntitlementsLoading(false);
      return;
    }
    setEntitlementsLoading(true);
    const [adminRes, paidRes] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: uid }),
      supabase.rpc("is_paid_subscriber", { _user_id: uid }),
    ]);
    setIsAdmin(!!adminRes.data);
    setIsPaid(!!paidRes.data);
    setEntitlementsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => void refreshEntitlements(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setIsPaid(false);
          setEntitlementsLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void refreshEntitlements(session.user.id);
      } else {
        setEntitlementsLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refreshEntitlements]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        isPaid,
        entitlementsLoading,
        signOut,
        refreshEntitlements,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
