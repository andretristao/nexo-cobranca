-- NEXO Cobrança · taxa de juros na negociação (rodar uma vez)
alter table negociacao add column if not exists taxa_juros_mes numeric(6,3) not null default 0;
alter table negociacao add column if not exists sistema_amortizacao text not null default 'price'
  check (sistema_amortizacao in ('price','simples'));
alter table parcela add column if not exists valor_juros numeric(14,2) not null default 0;
alter table parcela add column if not exists valor_amortizacao numeric(14,2);
