/**
 * O provedor do banco (Railway, etc.) costuma injetar `?sslmode=require`
 * (ou `prefer`/`verify-ca`) na própria DATABASE_URL — redundante nos
 * dois lugares que se conectam direto com essa URL crua (db/client.ts,
 * que já decide o `ssl` explicitamente, e drizzle.config.ts, usado
 * pelo `drizzle-kit migrate` no deploy). Sem remover, o
 * pg-connection-string imprime um aviso de depreciação a cada conexão
 * — não é erro, só ruído nos logs (que aparece em vermelho no Railway
 * e assusta à toa).
 */
export function stripSslModeParam(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.delete('sslmode');
  return url.toString();
}
