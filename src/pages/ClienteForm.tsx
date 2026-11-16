import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { cnpjValido, cpfValido, erroMsg } from "../lib/format";
import type { Cliente } from "../lib/tipos";

const VAZIO: Partial<Cliente> = { tipo_pessoa: "F", documento: "", nome: "", uf: "PB", ativo: true };

export default function ClienteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { entidade } = useAuth();
  const [c, setC] = useState<Partial<Cliente>>(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (id) supabase.from("cliente").select("*").eq("id", id).single().then(({ data }) => data && setC(data));
  }, [id]);

  const set = (k: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setC({ ...c, [k]: e.target.value });

  async function buscarCep() {
    const cep = (c.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((x) => x.json());
      if (!r.erro) setC((v) => ({ ...v, logradouro: r.logradouro || v.logradouro, bairro: r.bairro || v.bairro, cidade: r.localidade, uf: r.uf }));
    } catch { /* sem internet: segue manual */ }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const doc = (c.documento ?? "").replace(/\D/g, "");
    if (c.tipo_pessoa === "F" ? !cpfValido(doc) : !cnpjValido(doc)) { setErro(c.tipo_pessoa === "F" ? "CPF inválido." : "CNPJ inválido."); return; }
    setSalvando(true);
    const dados = { ...c, documento: doc, entidade_id: entidade!.id, atualizado_em: new Date().toISOString() };
    delete (dados as Partial<Cliente> & { criado_em?: string }).criado_em;
    const r = id ? await supabase.from("cliente").update(dados).eq("id", id).select().single()
                 : await supabase.from("cliente").insert(dados).select().single();
    setSalvando(false);
    if (r.error) { setErro(r.error.code === "23505" ? "Já existe cliente com este CPF/CNPJ." : erroMsg(r.error)); return; }
    nav(`/clientes/${r.data.id}`);
  }

  return (
    <>
      <h1>{id ? "Editar cliente" : "Novo cliente"}</h1>
      <form className="card form" onSubmit={salvar}>
        <div className="grade">
          <label>Tipo<select value={c.tipo_pessoa} onChange={set("tipo_pessoa")}><option value="F">Pessoa física</option><option value="J">Pessoa jurídica</option></select></label>
          <label>{c.tipo_pessoa === "F" ? "CPF" : "CNPJ"} *<input required value={c.documento ?? ""} onChange={set("documento")} /></label>
          <label className="larga">Nome / razão social *<input required value={c.nome ?? ""} onChange={set("nome")} /></label>
          {c.tipo_pessoa === "J" && <label className="larga">Nome fantasia<input value={c.nome_fantasia ?? ""} onChange={set("nome_fantasia")} /></label>}
          <label>Telefone<input value={c.telefone ?? ""} onChange={set("telefone")} /></label>
          <label>WhatsApp<input value={c.whatsapp ?? ""} onChange={set("whatsapp")} placeholder="(83) 9 9999-9999" /></label>
          <label className="larga">E-mail<input type="email" value={c.email ?? ""} onChange={set("email")} /></label>
          <label>CEP<input value={c.cep ?? ""} onChange={set("cep")} onBlur={buscarCep} /></label>
          <label className="larga">Logradouro<input value={c.logradouro ?? ""} onChange={set("logradouro")} /></label>
          <label>Número<input value={c.numero ?? ""} onChange={set("numero")} /></label>
          <label>Complemento<input value={c.complemento ?? ""} onChange={set("complemento")} /></label>
          <label>Bairro<input value={c.bairro ?? ""} onChange={set("bairro")} /></label>
          <label>Cidade<input value={c.cidade ?? ""} onChange={set("cidade")} /></label>
          <label>UF<input maxLength={2} value={c.uf ?? ""} onChange={set("uf")} /></label>
          <label className="inteira">Observações<textarea rows={3} value={c.observacoes ?? ""} onChange={set("observacoes")} /></label>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <div className="acoes"><button type="button" onClick={() => nav(-1)}>Cancelar</button><button className="primario" disabled={salvando}>Salvar</button></div>
      </form>
    </>
  );
}
