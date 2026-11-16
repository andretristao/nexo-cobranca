import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR, erroMsg, hojeISO } from "../lib/format";
import { emitirBoletos } from "../lib/emissao";
import type { Cliente } from "../lib/tipos";

const addMes = (iso: string, m: number) => {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, ult));
  return dt.toISOString().slice(0, 10);
};

export default function NegociacaoNova() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { entidade } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [clienteId, setClienteId] = useState(sp.get("cliente") ?? "");
  const [descricao, setDescricao] = useState("");
  const [principal, setPrincipal] = useState("");
  const [total, setTotal] = useState("");
  const [qtd, setQtd] = useState("10");
  const [venc, setVenc] = useState(addMes(hojeISO(), 1));
  const [gerarBoletos, setGerarBoletos] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let q = supabase.from("cliente").select("*").eq("ativo", true).order("nome").limit(50);
    if (busca) q = q.ilike("nome", `%${busca}%`);
    if (clienteId && !busca) q = supabase.from("cliente").select("*").eq("id", clienteId);
    q.then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, [busca, clienteId]);

  const vTotal = Number((total || principal).replace(",", ".")) || 0;
  const n = Math.max(1, Math.min(120, Number(qtd) || 1));
  const previa = useMemo(() => {
    const v = Math.floor((vTotal / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1, vencimento: addMes(venc, i),
      valor: i === n - 1 ? Math.round((vTotal - v * (n - 1)) * 100) / 100 : v,
    }));
  }, [vTotal, n, venc]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (!clienteId) { setErro("Selecione o cliente."); return; }
    const vp = Number(principal.replace(",", "."));
    if (!(vp > 0) || !(vTotal > 0)) { setErro("Informe os valores."); return; }
    setSalvando(true);
    try {
      const { data: neg, error } = await supabase.from("negociacao").insert({
        entidade_id: entidade!.id, cliente_id: clienteId, descricao, valor_principal: vp, valor_total: vTotal,
        qtd_parcelas: n, primeiro_vencimento: venc,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("parcela").insert(previa.map((p) => ({
        entidade_id: entidade!.id, negociacao_id: neg.id, numero: p.numero, vencimento: p.vencimento, valor: p.valor,
      })));
      if (e2) throw e2;
      if (gerarBoletos) {
        const { data: ps } = await supabase.from("parcela").select("id").eq("negociacao_id", neg.id);
        try { await emitirBoletos((ps ?? []).map((p) => p.id)); } catch (eb) { alertaSilencioso(eb); }
      }
      nav(`/negociacoes/${neg.id}`);
    } catch (err) { setErro(erroMsg(err)); } finally { setSalvando(false); }
  }

  return (
    <>
      <h1>Nova negociação</h1>
      <form className="card form" onSubmit={salvar}>
        <div className="grade">
          <label className="larga">Buscar cliente<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome" /></label>
          <label className="larga">Cliente *
            <select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="inteira">Descrição / finalidade<input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Microcrédito para capital de giro" /></label>
          <label>Valor principal (R$) *<input required inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></label>
          <label>Valor total a pagar (R$)<input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="igual ao principal" /></label>
          <label>Nº de parcelas *<input required type="number" min={1} max={120} value={qtd} onChange={(e) => setQtd(e.target.value)} /></label>
          <label>1º vencimento *<input required type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></label>
          <label className="check inteira"><input type="checkbox" checked={gerarBoletos} onChange={(e) => setGerarBoletos(e.target.checked)} /> Gerar os boletos das parcelas ao salvar</label>
        </div>
        {vTotal > 0 && (
          <div className="previa">
            <b>Prévia: {n} parcela(s), total {brl(vTotal)}</b>
            <table><tbody>{previa.map((p) => <tr key={p.numero}><td>{p.numero}</td><td>{dataBR(p.vencimento)}</td><td className="num">{brl(p.valor)}</td></tr>)}</tbody></table>
          </div>
        )}
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes"><button type="button" onClick={() => nav(-1)}>Cancelar</button><button className="primario" disabled={salvando}>Salvar negociação</button></div>
      </form>
    </>
  );
}

function alertaSilencioso(e: unknown) { console.warn("Boletos não gerados:", e); }
