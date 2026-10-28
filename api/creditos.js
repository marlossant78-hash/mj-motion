// Mostra o saldo de créditos do cliente (identificado pelo código de acesso).
import { lerToken, enviar, soMetodo } from '../lib/http.js';
import { usuarioExiste, saldo } from '../lib/db.js';

export default async function handler(req, res) {
  if (!soMetodo(req, res, 'GET')) return;
  const token = lerToken(req);
  if (!token || !(await usuarioExiste(token))) {
    return enviar(res, 200, { creditos: 0, valido: false });
  }
  enviar(res, 200, { creditos: await saldo(token), valido: true });
}
