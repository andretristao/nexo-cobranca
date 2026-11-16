import { useState } from "react";
import { supabase } from "../lib/supabase";
import { erroMsg } from "../lib/format";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "cadastrar" | "esqueci">("entrar");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setOcupado(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modo === "cadastrar") {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        setMsg("Cadastro criado. Confirme o e-mail, se solicitado, e peça ao administrador para liberar seu acesso.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg("Enviamos um link de redefinição para o seu e-mail.");
      }
    } catch (err) { setMsg(erroMsg(err)); } finally { setOcupado(false); }
  }

  return (
    <div className="centro login">
      <form className="card" onSubmit={enviar} style={{ width: 360 }}>
        <div className="marca grande">NEXO <b>Cobrança</b></div>
        <p className="sub">Gestão de clientes, negociações e boletos</p>
        <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {modo !== "esqueci" && (
          <label>Senha<input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
        )}
        <button className="primario" disabled={ocupado}>
          {modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar login" : "Enviar link"}
        </button>
        {msg && <p className="aviso">{msg}</p>}
        <div className="linha-links">
          {modo !== "entrar" && <button type="button" className="link" onClick={() => setModo("entrar")}>Já tenho login</button>}
          {modo !== "cadastrar" && <button type="button" className="link" onClick={() => setModo("cadastrar")}>Criar login</button>}
          {modo !== "esqueci" && <button type="button" className="link" onClick={() => setModo("esqueci")}>Esqueci a senha</button>}
        </div>
      </form>
    </div>
  );
}
