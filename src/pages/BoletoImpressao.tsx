import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { brl, dataBR, docFmt } from "../lib/format";
import { codigoBarrasSVG } from "../lib/boleto";
import type { Boleto, Cliente, Convenio } from "../lib/tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type B = Boleto & { parcela: any; convenio_cobranca: Convenio };

export default function BoletoImpressao() {
  const [sp] = useSearchParams();
  const [bols, setBols] = useState<B[] | null>(null);

  useEffect(() => {
    const ids = (sp.get("ids") ?? "").split(",").filter(Boolean);
    supabase.from("boleto").select("*, convenio_cobranca(*), parcela(numero, negociacao(numero, cliente(*)))").in("id", ids).order("vencimento")
      .then(({ data }) => setBols((data ?? []) as B[]));
  }, [sp]);

  useEffect(() => { if (bols?.length) setTimeout(() => window.print(), 600); }, [bols]);
  if (!bols) return <p style={{ padding: 20 }}>Carregando…</p>;
  if (!bols.length) return <p style={{ padding: 20 }}>Nenhum boleto encontrado (faça login no sistema e tente de novo).</p>;

  return (
    <div className="impressao">
      {bols.map((b) => {
        const c = b.convenio_cobranca;
        const cl = b.parcela.negociacao.cliente as Cliente;
        const ag = `${c.agencia}${c.agencia_dv ? "-" + c.agencia_dv : ""} / ${c.conta}${c.conta_dv ? "-" + c.conta_dv : ""}`;
        const end = [cl.logradouro, cl.numero, cl.bairro, cl.cidade && `${cl.cidade}/${cl.uf}`, cl.cep].filter(Boolean).join(", ");
        return (
          <section className="boleto" key={b.id}>
            <div className="recibo">
              <div className="cab"><b>{c.banco_nome}</b><span className="cod">{c.banco_codigo}-9</span><span className="ld">Recibo do pagador</span></div>
              <table><tbody>
                <tr><td colSpan={3}><small>Beneficiário</small>{c.beneficiario_nome} · CNPJ {docFmt(c.beneficiario_documento)}</td><td><small>Vencimento</small><b>{dataBR(b.vencimento)}</b></td></tr>
                <tr><td colSpan={2}><small>Pagador</small>{cl.nome} · {docFmt(cl.documento)}</td><td><small>Nosso número</small>{b.nosso_numero}</td><td><small>Valor</small><b>{brl(b.valor)}</b></td></tr>
              </tbody></table>
            </div>
            <div className="corte">✂ corte aqui</div>
            <div className="ficha">
              <div className="cab"><b>{c.banco_nome}</b><span className="cod">{c.banco_codigo}-9</span><span className="ld">{b.linha_digitavel}</span></div>
              <table><tbody>
                <tr><td colSpan={4}><small>Local de pagamento</small>Pagável em qualquer banco até o vencimento. Após, somente no {c.banco_nome}.</td><td><small>Vencimento</small><b>{dataBR(b.vencimento)}</b></td></tr>
                <tr><td colSpan={4}><small>Beneficiário</small>{c.beneficiario_nome} · CNPJ {docFmt(c.beneficiario_documento)}</td><td><small>Agência / código beneficiário</small>{ag}</td></tr>
                <tr><td><small>Data documento</small>{dataBR(b.criado_em)}</td><td><small>Nº documento</small>{b.seu_numero}</td><td><small>Espécie doc.</small>DM</td><td><small>Aceite</small>N</td><td><small>Nosso número</small>{b.nosso_numero}</td></tr>
                <tr><td><small>Carteira</small>{c.carteira}</td><td><small>Espécie</small>R$</td><td colSpan={2} /><td><small>(=) Valor do documento</small><b>{brl(b.valor)}</b></td></tr>
                <tr><td colSpan={4} rowSpan={2} className="instr"><small>Instruções (texto de responsabilidade do beneficiário)</small>
                  {Number(c.multa_percentual) > 0 && <>Após o vencimento, multa de {Number(c.multa_percentual).toFixed(2).replace(".", ",")}%.<br /></>}
                  {Number(c.juros_mes_percentual) > 0 && <>Juros de {Number(c.juros_mes_percentual).toFixed(2).replace(".", ",")}% ao mês.<br /></>}
                  {c.instrucoes}<br />Negociação {b.parcela.negociacao.numero}, parcela {b.parcela.numero}.</td>
                  <td><small>(+) Mora / multa</small>&nbsp;</td></tr>
                <tr><td><small>(=) Valor cobrado</small>&nbsp;</td></tr>
                <tr><td colSpan={5}><small>Pagador</small>{cl.nome} · {docFmt(cl.documento)}<br />{end}</td></tr>
              </tbody></table>
              <div className="barras" dangerouslySetInnerHTML={{ __html: codigoBarrasSVG(b.codigo_barras ?? "", 50, 1) }} />
              <small className="autent">Autenticação mecânica · Ficha de compensação</small>
            </div>
          </section>
        );
      })}
    </div>
  );
}
