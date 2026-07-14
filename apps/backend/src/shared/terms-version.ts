/**
 * Identifica qual redação dos Termos de Uso foi aceita, gravada junto
 * com cada `termsAcceptedAt` (users e jobs) — sem isso, uma mudança
 * futura no texto deixaria os aceites antigos sem como saber qual
 * versão a pessoa/empresa realmente viu.
 *
 * Bump manual sempre que o texto da cláusula "Pronto é só
 * intermediário, sem vínculo empregatício" mudar de forma relevante.
 */
export const CURRENT_TERMS_VERSION = 'v1';
