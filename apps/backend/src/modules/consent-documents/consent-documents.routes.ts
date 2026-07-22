import { Router } from 'express';
import { getConsentDocumentHandler } from './get-consent-document.controller';

// Sem requireAuth de propósito — o texto vigente do termo precisa ficar
// acessível (ver módulo 12.5/28.5 do documento: "a versão vigente
// permanecerá disponível em ambiente de fácil acesso"), e o modal de
// candidatura/menores é aberto a partir de telas com contextos de auth
// diferentes (trabalhador, empresa).
export const consentDocumentsRoutes = Router();

consentDocumentsRoutes.get('/consent-documents/:type', getConsentDocumentHandler);
