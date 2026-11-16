import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { baixarArquivo, brl, dataBR, dataHoraBR, erroMsg } from "../lib/format";
import { gerarRemessa } from "../lib/emissao";
import { STATUS_BOLETO, type Boleto } from "../lib/tipos";

interface Remessa { id: string; sequencial: number; nome_arquivo: string; qtd_titulos: number; valor_total: number; gerado_em: string }

export default function Boletos() {
  const { podeEditar } = useAuth();
  const [status, setStatus] = useState("gerado");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bols, setBols] = useState<(Boleto & { parcela: any })[]>([]);
  const [rems, setRems] = useState<Remessa[]>([]);
  const [teste, setTeste] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    let q = supabase.from("boleto").select("*, parcela(numero, negociacao(id, numero, cliente(nome)))").order("vencimento").limit(500);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    setBols((data ?? []) as typeof bols);
    const { data: r } = await supabase.from("remessa").select("id, sequencial, nome_arquivo, qtd_titulos, valor_total, gerado_em").order("gerado_em", { ascending: false }).limit(30);
    setRems((r ?? []) as Remessa[]);
  }, [status]);
  useEffect(() => { carregar(); }, [carregar]);

  async function remessa() {
    setMsg("");
    try {
      const r = await gerarRemessa(teste);
      if (!r) { setMsg("Não há boletos novos para enviar."); return; }
      baixarArquivo(r.nome, r.conteudo);
      setMsg(`Remessa ${r.nome} gerada com ${r.qtd} boleto(s), total ${brl(r.total)}. Envie o arquivo pelo gerenciador financeiro do banco.`);
      carregar();
    } catch (e) { setMsg(erroMsg(e)); }
  }

  async function baixarRemessa(id: string) {
    const { data } = await supabase.from("remessa").select("nome_arquivo, conteudo").eq("id", id).single();
    if (data) baixarArquivo(data.nome_arquivo, data.conteudo);
  }

  const imprimir = bols.filter((b) => !["pago", "cancelado", "baixado"].includes(b.status)).map((b) => b.id);
  return (
    <>
      <div className="topo">
        <h1>Boletos e remessa</h1>
        <div className="grupo">
          {imprimir.length > 0 && <Link className="botao" target="_blank" to={`/imprimir/boletos?ids=${imprimir.slice(0, 200).join(",")}`}>Imprimir listados</Link>}
          {podeEditar && <button className="primario" onClick={remessa}>Gerar arquivo de remessa</button>}
        </div>
      </div>
      {podeEditar && <label className="check"><input type="checkbox" checked={teste} onChange={(e) => setTeste(e.target.checked)} /> Remessa de teste (homologação no banco)</label>}
      {msg && <div className="faixa">{msg}</div>}
      <div className="filtros">
        {[["gerado", "Aguardando remessa"], ["enviado", "Em remessa"], ["registrado", "Registrados"], ["rejeitado", "Rejeitados"], ["pago", "Pagos"], ["", "Todos"]].map(([v, l]) => (
          <button key={v} className={status === v ? "ativo" : ""} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {bols.length === 0 ? <p className="vazio">Nenhum boleto nesta situação.</p> : (
          <table><thead><tr><th>Nosso número</th><th>Cliente</th><th>Neg./parc.</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th><th>Última ocorrência</th></tr></thead>
            <tbody>{bols.map((b) => (
              <tr key={b.id}><td><code className="mini">{b.nosso_numero}</code></td><td>{b.parcela?.negociacao?.cliente?.nome}</td>
                <td><Link to={`/negociacoes/${b.parcela?.negociacao?.id}`}>{b.parcela?.negociacao?.numero}/{b.parcela?.numero}</Link></td>
                <td>{dataBR(b.vencimento)}</td><td className="num">{brl(b.valor)}</td><td>{STATUS_BOLETO[b.status]}</td><td><small>{b.ocorrencia_ultima}</small></td></tr>
            ))}</tbody></table>
        )}
      </div>
      <div className="card">
        <h2>Remessas geradas</h2>
        {rems.length === 0 ? <p className="vazio">Nenhuma remessa ainda.</p> : (
          <table><thead><tr><th>Seq.</th><th>Arquivo</th><th>Gerada em</th><th className="num">Boletos</th><th className="num">Total</th><th /></tr></thead>
            <tbody>{rems.map((r) => (
              <tr key={r.id}><td>{r.sequencial}</td><td>{r.nome_arquivo}</td><td>{dataHoraBR(r.gerado_em)}</td><td className="num">{r.qtd_titulos}</td>
                <td className="num">{brl(r.valor_total)}</td><td><button className="link" onClick={() => baixarRemessa(r.id)}>Baixar</button></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
