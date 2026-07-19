# Jornada do usuário — Pronto

> A jornada completa de cada persona, ponta a ponta, como o produto funciona hoje. Vocabulário definido em [`glossary.md`](./glossary.md).

## Trabalhador

1. **Cadastro de conta** — e-mail/senha ou Google. Se entrar via Google sem ter completado o perfil ainda, o app força a completar antes de liberar qualquer outra tela.
2. **Cadastro de perfil** — nome, CPF, telefone, endereço, data de nascimento, CNH (opcional), categorias de habilidade (com "já tem experiência?" por categoria), foto. Data de nascimento decide tudo: menor de 16 anos é bloqueado sem exceção; 16-17 anos exige dados e autorização de um responsável.
3. **Verificação (KYC)** — envio de documento de identidade + selfie (obrigatórios), CNH em PDF (se declarou categoria de CNH), documento do responsável (se menor). Enquanto o KYC não é `approved` por um admin, o app bloqueia visualmente a candidatura a vagas.
4. **Busca de vagas** — lista de vagas próximas, calculada por distância real (geolocalização), dentro do raio de busca que o próprio trabalhador define (5-100km). Essa é a única geolocalização que continua ativa no produto — não tem relação com check-in/check-out. Vagas mostram avisos (não bloqueios, exceto por idade/CNH) quando a categoria do trabalhador não bate exatamente com a exigida.
5. **Candidatura** — aceite de termos, e bloqueio automático se a vaga exigir CNH que o trabalhador não tem ou não permitir menores de idade e o trabalhador for menor.
6. **Aguardar aprovação** — a empresa vê a candidatura, junto com a nota média do trabalhador e quantas vezes ele já trabalhou com aquela empresa antes.
7. **Turno aprovado** — vira compromisso agendado, com o valor combinado já congelado.
8. **Check-in** — no dia do turno, o trabalhador confirma chegada pelo celular, sem precisar de GPS. Fica com status "em andamento", aguardando a empresa confirmar a chegada (isso pode acontecer antes ou depois do check-out — as duas confirmações são independentes).
9. **Check-out** — ao final do turno, confirma saída, também sem GPS. Status fica "aguardando confirmação da empresa".
10. **Confirmação da empresa** — quando a empresa confirma a saída, o turno vira "concluído" — é esse ato, não o check-out em si, que fecha o ciclo e dispara a cobrança.
11. **Pagamento** — hoje, combinado fora da plataforma. O app mostra quando a empresa marca como paga, e o trabalhador confirma se recebeu de verdade ou contesta.
12. **Avaliação** — trabalhador avalia a empresa (pontualidade do pagamento, clareza da vaga, respeito, comunicação, ambiente); vê a nota que a empresa deu pra ele assim que ambos avaliarem, ou depois de 7 dias.

## Empresa

1. **Cadastro de conta e perfil** — e-mail/senha ou Google, depois razão social/CNPJ (pessoa jurídica) ou nome/CPF (pessoa física). Pessoa física precisa enviar um documento de identidade; pessoa jurídica hoje não tem nenhum upload de comprovante no app.
2. **Verificação** — um admin aprova o cadastro. Enquanto pendente, o app avisa mas **não bloqueia** o formulário de publicar vaga — a empresa só descobre a recusa depois de tentar publicar de verdade.
3. **Publicar vaga** — categoria, exigências (experiência, CNH, permissão pra menores), benefícios (alimentação/transporte: sem oferta / no local / valor em dinheiro), endereço (com geolocalização pra calcular distância de candidatos), número de posições, valor, data/horário, prazo de candidatura. Pode reaproveitar uma vaga anterior como modelo, ou duplicar a semana inteira de uma vez.
4. **Gerenciar candidatos** — ver quem se candidatou, nota média, se já trabalhou com a empresa antes, avisos de incompatibilidade. Aprovar (cria o turno) ou rejeitar. Pode remover uma aprovação depois, enquanto o turno ainda não começou — isso reabre a vaga.
5. **Acompanhar a operação do dia** — pelo sino (candidaturas pendentes, check-ins/check-outs aguardando confirmação, avaliações pendentes) e pela tela "Ao vivo" (quem chegou, quem está atrasado, em tempo real, por vaga do dia).
6. **Confirmar chegada e saída** — na tela da vaga, botões dedicados "Confirmar chegada" / "Confirmar saída" (esse último com um aviso extra, porque é o que libera a cobrança).
7. **Marcar como pago** — depois que o turno é concluído, a empresa marca que já acertou o pagamento por fora; o trabalhador confirma do lado dele.
8. **Avaliar o trabalhador** — pontualidade, educação, proatividade, comunicação, qualidade. Pode optar por não avaliar ("agora não"), sem isso bloquear avaliar depois.
9. **Histórico de trabalhadores** — tela dedicada agregando todo trabalhador que já passou por qualquer vaga da empresa, com taxa de comparecimento e quantas vezes voltou a trabalhar.

## Admin

1. **Login próprio** — só quem tem permissão de administrador no banco consegue entrar; não existe cadastro self-service.
2. **Visão geral** — métricas agregadas (empresas, trabalhadores, turnos concluídos, valor processado), gráficos de crescimento semanal, lista de pagamentos que falharam (sem retry automático — resolução é manual).
3. **Verificações pendentes** — aprova ou rejeita documentos de KYC de trabalhador (com atenção especial a menores de idade, mostrando os dados do responsável), verificação de empresa, e categorias de habilidade criadas sob demanda pelos usuários (pode corrigir o nome antes de aprovar).
4. **Empresas e trabalhadores** — listas com busca e métricas (quem mais contrata, quem mais trabalha), com atalho pra resetar a senha de qualquer usuário.
5. **Manutenção** — remover dados de demonstração de uma vez (usado pra manter o ambiente limpo pra testes/demos).
