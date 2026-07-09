const IMAGE_SIGNATURES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

const PDF_SIGNATURE = Buffer.from('%PDF');

/**
 * O `Content-Type` do multipart é escolhido pelo cliente — qualquer
 * request feita fora de um navegador (curl, Postman) pode declarar
 * `image/jpeg` e mandar qualquer outro conteúdo. Aqui a checagem é
 * pelos bytes de assinatura reais do arquivo, não pelo header.
 * Retorna o mime type detectado, ou `null` se não bater com nenhum
 * dos formatos aceitos.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signature] of Object.entries(IMAGE_SIGNATURES)) {
    if (buffer.subarray(0, signature.length).equals(signature)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Documento de identidade (CNH/RG) aceita imagem OU PDF — diferente de
 * foto de perfil/logo, que só faz sentido como imagem (vira `<img>`
 * direto). Mesmo raciocínio de checar os bytes reais, não o header.
 */
export function detectDocumentMimeType(buffer: Buffer): string | null {
  const imageMimeType = detectImageMimeType(buffer);
  if (imageMimeType) {
    return imageMimeType;
  }

  if (buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return 'application/pdf';
  }

  return null;
}
