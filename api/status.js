// O site pergunta aqui, de tempos em tempos, se o vídeo já ficou pronto.
// Se a geração falhar de vez, o crédito é devolvido (uma única vez).
import { MODEL } from '../lib/config.js';
import { redis, userKey } from '../lib/db.js';
import { fal } from '../lib/fal.js';
import { enviar, soMetodo, lerToken } from '../lib/http.js';

async function devolverCredito(id, token) {
  const primeira = await redis.set(`refund:${id}`, '1', { nx: true, ex: 3 * 24 * 3600 });
  if (primeira) await redis.hincrby(userKey(token), 'creditos', 1);
}

export default async function handler(req, res) {
  if (!soMetodo(req, res, 'GET')) return;

  const token = lerToken(req);
  const id = String(req.query?.id || '');
  if (!token || !/^[\w-]{8,100}$/.test(id)) return enviar(res, 400, { erro: 'Pedido inválido.' });

  const job = await redis.get(`job:${id}`);
  if (!job || job.token !== token) return enviar(res, 404, { erro: 'Pedido não encontrado.' });

  let st;
  try {
    st = await fal.queue.status(MODEL, { requestId: id });
  } catch (e) {
    return enviar(res, 200, { status: 'processando' }); // falha momentânea: o site tenta de novo
  }
  if (st.status !== 'COMPLETED') return enviar(res, 200, { status: 'processando', etapa: st.status });

  try {
    const r = await fal.queue.result(MODEL, { requestId: id });
    const url = r?.data?.video?.url;
    if (!url) throw new Error('sem vídeo');
    return enviar(res, 200, { status: 'pronto', url });
  } catch (e) {
    const falhas = await redis.incr(`falhas:${id}`);
    await redis.expire(`falhas:${id}`, 3 * 24 * 3600);
    if (falhas >= 4) {
      await devolverCredito(id, token);
      return enviar(res, 200, {
        status: 'erro',
        erro: 'A geração falhou. Seu crédito foi devolvido. Tente outra imagem ou outro vídeo.',
      });
    }
    return enviar(res, 200, { status: 'processando' });
  }
}
