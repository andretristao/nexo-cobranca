// Cálculo de parcelas de crédito
export interface ParcelaCalc { numero: number; vencimento: string; valor: number; juros: number; amortizacao: number; saldo: number }

const r2 = (v: number) => Math.round(v * 100) / 100;

export const addMes = (iso: string, m: number) => {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, ult));
  return dt.toISOString().slice(0, 10);
};

/**
 * price   = Tabela Price: parcelas iguais; juros compostos sobre o saldo devedor.
 * simples = juros simples sobre o principal, divididos igualmente nas parcelas.
 * Taxa em % ao mês. Taxa 0 = sem juros (parcelas iguais ao principal / n).
 */
export function calcularParcelas(principal: number, taxaMes: number, n: number, primeiroVenc: string,
  sistema: "price" | "simples" = "price"): ParcelaCalc[] {
  if (!(principal > 0) || !(n >= 1) || !primeiroVenc) return [];
  const i = taxaMes / 100;
  const out: ParcelaCalc[] = [];
  let saldo = principal;
  if (i === 0 || sistema === "simples") {
    const totalJuros = r2(principal * i * n);
    const amortBase = Math.floor((principal / n) * 100) / 100;
    const jurosBase = Math.floor((totalJuros / n) * 100) / 100;
    for (let k = 1; k <= n; k++) {
      const ult = k === n;
      const amort = ult ? r2(saldo) : amortBase;
      const juros = ult ? r2(totalJuros - jurosBase * (n - 1)) : jurosBase;
      saldo = r2(saldo - amort);
      out.push({ numero: k, vencimento: addMes(primeiroVenc, k - 1), valor: r2(amort + juros), juros, amortizacao: amort, saldo });
    }
    return out;
  }
  const pmt = r2((principal * i) / (1 - Math.pow(1 + i, -n)));
  for (let k = 1; k <= n; k++) {
    const juros = r2(saldo * i);
    const ult = k === n;
    const amort = ult ? r2(saldo) : r2(pmt - juros);
    saldo = r2(saldo - amort);
    out.push({ numero: k, vencimento: addMes(primeiroVenc, k - 1), valor: r2(amort + juros), juros, amortizacao: amort, saldo });
  }
  return out;
}
