import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { supabase, configurado } from "./lib/supabase";
import Login from "./pages/Login";
import Painel from "./pages/Painel";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import NegociacaoNova from "./pages/NegociacaoNova";
import NegociacaoDetalhe from "./pages/NegociacaoDetalhe";
import Negociacoes from "./pages/Negociacoes";
import Boletos from "./pages/Boletos";
import BoletoImpressao from "./pages/BoletoImpressao";
import Retornos from "./pages/Retornos";
import Notificacoes from "./pages/Notificacoes";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";

const MENU = [
  ["/", "Painel"],
  ["/clientes", "Clientes"],
  ["/negociacoes", "Negociações"],
  ["/boletos", "Boletos e remessa"],
  ["/retornos", "Retorno bancário"],
  ["/notificacoes", "Notificações"],
  ["/relatorios", "Relatórios"],
  ["/configuracoes", "Configurações"],
] as const;

function Layout() {
  const { session, usuario, entidade, carregando } = useAuth();
  if (!configurado) return <div className="centro"><div className="card">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div></div>;
  if (carregando) return <div className="centro">Carregando…</div>;
  if (!session) return <Login />;
  if (!usuario) return (
    <div className="centro"><div className="card" style={{ maxWidth: 460 }}>
      <h2>Acesso pendente</h2>
      <p>Seu login ({session.user.email}) foi criado, mas ainda não está vinculado a uma entidade. Peça ao administrador para liberar seu acesso em Configurações → Usuários.</p>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </div></div>
  );
  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">NEXO <b>Cobrança</b></div>
        <div className="entidade">{entidade?.nome}<br /><small>{entidade?.programa}</small></div>
        <nav>{MENU.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}</nav>
        <div className="usuario">
          {usuario.nome}<br /><small>{usuario.perfil}</small><br />
          <button className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </aside>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/novo" element={<ClienteForm />} />
          <Route path="/clientes/:id" element={<ClienteDetalhe />} />
          <Route path="/clientes/:id/editar" element={<ClienteForm />} />
          <Route path="/negociacoes" element={<Negociacoes />} />
          <Route path="/negociacoes/nova" element={<NegociacaoNova />} />
          <Route path="/negociacoes/:id" element={<NegociacaoDetalhe />} />
          <Route path="/boletos" element={<Boletos />} />
          <Route path="/retornos" element={<Retornos />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/imprimir/boletos" element={<BoletoImpressao />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
