-- NEXO Cobrança · primeiro acesso de uma nova entidade
-- 1) A pessoa cria o login na tela inicial do sistema ("Criar login").
-- 2) Troque os textos entre <> e rode este script no SQL Editor do Supabase.

with e as (
  insert into entidade (nome, cnpj, programa)
  values ('<PREFEITURA MUNICIPAL DE UIRAÚNA>', '<CNPJ>', 'Casa do Empreendedor')
  returning id
)
insert into usuario (id, entidade_id, nome, email, perfil)
select u.id, e.id, '<Nome do administrador>', u.email, 'admin'
  from auth.users u, e
 where lower(u.email) = lower('<email-do-admin@exemplo.com>');
