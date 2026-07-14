import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem isso, cada render() se acumula no DOM entre testes do mesmo
// arquivo — o Testing Library só limpa sozinho quando `afterEach`
// existe como global, e não usamos globals do Vitest de propósito.
afterEach(() => {
  cleanup();
});
