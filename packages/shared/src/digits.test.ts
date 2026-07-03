import { describe, expect, it } from 'vitest';
import { extractDigits } from './digits';

describe('extractDigits', () => {
  it('remove tudo que não é número', () => {
    expect(extractDigits('(11) 99999-0000')).toBe('11999990000');
  });
});
