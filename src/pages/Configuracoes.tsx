import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { baixarCSV, dataHoraBR, erroMsg } from "../lib/format";
import type { Convenio, Usuario } from "../lib/tipos";

type Aba = "convenio" | "usuarios" | "log" | "exportar";

export default function Configuracoes() {
  const { usuario } = useAuth();
  const admin = usuario?.perfil === "admin";
  const [aba, setAba] = useState<Aba>("convenio");
  return (
    <>
      <h1>Configurações</h1>
      <div className="filtros">
        {([["convenio", "Convênio bancário"], ["usuarios", "Usuários e perfis"], ["log", "Log de operações"], ["exportar", "Exportar base"]] as [Aba, string][])
          .map(([a, l]) => <button key={a} className={aba === a ? "ativo" : ""} onClick={() => setAba(a)}>{l}</button>)}
      </div>
      {!admin && aba !== "convenio" ? <div className="card">Disponível apenas para administradores.</div> : (
        aba === "convenio" ? <ConvenioForm admin={admin} /> : aba === "usuarios" ? <Usuarios /> : aba === "log" ? <Log /> : <Exportar />
      )}
    </>
  );
}

function ConvenioForm({ admin }: { admin: boolean }) {
  const { entidade } = useAuth();
  const [c, setC] = useState<Partial<Convenio>>({ banco_codigo: "001", banco_nome: "BANCO DO BRASIL S.A.", layout: "CNAB240", carteira: "17", variacao_carteira: "019", multa_percentual: 2, juros_mes_percentual: 1 });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    supabase.from("convenio_cobranca").select("*").eq("ativo", true).order("criado_em").limit(1).maybeSingle().then(({ data }) => data && setC(data));
  }, []);
  const set = (k: keyof Convenio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const d = { ...c, entidade_id: entidade!.id };
    delete (d as Record<string, unknown>).criado_em;
    const r = c.id ? await supabase.from("convenio_cobranca").update(d).eq("id", c.id).select().single()
                   : await supabase.from("convenio_cobranca").insert(d).select().single();
    if (r.error) setMsg(erroMsg(r.error)); else { setC(r.data); setMsg("Convênio salvo."); }
  }
  const campo = (k: keyof Convenio, label: string, extra: Record<string, unknown> = {}) =>
    <label {...(extra.larga ? { className: "larga" } : {})}>{label}<input disabled={!admin} value={(c[k] as string | number | undefined) ?? ""} onChange={set(k)} {...(extra.input as object)} /></label>;

  return (
    <form className="card form" onSubmit={salvar}>
      <p>Dados do convênio de cobrança registrada da Prefeitura no banco. Hoje o sistema gera boletos e arquivos CNAB 240 do Banco do Brasil (convênio de 7 dígitos, carteira 17).</p>
      <div className="grade">
        <label>Banco<select disabled={!admin} value={c.banco_codigo} onChange={(e) => setC({ ...c, banco_codigo: e.target.value, banco_nome: e.target.selectedOptions[0].dataset.nome! })}>
          <option value="001" data-nome="BANCO DO BRASIL S.A.">001 · Banco do Brasil</option></select></label>
        <label>Layout<select disabled={!admin} value={c.layout} onChange={set("layout")}><option value="CNAB240">CNAB 240</option></select></label>
        {campo("agencia", "Agência")}{campo("agencia_dv", "DV agência")}
        {campo("conta", "Conta corrente")}{campo("conta_dv", "DV conta")}
        {campo("convenio", "Convênio (7 dígitos)")}{campo("carteira", "Carteira")}{campo("variacao_carteira", "Variação da carteira")}
        {campo("beneficiario_nome", "Beneficiário (razão social)", { larga: true })}{campo("beneficiario_documento", "CNPJ do beneficiário")}
        {campo("multa_percentual", "Multa após vencimento (%)")}{campo("juros_mes_percentual", "Juros ao mês (%)")}
        {campo("proximo_nosso_numero", "Próximo nosso número")}{campo("proximo_sequencial_remessa", "Próximo nº de remessa")}
        <label className="inteira">Instruções impressas no boleto<textarea disabled={!admin} rows={2} value={c.instrucoes ?? ""} onChange={set("instrucoes")} /></label>
      </div>
      {msg && <p className="aviso">{msg}</p>}
      {admin && <div className="acoes"><button className="primario">Salvar convênio</button></div>}
    </form>
  );
}

function Usuarios() {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [email, setEmail] = useState(""); const [nome, setNome] = useState(""); const [perfil, setPerfil] = useState("operador");
  const [msg, setMsg] = useState("");
  const carregar = useCallback(async () => {
    const { data } = await supabase.from("usuario").select("*").order("nome"); setLista((data ?? []) as Usuario[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function vincular(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const { error } = await supabase.rpc("vincular_usuario", { p_email: email, p_nome: nome, p_perfil: perfil });
    if (error) setMsg(erroMsg(error)); else { setMsg("Acesso liberado."); setEmail(""); setNome(""); carregar(); }
  }
  async function alterar(u: Usuario, campos: Partial<Usuario>) {
    const { error } = await supabase.from("usuario").update(campos).eq("id", u.id);
    if (error) setMsg(erroMsg(error)); carregar();
  }
  return (
    <>
      <form className="card form" onSubmit={vincular}>
        <h2>Liberar acesso</h2>
        <p>A pessoa cria o login na tela inicial ("Criar login"). Depois, informe o e-mail dela aqui e escolha o perfil.</p>
        <div className="grade">
          <label className="larga">E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="larga">Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Perfil<select value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            <option value="admin">Administrador</option><option value="operador">Operador</option><option value="consulta">Consulta</option></select></label>
        </div>
        {msg && <p className="aviso">{msg}</p>}
        <div className="acoes"><button className="primario">Liberar</button></div>
      </form>
      <div className="card">
        <p><small>Administrador: tudo, inclusive convênio, usuários e log. Operador: cadastra clientes, negociações, boletos, remessas, retornos e notificações. Consulta: só visualiza e emite relatórios.</small></p>
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th></tr></thead>
          <tbody>{lista.map((u) => (
            <tr key={u.id}><td>{u.nome}</td><td>{u.email}</td>
              <td><select value={u.perfil} onChange={(e) => alterar(u, { perfil: e.target.value as Usuario["perfil"] })}>
                <option value="admin">Administrador</option><option value="operador">Operador</option><option value="consulta">Consulta</option></select></td>
              <td><input type="checkbox" checked={u.ativo} onChange={(e) => alterar(u, { ativo: e.target.checked })} /></td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}

interface LogL { id: number; usuario_id: string | null; tabela: string; operacao: string; registro_id: string; em: string }
function Log() {
  const [linhas, setLinhas] = useState<LogL[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [tabela, setTabela] = useState("");
  useEffect(() => {
    let q = supabase.from("log_operacao").select("id, usuario_id, tabela, operacao, registro_id, em").order("em", { ascending: false }).limit(300);
    if (tabela) q = q.eq("tabela", tabela);
    q.then(({ data }) => setLinhas((data ?? []) as LogL[]));
    supabase.from("usuario").select("id, nome").then(({ data }) => setNomes(Object.fromEntries((data ?? []).map((u) => [u.id, u.nome]))));
  }, [tabela]);
  const OP: Record<string, string> = { INSERT: "Inclusão", UPDATE: "Alteração", DELETE: "Exclusão" };
  return (
    <div className="card">
      <div className="filtros"><label>Tabela <select value={tabela} onChange={(e) => setTabela(e.target.value)}>
        <option value="">Todas</option>{["cliente", "negociacao", "parcela", "boleto", "remessa", "retorno", "notificacao", "convenio_cobranca", "usuario"].map((t) => <option key={t}>{t}</option>)}</select></label></div>
      <table><thead><tr><th>Data e hora</th><th>Usuário</th><th>Operação</th><th>Tabela</th><th>Registro</th></tr></thead>
        <tbody>{linhas.map((l) => <tr key={l.id}><td>{dataHoraBR(l.em)}</td><td>{l.usuario_id ? nomes[l.usuario_id] ?? l.usuario_id : "sistema"}</td><td>{OP[l.operacao]}</td><td>{l.tabela}</td><td><code className="mini">{l.registro_id}</code></td></tr>)}</tbody></table>
    </div>
  );
}

function Exportar() {
  const [msg, setMsg] = useState("");
  async function exp(t: string) {
    const { data, error } = await supabase.from(t).select("*").limit(100000);
    if (error) { setMsg(erroMsg(error)); return; }
    if (!data?.length) { setMsg(`Tabela ${t} sem registros.`); return; }
    baixarCSV(`${t}.csv`, data as Record<string, unknown>[]);
  }
  return (
    <div className="card">
      <p>Exporta a base de dados em CSV (formato aberto), conforme a cláusula de propriedade dos dados. Os dados pertencem à Administração.</p>
      <div className="grupo">{["cliente", "negociacao", "parcela", "boleto", "remessa", "retorno", "notificacao"].map((t) => <button key={t} onClick={() => exp(t)}>{t}.csv</button>)}</div>
      {msg && <p className="aviso">{msg}</p>}
    </div>
  );
}
