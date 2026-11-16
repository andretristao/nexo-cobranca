import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Entidade, Usuario } from "./tipos";

interface Ctx {
  session: Session | null;
  usuario: Usuario | null;
  entidade: Entidade | null;
  carregando: boolean;
  podeEditar: boolean;
  recarregar: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>({
  session: null, usuario: null, entidade: null, carregando: true, podeEditar: false, recarregar: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [entidade, setEntidade] = useState<Entidade | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarPerfil(s: Session | null) {
    if (!s) { setUsuario(null); setEntidade(null); setCarregando(false); return; }
    const { data: u } = await supabase.from("usuario").select("*").eq("id", s.user.id).maybeSingle();
    setUsuario(u as Usuario | null);
    if (u) {
      const { data: e } = await supabase.from("entidade").select("*").eq("id", u.entidade_id).maybeSingle();
      setEntidade(e as Entidade | null);
    }
    setCarregando(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); carregarPerfil(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); carregarPerfil(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const podeEditar = usuario?.perfil === "admin" || usuario?.perfil === "operador";
  return (
    <AuthCtx.Provider value={{ session, usuario, entidade, carregando, podeEditar, recarregar: () => carregarPerfil(session) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
