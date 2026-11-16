import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { casa } from "../lib/busca";
import { docFmt } from "../lib/format";

interface C { id: string; nome: string; documento: string; cidade: string | null }

/** Campo único: digite parte do nome (sem se preocupar com acento) ou do CPF/CNPJ e escolha na lista. */
export default function ClienteBusca({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const [todos, setTodos] = useState<C[]>([]);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("cliente").select("id, nome, documento, cidade").eq("ativo", true).order("nome").limit(5000)
      .then(({ data }) => setTodos((data ?? []) as C[]));
  }, []);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const selecionado = todos.find((c) => c.id === valor);
  const dig = texto.replace(/\D/g, "");
  const lista = texto.trim()
    ? todos.filter((c) => casa(c.nome, texto) || (dig.length >= 3 && c.documento.includes(dig))).slice(0, 8)
    : todos.slice(0, 8);

  function escolher(c: C) { onChange(c.id); setTexto(""); setAberto(false); }

  if (selecionado) return (
    <div className="cliente-escolhido">
      <div><b>{selecionado.nome}</b><br /><small>{docFmt(selecionado.documento)}{selecionado.cidade ? ` · ${selecionado.cidade}` : ""}</small></div>
      <button type="button" className="link" onClick={() => onChange("")}>Trocar cliente</button>
    </div>
  );

  return (
    <div className="autocompletar" ref={caixa}>
      <input autoFocus placeholder="Digite o nome ou CPF do cliente" value={texto}
        onFocus={() => setAberto(true)}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); setAtivo(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, lista.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && lista[ativo]) { e.preventDefault(); escolher(lista[ativo]); }
        }} />
      {aberto && (
        <ul className="sugestoes">
          {lista.length === 0 ? <li className="vazio">Nenhum cliente encontrado.</li> : lista.map((c, k) => (
            <li key={c.id} className={k === ativo ? "ativo" : ""} onMouseDown={(e) => { e.preventDefault(); escolher(c); }} onMouseEnter={() => setAtivo(k)}>
              <b>{c.nome}</b> <small>{docFmt(c.documento)}{c.cidade ? ` · ${c.cidade}` : ""}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
