const SIGNATURES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

/**
 * O `Content-Type` do multipart é escolhido pelo cliente — qualquer
 * request feita fora de um navegador (curl, Postman) pode declarar
 * `image/jpeg` e mandar qualquer outro conteúdo. Aqui a checagem é
 * pelos bytes de assinatura reais do arquivo, não pelo header.
 * Retorna o mime type detectado, ou `null` se não bater com nenhum
 * dos formatos aceitos.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signature] of Object.entries(SIGNATURES)) {
    if (buffer.subarray(0, signature.length).equals(signature)) {
      return mimeType;
    }
  }

  return null;
}
