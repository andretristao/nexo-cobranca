import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { baixarCSV, brl, dataBR, docFmt, hojeISO } from "../lib/format";

type Aba = "sintetico" | "analitico" | "inadimplentes" | "pagamentos";
const TITULOS: Record<Aba, string> = {
  sintetico: "Clientes (sintético)", analitico: "Clientes (analítico)", inadimplentes: "Inadimplentes", pagamentos: "Pagamentos recebidos",
};
type Linha = Record<string, string | number | null>;

export default function Relatorios() {
  const { entidade } = useAuth();
  const [aba, setAba] = useState<Aba>("sintetico");
  const [ini, setIni] = useState(hojeISO().slice(0, 8) + "01");
  const [fim, setFim] = useState(hojeISO());
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cols, setCols] = useState<[string, string, "moeda" | "data" | "doc" | ""][]>([]);

  useEffect(() => {
    (async () => {
      if (aba === "sintetico") {
        const { data } = await supabase.from("vw_clientes_sintetico").select("*").order("nome");
        setCols([["nome", "Cliente", ""], ["documento", "CPF/CNPJ", "doc"], ["negociacoes_ativas", "Negoc. ativas", ""], ["saldo_aberto", "Saldo aberto", "moeda"], ["valor_vencido", "Vencido", "moeda"], ["total_pago", "Total pago", "moeda"]]);
        setLinhas((data ?? []) as Linha[]);
      } else if (aba === "inadimplentes") {
        const { data } = await supabase.from("vw_inadimplentes").select("*").order("dias_atraso", { ascending: false });
        setCols([["nome", "Cliente", ""], ["documento", "CPF/CNPJ", "doc"], ["telefone", "Telefone", ""], ["parcelas_vencidas", "Parcelas vencidas", ""], ["valor_vencido", "Valor vencido", "moeda"], ["vencimento_mais_antigo", "Venc. mais antigo", "data"], ["dias_atraso", "Dias de atraso", ""]]);
        setLinhas((data ?? []) as Linha[]);
      } else if (aba === "pagamentos") {
        const { data } = await supabase.from("vw_pagamentos").select("*").gte("data_pagamento", ini).lte("data_pagamento", fim).order("data_pagamento");
        setCols([["data_pagamento", "Pago em", "data"], ["nome", "Cliente", ""], ["documento", "CPF/CNPJ", "doc"], ["negociacao", "Negociação", ""], ["parcela", "Parcela", ""], ["nosso_numero", "Nosso número", ""], ["forma_baixa", "Baixa", ""], ["valor_pago", "Valor pago", "moeda"]]);
        setLinhas((data ?? []) as Linha[]);
      } else {
        const { data } = await supabase.from("parcela").select("numero, vencimento, valor, status, valor_pago, data_pagamento, negociacao(numero, cliente(nome, documento))").order("vencimento").limit(5000);
        const hoje = hojeISO();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const l = ((data ?? []) as any[]).map((p) => ({
          nome: p.negociacao.cliente.nome, documento: p.negociacao.cliente.documento, negociacao: p.negociacao.numero, parcela: p.numero,
          vencimento: p.vencimento, valor: p.valor, situacao: p.status === "aberta" && p.vencimento < hoje ? "atrasada" : p.status,
          valor_pago: p.valor_pago, data_pagamento: p.data_pagamento,
        })).sort((a, b) => a.nome.localeCompare(b.nome) || a.negociacao - b.negociacao || a.parcela - b.parcela);
        setCols([["nome", "Cliente", ""], ["documento", "CPF/CNPJ", "doc"], ["negociacao", "Neg.", ""], ["parcela", "Parc.", ""], ["vencimento", "Vencimento", "data"], ["valor", "Valor", "moeda"], ["situacao", "Situação", ""], ["valor_pago", "Pago", "moeda"], ["data_pagamento", "Pago em", "data"]]);
        setLinhas(l);
      }
    })();
  }, [aba, ini, fim]);

  const fmt = (v: string | number | null, t: string) =>
    v === null || v === undefined || v === "" ? "" : t === "moeda" ? brl(Number(v)) : t === "data" ? dataBR(String(v)) : t === "doc" ? docFmt(String(v)) : String(v);
  const totais = cols.filter(([, , t]) => t === "moeda").map(([k]) => [k, linhas.reduce((a, l) => a + Number(l[k] ?? 0), 0)] as const);

  return (
    <>
      <div className="topo nao-imprime">
        <h1>Relatórios</h1>
        <div className="grupo">
          <button onClick={() => baixarCSV(`${aba}-${hojeISO()}.csv`, linhas.map((l) => Object.fromEntries(cols.map(([k, t]) => [t, l[k]]))))}>Exportar CSV</button>
          <button className="primario" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>
      <div className="filtros nao-imprime">
        {(Object.keys(TITULOS) as Aba[]).map((a) => <button key={a} className={aba === a ? "ativo" : ""} onClick={() => setAba(a)}>{TITULOS[a]}</button>)}
      </div>
      {aba === "pagamentos" && (
        <div className="filtros nao-imprime">
          <label>De <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
          <label>Até <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        </div>
      )}
      <div className="card relatorio">
        <div className="so-imprime"><b>{entidade?.nome}</b> · {entidade?.programa}<br /></div>
        <h2>{TITULOS[aba]}{aba === "pagamentos" && ` · ${dataBR(ini)} a ${dataBR(fim)}`} <small>· emitido em {new Date().toLocaleString("pt-BR")}</small></h2>
        {linhas.length === 0 ? <p className="vazio">Sem dados.</p> : (
          <table>
            <thead><tr>{cols.map(([k, t, tp]) => <th key={k} className={tp === "moeda" ? "num" : ""}>{t}</th>)}</tr></thead>
            <tbody>{linhas.map((l, i) => <tr key={i}>{cols.map(([k, , t]) => <td key={k} className={t === "moeda" ? "num" : ""}>{fmt(l[k], t)}</td>)}</tr>)}</tbody>
            <tfoot><tr>{cols.map(([k], i) => {
              const tot = totais.find(([tk]) => tk === k);
              return <td key={k} className={tot ? "num" : ""}><b>{i === 0 ? `${linhas.length} registro(s)` : tot ? brl(tot[1]) : ""}</b></td>;
            })}</tr></tfoot>
          </table>
        )}
      </div>
    </>
  );
}
