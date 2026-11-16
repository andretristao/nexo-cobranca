// Emissão de boletos e remessa a partir das parcelas
import { supabase } from "./supabase";
import { calcularBoleto } from "./boleto";
import { gerarRemessa240, type Convenio as ConvCnab } from "./cnab240";
import type { Boleto, Cliente, Convenio } from "./tipos";

export async function convenioAtivo(): Promise<Convenio | null> {
  const { data } = await supabase.from("convenio_cobranca").select("*").eq("ativo", true).order("criado_em").limit(1).maybeSingle();
  return data as Convenio | null;
}

/** Gera boletos para as parcelas abertas informadas (ignora as que já têm boleto válido). */
export async function emitirBoletos(parcelaIds: string[]): Promise<number> {
  const conv = await convenioAtivo();
  if (!conv) throw new Error("Cadastre o convênio bancário em Configurações antes de emitir boletos.");
  const { data: parcelas, error } = await supabase.from("parcela")
    .select("id, numero, vencimento, valor, status, negociacao(numero)").in("id", parcelaIds).eq("status", "aberta");
  if (error) throw error;
  const { data: existentes } = await supabase.from("boleto").select("parcela_id")
    .in("parcela_id", parcelaIds).in("status", ["gerado", "enviado", "registrado", "pago"]);
  const ja = new Set((existentes ?? []).map((b) => b.parcela_id));
  let n = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (parcelas ?? []) as any[]) {
    if (ja.has(p.id)) continue;
    const { data: seq, error: e1 } = await supabase.rpc("proximo_nosso_numero", { p_convenio: conv.id });
    if (e1) throw e1;
    const calc = calcularBoleto({
      bancoCodigo: conv.banco_codigo, convenio: conv.convenio, carteira: conv.carteira ?? "17",
      sequencial: Number(seq), vencimento: p.vencimento, valor: Number(p.valor),
    });
    const { error: e2 } = await supabase.from("boleto").insert({
      entidade_id: conv.entidade_id, parcela_id: p.id, convenio_id: conv.id, nosso_numero: calc.nossoNumero,
      seu_numero: `${p.negociacao?.numero ?? ""}-${String(p.numero).padStart(2, "0")}`,
      vencimento: p.vencimento, valor: p.valor, linha_digitavel: calc.linhaDigitavel, codigo_barras: calc.codigoBarras,
    });
    if (e2) throw e2;
    n++;
  }
  return n;
}

export function convenioParaCnab(c: Convenio, teste = false): ConvCnab {
  return {
    bancoCodigo: c.banco_codigo, bancoNome: c.banco_nome, agencia: c.agencia, agenciaDv: c.agencia_dv ?? "",
    conta: c.conta, contaDv: c.conta_dv ?? "", convenio: c.convenio, carteira: c.carteira ?? "17",
    variacao: c.variacao_carteira ?? "019", beneficiarioNome: c.beneficiario_nome,
    beneficiarioCnpj: c.beneficiario_documento, multaPercentual: Number(c.multa_percentual ?? 0),
    jurosMesPercentual: Number(c.juros_mes_percentual ?? 0), teste,
  };
}

/** Gera o arquivo de remessa com todos os boletos em status "gerado". */
export async function gerarRemessa(teste: boolean): Promise<{ nome: string; conteudo: string; qtd: number; total: number } | null> {
  const conv = await convenioAtivo();
  if (!conv) throw new Error("Cadastre o convênio bancário em Configurações.");
  const { data, error } = await supabase.from("boleto")
    .select("*, parcela(negociacao(cliente(*)))").eq("status", "gerado").eq("convenio_id", conv.id).order("criado_em");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bols = (data ?? []) as (Boleto & { parcela: any })[];
  if (!bols.length) return null;
  const { data: nsa, error: e1 } = await supabase.rpc("proximo_sequencial_remessa", { p_convenio: conv.id });
  if (e1) throw e1;
  const hoje = new Date().toISOString().slice(0, 10);
  const arq = gerarRemessa240(convenioParaCnab(conv, teste), bols.map((b) => {
    const cl = b.parcela.negociacao.cliente as Cliente;
    return {
      nossoNumero: b.nosso_numero, seuNumero: b.seu_numero ?? "", usoEmpresa: b.id.replace(/-/g, "").slice(0, 25),
      vencimento: b.vencimento, emissao: hoje, valor: Number(b.valor),
      pagador: {
        documento: cl.documento, nome: cl.nome,
        endereco: [cl.logradouro, cl.numero, cl.complemento].filter(Boolean).join(", "),
        bairro: cl.bairro ?? "", cep: cl.cep ?? "", cidade: cl.cidade ?? "", uf: cl.uf ?? "",
      },
      mensagem1: conv.instrucoes ?? "",
    };
  }), Number(nsa));
  const { data: rem, error: e2 } = await supabase.from("remessa").insert({
    entidade_id: conv.entidade_id, convenio_id: conv.id, sequencial: nsa, nome_arquivo: arq.nomeArquivo,
    conteudo: arq.conteudo, qtd_titulos: arq.qtd, valor_total: arq.total,
  }).select().single();
  if (e2) throw e2;
  const { error: e3 } = await supabase.from("boleto").update({ status: "enviado", remessa_id: rem.id }).in("id", bols.map((b) => b.id));
  if (e3) throw e3;
  return { nome: arq.nomeArquivo, conteudo: arq.conteudo, qtd: arq.qtd, total: arq.total };
}
