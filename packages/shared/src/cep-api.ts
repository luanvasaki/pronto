export interface CepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * ViaCEP é público, sem chave — retorna 200 com `{ erro: true }` (não
 * um status de erro HTTP) quando o CEP não existe, por isso a checagem
 * é no corpo, não em `response.ok`. `digits` já deve vir só com
 * números (ver extractDigits) — não aceita máscara.
 */
export async function lookupCep(digits: string): Promise<CepLookupResult> {
  if (!/^\d{8}$/.test(digits)) {
    throw new Error('CEP precisa ter 8 dígitos.');
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) {
    throw new Error('Não foi possível buscar esse CEP. Tente de novo.');
  }

  const body = (await response.json()) as ViaCepResponse;
  if (body.erro) {
    throw new Error('CEP não encontrado.');
  }

  return {
    cep: digits,
    street: body.logradouro ?? '',
    neighborhood: body.bairro ?? '',
    city: body.localidade ?? '',
    state: body.uf ?? '',
  };
}
