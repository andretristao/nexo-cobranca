import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR, docFmt } from "../lib/format";
import type { Cliente, Negociacao } from "../lib/tipos";

export default function ClienteDetalhe() {
  const { id } = useParams();
  const { podeEditar } = useAuth();
  const nav = useNavigate();
  const [c, setC] = useState<Cliente | null>(null);
  const [negs, setNegs] = useState<Negociacao[]>([]);

  useEffect(() => {
    supabase.from("cliente").select("*").eq("id", id!).single().then(({ data }) => setC(data));
    supabase.from("negociacao").select("*").eq("cliente_id", id!).order("data_negociacao", { ascending: false })
      .then(({ data }) => setNegs((data ?? []) as Negociacao[]));
  }, [id]);

  if (!c) return <p>Carregando…</p>;
  const end = [c.logradouro, c.numero, c.complemento, c.bairro, c.cidade && `${c.cidade}/${c.uf}`, c.cep].filter(Boolean).join(", ");
  return (
    <>
      <div className="topo">
        <h1>{c.nome}</h1>
        <div className="grupo">
          {podeEditar && <Link className="botao" to={`/clientes/${c.id}/editar`}>Editar</Link>}
          {podeEditar && <Link className="botao primario" to={`/negociacoes/nova?cliente=${c.id}`}>+ Nova negociação</Link>}
        </div>
      </div>
      <div className="card dados">
        <div><span>{c.tipo_pessoa === "F" ? "CPF" : "CNPJ"}</span>{docFmt(c.documento)}</div>
        <div><span>Telefone</span>{c.telefone || "—"}</div>
        <div><span>WhatsApp</span>{c.whatsapp || "—"}</div>
        <div><span>E-mail</span>{c.email || "—"}</div>
        <div className="inteira"><span>Endereço</span>{end || "—"}</div>
        {c.observacoes && <div className="inteira"><span>Observações</span>{c.observacoes}</div>}
      </div>
      <div className="card">
        <h2>Negociações</h2>
        {negs.length === 0 ? <p className="vazio">Nenhuma negociação para este cliente.</p> : (
          <table><thead><tr><th>Nº</th><th>Data</th><th>Descrição</th><th className="num">Valor total</th><th>Parcelas</th><th>Situação</th></tr></thead>
            <tbody>{negs.map((n) => (
              <tr key={n.id} className="clicavel" onClick={() => nav(`/negociacoes/${n.id}`)}><td><Link to={`/negociacoes/${n.id}`}>{n.numero}</Link></td><td>{dataBR(n.data_negociacao)}</td>
                <td>{n.descricao}</td><td className="num">{brl(n.valor_total)}</td><td>{n.qtd_parcelas}x</td>
                <td><span className={`tag ${n.status}`}>{n.status}</span></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
