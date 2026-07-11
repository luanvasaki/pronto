export const CNH_CATEGORIES = ['A', 'B', 'AB', 'C', 'D', 'E'] as const;
export type CnhCategory = (typeof CNH_CATEGORIES)[number];

export function isCnhCategory(value: string): value is CnhCategory {
  return (CNH_CATEGORIES as readonly string[]).includes(value);
}

/**
 * AB cobre A e B (categoria combinada) — qualquer outra categoria só bate
 * com ela mesma. Sem tentar modelar a hierarquia completa da CNH real
 * (C/D/E exigem B como pré-requisito pra tirar, mas isso não significa
 * que quem dirige categoria maior deva "herdar" a exigência de B de uma
 * vaga — mantido simples de propósito).
 */
export function satisfiesCnhRequirement(workerCnh: string | null, requiredCnh: string): boolean {
  if (!workerCnh) return false;
  if (workerCnh === requiredCnh) return true;
  return workerCnh === 'AB' && (requiredCnh === 'A' || requiredCnh === 'B');
}
