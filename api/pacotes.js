// Devolve os pacotes e limites para o site mostrar (os preços ficam em lib/config.js).
import { PACOTES, MAX_SECONDS } from '../lib/config.js';
import { enviar, soMetodo } from '../lib/http.js';

export default function handler(req, res) {
  if (!soMetodo(req, res, 'GET')) return;
  enviar(res, 200, {
    maxSegundos: MAX_SECONDS,
    pacotes: Object.values(PACOTES),
  });
}
