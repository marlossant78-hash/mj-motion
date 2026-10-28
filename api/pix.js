// Cria uma cobrança Pix no Mercado Pago.
// Os créditos só entram depois que o Mercado Pago avisa (api/webhook.js) que o Pix foi pago.
import { randomBytes, randomUUID } from 'node:crypto';
import { PACOTES } from '../lib/config.js';
import { redis, userKey, usuarioExiste, TOKEN_RE } from '../lib/db.js';
import { enviar, soMetodo, lerToken } from '../lib/http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!soMetodo(req, res, 'POST')) return;

  if (!process.env.MP_ACCESS_TOKEN || !process.env.SITE_URL) {
    return enviar(res, 500, { erro: 'Pagamento não configurado.' });
  }

  const { email, pacote: pacoteId } = req.body || {};
  const pacote = PACOTES[pacoteId];
  if (!pacote) return enviar(res, 400, { erro: 'Pacote inválido.' });
  if (!EMAIL_RE.test(String(email || ''))) return enviar(res, 400, { erro: 'E-mail inválido.' });

  // Cliente que já tem código de acesso recarrega o mesmo saldo; cliente novo ganha um código.
  let token = lerToken(req);
  if (!token || !(await usuarioExiste(token))) {
    token = randomBytes(24).toString('hex');
    if (!TOKEN_RE.test(token)) return enviar(res, 500, { erro: 'Erro ao criar acesso.' });
    await redis.hset(userKey(token), { email: String(email).toLowerCase(), creditos: 0 });
  }

  const site = process.env.SITE_URL.replace(/\/+$/, '');
  const resp = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: pacote.valor,
      description: `MJ Motion - pacote ${pacote.nome} (${pacote.creditos} vídeo${pacote.creditos > 1 ? 's' : ''})`,
      payment_method_id: 'pix',
      payer: { email: String(email).toLowerCase() },
      external_reference: `${token}|${pacote.id}`,
      notification_url: `${site}/api/webhook`,
    }),
  });

  const dados = await resp.json().catch(() => ({}));
  const qr = dados?.point_of_interaction?.transaction_data;
  if (!resp.ok || !qr?.qr_code) {
    console.error('Erro Mercado Pago', resp.status, JSON.stringify(dados).slice(0, 500));
    return enviar(res, 502, { erro: 'Não foi possível gerar o Pix agora. Tente de novo.' });
  }

  enviar(res, 200, {
    token,
    copiaECola: qr.qr_code,
    qrBase64: qr.qr_code_base64,
    pagamentoId: dados.id,
  });
}
