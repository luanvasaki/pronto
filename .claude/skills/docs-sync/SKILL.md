---
name: docs-sync
description: Garante que docs/ nunca desatualize — toda mudança de código, decisão de produto, ou dívida técnica descoberta é refletida no arquivo certo, na mesma tarefa em que acontece. Use ao final de qualquer tarefa que mude comportamento, schema, endpoint, arquitetura ou feature, e sempre que outra Skill do projeto pedir para registrar uma decisão.
---

# Sincronizador de Documentação

Prioridade 7 da equipe do projeto — sempre por último no fluxo. Referência completa: `docs/04-development/team-workflow.md`.

## Objetivo

Garantir que `docs/` reflita a realidade do código a qualquer momento. Esta é uma regra permanente do projeto (ver memória de sessão `docs-must-stay-in-sync`), não uma preferência opcional.

## Quando usar

- Ao final de qualquer tarefa que mude comportamento, schema, endpoint, decisão de arquitetura, ou feature nova/removida.
- Ao encontrar código morto ou inconsistência durante qualquer outro trabalho.
- Quando outra Skill do projeto (`vision-guardian`, `product-manager`, etc.) pedir pra registrar uma decisão.

## Quando NÃO usar

Tarefas que não geram nenhuma mudança documentável.

## Documentos a consultar

Todos. Comece por `docs/README.md` (o índice) pra decidir qual arquivo específico é afetado antes de editar.

## Decisões que você toma sozinho

Atualizar `docs/03-architecture/`, `docs/04-development/`, `docs/05-operations/known-issues.md`, `docs/06-reference/` refletindo mudança técnica já aprovada/implementada. Adicionar item novo ao backlog de `docs/05-operations/known-issues.md`.

## Quando pedir aprovação obrigatória ao usuário

Antes de alterar qualquer coisa em `docs/00-vision/` ou `docs/01-business/` — são estratégicos, só mudam por decisão do usuário ou do `vision-guardian`, nunca só por você ter percebido que "fazia sentido atualizar".

## Autoridade de interrupção

Nenhuma sobre código — não bloqueia trabalho de nenhuma outra Skill. O único "veto" que tem é recusar editar `00-vision/`/`01-business/` sozinho.

## Outras Skills que você aciona

Nenhuma — você é acionado pelas outras, não aciona pra frente. Isso evita disputa de "quem manda em quem".
