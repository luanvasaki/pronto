# Inventário de funcionalidades — Pronto

> O que existe, hoje, por app. Descrição funcional (o que faz), não técnica — detalhe de rota/endpoint fica em [`06-reference/`](../06-reference/). Jornada completa em [`user-journey.md`](./user-journey.md).

## App do trabalhador

- Cadastro por e-mail/senha ou Google, com fluxo de recuperação de senha.
- Cadastro de perfil: dados pessoais, endereço, categorias de habilidade (com nível de experiência declarado), CNH opcional, tratamento completo de menor de idade (16-17 anos, com responsável).
- Verificação de identidade (KYC): documento, selfie, CNH, documento do responsável.
- Busca de vagas por proximidade, com raio de busca ajustável e localização atualizável.
- Detalhe de vaga: descrição, benefícios, exigências, avisos de compatibilidade, perguntas e respostas públicas, avisos da empresa.
- Candidatura a vaga, com aceite de termos.
- Lista de candidaturas (pendente/aprovada/rejeitada/retirada), com opção de desistir enquanto pendente.
- Agenda: calendário mensal de turnos, com linha do tempo de cada turno (agendado → check-in → check-out → concluído).
- Check-in e check-out sem geolocalização.
- Acompanhamento de pagamento combinado: ver quando a empresa marcou como pago, confirmar recebimento ou contestar.
- Avaliação da empresa por turno concluído, com histórico de notas recebidas no perfil.
- Resumo de ganhos (agregado local, a partir dos turnos, sem endpoint financeiro dedicado).
- Push notifications (real, via navegador/PWA).
- Instalação como app (PWA) — sem funcionamento offline real, só o atalho de instalação.

## App da empresa

- Cadastro por e-mail/senha ou Google.
- Cadastro de perfil de empresa: pessoa jurídica (CNPJ) ou física (CPF) — os dois exigem upload de documento de verificação (cartão CNPJ/contrato social, ou RG/CNH).
- Painel com métricas do momento: cobertura das próximas 48h, vagas com posição em aberto, central de ações.
- Calendário de vagas: visão mensal, semanal e "Ao vivo".
- Publicar vaga: todos os campos de exigência/benefício, com opção de usar uma vaga anterior como modelo.
- Duplicar semana inteira de vagas de uma vez (sem candidatos, do zero).
- Editar ou cancelar vaga (enquanto ainda aberta / sem turno em andamento).
- Gerenciar candidatos: aprovar, rejeitar, remover aprovação, ver histórico de "já trabalhou X vezes" e nota média.
- Quadro de perguntas e respostas, e avisos, por vaga — visíveis a todo candidato.
- Confirmar chegada e saída de cada turno.
- Marcar turno como pago (acerto combinado por fora).
- Avaliar o trabalhador, com opção de pular a avaliação.
- Histórico agregado de todo trabalhador já contratado, com taxa de comparecimento.
- Sino de notificações: candidaturas pendentes, check-ins/check-outs não confirmados, avaliações pendentes.
- Push notifications e PWA instalável, mesmo padrão do app trabalhador.

## App admin

- Login próprio, restrito a usuários com permissão de administrador.
- Métricas agregadas: pagamentos por status, trabalhadores (total/verificados/ativos), empresas (total/vagas publicadas), turnos (concluídos/cancelados).
- Gráficos de crescimento semanal (empresas, trabalhadores, turnos concluídos), últimas 8 semanas.
- Lista de pagamentos com falha, pra ação manual.
- Aprovação/rejeição de: documentos de KYC de trabalhador (com preview do arquivo), verificação de empresa, categorias de habilidade criadas sob demanda.
- Listagem de empresas e trabalhadores, com busca e ordenação por volume/recência.
- Reset de senha de qualquer usuário.
- Remoção em lote de dados marcados como demonstração.

## Capacidades de backend que sustentam os três apps

- Autenticação por sessão (cookies + refresh token), com login por senha e por Google, recuperação de senha, e detecção de reuso de token roubado.
- Rate limiting em camadas (geral, escrita, autenticação, login por conta).
- Push notifications reais (VAPID/web-push).
- Armazenamento de arquivo com dois níveis de privacidade (documentos de KYC privados, foto de perfil pública).
- Geocodificação reversa (endereço a partir de coordenadas) para exibição, sem depender disso pra cálculo de distância.

## O que explicitamente não existe ainda

Ver [`01-business/roadmap.md`](../01-business/roadmap.md) para o detalhe de cada um: cobrança real de qualquer taxa, pagamento processado pela plataforma, registro real de falta (`no_show`), fluxo de resolução de disputa de pagamento, opção do trabalhador ignorar uma avaliação, upload de documento de verificação para empresa pessoa jurídica.
