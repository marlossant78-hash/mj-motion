// Recebe os links da imagem e do vídeo, cobra 1 crédito e manda para o Kling 3.0 na fal.ai.
// A geração demora alguns minutos, então só colocamos na fila e o site consulta /api/status.
import { MODEL, MAX_SECONDS, ORIENTATION, MAX_UPLOAD_BYTES, BLOB_HOST_SUFFIX, PROMPT_PADRAO } from '../lib/config.js';
import { redis, userKey, usuarioExiste, saldo } from '../lib/db.js';
import { fal } from '../lib/fal.js';
import { duracaoMp4 } from '../lib/mp4.js';
import { enviar, soMetodo, lerToken } from '../lib/http.js';

function urlDoBlob(valor) {
  try {
    const u = new URL(String(valor));
    return u.protocol === 'https:' && u.hostname.endsWith(BLOB_HOST_SUFFIX) ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (!soMetodo(req, res, 'POST')) return;

  const token = lerToken(req);
  if (!token || !(await usuarioExiste(token))) return enviar(res, 401, { erro: 'Acesso inválido.' });
  if ((await saldo(token)) < 1) return enviar(res, 402, { erro: 'Você não tem créditos. Compre um pacote.' });

  const imageUrl = urlDoBlob(req.body?.imageUrl);
  const videoUrl = urlDoBlob(req.body?.videoUrl);
  if (!imageUrl || !videoUrl) return enviar(res, 400, { erro: 'Arquivos inválidos. Envie de novo.' });

  // Confere a duração do vídeo ANTES de cobrar (o custo na fal.ai é por segundo gerado).
  let duracao = null;
  try {
    const v = await fetch(videoUrl);
    const tam = Number(v.headers.get('content-length') || 0);
    if (!v.ok || tam > MAX_UPLOAD_BYTES) throw new Error('arquivo');
    duracao = duracaoMp4(Buffer.from(await v.arrayBuffer()));
  } catch {
    return enviar(res, 400, { erro: 'Não consegui ler o vídeo. Envie um MP4 menor.' });
  }
  if (duracao === null) return enviar(res, 400, { erro: 'Não consegui ler a duração. Use um vídeo MP4 ou MOV.' });
  if (duracao > MAX_SECONDS + 0.5) {
    return enviar(res, 400, { erro: `O vídeo de referência tem ${duracao.toFixed(1)}s. O máximo é ${MAX_SECONDS}s.` });
  }

  // Cobra o crédito de forma segura (se ficar negativo, devolve e recusa).
  const restante = await redis.hincrby(userKey(token), 'creditos', -1);
  if (restante < 0) {
    await redis.hincrby(userKey(token), 'creditos', 1);
    return enviar(res, 402, { erro: 'Você não tem créditos. Compre um pacote.' });
  }

  try {
    const { request_id: requestId } = await fal.queue.submit(MODEL, {
      input: {
        prompt: PROMPT_PADRAO,
        image_url: imageUrl,
        video_url: videoUrl,
        character_orientation: ORIENTATION,
      },
    });
    await redis.set(`job:${requestId}`, { token }, { ex: 3 * 24 * 3600 });
    enviar(res, 200, { requestId, creditos: restante });
  } catch (e) {
    console.error('Erro fal.ai', e);
    await redis.hincrby(userKey(token), 'creditos', 1); // devolve o crédito
    enviar(res, 502, { erro: 'Não foi possível iniciar a geração. Seu crédito foi devolvido.' });
  }
}
