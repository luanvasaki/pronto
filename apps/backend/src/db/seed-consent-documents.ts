import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { closeDb, db } from './client';
import { consentDocuments, ConsentDocumentChapter } from './schema';

/**
 * Popula a v1.1 dos 3 documentos de consentimento (texto revisado pelo
 * jurídico, convertido dos .docx originais). Roda uma vez por versão nova
 * — nunca via migration (texto jurídico não é schema), via
 * `npx tsx src/db/seed-consent-documents.ts`. Idempotente: pula qualquer
 * (type, version) que já exista.
 *
 * ATENÇÃO: o capítulo 12 do platform_terms ainda tem "[A PREENCHER]" nos
 * dados institucionais (razão social/CNPJ da entidade, endereços, canais
 * de suporte/privacidade/denúncia) — o jurídico deixou esses campos em
 * aberto no documento original, pendentes de definição antes de uma
 * versão realmente ir pra produção.
 */

const PLATFORM_TERMS_VERSION = '1.1';

const platformTermsChapters: ConsentDocumentChapter[] = [
  {
    number: '0',
    heading: 'Resumo essencial e como o aceite é registrado',
    body: `Este resumo apresenta os pontos centrais, mas não substitui a leitura dos capítulos aplicáveis. Ao criar conta, acessar ou utilizar a Pronto, o usuário deverá aceitar eletronicamente este documento e as políticas complementares indicadas na plataforma.

Em linguagem direta: a Pronto é uma plataforma tecnológica de intermediação que aproxima contratantes e profissionais. A contratação e a prestação do serviço ocorrem diretamente entre os usuários; a Pronto não é empregadora, tomadora automática ou executora dos serviços anunciados. Na versão Beta, a Pronto não recebe, guarda, divide ou repassa valores e não garante pagamento, contratação, renda, comparecimento ou resultado. Cada usuário responde pelas informações que fornece, pelas condições que aceita e pelos atos que pratica. A realidade dos fatos prevalece: este Termo não pode ocultar vínculo empregatício ou outra relação jurídica que efetivamente exista entre contratante e profissional. Oportunidades abertas a adolescentes de 16 ou 17 anos seguem fluxo especial; autorização dos responsáveis não torna permitida atividade proibida por lei. Fraude, assédio, discriminação, violência, exploração, conteúdo ilícito e manipulação de registros podem gerar remoção, suspensão, bloqueio e comunicação às autoridades. Dados pessoais são tratados conforme a LGPD, as políticas de privacidade e retenção e, no caso de adolescentes, com prevalência do melhor interesse.

Como o aceite será registrado: a aceitação poderá ocorrer por botão, caixa de seleção ou mecanismo eletrônico equivalente. A plataforma poderá registrar o usuário, a data, o horário, a versão, o tópico aceito, o endereço de IP ou outro registro técnico disponível e eventuais atualizações posteriores. O aceite eletrônico não elimina o dever de apresentar informações claras nem afasta direitos obrigatórios previstos na legislação.`,
  },
  {
    number: '1',
    heading: 'Apresentação, aceitação, versão Beta e definições',
    body: `Finalidade e documentos aplicáveis: estes Termos regulam o cadastro, o acesso e a utilização do aplicativo, site, painéis, bancos de dados, ferramentas e demais serviços tecnológicos da Pronto. Integram este documento, conforme disponibilizados, as políticas de Privacidade, Cookies, Empresas, Freelancers, Menores, Antifraude, Avaliações, Denúncias, Segurança da Informação, Conteúdo, Responsabilidade Civil e Retenção e Exclusão de Dados. Em caso de regra específica, a política correspondente será aplicada ao assunto que regulamenta, desde que seja compatível com este Termo e com a legislação. Nenhuma cláusula será interpretada como renúncia a direito obrigatório, exclusão de responsabilidade inderrogável ou autorização para prática ilegal.

Aceitação, capacidade e representação: o cadastro e o uso de funções obrigatórias dependem de aceite válido. Ao aceitar, o usuário declara que possui capacidade jurídica para assumir as obrigações aplicáveis, fornece informações verdadeiras, não utiliza identidade de terceiro e, quando atua por empresa, possui poderes de representação. Usuários de 16 ou 17 anos dependem do fluxo especial e da participação do responsável legal, sem prejuízo das restrições legais de trabalho. A Pronto poderá apresentar o conteúdo em capítulos ou telas separadas e impedir o prosseguimento enquanto os aceites obrigatórios não forem concluídos. Mudanças substanciais poderão exigir novo aceite.

Versão Beta: a plataforma poderá operar em versão Beta para aperfeiçoamento de funções, fluxos, integrações e recursos. Ferramentas poderão ser testadas, ajustadas, limitadas, substituídas ou temporariamente desativadas. A condição de Beta não exclui a responsabilidade da Pronto por atos ou falhas que lhe sejam legalmente atribuíveis nem reduz direitos obrigatórios dos usuários.

Definições essenciais: Plataforma — os ambientes digitais, sistemas e ferramentas disponibilizados pela Pronto. Usuário — qualquer pessoa física ou jurídica cadastrada ou que utilize a plataforma. Contratante — empresa ou pessoa física aprovada para publicar oportunidades e selecionar profissionais. Profissional ou freelancer — pessoa física que visualiza oportunidades, candidata-se e presta serviços diretamente ao contratante. Profissional adolescente — usuário de 16 ou 17 anos admitido apenas no fluxo especial e nas atividades legalmente permitidas. Oportunidade ou turno — publicação que informa atividade, data, horário, local, quantidade, valor, requisitos e demais condições. Confirmação — registro de que contratante e profissional decidiram prosseguir diretamente com determinada oportunidade. Conteúdo — textos, imagens, documentos, avaliações, mensagens, certificados e demais informações inseridas pelos usuários. Cadastro aprovado — autorização para usar determinadas funções após análise mínima; não equivale a recomendação, certificação ou garantia. Perfil verificado — perfil submetido a procedimento adicional informado pela Pronto; não constitui garantia absoluta de conduta, capacidade ou idoneidade futura.`,
  },
  {
    number: '2',
    heading: 'Cadastro, conta, verificação e segurança',
    body: `Quem pode utilizar: poderão utilizar a Pronto, conforme aprovação e funções disponíveis, empresas regularmente representadas, pessoas físicas contratantes autorizadas, profissionais maiores de 18 anos e profissionais de 16 ou 17 anos admitidos no fluxo especial. Menores de 16 anos não podem utilizar o cadastro comum de freelancer; eventual aprendizagem profissional segue regime próprio e não se confunde com oportunidades comuns da plataforma. O cadastro poderá ser recusado, limitado ou submetido a verificação adicional quando faltarem dados mínimos, houver indício razoável de fraude, uso de documento ou identidade de terceiro, atividade ilegal, tentativa de contornar bloqueio, ausência de capacidade ou representação, ou risco relevante à segurança. A recusa não poderá se basear em discriminação ilegal e, quando possível sem comprometer segurança, investigação ou direitos de terceiros, a Pronto poderá informar a razão geral.

Dados verdadeiros e uso pessoal da conta: o usuário deve fornecer dados verdadeiros, completos, atuais e compatíveis com sua identidade ou representação. É proibido criar conta em nome de terceiro, compartilhar credenciais, vender ou transferir cadastro, apresentar documento adulterado, omitir informação relevante, inventar experiência ou qualificação ou criar contas múltiplas para manipular avaliações, candidaturas, medidas disciplinares ou bloqueios. A Pronto poderá solicitar dados razoavelmente necessários para identificar o usuário, validar idade, confirmar representação empresarial, prevenir fraude, operar a plataforma, proteger pessoas, cumprir obrigações legais e permitir o exercício de direitos. Informações vencidas, incompletas ou inconsistentes poderão gerar limitação temporária até regularização.

Aprovação e verificação: cadastro aprovado significa apenas que os dados mínimos foram analisados e que determinadas funções foram liberadas. Perfil verificado indica a conclusão de procedimento adicional cujo alcance deverá ser informado. Nenhuma dessas indicações representa investigação completa de antecedentes, certificação profissional, recomendação, garantia de pagamento, qualidade ou comportamento futuro, nem transfere à Pronto responsabilidade pelos atos do usuário.

Segurança da conta: o usuário deve criar senha segura, proteger seus dispositivos, não compartilhar códigos, desconfiar de comunicações suspeitas, manter meios de recuperação atualizados e comunicar imediatamente acesso não autorizado. A Pronto não solicitará senha completa por mensagem informal. O usuário responde por uso decorrente de compartilhamento voluntário de credenciais, sem prejuízo da análise de fraude ou falha de segurança atribuível à própria plataforma.`,
  },
  {
    number: '3',
    heading: 'Natureza da intermediação, contratação direta e ausência de garantias',
    body: `Atuação da Pronto: a Pronto é uma plataforma tecnológica de intermediação. Disponibiliza recursos para cadastro, publicação e visualização de oportunidades, candidaturas, seleção, confirmação, comunicação, registros pontuais de presença, avaliações, denúncias, histórico e reputação. A contratação e a execução do serviço ocorrem diretamente entre contratante e profissional. Como regra geral, a Pronto não fornece mão de obra própria, não administra equipes do contratante, não obriga profissionais a aceitar oportunidades, não estabelece exclusividade, não define salário ou benefícios, não controla jornada, não dirige presencialmente a execução, não fornece equipamentos de proteção, não determina método técnico e não se torna automaticamente contratante, empregadora, tomadora ou prestadora do serviço publicado.

Realidade da relação: a utilização da plataforma não altera a natureza jurídica da relação efetivamente formada entre contratante e profissional. A realidade dos fatos, a forma de exigência e execução do trabalho e a legislação aplicável prevalecem sobre nomes, declarações ou classificações. Se estiverem presentes requisitos de vínculo empregatício, aprendizagem, estágio, trabalho temporário ou outra modalidade legal obrigatória, o contratante deverá cumprir as obrigações correspondentes, sem prejuízo das responsabilidades próprias do profissional e da Pronto por seus atos.

Ausência de garantia: a Pronto não garante que uma publicação receberá candidatos, que um candidato será escolhido, que haverá contratação, renda, continuidade, comparecimento, pagamento, qualidade, resultado ou ausência de conflitos. Também não garante a veracidade absoluta de todas as declarações, documentos, avaliações ou condições informadas pelos usuários. Cada parte deve realizar sua própria análise, solicitar informações necessárias, verificar qualificações e agir com prudência. Ferramentas de organização, verificação, check-in, geolocalização pontual, histórico, mensagens e aplicação de regras não significam, isoladamente, subordinação trabalhista, direção do serviço ou fiscalização presencial pela Pronto.`,
  },
  {
    number: '4',
    heading: 'Oportunidades, candidaturas, comunicação e registros de presença',
    body: `Publicação das oportunidades: o contratante deverá informar de forma clara e atualizada a atividade, data, horário previsto, local, quantidade de vagas, valor, tarefas, requisitos, condições relevantes do ambiente, materiais ou equipamentos, benefícios eventualmente oferecidos e riscos específicos conhecidos. É responsável pela legalidade, exatidão e cumprimento das condições publicadas. Não poderão ser publicadas oportunidades ilegais, fraudulentas, discriminatórias, exploratórias, perigosas sem proteção adequada, diferentes da atividade anunciada, que exijam pagamento antecipado irregular do candidato, envolvam exploração sexual, tráfico de pessoas, trabalho análogo ao escravo, trabalho infantil proibido, violação de direitos de terceiros ou conteúdo incompatível com as políticas. Atividades regulamentadas somente poderão ser oferecidas com indicação das licenças, registros, formações ou habilitações exigidas. Condições essenciais — especialmente valor, função, local, data e horário — não poderão ser alteradas unilateralmente após a confirmação; mudanças dependem de ciência e concordância registrada da outra parte.

Candidatura, seleção e confirmação: o profissional é livre para escolher categorias, candidatar-se ou não, retirar candidatura antes da confirmação quando permitido, recusar oportunidades, usar outras plataformas, atender outros contratantes e organizar sua disponibilidade. Não existe obrigação de aceitar quantidade mínima de oportunidades. O contratante poderá selecionar candidatos por critérios lícitos, objetivos e não discriminatórios. A candidatura não garante seleção. A confirmação registra as condições aceitas diretamente entre os usuários. A seleção ou confirmação não garante execução sem cancelamento, imprevisto ou descumprimento.

Comunicação e registros oficiais: negociações, confirmações, alterações, valores, endereços, cancelamentos, justificativas e divergências relevantes devem ser realizadas ou registradas nas ferramentas oficiais sempre que disponíveis. É proibido usar dados obtidos na Pronto para golpes, assédio, publicidade não solicitada, extração de contatos, divulgação indevida, manipulação de avaliações ou evasão deliberada de registros e regras legitimamente informadas.

Check-in, check-out e geolocalização: quando disponíveis, servem para registrar chegada e saída. A geolocalização será pontual, aproximada e acionada pelo próprio usuário no momento do registro, sem rastreamento contínuo durante todo o serviço. Esses registros são elementos de organização e análise, não constituem prova absoluta, não confirmam qualidade, não substituem documentos legais e não determinam isoladamente a natureza da relação entre os usuários. É proibido falsificar localização, horário, dispositivo, presença ou qualquer registro.`,
  },
  {
    number: '5',
    heading: 'Responsabilidades dos contratantes e dos profissionais',
    body: `Responsabilidades do contratante: publicar informações verdadeiras, selecionar profissionais, cumprir as condições oferecidas, manter ambiente adequado, informar riscos, fornecer materiais e equipamentos prometidos, fornecer equipamentos de proteção quando obrigatórios, prestar orientações necessárias, respeitar a dignidade, impedir assédio, discriminação e violência, realizar o pagamento e observar normas de saúde, segurança, higiene, horário, licenças e atividades regulamentadas. Também deverá cumprir obrigações civis, trabalhistas, tributárias, previdenciárias, fiscais, documentais ou de proteção de adolescentes que decorram da relação efetivamente formada; responder por seus representantes, gestores, empregados e pessoas que atuem no local; e não transferir ao profissional obrigação que a lei atribua ao próprio contratante. A existência da Pronto não reduz essas responsabilidades.

Responsabilidades do profissional: fornecer informações verdadeiras, candidatar-se apenas a atividades que possa executar, informar limitações relevantes, possuir licenças ou habilitações exigidas, comparecer conforme confirmado, comunicar cancelamentos, agir com diligência, respeito e boa-fé, seguir regras legítimas de segurança, utilizar corretamente equipamentos fornecidos, preservar bens, dados e informações do contratante e cumprir as obrigações legais que lhe sejam atribuídas. É proibido comparecer em condição que comprometa a segurança, enviar substituto sem concordância, praticar fraude, subtrair bens, dados ou valores ou executar atividade ilegal. O profissional poderá recusar ou interromper atividade substancialmente diferente da publicada, proibida ou que apresente risco grave, preservando sua segurança e registrando o ocorrido quando possível.

Não discriminação e respeito: é proibida discriminação ilegal na publicação, candidatura, seleção, execução, avaliação ou encerramento da relação. Requisitos vinculados à atividade somente serão admitidos quando lícitos, necessários, proporcionais e claramente informados. Assédio, ameaça, violência, humilhação, retaliação e tratamento degradante são incompatíveis com a plataforma.`,
  },
  {
    number: '6',
    heading: 'Valores, pagamentos, benefícios, cancelamentos e ausências',
    body: `Pagamentos na versão Beta: durante a versão Beta, o pagamento do serviço ocorre diretamente entre contratante e profissional, fora da plataforma. A Pronto não recebe valores em nome dos usuários, não mantém custódia, não divide pagamentos, não realiza repasses, não concede crédito, não fiscaliza cada pagamento e não substitui comprovantes, notas fiscais ou documentos exigidos pela legislação. O valor e os benefícios eventualmente oferecidos devem ser informados antes da confirmação e ajustados diretamente entre as partes. O valor não poderá ser reduzido unilateralmente após a execução. Cada parte deverá cumprir obrigações fiscais, tributárias, previdenciárias, trabalhistas e documentais que a lei lhe atribuir.

Monetização futura: a Pronto poderá futuramente oferecer planos, taxas, comissões, recursos premium ou serviços adicionais. Qualquer cobrança deverá ser previamente informada, indicar valor ou critério de cálculo, responsável pelo pagamento e serviço correspondente, ser proporcional e não abusiva e respeitar direitos já constituídos. Mudança substancial poderá exigir novo aceite e não será aplicada retroativamente a serviços realizados sob condições anteriores.

Cancelamentos, desistências e no-show: quem não puder cumprir oportunidade confirmada deverá comunicar imediatamente pela plataforma e, quando possível, justificar. Poderão ser consideradas situações como emergência médica, acidente, risco à integridade, descumprimento relevante pela outra parte, mudança não aceita de condição essencial, força maior ou falha comprovada da plataforma. A justificativa será analisada e não implica aceitação automática. A ausência sem comunicação ou a indisponibilidade injustificada da oportunidade poderá ser registrada como no-show. Ocorrências confirmadas poderão gerar medidas progressivas: primeira ocorrência, advertência; segunda ocorrência, suspensão de 7 dias; terceira ocorrência, suspensão de 14 dias; quarta ocorrência, suspensão de 28 dias; quinta ocorrência, bloqueio permanente. A progressão poderá ser afastada em infrações graves, como fraude, violência, ameaça, exploração, documento falso, discriminação, risco à segurança, atividade criminosa ou manipulação do sistema. Salvo necessidade preventiva urgente, o usuário poderá apresentar explicação ou contestação antes da medida definitiva. Penalidades da plataforma não substituem pagamento, indenização ou demais responsabilidades entre as partes.`,
  },
  {
    number: '7',
    heading: 'Profissionais de 16 ou 17 anos e proteção integral',
    body: `Regime especial e limites de idade: profissionais de 16 ou 17 anos somente poderão usar a plataforma no fluxo especial, mediante confirmação de idade, identificação e participação do responsável legal, aceite das regras específicas, verificação documental quando exigida, aprovação da Pronto e observância integral da legislação. Menores de 16 anos não podem utilizar o cadastro comum de freelancer.

Atividades proibidas: pessoas com menos de 18 anos não poderão realizar trabalho noturno (entre 22h e 5h), perigoso, insalubre, penoso, excessivo ou incluído na Lista das Piores Formas de Trabalho Infantil; atividades que prejudiquem escola, formação ou desenvolvimento; atividades em ambientes incompatíveis; ou trabalhos envolvendo exploração, conteúdo sexual, bebidas alcoólicas, violência, armas, drogas ilícitas, segurança armada, condução sem habilitação ou outras proibições legais. A autorização dos pais ou responsáveis não torna permitida atividade proibida. Diante de dúvida sobre legalidade, risco, horário, ambiente ou compatibilidade com a idade, a oportunidade não deverá ser oferecida, aceita ou mantida até esclarecimento adequado.

Deveres do contratante: ao abrir oportunidade a adolescentes, o contratante deve verificar a compatibilidade legal da atividade, fornecer informações completas, conferir idade, documentos e autorizações exigidas, respeitar horário e frequência escolar, manter ambiente protegido, impedir mudança para tarefa proibida, fornecer acompanhamento adequado, permitir contato com o responsável e interromper imediatamente a atividade diante de risco.

Deveres do responsável e do adolescente: o responsável legal deverá analisar cada oportunidade, verificar atividade, local, horário, ambiente e condições, orientar o adolescente, acompanhar restrições e comunicar riscos ou violações. O adolescente deverá fornecer dados verdadeiros, informar alterações da atividade, relatar assédio, discriminação, violência ou risco, interromper a atividade quando houver perigo grave e utilizar a plataforma de boa-fé.

Limites e medidas da Pronto: a Pronto poderá aplicar filtros, alertas, verificações, restrições, remoções e suspensões, mas não realiza fiscalização presencial do local, da jornada, da atividade efetivamente executada ou das condições reais. Permitir candidaturas de adolescentes não representa autorização jurídica, certificação de conformidade ou substituição do contratante, do responsável legal ou das autoridades. Dados de adolescentes serão tratados com necessidade, segurança, transparência e prevalência do melhor interesse.`,
  },
  {
    number: '8',
    heading: 'Boa-fé, condutas proibidas, avaliações, denúncias e moderação',
    body: `Boa-fé e condutas proibidas: todos devem agir com honestidade, cooperação, respeito e finalidade legítima. É proibido praticar fraude, golpe, identidade falsa, falsificação documental, simulação de oportunidade ou serviço, lavagem de dinheiro, exploração, tráfico de pessoas, trabalho análogo ao escravo, assédio, ameaça, violência, discriminação, invasão de sistemas, teste não autorizado de vulnerabilidades, robôs não autorizados, extração massiva de dados, falsificação de presença ou localização, comercialização de contas, divulgação indevida de dados, código malicioso ou tentativa de contornar bloqueios e controles.

Avaliações e reputação: avaliações bilaterais devem refletir experiência real, estar vinculadas à oportunidade, ser honestas, respeitosas e evitar dados pessoais desnecessários. É proibido criar, comprar ou combinar avaliações, pressionar por nota, usar avaliação como chantagem ou retaliação, avaliar pessoa que não participou ou manipular reputação. O usuário poderá contestar avaliação falsa, ofensiva, discriminatória, desconectada da experiência, violadora de privacidade ou contrária às regras. Avaliações são opiniões e registros de usuários, não garantia de verdade absoluta nem recomendação automática da Pronto.

Denúncias, medidas e defesa: podem ser denunciados fraude, documento falso, ameaça, assédio, discriminação, violência, exploração, atividade ilegal ou proibida, risco à segurança, ausência, falta de pagamento, conteúdo ilícito, avaliação falsa, uso indevido de dados e outras violações. Conforme gravidade, risco e evidências, a Pronto poderá orientar, advertir, remover conteúdo, cancelar publicação, limitar funções, impedir candidaturas, suspender, bloquear preventivamente ou permanentemente, preservar registros e cooperar com autoridades. Salvo impedimento legal, urgência ou risco à investigação, o usuário poderá apresentar sua versão, documentos e pedido de revisão. A Pronto não substitui polícia, Ministério Público, Judiciário, fiscalização do trabalho ou outras autoridades.`,
  },
  {
    number: '9',
    heading: 'Privacidade, LGPD, cookies, segurança e retenção de dados',
    body: `Tratamento de dados pessoais: será detalhado na Política de Privacidade e observará a legislação aplicável. A Pronto poderá tratar dados para criar e administrar contas, identificar e verificar usuários, permitir oportunidades, candidaturas e confirmações, viabilizar comunicação, registrar presença pontual, prevenir fraude, manter segurança, produzir histórico e reputação, analisar denúncias, prestar suporte, cumprir obrigações legais e exercer direitos em processos. O usuário poderá exercer os direitos previstos na LGPD pelo canal de privacidade informado.

Crianças e adolescentes: dados de adolescentes serão tratados com prevalência do melhor interesse, minimização, transparência adequada, controles de idade e participação do responsável quando exigida.

Cookies, geolocalização e comunicações: cookies e tecnologias semelhantes serão descritos em política própria. Geolocalização, quando utilizada, será pontual e vinculada ao check-in ou check-out, não ao rastreamento contínuo. Comunicações operacionais, jurídicas e de segurança poderão ser enviadas por aplicativo, painel, e-mail, telefone, mensagem eletrônica ou site oficial.

Segurança, incidentes e retenção: a Pronto deverá adotar medidas técnicas e administrativas razoáveis para proteger dados. O encerramento da conta não implica eliminação imediata de todos os registros — dados poderão ser mantidos pelo tempo necessário para obrigação legal, prevenção de fraude, exercício regular de direitos, proteção de usuários, cumprimento de ordem, preservação de provas, segurança e finalidades previstas na Política de Retenção. Encerradas as finalidades, os dados serão eliminados, anonimizados ou conservados nas hipóteses legais.`,
  },
  {
    number: '10',
    heading: 'Conteúdo dos usuários e propriedade intelectual',
    body: `Conteúdo dos usuários: o usuário é responsável pelo conteúdo que publica e somente poderá inserir material próprio ou autorizado, verdadeiro quando apresentado como fato e compatível com a lei e as regras. É proibido conteúdo criminoso, fraudulento, discriminatório, ameaçador, sexual, exploratório, invasivo de privacidade, que exponha documentos sem necessidade, infrinja direitos autorais ou marcas, divulgue dados sem fundamento, contenha código malicioso, promova golpe ou imite comunicação oficial da Pronto. O usuário mantém a titularidade de seus direitos, mas concede à Pronto licença não exclusiva, limitada, gratuita e pelo prazo necessário para operar a plataforma, apresentar perfis e oportunidades, permitir comunicação, manter registros, moderar, prevenir fraude e cumprir obrigações legais.

Ativos da Pronto: marca, nome, logotipo, identidade visual, código-fonte, sistemas, telas, bancos de dados, estrutura, textos institucionais, fluxos, funcionalidades, documentação, desenhos e elementos gráficos pertencem à Pronto ou a seus licenciadores. O uso da plataforma concede apenas autorização pessoal, limitada, revogável, não exclusiva e intransferível para utilização regular. É proibido copiar, reproduzir interfaces, realizar engenharia reversa, tentar obter código-fonte, extrair dados automaticamente, remover avisos de propriedade, comercializar acesso, explorar vulnerabilidades, interferir no funcionamento, utilizar a marca sem autorização ou criar produto derivado por cópia indevida.`,
  },
  {
    number: '11',
    heading: 'Disponibilidade, suspensão, encerramento, autoridades e atualizações',
    body: `Disponibilidade e falhas: a Pronto buscará manter a plataforma disponível e segura, mas poderão ocorrer manutenções, atualizações, falhas de Internet ou fornecedores, problemas de dispositivo, interrupção de energia, ataques cibernéticos, caso fortuito, força maior, ordem de autoridade ou eventos fora do controle razoável. A Pronto não responde por problemas causados exclusivamente pelo dispositivo ou conexão do usuário, aplicativo não oficial, compartilhamento voluntário de credenciais, fraude do próprio usuário ou descumprimento deliberado de orientação de segurança.

Suspensão, bloqueio e encerramento: o usuário poderá solicitar encerramento da conta, devendo antes tratar oportunidades confirmadas, pagamentos e obrigações assumidas. A Pronto poderá limitar, suspender ou bloquear contas por fraude, reincidência, documento falso, manipulação, atividade ilegal, assédio, discriminação, violência, violação de dados, risco, descumprimento de ordem, exploração de menor, tentativa de evasão ou violação grave ou repetida. Usuário bloqueado permanentemente não poderá criar conta para contornar a decisão. Suspensão ou encerramento não eliminam dívidas, pagamentos, responsabilidade por danos, obrigações legais, investigações, denúncias ou direitos anteriores.

Autoridades e preservação de registros: diante de solicitação legalmente válida, a Pronto poderá preservar e fornecer informações nos limites legais, retirar conteúdo, restringir contas, impedir atividade, comunicar fato relevante e cumprir ordem judicial ou administrativa competente.

Atualizações e comunicações oficiais: correções sem impacto substancial poderão ser realizadas sem novo aceite. Alterações relevantes em direitos, obrigações, cobranças, responsabilidades ou funcionamento jurídico serão destacadas, comunicadas previamente quando exigido e poderão depender de novo aceite. Não haverá retroatividade prejudicial para fatos anteriores. Se o usuário não concordar com alteração que exija novo aceite, poderá deixar de usar a plataforma e solicitar encerramento, sem prejuízo de obrigações anteriores.`,
  },
  {
    number: '12',
    heading: 'Responsabilidade civil, proteção institucional, conflitos e disposições finais',
    body: `Responsabilidade de cada parte: cada usuário responde pelos danos que causar por ação, omissão, fraude, ilegalidade ou descumprimento de obrigação própria. A Pronto responde pelos danos diretamente decorrentes de atos ou falhas que lhe sejam legalmente atribuíveis. Nenhuma cláusula cria imunidade absoluta, impede reparação legal ou afasta responsabilidade que a lei não permita excluir.

Fundadores, sócios, administradores e desenvolvedores: não assumem, apenas por essa condição, obrigações pessoais dos usuários nem se tornam contratantes ou empregadores dos profissionais, ressalvadas as hipóteses legais de ato próprio, abuso, fraude, violação de dever ou desconsideração da personalidade jurídica.

Solução de conflitos e legislação: os usuários poderão utilizar suporte para esclarecer registros, denunciar, contestar avaliação ou penalidade e tentar restabelecer comunicação. O suporte não é condição obrigatória para acesso ao Poder Judiciário. Não há arbitragem obrigatória. Este documento é regido pela legislação brasileira. Eventual demanda será apresentada ao foro legalmente competente, observando o domicílio do consumidor quando aplicável.

Disposições finais: se uma cláusula for considerada inválida, as demais permanecerão aplicáveis quando puderem funcionar de forma independente. Este Termo não cria sociedade, associação, franquia, mandato, representação comercial, vínculo empregatício ou exclusividade entre a Pronto e os usuários, nem define automaticamente a relação entre contratante e profissional. A aplicação deste documento deverá ser compatível, entre outras normas aplicáveis, com a Constituição Federal, o Código Civil, o Código de Defesa do Consumidor quando incidente, o Marco Civil da Internet, a LGPD, o ECA, a CLT, as regras de proteção ao trabalho de adolescentes e a Lista TIP.

Evidência do aceite, governança de versões e canais: os mecanismos de aceite não deverão utilizar caixas previamente marcadas nem ocultar informações essenciais. A Pronto deverá manter histórico das versões disponibilizadas e evidências razoáveis de que o usuário teve acesso ao conteúdo aplicável no momento da confirmação. O registro poderá conter usuário ou conta, perfil, data, horário, versão, capítulo, sessão, endereço de IP, dispositivo ou outro dado técnico proporcional. Esses registros deverão ser protegidos contra alteração indevida, acessíveis para auditoria e conservados somente pelo período compatível com obrigação legal, segurança, prevenção a fraude e exercício de direitos.`,
  },
];

const PLATFORM_TERMS_DECLARATION = `Declaração final de aceite:
• Li os Termos, Políticas e Regras de Uso da Plataforma Pronto — Versão Beta.
• Tive acesso aos capítulos e às políticas complementares aplicáveis.
• Compreendi que a Pronto é uma plataforma tecnológica de intermediação.
• Compreendi que contratação, execução e pagamento, na versão Beta, ocorrem diretamente entre contratante e profissional.
• Compreendi que a realidade dos fatos prevalece sobre a denominação dada à relação.
• Compreendi minhas responsabilidades e as regras de cancelamento, avaliação, denúncia, suspensão e bloqueio.
• Compreendi as regras especiais aplicáveis a profissionais de 16 ou 17 anos.
• Compreendi que autorização de responsável não torna permitida atividade proibida.
• Concordo livremente com este documento, sem renunciar a direitos obrigatórios previstos em lei.

Data, horário, versão e endereço de IP são registrados automaticamente pela plataforma no momento da confirmação.`;

const MINORS_OPPORTUNITY_VERSION = '1.1';

const minorsOpportunityChapters: ConsentDocumentChapter[] = [
  {
    number: '1',
    heading: 'Oportunidade disponível para profissionais de 16 ou 17 anos',
    body: `Ao habilitar esta oportunidade para profissionais de 16 ou 17 anos, o contratante declara ciência de que:
• é responsável por verificar se a atividade pode ser legalmente exercida por adolescente;
• a autorização dos pais ou responsáveis não torna permitida atividade proibida;
• devem ser observadas idade, horário, frequência escolar, ambiente, segurança, saúde, natureza da atividade, CLT, ECA e Lista TIP;
• trabalho noturno, perigoso, insalubre, penoso e outras atividades legalmente proibidas não podem ser oferecidos a menores de 18 anos;
• todas as informações sobre função, tarefas, local, horário, valor, riscos e condições devem ser completas e verdadeiras;
• documentos, autorizações e requisitos legais devem ser verificados antes da confirmação e durante a execução;
• os responsáveis legais devem acompanhar e orientar o adolescente, sem substituir os deveres do contratante;
• a contratação e a relação efetivamente formada devem cumprir a legislação aplicável;
• a Pronto apenas facilita a aproximação, não realiza análise jurídica individual nem fiscalização presencial do local, da jornada ou do serviço;
• diante de dúvida sobre legalidade, segurança ou compatibilidade com a idade, a oportunidade não deve ser oferecida ou deve ser interrompida até esclarecimento adequado.`,
  },
];

const MINORS_OPPORTUNITY_DECLARATION = `Declaro que li e compreendi que sou responsável por verificar a legalidade, a segurança e a compatibilidade desta oportunidade com a idade do candidato. Reconheço que a autorização dos responsáveis legais não torna permitida atividade proibida e que a Pronto atua apenas como plataforma de intermediação, sem fiscalização presencial do serviço.

Contratante/conta, oportunidade, data, horário, versão aceita e IP são registrados automaticamente pela plataforma no momento da confirmação.`;

const LOGIN_SUMMARY_VERSION = '1.1';

const loginSummaryChapters: ConsentDocumentChapter[] = [
  {
    number: '1',
    heading: 'Termo resumido de ciência e utilização da Pronto',
    body: `Este texto apresenta as regras essenciais para acesso e utilização. Ele não substitui os Termos, Políticas e Regras de Uso completos, que permanecem disponíveis para consulta.

A Pronto é uma plataforma tecnológica de intermediação que aproxima contratantes e profissionais. A Pronto não é empregadora, não executa os serviços anunciados e não se torna automaticamente parte da contratação direta entre os usuários. A Pronto não garante emprego, seleção, contratação, renda, pagamento, comparecimento, qualidade ou resultado.

Contratantes e profissionais são responsáveis pelas informações que fornecem, pelas condições que aceitam e pelos atos que praticam. As condições da oportunidade, inclusive atividade, horário, local, valor e benefícios, são ajustadas diretamente entre as partes. Na versão Beta, a Pronto não recebe, guarda, divide ou repassa pagamentos.

A realidade dos fatos prevalece: a plataforma não pode ser usada para ocultar vínculo empregatício ou outra relação jurídica existente. Todos devem agir de boa-fé. Fraude, informação falsa, assédio, discriminação, violência, exploração, manipulação de registros e uso indevido de dados são proibidos. Denúncias poderão ser analisadas e contas, publicações ou funções poderão ser limitadas, suspensas ou bloqueadas, com direito de esclarecimento quando cabível.

Dados pessoais serão tratados conforme a LGPD, as regras de privacidade e retenção e, no caso de adolescentes, com prevalência do melhor interesse.`,
  },
];

const LOGIN_SUMMARY_DECLARATION = `Declaro que li, compreendi e concordo com as regras essenciais da Pronto, reconhecendo sua atuação como plataforma tecnológica de intermediação e confirmando que tive acesso ao Termo de Uso completo.

Usuário/conta, data, horário, versão aceita e IP são registrados automaticamente pela plataforma no momento da confirmação.`;

async function seedDocument(
  type: 'platform_terms' | 'minors_opportunity' | 'login_summary',
  version: string,
  chapters: ConsentDocumentChapter[],
  declaration: string,
): Promise<void> {
  const existing = await db.query.consentDocuments.findFirst({
    where: and(eq(consentDocuments.type, type), eq(consentDocuments.version, version)),
  });
  if (existing) {
    console.log(`[seed-consent-documents] ${type} v${version} já existe, pulando.`);
    return;
  }
  await db.insert(consentDocuments).values({ type, version, chapters, declaration });
  console.log(`[seed-consent-documents] ${type} v${version} inserido.`);
}

/**
 * Exportada (não só chamada pelo `main` do CLI) porque o setup global de
 * testes (`src/test-global-setup.ts`) também precisa garantir que os 3
 * tipos existem antes de qualquer teste rodar — `createJob`/`createApplication`/
 * `acceptTerms` etc. dependem de pelo menos uma versão de cada tipo existir,
 * e o ambiente de CI (Postgres efêmero, só migrado, nunca seedado
 * manualmente) precisaria disso pra não quebrar toda a suíte.
 */
export async function seedConsentDocuments(): Promise<void> {
  await seedDocument('platform_terms', PLATFORM_TERMS_VERSION, platformTermsChapters, PLATFORM_TERMS_DECLARATION);
  await seedDocument(
    'minors_opportunity',
    MINORS_OPPORTUNITY_VERSION,
    minorsOpportunityChapters,
    MINORS_OPPORTUNITY_DECLARATION,
  );
  await seedDocument('login_summary', LOGIN_SUMMARY_VERSION, loginSummaryChapters, LOGIN_SUMMARY_DECLARATION);
}

// Só roda sozinho quando executado direto (`npm run db:seed-consent-documents`)
// — sem essa guarda, importar `seedConsentDocuments` no setup global de
// testes (ver test-global-setup.ts) dispararia isso de novo no import e
// fecharia o pool de conexões (`closeDb`) por baixo de toda a suíte.
if (require.main === module) {
  seedConsentDocuments()
    .catch((error) => {
      console.error('Falha ao rodar o seed de documentos de consentimento:', error);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
