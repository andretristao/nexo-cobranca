-- NEXO Cobrança · funções de negócio (rodar depois do 01-schema.sql)

-- Reserva o próximo número sequencial de remessa (NSA)
create or replace function proximo_sequencial_remessa(p_convenio uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update convenio_cobranca set proximo_sequencial_remessa = proximo_sequencial_remessa + 1
   where id = p_convenio and entidade_id = minha_entidade()
   returning proximo_sequencial_remessa - 1 into n;
  if n is null then raise exception 'convênio inválido'; end if;
  return n;
end $$;

-- Aplica um arquivo de retorno já lido no navegador.
-- p_itens: [{nossoNumero, ocorrencia, descricao, valorPago, dataOcorrencia, dataCredito}]
create or replace function aplicar_retorno(p_convenio uuid, p_nome text, p_conteudo text, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ent uuid := minha_entidade();
  v_ret uuid;
  it jsonb;
  b boleto;
  v_liq int := 0; v_val numeric := 0; v_n int := 0; v_msg text; v_apl boolean;
begin
  if v_ent is null or meu_perfil() not in ('admin','operador') then raise exception 'sem permissão'; end if;
  if not exists (select 1 from convenio_cobranca where id = p_convenio and entidade_id = v_ent) then
    raise exception 'convênio inválido';
  end if;

  insert into retorno (entidade_id, convenio_id, nome_arquivo, conteudo, processado_por)
  values (v_ent, p_convenio, p_nome, p_conteudo, auth.uid()) returning id into v_ret;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_n := v_n + 1; v_apl := false; v_msg := null;
    select * into b from boleto
     where convenio_id = p_convenio and entidade_id = v_ent and nosso_numero = it->>'nossoNumero';
    if b.id is null then
      v_msg := 'Nosso número não encontrado no sistema';
    elsif it->>'ocorrencia' in ('06','17') then
      if b.status = 'pago' then
        v_msg := 'Boleto já estava baixado como pago';
      else
        update boleto set status = 'pago', valor_pago = (it->>'valorPago')::numeric,
               data_pagamento = nullif(it->>'dataOcorrencia','')::date, data_credito = nullif(it->>'dataCredito','')::date,
               ocorrencia_ultima = it->>'descricao'
         where id = b.id;
        update parcela set status = 'paga', valor_pago = (it->>'valorPago')::numeric,
               data_pagamento = nullif(it->>'dataOcorrencia','')::date, forma_baixa = 'retorno'
         where id = b.parcela_id and status = 'aberta';
        v_liq := v_liq + 1; v_val := v_val + (it->>'valorPago')::numeric; v_apl := true;
        v_msg := 'Pagamento baixado';
      end if;
    elsif it->>'ocorrencia' = '02' then
      update boleto set status = case when status in ('gerado','enviado') then 'registrado' else status end,
             ocorrencia_ultima = it->>'descricao' where id = b.id;
      v_apl := true; v_msg := 'Registro confirmado pelo banco';
    elsif it->>'ocorrencia' = '03' then
      update boleto set status = 'rejeitado', ocorrencia_ultima = it->>'descricao' where id = b.id;
      v_apl := true; v_msg := 'Rejeitado pelo banco: conferir motivos';
    elsif it->>'ocorrencia' in ('09','25') then
      update boleto set status = 'baixado', ocorrencia_ultima = it->>'descricao' where id = b.id;
      v_apl := true; v_msg := 'Baixado pelo banco';
    else
      update boleto set ocorrencia_ultima = it->>'descricao' where id = b.id;
      v_apl := true; v_msg := 'Ocorrência registrada';
    end if;

    insert into retorno_item (retorno_id, boleto_id, nosso_numero, codigo_ocorrencia, descricao_ocorrencia,
                              valor_pago, data_pagamento, data_credito, aplicado, mensagem)
    values (v_ret, b.id, it->>'nossoNumero', it->>'ocorrencia', it->>'descricao',
            nullif(it->>'valorPago','')::numeric, nullif(it->>'dataOcorrencia','')::date,
            nullif(it->>'dataCredito','')::date, v_apl, v_msg);
  end loop;

  -- quita a negociação quando todas as parcelas estiverem pagas
  update negociacao n set status = 'quitada'
   where n.entidade_id = v_ent and n.status = 'ativa'
     and not exists (select 1 from parcela p where p.negociacao_id = n.id and p.status = 'aberta');

  update retorno set qtd_registros = v_n, qtd_liquidados = v_liq, valor_liquidado = v_val where id = v_ret;
  return jsonb_build_object('retorno_id', v_ret, 'registros', v_n, 'liquidados', v_liq, 'valor', v_val);
end $$;

-- Baixa manual (pagamento fora do boleto, com justificativa registrada no log)
create or replace function baixar_parcela_manual(p_parcela uuid, p_valor numeric, p_data date)
returns void language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  if meu_perfil() not in ('admin','operador') then raise exception 'sem permissão'; end if;
  update parcela set status = 'paga', valor_pago = p_valor, data_pagamento = p_data, forma_baixa = 'manual'
   where id = p_parcela and entidade_id = minha_entidade() and status = 'aberta'
   returning negociacao_id into v_neg;
  if v_neg is null then raise exception 'parcela não encontrada ou já paga'; end if;
  update boleto set status = 'baixado', ocorrencia_ultima = 'Baixa manual no sistema'
   where parcela_id = p_parcela and status in ('gerado','enviado','registrado');
  update negociacao set status = 'quitada'
   where id = v_neg and not exists (select 1 from parcela where negociacao_id = v_neg and status = 'aberta');
end $$;

-- Admin vincula um usuário que já criou login (Authentication) à entidade
create or replace function vincular_usuario(p_email text, p_nome text, p_perfil text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  if meu_perfil() <> 'admin' then raise exception 'apenas administradores'; end if;
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'Nenhum login com este e-mail. Peça para a pessoa se cadastrar primeiro.'; end if;
  insert into usuario (id, entidade_id, nome, email, perfil)
  values (v_id, minha_entidade(), p_nome, lower(p_email), p_perfil)
  on conflict (id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true
   where usuario.entidade_id = minha_entidade();
end $$;

-- Cancelar negociação (parcelas abertas e boletos não pagos são cancelados)
create or replace function cancelar_negociacao(p_negociacao uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if meu_perfil() not in ('admin','operador') then raise exception 'sem permissão'; end if;
  update negociacao set status = 'cancelada' where id = p_negociacao and entidade_id = minha_entidade();
  update parcela set status = 'cancelada' where negociacao_id = p_negociacao and status = 'aberta';
  update boleto set status = 'cancelado'
   where parcela_id in (select id from parcela where negociacao_id = p_negociacao)
     and status in ('gerado','enviado','registrado');
end $$;

-- Admin pode alterar nome/programa da entidade
create policy entidade_upd on entidade for update using (id = minha_entidade() and meu_perfil() = 'admin');
