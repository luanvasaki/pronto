# Pacote `@shift/shared` — referência

> Sem build — os 3 apps front importam direto do `.ts` fonte (`transpilePackages` no `next.config.ts` de cada um). Só lógica, nunca componentes React — ver [`03-architecture/frontend-architecture.md`](../03-architecture/frontend-architecture.md).

| Arquivo | Exports | Notas |
|---|---|---|
| `api.ts` | `ApiError`, `apiFetch<T>` | `credentials: 'include'` sempre; detecta `FormData` pra não forçar `Content-Type` |
| `auth-api.ts` | `register`, `login`, `googleLogin`, `forgotPassword`, `resetPassword`, `getCurrentUser`, `refreshSession`, `logout`, tipo `UserResponse` | `refreshSession` deduplica chamadas concorrentes (evita disparo de detecção de reuso de token em StrictMode do React) |
| `benefits.ts` | `formatBenefitLabel`, tipo `BenefitProvision` | Retorna `null` (não texto errado) se `paid` sem valor |
| `cep-api.ts` | `lookupCep`, tipo `CepLookupResult` | Chama ViaCEP direto do navegador, não passa pelo backend |
| `cnh.ts` | `CNH_CATEGORY_OPTIONS` | Duplicado de propósito do schema do backend, sem import cruzado |
| `cpf-cnpj.ts` | `isValidCpf`, `isValidCnpj` | Validação real de dígito verificador |
| `digits.ts` | `extractDigits` | Remove tudo que não é dígito |
| `masks.ts` | `formatCpf`, `formatCnpj`, `formatPhone`, `formatCep` | Máscaras de exibição |
| `names.ts` | `getFirstName` | Usado na saudação do worker |
| `password.ts` | `isValidPassword` | Só valida mínimo de 8 caracteres — diverge do backend (ver [`05-operations/known-issues.md`](../05-operations/known-issues.md)) |
| `ratings-api.ts` | `WORKER_RATING_CATEGORIES`, `COMPANY_RATING_CATEGORIES`, `rateShift`, tipos `Rating`/`RatingCategory`/`ShiftRatings` | Categorias também duplicadas de propósito do backend |
| `skill-categories-api.ts` | `listSkillCategories`, `createSkillCategory`, tipo `SkillCategory` | — |

Cada app duplica seus próprios componentes de UI (`Button`, `Input`, `Avatar`, etc.) — não vêm daqui. Ver [`03-architecture/frontend-architecture.md`](../03-architecture/frontend-architecture.md) pra por que essa é uma escolha consciente de arquitetura.
