-- NEXO Cobrança · schema inicial (Supabase/Postgres)
-- Atende TR Uiraúna/PB DV00054/2026 itens 1.4 e 1.5:
-- clientes, negociações/parcelas, boletos registrados (remessa/retorno CNAB),
-- notificações, relatórios, perfis de acesso e log de operações.

create extension if not exists pgcrypto;

-- ===== Entidade (multi-tenant: cada prefeitura/programa) =====
create table if not exists entidade (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  programa text,                       -- ex.: 'Casa do Empreendedor'
  criado_em timestamptz not null default now()
);

-- Convênio de cobrança do banco indicado pela Administração
create table if not exists convenio_cobranca (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id) on delete cascade,
  banco_codigo text not null,          -- '001' BB, '104' Caixa, '756' Sicoob...
  banco_nome text not null,
  layout text not null check (layout in ('CNAB240','CNAB400','API')),
  agencia text not null,
  agencia_dv text,
  conta text not null,
  conta_dv text,
  convenio text not null,              -- código do beneficiário/convênio
  carteira text,
  variacao_carteira text,
  beneficiario_nome text not null,
  beneficiario_documento text not null,
  instrucoes text,                     -- texto impresso no boleto
  multa_percentual numeric(5,2) default 2.00,
  juros_mes_percentual numeric(5,2) default 1.00,
  dias_protesto int,
  proximo_nosso_numero bigint not null default 1,
  proximo_sequencial_remessa int not null default 1,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ===== Usuários e perfis =====
create table if not exists usuario (
  id uuid primary key references auth.users(id) on delete cascade,
  entidade_id uuid not null references entidade(id),
  nome text not null,
  email text not null,
  perfil text not null check (perfil in ('admin','operador','consulta')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function minha_entidade() returns uuid
language sql stable security definer set search_path = public as $$
  select entidade_id from usuario where id = auth.uid() and ativo
$$;

create or replace function meu_perfil() returns text
language sql stable security definer set search_path = public as $$
  select perfil from usuario where id = auth.uid() and ativo
$$;

-- ===== Clientes (1.4.1 a) =====
create table if not exists cliente (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  tipo_pessoa char(1) not null check (tipo_pessoa in ('F','J')),
  documento text not null,             -- CPF/CNPJ só dígitos
  nome text not null,
  nome_fantasia text,
  email text,
  telefone text,
  whatsapp text,
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, uf char(2),
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (entidade_id, documento)
);

-- ===== Negociações e parcelas (1.4.1 b) =====
create table if not exists negociacao (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  cliente_id uuid not null references cliente(id),
  numero serial,
  descricao text,                      -- finalidade do crédito
  data_negociacao date not null default current_date,
  valor_principal numeric(14,2) not null check (valor_principal > 0),
  valor_total numeric(14,2) not null check (valor_total > 0),
  qtd_parcelas int not null check (qtd_parcelas between 1 and 120),
  primeiro_vencimento date not null,
  status text not null default 'ativa'
    check (status in ('ativa','quitada','cancelada','renegociada')),
  negociacao_origem_id uuid references negociacao(id),  -- renegociação
  criado_em timestamptz not null default now()
);

create table if not exists parcela (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  negociacao_id uuid not null references negociacao(id) on delete cascade,
  numero int not null,
  vencimento date not null,
  valor numeric(14,2) not null check (valor > 0),
  status text not null default 'aberta'
    check (status in ('aberta','paga','cancelada','renegociada')),
  valor_pago numeric(14,2),
  data_pagamento date,
  forma_baixa text check (forma_baixa in ('retorno','manual')),
  unique (negociacao_id, numero)
);

-- Gera parcelas iguais (última ajusta centavos), vencimento mensal
create or replace function gerar_parcelas(p_negociacao uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n negociacao; v numeric(14,2); i int;
begin
  select * into n from negociacao where id = p_negociacao;
  if n.entidade_id <> minha_entidade() then raise exception 'sem acesso'; end if;
  delete from parcela where negociacao_id = n.id and status = 'aberta';
  v := trunc(n.valor_total / n.qtd_parcelas, 2);
  for i in 1..n.qtd_parcelas loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (n.entidade_id, n.id, i,
            (n.primeiro_vencimento + make_interval(months => i-1))::date,
            case when i = n.qtd_parcelas then n.valor_total - v*(n.qtd_parcelas-1) else v end);
  end loop;
  return n.qtd_parcelas;
end $$;

-- ===== Boletos, remessas e retornos (1.4.1 c, d) =====
create table if not exists remessa (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  convenio_id uuid not null references convenio_cobranca(id),
  sequencial int not null,
  nome_arquivo text not null,
  conteudo text not null,              -- arquivo CNAB gerado
  qtd_titulos int not null,
  valor_total numeric(14,2) not null,
  gerado_por uuid references usuario(id),
  gerado_em timestamptz not null default now()
);

create table if not exists boleto (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  parcela_id uuid not null references parcela(id),
  convenio_id uuid not null references convenio_cobranca(id),
  nosso_numero text not null,
  seu_numero text,                     -- ex.: NEG-123/04
  vencimento date not null,
  valor numeric(14,2) not null,
  linha_digitavel text,
  codigo_barras text,
  status text not null default 'gerado'
    check (status in ('gerado','enviado','registrado','rejeitado','pago','baixado','cancelado')),
  remessa_id uuid references remessa(id),
  ocorrencia_ultima text,
  valor_pago numeric(14,2),
  data_pagamento date,
  data_credito date,
  criado_em timestamptz not null default now(),
  unique (convenio_id, nosso_numero)
);

create table if not exists retorno (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  convenio_id uuid not null references convenio_cobranca(id),
  nome_arquivo text not null,
  conteudo text not null,
  qtd_registros int not null default 0,
  qtd_liquidados int not null default 0,
  valor_liquidado numeric(14,2) not null default 0,
  processado_por uuid references usuario(id),
  processado_em timestamptz not null default now()
);

create table if not exists retorno_item (
  id uuid primary key default gen_random_uuid(),
  retorno_id uuid not null references retorno(id) on delete cascade,
  boleto_id uuid references boleto(id),
  nosso_numero text,
  codigo_ocorrencia text,
  descricao_ocorrencia text,
  valor_pago numeric(14,2),
  data_pagamento date,
  data_credito date,
  aplicado boolean not null default false,
  mensagem text
);

-- Reserva nosso número de forma atômica
create or replace function proximo_nosso_numero(p_convenio uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update convenio_cobranca set proximo_nosso_numero = proximo_nosso_numero + 1
   where id = p_convenio and entidade_id = minha_entidade()
   returning proximo_nosso_numero - 1 into n;
  if n is null then raise exception 'convênio inválido'; end if;
  return n;
end $$;

-- ===== Notificações (1.4.1 e) =====
create table if not exists notificacao (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references entidade(id),
  cliente_id uuid not null references cliente(id),
  parcela_id uuid references parcela(id),
  tipo text not null check (tipo in ('lembrete_vencimento','atraso','cobranca','quitacao','livre')),
  canal text not null check (canal in ('email','whatsapp','sms','impresso')),
  assunto text,
  mensagem text not null,
  status text not null default 'pendente' check (status in ('pendente','enviada','falhou')),
  enviada_em timestamptz,
  erro text,
  criado_por uuid references usuario(id),
  criado_em timestamptz not null default now()
);

-- ===== Log de operações (1.5.2) =====
create table if not exists log_operacao (
  id bigserial primary key,
  entidade_id uuid,
  usuario_id uuid,
  tabela text not null,
  operacao text not null,
  registro_id text,
  dados_antes jsonb,
  dados_depois jsonb,
  em timestamptz not null default now()
);

create or replace function registrar_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into log_operacao (entidade_id, usuario_id, tabela, operacao, registro_id, dados_antes, dados_depois)
  values (coalesce((to_jsonb(new)->>'entidade_id')::uuid, (to_jsonb(old)->>'entidade_id')::uuid),
          auth.uid(), tg_table_name, tg_op,
          coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text;
begin
  foreach t in array array['cliente','negociacao','parcela','boleto','remessa','retorno',
                           'notificacao','convenio_cobranca','usuario'] loop
    execute format('drop trigger if exists trg_log on %I', t);
    execute format('create trigger trg_log after insert or update or delete on %I
                    for each row execute function registrar_log()', t);
  end loop;
end $$;

-- ===== Relatórios (1.4.1 f) =====
create or replace view vw_inadimplentes with (security_invoker = true) as
select c.entidade_id, c.id as cliente_id, c.nome, c.documento, c.telefone, c.email,
       count(p.id) as parcelas_vencidas,
       sum(p.valor) as valor_vencido,
       min(p.vencimento) as vencimento_mais_antigo,
       current_date - min(p.vencimento) as dias_atraso
  from parcela p
  join negociacao n on n.id = p.negociacao_id
  join cliente c on c.id = n.cliente_id
 where p.status = 'aberta' and p.vencimento < current_date
 group by c.entidade_id, c.id;

create or replace view vw_pagamentos with (security_invoker = true) as
select p.entidade_id, p.data_pagamento, p.valor_pago, p.forma_baixa, p.numero as parcela,
       n.numero as negociacao, c.nome, c.documento, b.nosso_numero
  from parcela p
  join negociacao n on n.id = p.negociacao_id
  join cliente c on c.id = n.cliente_id
  left join boleto b on b.parcela_id = p.id and b.status = 'pago'
 where p.status = 'paga';

create or replace view vw_clientes_sintetico with (security_invoker = true) as
select c.entidade_id, c.id as cliente_id, c.nome, c.documento,
       count(distinct n.id) filter (where n.status = 'ativa') as negociacoes_ativas,
       coalesce(sum(p.valor) filter (where p.status = 'aberta'), 0) as saldo_aberto,
       coalesce(sum(p.valor_pago) filter (where p.status = 'paga'), 0) as total_pago,
       coalesce(sum(p.valor) filter (where p.status = 'aberta' and p.vencimento < current_date), 0) as valor_vencido
  from cliente c
  left join negociacao n on n.cliente_id = c.id
  left join parcela p on p.negociacao_id = n.id
 group by c.entidade_id, c.id;

-- ===== RLS =====
do $$ declare t text;
begin
  foreach t in array array['entidade','convenio_cobranca','usuario','cliente','negociacao','parcela',
                           'boleto','remessa','retorno','notificacao','log_operacao'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy entidade_sel on entidade for select using (id = minha_entidade());

do $$ declare t text;
begin
  -- leitura: qualquer perfil da entidade; escrita: admin/operador
  foreach t in array array['cliente','negociacao','parcela','boleto','remessa','retorno','notificacao'] loop
    execute format('create policy %1$s_sel on %1$I for select using (entidade_id = minha_entidade())', t);
    execute format('create policy %1$s_ins on %1$I for insert with check (entidade_id = minha_entidade() and meu_perfil() in (''admin'',''operador''))', t);
    execute format('create policy %1$s_upd on %1$I for update using (entidade_id = minha_entidade() and meu_perfil() in (''admin'',''operador''))', t);
  end loop;
end $$;

create policy convenio_sel on convenio_cobranca for select using (entidade_id = minha_entidade());
create policy convenio_adm on convenio_cobranca for all
  using (entidade_id = minha_entidade() and meu_perfil() = 'admin')
  with check (entidade_id = minha_entidade() and meu_perfil() = 'admin');

create policy usuario_sel on usuario for select using (entidade_id = minha_entidade());
create policy usuario_adm on usuario for all
  using (entidade_id = minha_entidade() and meu_perfil() = 'admin')
  with check (entidade_id = minha_entidade() and meu_perfil() = 'admin');

create policy log_sel on log_operacao for select
  using (entidade_id = minha_entidade() and meu_perfil() = 'admin');

alter table retorno_item enable row level security;
create policy retorno_item_sel on retorno_item for select
  using (exists (select 1 from retorno r where r.id = retorno_id and r.entidade_id = minha_entidade()));
create policy retorno_item_ins on retorno_item for insert
  with check (exists (select 1 from retorno r where r.id = retorno_id and r.entidade_id = minha_entidade()));

create index if not exists ix_parcela_venc on parcela (entidade_id, status, vencimento);
create index if not exists ix_boleto_nn on boleto (convenio_id, nosso_numero);
create index if not exists ix_cliente_nome on cliente (entidade_id, nome);
create index if not exists ix_log_em on log_operacao (entidade_id, em desc);
