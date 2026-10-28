// O Mercado Pago chama esta rota quando um Pix muda de status.
// Segurança: nunca confiamos no que chega no aviso. Consultamos o pagamento direto na
// API do Mercado Pago com a nossa chave, e só então damos os créditos (uma única vez).
import { PACOTES } from '../lib/config.js';
import { redis, userKey, TOKEN_RE } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const id = req.body?.data?.id || q['data.id'] || q.id;
    if (!id || !/^\d+$/.test(String(id))) return res.status(200).end();

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!resp.ok) return res.status(500).end(); // o Mercado Pago tenta de novo depois
    const pg = await resp.json();

    if (pg.status !== 'approved' || pg.payment_method_id !== 'pix') return res.status(200).end();

    const [token, pacoteId] = String(pg.external_reference || '').split('|');
    const pacote = PACOTES[pacoteId];
    if (!TOKEN_RE.test(token || '') || !pacote) return res.status(200).end();
    if (Number(pg.transaction_amount) + 0.001 < pacote.valor) return res.status(200).end();
    if ((await redis.exists(userKey(token))) !== 1) return res.status(200).end();

    // Trava para o mesmo pagamento nunca creditar duas vezes.
    const primeira = await redis.set(`pay:${id}`, '1', { nx: true });
    if (!primeira) return res.status(200).end();

    try {
      await redis.hincrby(userKey(token), 'creditos', pacote.creditos);
    } catch (e) {
      await redis.del(`pay:${id}`); // libera para o Mercado Pago tentar de novo
      throw e;
    }
    res.status(200).end();
  } catch (e) {
    console.error('Erro no webhook', e);
    res.status(500).end();
  }
}
