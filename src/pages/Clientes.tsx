import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, docFmt } from "../lib/format";
import { casa } from "../lib/busca";

interface Linha { cliente_id: string; nome: string; documento: string; negociacoes_ativas: number; saldo_aberto: number; valor_vencido: number }

export default function Clientes() {
  const { podeEditar } = useAuth();
  const nav = useNavigate();
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [todos, setTodos] = useState<Linha[]>([]);
  useEffect(() => {
    supabase.from("vw_clientes_sintetico").select("*").order("nome").limit(5000)
      .then(({ data }) => { setTodos((data ?? []) as Linha[]); setCarregando(false); });
  }, []);
  useEffect(() => {
    const b = busca.trim();
    const dig = b.replace(/\D/g, "");
    setLinhas(!b ? todos : todos.filter((c) => casa(c.nome, b) || (dig.length >= 3 && c.documento.includes(dig))));
  }, [busca, todos]);

  return (
    <>
      <div className="topo"><h1>Clientes</h1>{podeEditar && <Link className="botao primario" to="/clientes/novo">+ Novo cliente</Link>}</div>
      <input className="busca" placeholder="Buscar por nome ou CPF/CNPJ (acentos não importam)" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="card">
        {carregando ? <p>Carregando…</p> : linhas.length === 0 ? <p className="vazio">Nenhum cliente encontrado.</p> : (
          <table>
            <thead><tr><th>Nome</th><th>CPF/CNPJ</th><th className="num">Negociações ativas</th><th className="num">Saldo aberto</th><th className="num">Vencido</th></tr></thead>
            <tbody>{linhas.map((c) => (
              <tr key={c.cliente_id} className="clicavel" onClick={() => nav(`/clientes/${c.cliente_id}`)}>
                <td><Link to={`/clientes/${c.cliente_id}`}>{c.nome}</Link></td>
                <td>{docFmt(c.documento)}</td>
                <td className="num">{c.negociacoes_ativas}</td>
                <td className="num">{brl(c.saldo_aberto)}</td>
                <td className={"num" + (Number(c.valor_vencido) > 0 ? " vermelho" : "")}>{brl(c.valor_vencido)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
