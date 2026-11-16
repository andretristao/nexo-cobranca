import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { baixarArquivo, brl, dataBR, dataHoraBR, erroMsg, hojeISO } from "../lib/format";
import { lerRetorno240, simularRetorno240, OCORRENCIAS_LIQUIDACAO, type ItemRetorno } from "../lib/cnab240";
import { convenioAtivo, convenioParaCnab } from "../lib/emissao";

interface Ret { id: string; nome_arquivo: string; qtd_registros: number; qtd_liquidados: number; valor_liquidado: number; processado_em: string }
interface RetItem { id: string; nosso_numero: string; codigo_ocorrencia: string; descricao_ocorrencia: string; valor_pago: number | null; data_pagamento: string | null; aplicado: boolean; mensagem: string }

export default function Retornos() {
  const { podeEditar, usuario } = useAuth();
  const [arquivo, setArquivo] = useState<{ nome: string; conteudo: string } | null>(null);
  const [itens, setItens] = useState<ItemRetorno[]>([]);
  const [msg, setMsg] = useState("");
  const [hist, setHist] = useState<Ret[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RetItem[]>([]);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("retorno").select("id, nome_arquivo, qtd_registros, qtd_liquidados, valor_liquidado, processado_em").order("processado_em", { ascending: false }).limit(30);
    setHist((data ?? []) as Ret[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function ler(f: File) {
    setMsg(""); setItens([]);
    const conteudo = await f.text();
    try {
      const r = lerRetorno240(conteudo);
      setArquivo({ nome: f.name, conteudo }); setItens(r.itens);
      if (!r.itens.length) setMsg("O arquivo não tem títulos (segmentos T/U).");
    } catch (e) { setMsg(erroMsg(e)); }
  }

  async function aplicar() {
    if (!arquivo) return;
    const conv = await convenioAtivo();
    if (!conv) { setMsg("Cadastre o convênio em Configurações."); return; }
    const { data, error } = await supabase.rpc("aplicar_retorno", {
      p_convenio: conv.id, p_nome: arquivo.nome, p_conteudo: arquivo.conteudo,
      p_itens: itens.map((i) => ({ nossoNumero: i.nossoNumero, ocorrencia: i.ocorrencia, descricao: i.descricao, valorPago: i.valorPago, dataOcorrencia: i.dataOcorrencia, dataCredito: i.dataCredito })),
    });
    if (error) { setMsg(erroMsg(error)); return; }
    setMsg(`Retorno processado: ${data.registros} registro(s), ${data.liquidados} pagamento(s) baixado(s), total ${brl(data.valor)}.`);
    setArquivo(null); setItens([]); carregar();
  }

  async function simular() {
    const conv = await convenioAtivo();
    if (!conv) { setMsg("Cadastre o convênio em Configurações."); return; }
    const { data } = await supabase.from("boleto").select("*").in("status", ["enviado", "registrado"]).order("vencimento").limit(20);
    if (!data?.length) { setMsg("Não há boletos em remessa para simular pagamento."); return; }
    const conteudo = simularRetorno240(convenioParaCnab(conv), data.map((b) => ({
      nossoNumero: b.nosso_numero, seuNumero: b.seu_numero ?? "", usoEmpresa: b.id.replace(/-/g, "").slice(0, 25),
      vencimento: b.vencimento, valor: Number(b.valor), pagoEm: hojeISO(),
    })), 1);
    baixarArquivo(`SIMULACAO_RETORNO_${hojeISO()}.RET`, conteudo);
    setMsg("Arquivo de retorno SIMULADO baixado (todos os boletos em remessa como pagos). Use só para treinamento e demonstração.");
  }

  async function abrir(id: string) {
    if (aberto === id) { setAberto(null); return; }
    const { data } = await supabase.from("retorno_item").select("*").eq("retorno_id", id);
    setDetalhe((data ?? []) as RetItem[]); setAberto(id);
  }

  const liq = itens.filter((i) => OCORRENCIAS_LIQUIDACAO.has(i.ocorrencia));
  return (
    <>
      <h1>Retorno bancário</h1>
      {podeEditar && (
        <div className="card">
          <p>Baixe o arquivo de retorno no gerenciador financeiro do banco e envie aqui. O sistema dá baixa automática nos boletos pagos e registra rejeições.</p>
          <input type="file" accept=".ret,.RET,.txt,.TXT,*" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
          {usuario?.perfil === "admin" && <button className="link" onClick={simular}>Gerar retorno simulado (treinamento)</button>}
        </div>
      )}
      {msg && <div className="faixa">{msg}</div>}
      {itens.length > 0 && (
        <div className="card">
          <div className="topo"><h2>{arquivo?.nome}: {itens.length} registro(s), {liq.length} pagamento(s), {brl(liq.reduce((a, i) => a + i.valorPago, 0))}</h2>
            <button className="primario" onClick={aplicar}>Confirmar e dar baixa</button></div>
          <table><thead><tr><th>Nosso número</th><th>Ocorrência</th><th>Vencimento</th><th className="num">Valor título</th><th className="num">Valor pago</th><th>Pago em</th><th>Crédito</th></tr></thead>
            <tbody>{itens.map((i, k) => (
              <tr key={k}><td><code className="mini">{i.nossoNumero}</code></td><td>{i.ocorrencia} · {i.descricao}{i.motivos && <small> ({i.motivos})</small>}</td>
                <td>{dataBR(i.vencimento)}</td><td className="num">{brl(i.valorTitulo)}</td><td className="num">{i.valorPago ? brl(i.valorPago) : ""}</td>
                <td>{dataBR(i.dataOcorrencia)}</td><td>{dataBR(i.dataCredito)}</td></tr>
            ))}</tbody></table>
        </div>
      )}
      <div className="card">
        <h2>Retornos processados</h2>
        {hist.length === 0 ? <p className="vazio">Nenhum retorno processado.</p> : (
          <table><thead><tr><th>Arquivo</th><th>Processado em</th><th className="num">Registros</th><th className="num">Pagamentos</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{hist.map((r) => (<Fragment key={r.id}>
              <tr key={r.id}><td>{r.nome_arquivo}</td><td>{dataHoraBR(r.processado_em)}</td><td className="num">{r.qtd_registros}</td><td className="num">{r.qtd_liquidados}</td>
                <td className="num">{brl(r.valor_liquidado)}</td><td><button className="link" onClick={() => abrir(r.id)}>{aberto === r.id ? "Fechar" : "Detalhes"}</button></td></tr>
              {aberto === r.id && <tr key={r.id + "d"}><td colSpan={6}>
                <table className="interna"><tbody>{detalhe.map((d) => (
                  <tr key={d.id}><td><code className="mini">{d.nosso_numero}</code></td><td>{d.codigo_ocorrencia} · {d.descricao_ocorrencia}</td>
                    <td className="num">{d.valor_pago ? brl(d.valor_pago) : ""}</td><td className={d.aplicado ? "" : "vermelho"}>{d.mensagem}</td></tr>
                ))}</tbody></table></td></tr>}
            </Fragment>))}</tbody></table>
        )}
      </div>
    </>
  );
}
