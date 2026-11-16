// NEXO Cobrança · CNAB 240 (FEBRABAN) · remessa e retorno de cobrança
// Implementação inicial: Banco do Brasil (convênio 7 dígitos, carteira 17).
// Cada registro é montado campo a campo e validado com 240 posições.

import { so, zeros, centavos } from "./boleto";

export interface Convenio {
  bancoCodigo: string;      // '001'
  bancoNome: string;        // 'BANCO DO BRASIL S.A.'
  agencia: string; agenciaDv: string;
  conta: string; contaDv: string;
  convenio: string;         // 7 dígitos
  carteira: string;         // '17'
  variacao: string;         // '019' etc.
  beneficiarioNome: string;
  beneficiarioCnpj: string;
  multaPercentual: number;  // ex.: 2
  jurosMesPercentual: number; // ex.: 1
  especie?: string;         // default '02' (DM); '04' DS; '99' outros
  teste?: boolean;          // marca 'TS' no header (homologação BB)
}

export interface TituloRemessa {
  nossoNumero: string;      // 17 dígitos (BB)
  seuNumero: string;        // nº do documento (até 15)
  usoEmpresa: string;       // id interno (até 25)
  vencimento: string;       // YYYY-MM-DD
  emissao: string;          // YYYY-MM-DD
  valor: number;
  pagador: {
    documento: string; nome: string; endereco: string; bairro: string;
    cep: string; cidade: string; uf: string;
  };
  mensagem1?: string;
  mensagem2?: string;
}

// ---------- helpers ----------
const sem = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, " ").toUpperCase();
const A = (s: string, n: number) => sem(s).slice(0, n).padEnd(n, " ");    // alfanumérico
const N = (v: string | number, n: number) => zeros(so(String(v)) || "0", n); // numérico
const B = (n: number) => " ".repeat(n);
const Z = (n: number) => "0".repeat(n);
const V = (v: number, n: number) => zeros(centavos(v), n);
const D = (iso: string) => (iso ? iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4) : Z(8));
const somaDias = (iso: string, d: number) => {
  const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

function reg(partes: string[], tipo: string): string {
  const r = partes.join("");
  if (r.length !== 240) throw new Error(`Registro ${tipo} com ${r.length} posições (esperado 240)`);
  return r;
}

const convenioBB = (c: Convenio, teste?: boolean) =>
  N(c.convenio, 9) + "0014" + N(c.carteira, 2) + N(c.variacao, 3) + (teste ? "TS" : B(2)); // 20

const contaBloco = (c: Convenio) =>
  N(c.agencia, 5) + A(c.agenciaDv, 1) + N(c.conta, 12) + A(c.contaDv, 1) + B(1); // 20

// ---------- remessa ----------
export function gerarRemessa240(
  c: Convenio, titulos: TituloRemessa[], nsa: number, agora = new Date(),
): { nomeArquivo: string; conteudo: string; qtd: number; total: number } {
  if (c.bancoCodigo !== "001") throw new Error(`Banco ${c.bancoCodigo} ainda não implementado`);
  if (!titulos.length) throw new Error("Nenhum título para remessa");
  const hoje = agora.toISOString().slice(0, 10);
  const hora = agora.toTimeString().slice(0, 8).replace(/:/g, "");
  const banco = N(c.bancoCodigo, 3);
  const linhas: string[] = [];

  // Header de arquivo
  linhas.push(reg([
    banco, "0000", "0", B(9), "2", N(c.beneficiarioCnpj, 14), convenioBB(c, c.teste),
    contaBloco(c), A(c.beneficiarioNome, 30), A(c.bancoNome, 30), B(10),
    "1", D(hoje), hora, N(nsa, 6), "083", Z(5), B(20), B(20), B(29),
  ], "header arquivo"));

  // Header de lote
  linhas.push(reg([
    banco, "0001", "1", "R", "01", B(2), "042", B(1), "2", N(c.beneficiarioCnpj, 15),
    convenioBB(c, c.teste), contaBloco(c), A(c.beneficiarioNome, 30), B(40), B(40),
    N(nsa, 8), D(hoje), Z(8), B(33),
  ], "header lote"));

  let seq = 0;
  let total = 0;
  for (const t of titulos) {
    total += t.valor;
    const p = t.pagador;
    const doc = so(p.documento);
    const cep = N(p.cep, 8);
    const diaSeguinte = somaDias(t.vencimento, 1);

    // Segmento P
    linhas.push(reg([
      banco, "0001", "3", N(++seq, 5), "P", B(1), "01", contaBloco(c),
      A(t.nossoNumero, 20), "7", "1", "1", "2", "2", A(t.seuNumero, 15), D(t.vencimento),
      V(t.valor, 15), Z(5), "0", N(c.especie ?? "02", 2), "N", D(t.emissao),
      c.jurosMesPercentual > 0 ? "2" : "3", c.jurosMesPercentual > 0 ? D(diaSeguinte) : Z(8),
      V(c.jurosMesPercentual, 15),
      "0", Z(8), Z(15), Z(15), Z(15), A(t.usoEmpresa, 25), "3", "00", "0", "000", "09", Z(10), B(1),
    ], "segmento P"));

    // Segmento Q
    linhas.push(reg([
      banco, "0001", "3", N(++seq, 5), "Q", B(1), "01", doc.length > 11 ? "2" : "1", N(doc, 15),
      A(p.nome, 40), A(p.endereco, 40), A(p.bairro, 15), cep.slice(0, 5), cep.slice(5),
      A(p.cidade, 15), A(p.uf, 2), "0", Z(15), B(40), "000", B(20), B(8),
    ], "segmento Q"));

    // Segmento R (multa + mensagens)
    linhas.push(reg([
      banco, "0001", "3", N(++seq, 5), "R", B(1), "01", "0", Z(8), Z(15), "0", Z(8), Z(15),
      c.multaPercentual > 0 ? "2" : "0", c.multaPercentual > 0 ? D(diaSeguinte) : Z(8),
      V(c.multaPercentual, 15), B(10), A(t.mensagem1 ?? "", 40), A(t.mensagem2 ?? "", 40),
      B(20), Z(8), Z(3), Z(5), B(1), Z(12), B(1), B(1), "0", B(9),
    ], "segmento R"));
  }

  // Trailer de lote (header + detalhes + trailer)
  linhas.push(reg([
    banco, "0001", "5", B(9), N(seq + 2, 6), N(titulos.length, 6), V(total, 17), Z(69), B(125),
  ], "trailer lote"));

  // Trailer de arquivo
  linhas.push(reg([
    banco, "9999", "9", B(9), "000001", N(linhas.length + 1, 6), Z(6), B(205),
  ], "trailer arquivo"));

  const nomeArquivo = `CB${D(hoje).slice(0, 4)}${N(nsa, 2)}.REM`;
  return { nomeArquivo, conteudo: linhas.join("\r\n") + "\r\n", qtd: titulos.length, total };
}

// ---------- retorno ----------
export const OCORRENCIAS_RETORNO: Record<string, string> = {
  "02": "Entrada confirmada (registrado)",
  "03": "Entrada rejeitada",
  "06": "Liquidação",
  "09": "Baixa",
  "12": "Confirmação de abatimento",
  "14": "Confirmação de alteração de vencimento",
  "17": "Liquidação após baixa",
  "19": "Confirmação de recebimento de instrução de protesto",
  "25": "Protestado e baixado",
  "28": "Débito de tarifas/custas",
};
export const OCORRENCIAS_LIQUIDACAO = new Set(["06", "17"]);

export interface ItemRetorno {
  nossoNumero: string;
  seuNumero: string;
  usoEmpresa: string;
  ocorrencia: string;
  descricao: string;
  motivos: string;
  vencimento: string | null;
  valorTitulo: number;
  valorPago: number;
  valorLiquido: number;
  jurosMulta: number;
  tarifa: number;
  dataOcorrencia: string | null;
  dataCredito: string | null;
}

const isoDe = (ddmmaaaa: string) =>
  /^0+$/.test(ddmmaaaa) || !ddmmaaaa.trim() ? null
    : `${ddmmaaaa.slice(4, 8)}-${ddmmaaaa.slice(2, 4)}-${ddmmaaaa.slice(0, 2)}`;
const valorDe = (s: string) => Number(so(s) || "0") / 100;
const f = (l: string, ini: number, fim: number) => l.slice(ini - 1, fim);

export function lerRetorno240(conteudo: string): { banco: string; itens: ItemRetorno[] } {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length);
  if (!linhas.length || linhas[0].length < 240) throw new Error("Arquivo não parece CNAB 240");
  const banco = f(linhas[0], 1, 3);
  const itens: ItemRetorno[] = [];
  let atual: ItemRetorno | null = null;

  for (const l of linhas) {
    if (f(l, 8, 8) !== "3") continue;
    const seg = f(l, 14, 14);
    if (seg === "T") {
      const oc = f(l, 16, 17);
      atual = {
        nossoNumero: f(l, 38, 57).trim(),
        seuNumero: f(l, 59, 73).trim(),
        usoEmpresa: f(l, 106, 130).trim(),
        ocorrencia: oc,
        descricao: OCORRENCIAS_RETORNO[oc] ?? `Ocorrência ${oc}`,
        motivos: f(l, 214, 223).trim(),
        vencimento: isoDe(f(l, 74, 81)),
        valorTitulo: valorDe(f(l, 82, 96)),
        tarifa: valorDe(f(l, 199, 213)),
        valorPago: 0, valorLiquido: 0, jurosMulta: 0,
        dataOcorrencia: null, dataCredito: null,
      };
      itens.push(atual);
    } else if (seg === "U" && atual) {
      atual.jurosMulta = valorDe(f(l, 18, 32));
      atual.valorPago = valorDe(f(l, 78, 92));
      atual.valorLiquido = valorDe(f(l, 93, 107));
      atual.dataOcorrencia = isoDe(f(l, 138, 145));
      atual.dataCredito = isoDe(f(l, 146, 153));
      atual = null;
    }
  }
  return { banco, itens };
}

/** Gera um retorno simulado (para demonstração/testes) liquidando os títulos informados. */
export function simularRetorno240(
  c: Convenio,
  pagos: { nossoNumero: string; seuNumero: string; usoEmpresa: string; vencimento: string; valor: number; pagoEm: string; ocorrencia?: string }[],
  nsa: number,
): string {
  const banco = N(c.bancoCodigo, 3);
  const L: string[] = [];
  const hoje = new Date().toISOString().slice(0, 10);
  L.push(reg([banco, "0000", "0", B(9), "2", N(c.beneficiarioCnpj, 14), convenioBB(c), contaBloco(c),
    A(c.beneficiarioNome, 30), A(c.bancoNome, 30), B(10), "2", D(hoje), "120000", N(nsa, 6), "083", Z(5), B(69)], "hdr"));
  L.push(reg([banco, "0001", "1", "T", "01", B(2), "042", B(1), "2", N(c.beneficiarioCnpj, 15), convenioBB(c),
    contaBloco(c), A(c.beneficiarioNome, 30), B(80), N(nsa, 8), D(hoje), Z(8), B(33)], "hdr lote"));
  let seq = 0;
  for (const p of pagos) {
    const oc = p.ocorrencia ?? "06";
    const pago = oc === "06" || oc === "17" ? p.valor : 0;
    L.push(reg([banco, "0001", "3", N(++seq, 5), "T", B(1), oc, contaBloco(c), A(p.nossoNumero, 20), "7",
      A(p.seuNumero, 15), D(p.vencimento), V(p.valor, 15), "001", Z(5), B(1), A(p.usoEmpresa, 25), "09",
      "1", Z(15), B(40), Z(10), V(oc === "06" ? 1.5 : 0, 15), B(10), B(17)], "T"));
    L.push(reg([banco, "0001", "3", N(++seq, 5), "U", B(1), oc, Z(15), Z(15), Z(15), Z(15), V(pago, 15),
      V(pago ? pago - 1.5 : 0, 15), Z(15), Z(15), D(pago ? p.pagoEm : hoje), pago ? D(somaDias(p.pagoEm, 1)) : Z(8),
      B(4), Z(8), Z(15), B(30), "000", B(27)], "U"));
  }
  L.push(reg([banco, "0001", "5", B(9), N(seq + 2, 6), B(217)], "trl lote"));
  L.push(reg([banco, "9999", "9", B(9), "000001", N(L.length + 1, 6), Z(6), B(205)], "trl arq"));
  return L.join("\r\n") + "\r\n";
}
