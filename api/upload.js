// Autoriza o navegador a enviar a imagem e o vídeo direto para o Vercel Blob
// (assim os arquivos grandes não passam pela função do servidor).
import { handleUpload } from '@vercel/blob/client';
import { MAX_UPLOAD_BYTES } from '../lib/config.js';
import { usuarioExiste, saldo } from '../lib/db.js';
import { enviar, soMetodo } from '../lib/http.js';

export default async function handler(req, res) {
  if (!soMetodo(req, res, 'POST')) return;
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const token = String(clientPayload || '');
        if (!(await usuarioExiste(token)) || (await saldo(token)) < 1) {
          throw new Error('Sem créditos.');
        }
        return {
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/quicktime',
          ],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    enviar(res, 200, json);
  } catch (e) {
    enviar(res, 400, { erro: e.message || 'Upload não autorizado.' });
  }
}
