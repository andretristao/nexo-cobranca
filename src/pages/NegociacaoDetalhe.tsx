import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR, erroMsg, hojeISO } from "../lib/format";
import { emitirBoletos } from "../lib/emissao";
import { STATUS_BOLETO, type Boleto, type Negociacao, type Parcela } from "../lib/tipos";

export default function NegociacaoDetalhe() {
  const { id } = useParams();
  const { podeEditar } = useAuth();
  const [neg, setNeg] = useState<Negociacao | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [boletos, setBoletos] = useState<Record<string, Boleto>>({});
  const [msg, setMsg] = useState("");
  const [baixa, setBaixa] = useState<Parcela | null>(null);
  const [baixaValor, setBaixaValor] = useState("");
  const [baixaData, setBaixaData] = useState(hojeISO());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const alternar = (pid: string) => setSel((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });

  const carregar = useCallback(async () => {
    const { data: n } = await supabase.from("negociacao").select("*, cliente(*)").eq("id", id!).single();
    setNeg(n as Negociacao);
    const { data: ps } = await supabase.from("parcela").select("*").eq("negociacao_id", id!).order("numero");
    setParcelas((ps ?? []) as Parcela[]);
    const ids = (ps ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: bs } = await supabase.from("boleto").select("*").in("parcela_id", ids).neq("status", "cancelado").order("criado_em");
      const m: Record<string, Boleto> = {};
      (bs ?? []).forEach((b) => { m[b.parcela_id] = b as Boleto; });
      setBoletos(m);
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function gerar() {
    setMsg("");
    if (!semBoleto.length) { setMsg("Marque parcelas que ainda não têm boleto."); return; }
    try {
      const n = await emitirBoletos(semBoleto);
      setMsg(`${n} boleto(s) gerado(s).`);
      setSel(new Set()); carregar();
    } catch (e) { setMsg(erroMsg(e)); }
  }

  async function confirmarBaixa() {
    if (!baixa) return;
    const { error } = await supabase.rpc("baixar_parcela_manual", {
      p_parcela: baixa.id, p_valor: Number(baixaValor.replace(",", ".")) || baixa.valor, p_data: baixaData,
    });
    setMsg(error ? erroMsg(error) : `Parcela ${baixa.numero} baixada manualmente.`);
    setBaixa(null); carregar();
  }

  async function cancelarBoletos(ids: string[]) {
    if (!confirm(`Cancelar ${ids.length} boleto(s) que ainda não foram enviados ao banco?`)) return;
    const { error } = await supabase.from("boleto").update({ status: "cancelado", ocorrencia_ultima: "Cancelado antes da remessa" }).in("id", ids).eq("status", "gerado");
    setMsg(error ? erroMsg(error) : `${ids.length} boleto(s) cancelado(s). As parcelas continuam abertas.`);
    setSel(new Set()); carregar();
  }

  async function cancelar() {
    if (!confirm("Cancelar esta negociação? As parcelas abertas e os boletos não pagos serão cancelados.")) return;
    const { error } = await supabase.rpc("cancelar_negociacao", { p_negociacao: id });
    setMsg(error ? erroMsg(error) : "Negociação cancelada."); carregar();
  }

  if (!neg) return <p>Carregando…</p>;
  const hoje = hojeISO();
  const pago = parcelas.reduce((a, p) => a + Number(p.valor_pago ?? 0), 0);
  const aberto = parcelas.filter((p) => p.status === "aberta").reduce((a, p) => a + Number(p.valor), 0);
  const vencido = parcelas.filter((p) => p.status === "aberta" && p.vencimento < hoje).reduce((a, p) => a + Number(p.valor), 0);
  const abertas = parcelas.filter((p) => p.status === "aberta");
  const todasMarcadas = abertas.length > 0 && abertas.every((p) => sel.has(p.id));
  const boletosVivos = Object.values(boletos).filter((b) => !["pago", "baixado", "rejeitado"].includes(b.status));
  const semBoleto = abertas.filter((p) => sel.has(p.id) && !boletosVivos.some((b) => b.parcela_id === p.id)).map((p) => p.id);
  const cancelaveis = boletosVivos.filter((b) => b.status === "gerado" && sel.has(b.parcela_id)).map((b) => b.id);
  const comBoleto = (sel.size ? boletosVivos.filter((b) => sel.has(b.parcela_id)) : boletosVivos).map((b) => b.id);

  return (
    <>
      <div className="topo">
        <h1>Negociação nº {neg.numero} <span className={`tag ${neg.status}`}>{neg.status}</span></h1>
        <div className="grupo">
          {comBoleto.length > 0 && <Link className="botao" to={`/imprimir/boletos?ids=${comBoleto.join(",")}`} target="_blank">{sel.size ? `Imprimir boletos marcados (${comBoleto.length})` : "Imprimir todos os boletos"}</Link>}
          {podeEditar && neg.status === "ativa" && <button className="primario" disabled={!semBoleto.length} title={sel.size && !semBoleto.length ? "As parcelas marcadas já têm boleto" : ""} onClick={gerar}>Gerar boletos das marcadas{semBoleto.length ? ` (${semBoleto.length})` : ""}</button>}
          {podeEditar && cancelaveis.length > 0 && <button onClick={() => cancelarBoletos(cancelaveis)}>Cancelar boletos marcados ({cancelaveis.length})</button>}
          {podeEditar && neg.status === "ativa" && <button className="perigo" onClick={cancelar}>Cancelar negociação</button>}
        </div>
      </div>
      <div className="card dados">
        <div><span>Cliente</span><Link to={`/clientes/${neg.cliente_id}`}>{neg.cliente?.nome}</Link></div>
        <div><span>Data</span>{dataBR(neg.data_negociacao)}</div>
        <div><span>Principal</span>{brl(neg.valor_principal)}</div>
        <div><span>Total</span>{brl(neg.valor_total)}</div>
        <div><span>Pago</span>{brl(pago)}</div>
        <div><span>Em aberto</span>{brl(aberto)}</div>
        <div><span>Vencido</span><b className={vencido > 0 ? "vermelho" : ""}>{brl(vencido)}</b></div>
        {neg.descricao && <div className="inteira"><span>Descrição</span>{neg.descricao}</div>}
      </div>
      {msg && <div className="faixa">{msg}</div>}
      <div className="card">
        <h2>Parcelas</h2>
        <p className="aviso">Marque as parcelas para gerar, imprimir ou cancelar só os boletos que o cliente vai pagar agora.{sel.size > 0 && !semBoleto.length && " As parcelas marcadas já têm boleto: use Imprimir ou Cancelar boletos marcados."}</p>
        <table>
          <thead><tr><th>{abertas.length > 0 && <input type="checkbox" title="Marcar todas as abertas" checked={todasMarcadas} onChange={() => setSel(todasMarcadas ? new Set() : new Set(abertas.map((p) => p.id)))} />}</th><th>#</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th><th>Boleto</th><th className="num">Pago</th><th>Pago em</th><th /></tr></thead>
          <tbody>{parcelas.map((p) => {
            const b = boletos[p.id];
            const atrasada = p.status === "aberta" && p.vencimento < hoje;
            return (
              <tr key={p.id} className={sel.has(p.id) ? "marcada" : ""}>
                <td>{p.status === "aberta" && <input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} />}</td>
                <td>{p.numero}</td><td>{dataBR(p.vencimento)}</td><td className="num">{brl(p.valor)}</td>
                <td><span className={`tag ${atrasada ? "atrasada" : p.status}`}>{atrasada ? "atrasada" : p.status}</span></td>
                <td>{b ? <><small>{STATUS_BOLETO[b.status]}</small><br /><code className="mini">{b.nosso_numero}</code></> : "—"}</td>
                <td className="num">{p.valor_pago ? brl(p.valor_pago) : ""}</td>
                <td>{dataBR(p.data_pagamento)}{p.forma_baixa === "manual" ? " (manual)" : ""}</td>
                <td>{podeEditar && p.status === "aberta" && <button className="link" onClick={() => { setBaixa(p); setBaixaValor(String(p.valor)); }}>Baixa manual</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {baixa && (
        <div className="modal"><div className="card">
          <h2>Baixa manual da parcela {baixa.numero}</h2>
          <p>Use só para pagamentos recebidos fora do boleto. A operação fica registrada no log com seu usuário.</p>
          <label>Valor recebido<input value={baixaValor} onChange={(e) => setBaixaValor(e.target.value)} /></label>
          <label>Data do pagamento<input type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} /></label>
          <div className="acoes"><button onClick={() => setBaixa(null)}>Voltar</button><button className="primario" onClick={confirmarBaixa}>Confirmar baixa</button></div>
        </div></div>
      )}
    </>
  );
}
