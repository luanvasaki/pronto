# Conhecimento tribal — Pronto

> Corridas resolvidas, bugs históricos corrigidos e documentados no próprio código, e decisões não óbvias que não se encaixam em nenhum outro documento. Isso existe pra ninguém precisar redescobrir o mesmo problema duas vezes.

## Bugs históricos corrigidos (e por que a correção é do jeito que é)

**Bypass de autorização de responsável pra menor de idade.** A exigência de dados do responsável (nome, CPF, telefone, autorização) rodava só quando o perfil ainda não existia (`!existingProfile`). Isso permitia cadastrar primeiro com uma data de nascimento de maior de idade, e depois corrigir pra uma data de menor sem nunca passar pela exigência de responsável. Corrigido pra checar sempre `isMinor && !existingProfile?.guardianAuthorizedAt`, não só na criação.

**Cookie de sessão "entrava e saía".** Histórico de bug de login instável, documentado em comentário junto da configuração de `sameSite` do cookie de sessão (`lax` em dev, `none` em produção, porque front e back rodam em domínios diferentes). Qualquer mudança futura na configuração de cookie de auth deveria reler esse comentário antes de mexer.

## Corridas conhecidas e como cada uma foi resolvida

Além do padrão geral de UPDATE condicional ([`03-architecture/backend-architecture.md`](../03-architecture/backend-architecture.md)), alguns casos específicos têm tratamento próprio documentado:

- **Login com Google, duas chamadas simultâneas pra conta nova**: tratado tanto o caso de duas tentativas de criar a mesma conta (corrida na constraint única) quanto o caso de vincular um `googleId` a uma conta já existente pelo mesmo e-mail.
- **Refresh token**: reuso de um token já revogado **revoga todas as sessões do usuário** — é tratado como sinal de token roubado, não como corrida comum.
- **Liberar pagamento (`release-payment`)**: o UPDATE condicional acontece **antes** da chamada ao gateway externo, de propósito — se fosse ao contrário, duas chamadas simultâneas passariam as duas pela checagem de status e liberariam em dobro no gateway. Hoje é inofensivo porque o gateway é mock, mas seria dinheiro real duplicado com um PSP de verdade — vale relembrar isso quando o pagamento real for implementado.

## Mitigação de enumeração de conta

Login por senha usa um **hash dummy pré-computado** quando o e-mail não existe, especificamente pra gastar o mesmo tempo de resposta que gastaria validando uma senha errada de verdade — evita que alguém descubra quais e-mails têm conta só medindo tempo de resposta. Esqueci-minha-senha e reset sempre respondem a mesma mensagem de sucesso, exista ou não o e-mail, pelo mesmo motivo.

## Fechamento de vaga é sempre por `getTime()`, nunca comparação de data direta

O cálculo de "prazo de candidatura já fechou" compara timestamps em milissegundos (epoch), nunca objetos de data comparados diretamente — de propósito, pra ser imune a fuso horário do servidor ou do banco divergir do esperado.

## Vagas somem da listagem sozinhas, sem job/cron

Vaga cheia, prazo vencido, empresa não verificada — tudo isso é calculado **na hora da consulta**, nunca um processo em background marcando status. O mesmo vale pra atraso/chegada na tela "Ao vivo" da operação do dia. Isso é uma escolha consciente de simplicidade: sem cron, sem risco de estado desatualizado por um job que não rodou.
