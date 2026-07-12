import { describe, expect, it } from 'vitest';
import { stripSslModeParam } from './strip-ssl-mode-param';

describe('stripSslModeParam', () => {
  it('remove sslmode da query string', () => {
    const result = stripSslModeParam('postgresql://user:pass@host:5432/db?sslmode=require');
    expect(result).not.toContain('sslmode');
  });

  it('mantém outros parâmetros de query intactos', () => {
    const result = stripSslModeParam('postgresql://user:pass@host:5432/db?sslmode=require&application_name=shift');
    expect(result).toContain('application_name=shift');
    expect(result).not.toContain('sslmode');
  });

  it('não quebra uma URL sem sslmode', () => {
    const result = stripSslModeParam('postgresql://user:pass@host:5432/db');
    expect(result).toContain('host:5432');
  });
});
