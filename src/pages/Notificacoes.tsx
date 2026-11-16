import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { brl, dataBR, dataHoraBR, hojeISO } from "../lib/format";

interface Alvo { parcela_id: string; cliente_id: string; nome: string; whatsapp: string | null; telefone: string | null; email: string | null;
  endereco: string; vencimento: string; valor: number; negociacao: number; parcela: number; linha: string | null }
interface Hist { id: string; tipo: string; canal: string; mensagem: string; status: string; enviada_em: string | null; criado_em: string; cliente: { nome: string } }

const MODELOS: Record<string, { titulo: string; texto: string }> = {
  lembrete_vencimento: {
    titulo: "Lembrete de vencimento",
    texto: "Olá, {nome}! A parcela {parcela} da sua negociação nº {negociacao} no Programa {programa} vence em {vencimento}, no valor de {valor}.{linha} Em caso de dúvida, procure a Casa do Empreendedor.",
  },
  atraso: {
    titulo: "Parcela em atraso",
    texto: "Olá, {nome}. Consta em aberto a parcela {parcela} da negociação nº {negociacao} no Programa {programa}, vencida em {vencimento}, no valor de {valor}. Regularize o pagamento ou procure a Casa do Empreendedor para negociar.{linha}",
  },
};

export default function Notificacoes() {
  const { entidade, podeEditar } = useAuth();
  const [tipo, setTipo] = useState<"lembrete_vencimento" | "atraso">("atraso");
  const [dias, setDias] = useState(5);
  const [texto, setTexto] = useState(MODELOS.atraso.texto);
  const [alvos, setAlvos] = useState<Alvo[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [cartas, setCartas] = useState<Alvo[] | null>(null);

  const carregar = useCallback(async () => {
    const hoje = hojeISO();
    let q = supabase.from("parcela").select("id, numero, vencimento, valor, negociacao(numero, cliente(*)), boleto(linha_digitavel, status)").eq("status", "aberta").order("vencimento").limit(300);
    if (tipo === "atraso") q = q.lt("vencimento", hoje);
    else q = q.gte("vencimento", hoje).lte("vencimento", new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10));
    const { data } = await q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAlvos(((data ?? []) as any[]).map((p) => {
      const c = p.negociacao.cliente;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = (p.boleto ?? []).find((x: any) => !["cancelado", "baixado", "pago"].includes(x.status));
      return { parcela_id: p.id, cliente_id: c.id, nome: c.nome, whatsapp: c.whatsapp, telefone: c.telefone, email: c.email,
        endereco: [c.logradouro, c.numero, c.bairro, c.cidade && `${c.cidade}/${c.uf}`, c.cep].filter(Boolean).join(", "),
        vencimento: p.vencimento, valor: p.valor, negociacao: p.negociacao.numero, parcela: p.numero, linha: b?.linha_digitavel ?? null };
    }));
    const { data: h } = await supabase.from("notificacao").select("*, cliente(nome)").order("criado_em", { ascending: false }).limit(50);
    setHist((h ?? []) as Hist[]);
  }, [tipo, dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const montar = (a: Alvo) => texto
    .replace(/{nome}/g, a.nome.split(" ")[0]).replace(/{parcela}/g, String(a.parcela)).replace(/{negociacao}/g, String(a.negociacao))
    .replace(/{programa}/g, entidade?.programa ?? "").replace(/{vencimento}/g, dataBR(a.vencimento)).replace(/{valor}/g, brl(a.valor))
    .replace(/{linha}/g, a.linha ? ` Linha digitável do boleto: ${a.linha}.` : "");

  async function registrar(a: Alvo, canal: string) {
    await supabase.from("notificacao").insert({ entidade_id: entidade!.id, cliente_id: a.cliente_id, parcela_id: a.parcela_id, tipo, canal,
      assunto: MODELOS[tipo].titulo, mensagem: montar(a), status: "enviada", enviada_em: new Date().toISOString() });
  }

  async function whats(a: Alvo) {
    const fone = (a.whatsapp || a.telefone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${fone.length <= 11 ? "55" + fone : fone}?text=${encodeURIComponent(montar(a))}`, "_blank");
    await registrar(a, "whatsapp"); carregar();
  }
  async function email(a: Alvo) {
    window.open(`mailto:${a.email}?subject=${encodeURIComponent(MODELOS[tipo].titulo + " - " + (entidade?.programa ?? ""))}&body=${encodeURIComponent(montar(a))}`);
    await registrar(a, "email"); carregar();
  }
  async function imprimirCartas() {
    for (const a of alvos) await registrar(a, "impresso");
    setCartas(alvos); setTimeout(() => { window.print(); setCartas(null); carregar(); }, 400);
  }

  if (cartas) return (
    <div className="cartas">{cartas.map((a) => (
      <section key={a.parcela_id} className="carta">
        <h2>{entidade?.nome}</h2><p><small>{entidade?.programa}</small></p>
        <p><b>{MODELOS[tipo].titulo}</b></p><p>Para: {a.nome}<br />{a.endereco}</p>
        <p>{montar(a)}</p><p>{dataBR(hojeISO())}</p>
      </section>))}</div>
  );

  return (
    <>
      <h1>Notificações</h1>
      <div className="card form">
        <div className="grade">
          <label>Tipo<select value={tipo} onChange={(e) => { const t = e.target.value as typeof tipo; setTipo(t); setTexto(MODELOS[t].texto); }}>
            <option value="atraso">Parcelas em atraso</option><option value="lembrete_vencimento">Lembrete: vencem nos próximos dias</option></select></label>
          {tipo === "lembrete_vencimento" && <label>Próximos (dias)<input type="number" min={1} max={60} value={dias} onChange={(e) => setDias(Number(e.target.value))} /></label>}
          <label className="inteira">Mensagem (variáveis: {"{nome} {parcela} {negociacao} {programa} {vencimento} {valor} {linha}"})
            <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
        </div>
      </div>
      <div className="card">
        <div className="topo"><h2>{alvos.length} parcela(s)</h2>{podeEditar && alvos.length > 0 && <button onClick={imprimirCartas}>Imprimir cartas de todos</button>}</div>
        {alvos.length === 0 ? <p className="vazio">Nenhuma parcela nesta condição.</p> : (
          <table><thead><tr><th>Cliente</th><th>Neg./parc.</th><th>Vencimento</th><th className="num">Valor</th><th>Enviar</th></tr></thead>
            <tbody>{alvos.map((a) => (
              <tr key={a.parcela_id}><td>{a.nome}</td><td>{a.negociacao}/{a.parcela}</td><td>{dataBR(a.vencimento)}</td><td className="num">{brl(a.valor)}</td>
                <td className="grupo">{podeEditar && <>
                  <button className="link" disabled={!(a.whatsapp || a.telefone)} onClick={() => whats(a)}>WhatsApp</button>
                  <button className="link" disabled={!a.email} onClick={() => email(a)}>E-mail</button></>}</td></tr>
            ))}</tbody></table>
        )}
      </div>
      <div className="card">
        <h2>Histórico de notificações</h2>
        {hist.length === 0 ? <p className="vazio">Nenhuma notificação registrada.</p> : (
          <table><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Canal</th><th>Mensagem</th></tr></thead>
            <tbody>{hist.map((h) => (
              <tr key={h.id}><td>{dataHoraBR(h.enviada_em ?? h.criado_em)}</td><td>{h.cliente?.nome}</td><td>{MODELOS[h.tipo]?.titulo ?? h.tipo}</td><td>{h.canal}</td><td><small>{h.mensagem}</small></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
