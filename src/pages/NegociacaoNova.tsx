import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR, erroMsg, hojeISO } from "../lib/format";
import { addMes, calcularParcelas } from "../lib/juros";
import { emitirBoletos } from "../lib/emissao";
import ClienteBusca from "../components/ClienteBusca";

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

export default function NegociacaoNova() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { entidade } = useAuth();
  const [clienteId, setClienteId] = useState(sp.get("cliente") ?? "");
  const [descricao, setDescricao] = useState("");
  const [principal, setPrincipal] = useState("");
  const [taxa, setTaxa] = useState("0");
  const [sistema, setSistema] = useState<"price" | "simples">("price");
  const [qtd, setQtd] = useState("10");
  const [venc, setVenc] = useState(addMes(hojeISO(), 1));
  const [gerarBoletos, setGerarBoletos] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const vp = num(principal);
  const tx = Math.max(0, num(taxa));
  const n = Math.max(1, Math.min(120, Number(qtd) || 1));
  const parcelas = useMemo(() => calcularParcelas(vp, tx, n, venc, sistema), [vp, tx, n, venc, sistema]);
  const total = parcelas.reduce((a, p) => a + p.valor, 0);
  const totalJuros = parcelas.reduce((a, p) => a + p.juros, 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (!clienteId) { setErro("Escolha o cliente."); return; }
    if (!(vp > 0)) { setErro("Informe o valor emprestado."); return; }
    setSalvando(true);
    try {
      const { data: neg, error } = await supabase.from("negociacao").insert({
        entidade_id: entidade!.id, cliente_id: clienteId, descricao, valor_principal: vp, valor_total: Math.round(total * 100) / 100,
        qtd_parcelas: n, primeiro_vencimento: venc, taxa_juros_mes: tx, sistema_amortizacao: sistema,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("parcela").insert(parcelas.map((p) => ({
        entidade_id: entidade!.id, negociacao_id: neg.id, numero: p.numero, vencimento: p.vencimento, valor: p.valor,
        valor_juros: p.juros, valor_amortizacao: p.amortizacao,
      })));
      if (e2) throw e2;
      if (gerarBoletos) {
        const { data: ps } = await supabase.from("parcela").select("id").eq("negociacao_id", neg.id);
        try { await emitirBoletos((ps ?? []).map((p) => p.id)); } catch (eb) { console.warn("Boletos não gerados:", eb); }
      }
      nav(`/negociacoes/${neg.id}`);
    } catch (err) { setErro(erroMsg(err)); } finally { setSalvando(false); }
  }

  return (
    <>
      <h1>Nova negociação</h1>
      <form className="card form" onSubmit={salvar}>
        <div className="grade">
          <label className="inteira">Cliente *
            <ClienteBusca valor={clienteId} onChange={setClienteId} />
          </label>
          <small className="inteira dica">Não encontrou? <Link to="/clientes/novo">Cadastre o cliente</Link> e volte aqui.</small>
          <label className="inteira">Descrição / finalidade<input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Microcrédito para capital de giro" /></label>
          <label>Valor emprestado (R$) *<input required inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="15.000,00" /></label>
          <label>Juros (% ao mês)<input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="0 = sem juros" /></label>
          <label>Nº de parcelas *<input required type="number" min={1} max={120} value={qtd} onChange={(e) => setQtd(e.target.value)} /></label>
          <label>1º vencimento *<input required type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></label>
          {tx > 0 && (
            <label className="larga">Forma de cálculo
              <select value={sistema} onChange={(e) => setSistema(e.target.value as typeof sistema)}>
                <option value="price">Tabela Price (parcelas iguais, juros sobre o saldo)</option>
                <option value="simples">Juros simples sobre o valor emprestado</option>
              </select>
            </label>
          )}
          <label className="check inteira"><input type="checkbox" checked={gerarBoletos} onChange={(e) => setGerarBoletos(e.target.checked)} /> Gerar os boletos de todas as parcelas ao salvar (desmarque para gerar depois, só das que o cliente for pagar)</label>
        </div>
        {parcelas.length > 0 && (
          <div className="previa">
            <div className="resumo-previa">
              <div><span>Emprestado</span><b>{brl(vp)}</b></div>
              <div><span>Juros totais</span><b>{brl(totalJuros)}</b></div>
              <div><span>Total a pagar</span><b>{brl(total)}</b></div>
              <div><span>Parcelas</span><b>{n}x de {brl(parcelas[0].valor)}</b></div>
            </div>
            <div className="previa-tabela"><table>
              <thead><tr><th>#</th><th>Vencimento</th><th className="num">Amortização</th><th className="num">Juros</th><th className="num">Parcela</th><th className="num">Saldo devedor</th></tr></thead>
              <tbody>{parcelas.map((p) => (
                <tr key={p.numero}><td>{p.numero}</td><td>{dataBR(p.vencimento)}</td><td className="num">{brl(p.amortizacao)}</td>
                  <td className="num">{brl(p.juros)}</td><td className="num"><b>{brl(p.valor)}</b></td><td className="num">{brl(p.saldo)}</td></tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={2}><b>Total</b></td><td className="num"><b>{brl(vp)}</b></td><td className="num"><b>{brl(totalJuros)}</b></td><td className="num"><b>{brl(total)}</b></td><td /></tr></tfoot>
            </table></div>
          </div>
        )}
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes"><button type="button" onClick={() => nav(-1)}>Cancelar</button><button className="primario" disabled={salvando}>Salvar negociação</button></div>
      </form>
    </>
  );
}
