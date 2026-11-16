/** Normaliza texto para busca: minúsculas e sem acentos ("André" → "andre"). */
export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Confere se todas as palavras digitadas aparecem no texto (em qualquer ordem). */
export function casa(texto: string, termo: string) {
  const t = norm(texto);
  return norm(termo).split(/\s+/).filter(Boolean).every((p) => t.includes(p));
}
