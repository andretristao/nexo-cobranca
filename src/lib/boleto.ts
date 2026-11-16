// NEXO Cobrança · boleto FEBRABAN (código de barras + linha digitável)
// Implementação inicial: Banco do Brasil, convênio de 7 dígitos (carteira 17).
// Outros bancos entram como novos "montadores de campo livre".

export function mod10(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  const r = soma % 10;
  return r === 0 ? 0 : 10 - r;
}

/** DV geral do código de barras (módulo 11, pesos 2..9; 0, 10 e 11 viram 1). */
export function mod11Barras(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    soma += Number(num[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

const DIA_MS = 86_400_000;
const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * Fator de vencimento FEBRABAN. Após 21/02/2025 (fator 9999) o fator
 * reinicia em 1000 em 22/02/2025.
 */
export function fatorVencimento(vencimentoISO: string): string {
  const dias = Math.round((utc(vencimentoISO) - utc("1997-10-07")) / DIA_MS);
  let fator = dias;
  if (dias > 9999) fator = ((dias - 10000) % 9000) + 1000;
  return String(fator).padStart(4, "0");
}

export const so = (s: string) => (s ?? "").replace(/\D/g, "");
export const zeros = (v: string | number, n: number) => String(v).padStart(n, "0").slice(-n);
export const centavos = (v: number) => Math.round(v * 100);

export interface DadosBoleto {
  bancoCodigo: string;        // '001'
  convenio: string;           // 7 dígitos (BB)
  carteira: string;           // '17'
  sequencial: number;         // parte variável do nosso número
  vencimento: string;         // 'YYYY-MM-DD'
  valor: number;              // reais
}

export interface BoletoCalculado {
  nossoNumero: string;
  codigoBarras: string;       // 44 dígitos
  linhaDigitavel: string;     // 47 dígitos, formatada
}

/** Nosso número BB convênio 7 dígitos: convênio(7) + sequencial(10) = 17, sem DV. */
export function nossoNumeroBB(convenio: string, sequencial: number): string {
  const c = so(convenio);
  if (c.length !== 7) throw new Error("Convênio BB deve ter 7 dígitos");
  return c + zeros(sequencial, 10);
}

function campoLivre(d: DadosBoleto): { campoLivre: string; nossoNumero: string } {
  if (d.bancoCodigo === "001") {
    const nn = nossoNumeroBB(d.convenio, d.sequencial);
    return { campoLivre: "000000" + nn + zeros(d.carteira, 2), nossoNumero: nn };
  }
  throw new Error(`Banco ${d.bancoCodigo} ainda não implementado`);
}

export function calcularBoleto(d: DadosBoleto): BoletoCalculado {
  const { campoLivre: cl, nossoNumero } = campoLivre(d);
  if (cl.length !== 25) throw new Error("Campo livre deve ter 25 dígitos");
  const moeda = "9";
  const fator = fatorVencimento(d.vencimento);
  const valor = zeros(centavos(d.valor), 10);
  const semDv = d.bancoCodigo + moeda + fator + valor + cl; // 43
  const dv = mod11Barras(semDv);
  const codigoBarras = semDv.slice(0, 4) + dv + semDv.slice(4);

  const c1 = d.bancoCodigo + moeda + cl.slice(0, 5);
  const c2 = cl.slice(5, 15);
  const c3 = cl.slice(15, 25);
  const f1 = c1 + mod10(c1);
  const f2 = c2 + mod10(c2);
  const f3 = c3 + mod10(c3);
  const linhaDigitavel =
    `${f1.slice(0, 5)}.${f1.slice(5)} ${f2.slice(0, 5)}.${f2.slice(5)} ` +
    `${f3.slice(0, 5)}.${f3.slice(5)} ${dv} ${fator}${valor}`;

  return { nossoNumero, codigoBarras, linhaDigitavel };
}

/** Intercalado 2 de 5: devolve sequência de larguras (n=estreita, w=larga) barra/espaço alternados. */
export function i25Pattern(codigo: string): string {
  const P: Record<string, string> = {
    "0": "nnwwn", "1": "wnnnw", "2": "nwnnw", "3": "wwnnn", "4": "nnwnw",
    "5": "wnwnn", "6": "nwwnn", "7": "nnnww", "8": "wnnwn", "9": "nwnwn",
  };
  let out = "nnnn"; // start
  for (let i = 0; i < codigo.length; i += 2) {
    const a = P[codigo[i]], b = P[codigo[i + 1]];
    for (let k = 0; k < 5; k++) out += a[k] + b[k];
  }
  return out + "wnn"; // stop
}

/** SVG do código de barras (para o PDF/HTML do boleto). */
export function codigoBarrasSVG(codigo: string, altura = 50, fina = 1): string {
  const pat = i25Pattern(codigo);
  let x = 0;
  let rects = "";
  for (let i = 0; i < pat.length; i++) {
    const w = pat[i] === "w" ? fina * 3 : fina;
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${altura}"/>`;
    x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${altura}" viewBox="0 0 ${x} ${altura}" fill="#000">${rects}</svg>`;
}
