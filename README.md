# NEXO Cobrança

Sistema web para gestão de programas municipais de crédito e cobrança (ex.: Casa do Empreendedor):
clientes, negociações e parcelas, boletos registrados com remessa e retorno CNAB 240,
notificações (WhatsApp, e-mail, carta), relatórios e log de operações.

Stack: React + TypeScript (Vite), Supabase (Postgres + Auth + RLS), Vercel.

## Instalação

1. Crie um projeto no Supabase (região São Paulo).
2. No SQL Editor, rode em ordem: `supabase/01-schema.sql` e `supabase/02-funcoes.sql`.
3. Na Vercel, importe este repositório e configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Acesse o sistema, clique em "Criar login" e depois rode `supabase/03-primeiro-acesso.sql` com seus dados.
5. Em Configurações → Convênio bancário, cadastre o convênio de cobrança da entidade.

## Bancos suportados

- Banco do Brasil: convênio de 7 dígitos, carteira 17, CNAB 240 (remessa e retorno).

## Desenvolvimento

```
npm install
cp .env.example .env.local   # preencher
npm run dev
```
