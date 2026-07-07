import rateLimit from 'express-rate-limit';

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
