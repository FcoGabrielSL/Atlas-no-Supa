import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { UserConfig } from "../types";

export interface AuthContextType {
  user: any | null;
  usuarioAtual: UserConfig | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  usuarioAtual: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [usuarioAtual, setUsuarioAtual] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper para blindar objeto de usuário soberano Admin
  const formatSovereignAdmin = (baseUser: any): UserConfig => {
    return {
      id: baseUser.id || "admin-brisanet-sovereign",
      nome: baseUser.user_metadata?.nome || "Francisco",
      sobrenome: baseUser.user_metadata?.sobrenome || "Gabriel",
      email: "francisco.gabriel@grupobrisanet.com.br",
      dataNascimento: baseUser.user_metadata?.dataNascimento || "",
      senha: "OAuth/SupabaseAuthSecure",
      dataInsercao: new Date().toLocaleDateString("pt-BR"),
      nivel: "Administrador (Admin)",
      ...({ role: "ADMIN" } as any),
      permissions: {
        entroncamentos: { visualizar: true, editar: true, excluir: true },
        camada_optica: { visualizar: true, editar: true, excluir: true },
        otdr: { visualizar: true, editar: true, excluir: true },
        atenuacoes: { visualizar: true, editar: true, excluir: true },
        testes_campo: { visualizar: true, editar: true, excluir: true },
        bypass: { visualizar: true, editar: true, excluir: true },
        relatorio_mensal: { visualizar: true, editar: true, excluir: true },
        atuacoes_geral: { visualizar: true, editar: true, excluir: true },
        troca_cabo: { visualizar: true, editar: true, excluir: true },
        avisos: { visualizar: true, editar: true, excluir: true },
        relatorio_periodico: { visualizar: true, editar: true, excluir: true },
        settings: { visualizar: true, editar: true, excluir: true },
        admin: { visualizar: true, editar: true, excluir: true }
      }
    };
  };

  useEffect(() => {
    // 1. Limpa resquícios antigos do localStorage que induzem race condition
    const staleUser = localStorage.getItem("user") || localStorage.getItem("cbe_current_user");
    if (staleUser) {
      try {
        const parsed = JSON.parse(staleUser);
        if (parsed?.email !== "francisco.gabriel@grupobrisanet.com.br") {
          localStorage.removeItem("user");
          localStorage.removeItem("cbe_current_user");
        }
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("cbe_current_user");
      }
    }

    // 2. Consulta a sessão ativa inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        processSessionUser(session.user);
      } else {
        setUser(null);
        setUsuarioAtual(null);
      }
      setLoading(false);
    });

    // 3. ÚNICA FONTE DE VERDADE: supabase.auth.onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        processSessionUser(session.user);
        setLoading(false);
      } else {
        // Logout ou expiração: limpa todo e qualquer estado de sessão
        setUser(null);
        setUsuarioAtual(null);
        localStorage.removeItem("user");
        localStorage.removeItem("cbe_current_user");
        setLoading(false);
      }
    });

    function processSessionUser(authUser: any) {
      const email = authUser.email?.toLowerCase().trim();
      
      // TRAVA ADMIN: Soberania corporativa incondicional
      if (email === "francisco.gabriel@grupobrisanet.com.br") {
        const adminProfile = formatSovereignAdmin(authUser);
        setUser({ ...authUser, role: "ADMIN", nivel: "Administrador (Admin)" });
        setUsuarioAtual(adminProfile);
        return;
      }

      // Usuário regular
      const regularProfile: UserConfig = {
        id: authUser.id,
        nome: authUser.user_metadata?.nome || email?.split("@")[0] || "Operador",
        sobrenome: authUser.user_metadata?.sobrenome || "",
        email: authUser.email,
        dataNascimento: authUser.user_metadata?.dataNascimento || "",
        senha: "OAuth/SupabaseAuthSecure",
        dataInsercao: new Date().toLocaleDateString("pt-BR"),
        nivel: authUser.user_metadata?.nivel || "Visitante",
        permissions: authUser.user_metadata?.permissions || {
          avisos: { visualizar: true, editar: false, excluir: false }
        }
      };

      setUser(authUser);
      setUsuarioAtual(regularProfile);
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setUsuarioAtual(null);
      localStorage.removeItem("user");
      localStorage.removeItem("cbe_current_user");
    }
  };

  const isAdmin = 
    user?.email?.toLowerCase().trim() === "francisco.gabriel@grupobrisanet.com.br" ||
    usuarioAtual?.role === "ADMIN" ||
    usuarioAtual?.nivel === "Administrador (Admin)";

  return (
    <AuthContext.Provider value={{ user, usuarioAtual, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
