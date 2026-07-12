import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Limite geral do app — rede de segurança contra flood genérico.
 * Instanciado por chamada de `createApp()`, não em nível de módulo,
 * pra cada teste (que chama `createApp()` várias vezes) começar com
 * contador zerado — em produção `createApp()` só roda uma vez.
 */
export function createGeneralRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Limite estrito por IP nas rotas de autenticação (login, registro,
 * esqueci-a-senha, Google) — sem isso, um IP pode tentar senha por
 * força bruta contra um e-mail, ou disparar e-mails de reset em massa.
 * Mais crítico do que era pra OTP, já que senha é tentável em loop.
 */
export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente de novo mais tarde.' },
  });
}

/**
 * Limite por IP nas rotas de escrita mais sensíveis a abuso/flood
 * (criar vaga, se candidatar, avaliar) — mais permissivo que o de auth
 * (uso legítimo de uma empresa/trabalhador ativo fica bem abaixo disso
 * numa janela de 15min), mas segura um script varrendo essas rotas.
 */
export function createWriteRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente de novo mais tarde.' },
  });
}

/**
 * Segunda camada de limite no login, complementar ao `authRateLimiter`
 * (que é por IP): esse aqui é por CONTA (e-mail normalizado), pra pegar
 * alguém tentando força bruta contra um único e-mail alternando IPs
 * (proxy/VPN rotativos). Mais apertado que o de IP porque é sobre uma
 * conta só. Cai pro IP (via `ipKeyGenerator`, compatível com IPv6) se
 * não vier e-mail no corpo — ainda assim uma rede de segurança melhor
 * que nada.
 */
export function createLoginAccountRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente de novo mais tarde.' },
    keyGenerator: (req: Request) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return email || ipKeyGenerator(req.ip ?? '');
    },
  });
}
