import { Request, Response } from 'express';
import { env } from '../../config/env';
import { IssuedTokens } from './issue-tokens';
import { REFRESH_TOKEN_TTL_MS } from './refresh-token';

const ACCESS_TOKEN_COOKIE = 'shift_access_token';
const REFRESH_TOKEN_COOKIE = 'shift_refresh_token';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * httpOnly nos dois — nenhum JavaScript no navegador consegue ler o
 * valor, é a proteção contra roubo de token via XSS. secure só em
 * produção porque dev local é http, não https.
 */
const baseCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(res: Response, tokens: IssuedTokens): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions);
}

export function getAccessTokenCookie(req: Request): string | undefined {
  return req.cookies?.[ACCESS_TOKEN_COOKIE];
}

export function getRefreshTokenCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_TOKEN_COOKIE];
}
