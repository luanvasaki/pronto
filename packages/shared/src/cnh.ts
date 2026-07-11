export interface CnhCategoryOption {
  value: string;
  label: string;
}

/**
 * Categorias oficiais de CNH no Brasil — mesmos valores de
 * apps/backend/src/db/schema/cnh.ts (duplicado de propósito, front e
 * back não importam um do outro). Usada tanto no cadastro/perfil do
 * trabalhador (qual CNH ele tem) quanto na criação de vaga (qual CNH
 * a vaga exige/prefere).
 */
export const CNH_CATEGORY_OPTIONS: readonly CnhCategoryOption[] = [
  { value: 'A', label: 'A (moto)' },
  { value: 'B', label: 'B (carro)' },
  { value: 'AB', label: 'AB (moto e carro)' },
  { value: 'C', label: 'C (caminhão pequeno)' },
  { value: 'D', label: 'D (ônibus)' },
  { value: 'E', label: 'E (carreta)' },
];
