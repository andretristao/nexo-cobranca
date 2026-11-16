import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR } from "../lib/format";
import type { Negociacao } from "../lib/tipos";

export default function Negociacoes() {
  const { podeEditar } = useAuth();
  const [status, setStatus] = useState("ativa");
  const [negs, setNegs] = useState<Negociacao[]>([]);

  useEffect(() => {
    let q = supabase.from("negociacao").select("*, cliente(nome, documento)").order("numero", { ascending: false }).limit(300);
    if (status) q = q.eq("status", status);
    q.then(({ data }) => setNegs((data ?? []) as Negociacao[]));
  }, [status]);

  return (
    <>
      <div className="topo"><h1>Negociações</h1>{podeEditar && <Link className="botao primario" to="/negociacoes/nova">+ Nova negociação</Link>}</div>
      <div className="filtros">
        {[["ativa", "Ativas"], ["quitada", "Quitadas"], ["cancelada", "Canceladas"], ["", "Todas"]].map(([v, l]) => (
          <button key={v} className={status === v ? "ativo" : ""} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {negs.length === 0 ? <p className="vazio">Nenhuma negociação.</p> : (
          <table><thead><tr><th>Nº</th><th>Cliente</th><th>Data</th><th>Descrição</th><th className="num">Valor total</th><th>Parcelas</th><th>Situação</th></tr></thead>
            <tbody>{negs.map((n) => (
              <tr key={n.id}><td><Link to={`/negociacoes/${n.id}`}>{n.numero}</Link></td><td>{n.cliente?.nome}</td>
                <td>{dataBR(n.data_negociacao)}</td><td>{n.descricao}</td><td className="num">{brl(n.valor_total)}</td>
                <td>{n.qtd_parcelas}x</td><td><span className={`tag ${n.status}`}>{n.status}</span></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
