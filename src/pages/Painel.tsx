import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { brl, dataBR, hojeISO } from "../lib/format";

interface Resumo {
  clientes: number; negociacoesAtivas: number; saldoAberto: number; vencido: number;
  inadimplentes: number; recebidoMes: number; aVencer7: { id: string; vencimento: string; valor: number; negociacao_id: string; nome: string }[];
  boletosSemRemessa: number;
}

export default function Painel() {
  const [r, setR] = useState<Resumo | null>(null);

  useEffect(() => {
    (async () => {
      const hoje = hojeISO();
      const inicioMes = hoje.slice(0, 8) + "01";
      const em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const [cli, neg, abertas, inad, pagas, prox, bol] = await Promise.all([
        supabase.from("cliente").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("negociacao").select("id", { count: "exact", head: true }).eq("status", "ativa"),
        supabase.from("parcela").select("valor, vencimento").eq("status", "aberta"),
        supabase.from("vw_inadimplentes").select("cliente_id", { count: "exact", head: true }),
        supabase.from("parcela").select("valor_pago").eq("status", "paga").gte("data_pagamento", inicioMes),
        supabase.from("parcela").select("id, vencimento, valor, negociacao_id, negociacao(cliente(nome))")
          .eq("status", "aberta").gte("vencimento", hoje).lte("vencimento", em7).order("vencimento").limit(10),
        supabase.from("boleto").select("id", { count: "exact", head: true }).eq("status", "gerado"),
      ]);
      const ab = (abertas.data ?? []) as { valor: number; vencimento: string }[];
      setR({
        clientes: cli.count ?? 0,
        negociacoesAtivas: neg.count ?? 0,
        saldoAberto: ab.reduce((a, p) => a + Number(p.valor), 0),
        vencido: ab.filter((p) => p.vencimento < hoje).reduce((a, p) => a + Number(p.valor), 0),
        inadimplentes: inad.count ?? 0,
        recebidoMes: ((pagas.data ?? []) as { valor_pago: number }[]).reduce((a, p) => a + Number(p.valor_pago ?? 0), 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aVencer7: ((prox.data ?? []) as any[]).map((p) => ({ ...p, nome: p.negociacao?.cliente?.nome ?? "" })),
        boletosSemRemessa: bol.count ?? 0,
      });
    })();
  }, []);

  if (!r) return <p>Carregando…</p>;
  return (
    <>
      <h1>Painel</h1>
      <div className="kpis">
        <div className="kpi"><span>Clientes ativos</span><b>{r.clientes}</b></div>
        <div className="kpi"><span>Negociações ativas</span><b>{r.negociacoesAtivas}</b></div>
        <div className="kpi"><span>Saldo a receber</span><b>{brl(r.saldoAberto)}</b></div>
        <div className="kpi alerta"><span>Vencido ({r.inadimplentes} clientes)</span><b>{brl(r.vencido)}</b></div>
        <div className="kpi ok"><span>Recebido no mês</span><b>{brl(r.recebidoMes)}</b></div>
      </div>
      {r.boletosSemRemessa > 0 && (
        <div className="faixa">Há {r.boletosSemRemessa} boleto(s) gerado(s) que ainda não foram para o banco. <Link to="/boletos">Gerar remessa</Link></div>
      )}
      <div className="card">
        <h2>Vencendo nos próximos 7 dias</h2>
        {r.aVencer7.length === 0 ? <p className="vazio">Nenhuma parcela vence nos próximos 7 dias.</p> : (
          <table><thead><tr><th>Cliente</th><th>Vencimento</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{r.aVencer7.map((p) => (
              <tr key={p.id}><td>{p.nome}</td><td>{dataBR(p.vencimento)}</td><td className="num">{brl(p.valor)}</td>
                <td><Link to={`/negociacoes/${p.negociacao_id}`}>Abrir</Link></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
