export type Perfil = "admin" | "operador" | "consulta";

export interface Usuario { id: string; entidade_id: string; nome: string; email: string; perfil: Perfil; ativo: boolean }
export interface Entidade { id: string; nome: string; cnpj: string | null; programa: string | null }

export interface Cliente {
  id: string; entidade_id: string; tipo_pessoa: "F" | "J"; documento: string; nome: string;
  nome_fantasia: string | null; email: string | null; telefone: string | null; whatsapp: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; uf: string | null; observacoes: string | null; ativo: boolean;
}

export interface Negociacao {
  id: string; entidade_id: string; cliente_id: string; numero: number; descricao: string | null;
  data_negociacao: string; valor_principal: number; valor_total: number; qtd_parcelas: number;
  primeiro_vencimento: string; taxa_juros_mes?: number; sistema_amortizacao?: string; status: "ativa" | "quitada" | "cancelada" | "renegociada";
  cliente?: Cliente;
}

export interface Parcela {
  id: string; entidade_id: string; negociacao_id: string; numero: number; vencimento: string; valor: number;
  status: "aberta" | "paga" | "cancelada" | "renegociada"; valor_pago: number | null;
  data_pagamento: string | null; forma_baixa: "retorno" | "manual" | null; valor_juros?: number; valor_amortizacao?: number | null;
}

export interface Convenio {
  id: string; entidade_id: string; banco_codigo: string; banco_nome: string; layout: string;
  agencia: string; agencia_dv: string | null; conta: string; conta_dv: string | null; convenio: string;
  carteira: string | null; variacao_carteira: string | null; beneficiario_nome: string;
  beneficiario_documento: string; instrucoes: string | null; multa_percentual: number;
  juros_mes_percentual: number; dias_protesto: number | null; proximo_nosso_numero: number;
  proximo_sequencial_remessa: number; ativo: boolean;
}

export interface Boleto {
  id: string; entidade_id: string; parcela_id: string; convenio_id: string; nosso_numero: string;
  seu_numero: string | null; vencimento: string; valor: number; linha_digitavel: string | null;
  codigo_barras: string | null; status: string; remessa_id: string | null; ocorrencia_ultima: string | null;
  valor_pago: number | null; data_pagamento: string | null; data_credito: string | null; criado_em: string;
}

export const STATUS_BOLETO: Record<string, string> = {
  gerado: "Gerado (aguarda remessa)", enviado: "Em remessa", registrado: "Registrado no banco",
  rejeitado: "Rejeitado", pago: "Pago", baixado: "Baixado", cancelado: "Cancelado",
};
