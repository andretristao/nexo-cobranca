-- NEXO Cobrança · dados de DEMONSTRAÇÃO (fictícios)
-- Rodar no SQL Editor DEPOIS do 03-primeiro-acesso.sql.
-- Convênio de teste com dados fictícios: troque pelos dados reais do banco antes de produção.

do $$
declare v_ent uuid; v_cli uuid; v_neg uuid; i int; v_n int; v_val numeric; v_venc date; v_pagas int;
begin
  select id into v_ent from entidade order by criado_em limit 1;
  if v_ent is null then raise exception 'Rode antes o 03-primeiro-acesso.sql'; end if;

  if not exists (select 1 from convenio_cobranca where entidade_id = v_ent) then
    insert into convenio_cobranca (entidade_id, banco_codigo, banco_nome, layout, agencia, agencia_dv, conta, conta_dv,
      convenio, carteira, variacao_carteira, beneficiario_nome, beneficiario_documento, instrucoes, multa_percentual, juros_mes_percentual)
    values (v_ent, '001', 'BANCO DO BRASIL S.A.', 'CNAB240', '1234', '5', '12345', '6', '1234567', '17', '019',
      'FUNDO MUNICIPAL DE APOIO AOS MICRO E PEQUENOS NEGOCIOS', '00000000000191',
      'Dúvidas: Casa do Empreendedor. DADOS DE DEMONSTRAÇÃO.', 2, 1);
  end if;

  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '52601815906', 'Maria das Graças Fernandes', '83 98118-9313', '83 98118-9313', null, '58915000', 'Rua Padre Cícero', '81', 'Alto Alegre', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: capital de giro (mercearia)', (date_trunc('month', current_date) - interval '7 month')::date, 2000, 2100.0, 6,
          (date_trunc('month', current_date) - interval '6 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '86091390937', 'José Erivan de Sousa', '83 99199-7499', '83 99199-7499', null, '58915000', 'Av. Senador Rui Carneiro', '439', 'Alto Alegre', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: ferramentas de oficina', (date_trunc('month', current_date) - interval '3 month')::date, 1500, 1575.0, 6,
          (date_trunc('month', current_date) - interval '2 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date and numero < (select max(numero) - 1 from parcela p2 where p2.negociacao_id = v_neg and p2.vencimento < current_date);
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '19482199308', 'Francisca Lúcia Andrade', '83 98762-2596', '83 98762-2596', null, '58915000', 'Rua Santo Antônio', '220', 'Nova Uiraúna', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: ferramentas de oficina', (date_trunc('month', current_date) - interval '1 month')::date, 4000, 4200.0, 12,
          (date_trunc('month', current_date) - interval '0 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '65797543206', 'Antônio Marcos Batista', '83 99431-4999', '83 99431-4999', null, '58915000', 'Av. Senador Rui Carneiro', '756', 'Nova Uiraúna', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: equipamentos de lanchonete', (date_trunc('month', current_date) - interval '8 month')::date, 1500, 1620.0, 12,
          (date_trunc('month', current_date) - interval '7 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '91186252740', 'Ana Paula Gomes da Silva', '83 98863-1642', '83 98863-1642', null, '58915000', 'Av. Senador Rui Carneiro', '721', 'São José', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: ferramentas de oficina', (date_trunc('month', current_date) - interval '6 month')::date, 5000, 5500.0, 6,
          (date_trunc('month', current_date) - interval '5 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '79711471043', 'Raimundo Nonato Pereira', '83 99497-6072', '83 99497-6072', null, '58915000', 'Av. Senador Rui Carneiro', '743', 'Nova Uiraúna', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: equipamentos de lanchonete', (date_trunc('month', current_date) - interval '8 month')::date, 5000, 5500.0, 12,
          (date_trunc('month', current_date) - interval '7 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date and numero < (select max(numero) - 1 from parcela p2 where p2.negociacao_id = v_neg and p2.vencimento < current_date);
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '07529170309', 'Josefa Aparecida Lima', '83 99573-5709', '83 99573-5709', null, '58915000', 'Rua Padre Cícero', '518', 'Centro', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: máquina de costura', (date_trunc('month', current_date) - interval '7 month')::date, 2000, 2100.0, 12,
          (date_trunc('month', current_date) - interval '6 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '76842684650', 'Francisco de Assis Rolim', '83 98734-7233', '83 98734-7233', null, '58915000', 'Rua José Moreira', '247', 'Alto Alegre', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: capital de giro (mercearia)', (date_trunc('month', current_date) - interval '3 month')::date, 2000, 2100.0, 6,
          (date_trunc('month', current_date) - interval '2 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '79244026830', 'Luzia Helena Cavalcante', '83 98756-6220', '83 98756-6220', null, '58915000', 'Rua Padre Cícero', '808', 'Bairro da Pedra', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: estoque de confecções', (date_trunc('month', current_date) - interval '1 month')::date, 2000, 2200.0, 12,
          (date_trunc('month', current_date) - interval '0 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '66617603117', 'Cícero Romão Alves', '83 98427-8219', '83 98427-8219', null, '58915000', 'Rua Coronel Joaquim Moreira', '10', 'Bairro da Pedra', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: máquina de costura', (date_trunc('month', current_date) - interval '1 month')::date, 2000, 2160.0, 6,
          (date_trunc('month', current_date) - interval '0 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date and numero < (select max(numero) - 1 from parcela p2 where p2.negociacao_id = v_neg and p2.vencimento < current_date);
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '81590139658', 'Rita de Cássia Moreira', '83 98304-5132', '83 98304-5132', null, '58915000', 'Rua Coronel Joaquim Moreira', '128', 'Nova Uiraúna', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: estoque de confecções', (date_trunc('month', current_date) - interval '8 month')::date, 2500, 2700.0, 12,
          (date_trunc('month', current_date) - interval '7 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '77412154770', 'Pedro Henrique Dantas', '83 99697-3645', '83 99697-3645', null, '58915000', 'Rua José Moreira', '716', 'Bairro da Pedra', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: capital de giro (mercearia)', (date_trunc('month', current_date) - interval '6 month')::date, 4000, 4200.0, 6,
          (date_trunc('month', current_date) - interval '5 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '84148525303', 'Edileuza Maria Bezerra', '83 99090-9873', '83 99090-9873', null, '58915000', 'Rua Santo Antônio', '840', 'Alto Alegre', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: máquina de costura', (date_trunc('month', current_date) - interval '4 month')::date, 4000, 4400.0, 10,
          (date_trunc('month', current_date) - interval '3 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '63387500408', 'João Batista Formiga', '83 98967-5246', '83 98967-5246', null, '58915000', 'Rua Padre Cícero', '837', 'São José', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: equipamentos de lanchonete', (date_trunc('month', current_date) - interval '6 month')::date, 2000, 2200.0, 12,
          (date_trunc('month', current_date) - interval '5 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date and numero < (select max(numero) - 1 from parcela p2 where p2.negociacao_id = v_neg and p2.vencimento < current_date);
  insert into cliente (entidade_id, tipo_pessoa, documento, nome, telefone, whatsapp, email, cep, logradouro, numero, bairro, cidade, uf)
  values (v_ent, 'F', '13137353700', 'Sebastiana Ferreira Leite', '83 99278-1031', '83 99278-1031', null, '58915000', 'Rua Coronel Joaquim Moreira', '407', 'Alto Alegre', 'Uiraúna', 'PB')
  on conflict (entidade_id, documento) do update set nome = excluded.nome returning id into v_cli;
  insert into negociacao (entidade_id, cliente_id, descricao, data_negociacao, valor_principal, valor_total, qtd_parcelas, primeiro_vencimento)
  values (v_ent, v_cli, 'Microcrédito: estoque de confecções', (date_trunc('month', current_date) - interval '2 month')::date, 3000, 3240.0, 12,
          (date_trunc('month', current_date) - interval '1 month')::date + 9) returning id, qtd_parcelas, valor_total, primeiro_vencimento into v_neg, v_n, v_val, v_venc;
  v_pagas := 0;
  for i in 1..v_n loop
    insert into parcela (entidade_id, negociacao_id, numero, vencimento, valor)
    values (v_ent, v_neg, i, (v_venc + make_interval(months => i-1))::date,
            case when i = v_n then v_val - trunc(v_val / v_n, 2) * (v_n - 1) else trunc(v_val / v_n, 2) end);
  end loop;
  update parcela set status = 'paga', valor_pago = valor, data_pagamento = vencimento - 2, forma_baixa = 'manual'
   where negociacao_id = v_neg and vencimento < current_date ;
end $$;
