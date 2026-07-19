# Integrações — o que é real vs. mock — Pronto

> Todo serviço externo do backend segue o mesmo padrão: uma interface + uma implementação real + um fallback de desenvolvimento, escolhidos por fábrica (`create<Serviço>()`) conforme env vars presentes. A diferença importante entre eles é **o que acontece em produção sem a env var configurada** — alguns degradam silenciosamente, outros travam o boot de propósito.

## Gateway de pagamento — mock, decisão de produto

`MockPaymentGateway` é a única implementação hoje: `charge()` sempre "sucede" instantaneamente, `release()` é no-op. Não existe integração com nenhum PSP (Pagar.me, Iugu, ou outro) plugada. **Não há cobrança real da plataforma nem processamento real do pagamento do turno** — o dinheiro é combinado inteiramente fora do sistema; a tabela `payments` só rastreia em que ponto esse combinado está. Isso é uma decisão de produto explícita e documentada no código, não uma pendência escondida — mas é o maior bloqueio estrutural pro modelo de monetização planejado (ver [`01-business/monetization.md`](../01-business/monetization.md)).

## E-mail — real, com trava de segurança em produção

`ConsoleEmailSender` (loga o link de reset de senha em texto puro em vez de enviar) é o fallback de desenvolvimento quando `RESEND_API_KEY` não está configurada. Em produção, **a ausência dessa env var trava o boot da aplicação** em vez de cair nesse fallback — decisão deliberada pra nunca vazar um link de reset de senha real nos logs de produção.

## Login com Google — real, com a mesma trava

Mesmo padrão do e-mail: sem `GOOGLE_CLIENT_ID` configurada, `UnconfiguredGoogleTokenVerifier` faz qualquer tentativa de "Entrar com Google" falhar — e em produção, a ausência da env var trava o boot, não degrada silenciosamente.

## Push notifications — real

VAPID / `web-push`, processando notificação de verdade. Sem as chaves configuradas, vira no-op silencioso (aqui sim degrada, ao contrário de e-mail/Google) — enviar notificação é um complemento, não um caminho crítico de segurança, então o padrão de trava não se aplica.

## Armazenamento de arquivo — real, dois níveis de privacidade

Documentos de KYC (identidade, selfie, CNH, documento de responsável) são **privados**, servidos só através de um proxy autenticado que nunca expõe a URL do provedor de armazenamento direto. Foto de perfil e logo de empresa são **públicos**. Em desenvolvimento, sem token de armazenamento configurado, cai pra disco local (`LocalFileStorage`) — em produção, a ausência do token trava o boot, mesmo padrão de e-mail/Google.

## Geolocalização — dois usos completamente diferentes, ambos reais

1. **Busca de vagas por proximidade** (trabalhador): distância real (fórmula de Haversine) entre a localização do trabalhador e a da vaga, calculada no servidor. Continua ativo e é central pro produto.
2. **Check-in/check-out de turno**: **removido** numa revisão recente — antes bloqueava (ou deveria validar) a presença física no local via GPS, hoje o check-in/check-out não depende de localização nenhuma, só de confirmação humana da empresa. Ver [`02-product/glossary.md`](../02-product/glossary.md).

Esses dois usos não têm relação um com o outro — é fácil confundir "geolocalização foi removida" como algo geral, quando na verdade só o segundo uso foi removido.

## Geocodificação reversa e busca de CEP — real, best-effort

Endereço legível a partir de coordenadas (pro perfil do trabalhador) via um serviço de geocodificação reversa, chamado de forma best-effort — se falhar, a localização ainda é salva, só sem o rótulo de endereço bonito. Busca de endereço a partir de CEP (na tela de publicar vaga) é feita direto do navegador contra a ViaCEP, sem passar pelo backend.
