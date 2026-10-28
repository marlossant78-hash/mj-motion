# MJ Motion

Site de motion control: o cliente envia uma imagem e um vídeo de referência, paga por Pix e recebe o vídeo gerado pelo **Kling 3.0 Standard (720p)** na fal.ai.

## Como funciona

1. O cliente compra um pacote por Pix (Mercado Pago). O pagamento confirmado libera os créditos.
2. Cada vídeo gasta 1 crédito. Os arquivos vão direto do navegador para o Vercel Blob.
3. O servidor confere a duração do vídeo (máximo de 5 s), cobra o crédito e coloca o pedido na fila da fal.ai.
4. O site consulta o andamento. Se a geração falhar, o crédito volta sozinho.

Custo de referência na fal.ai: US$ 0,126 por segundo, ou cerca de **US$ 0,63 por vídeo de 5 s**.

## Arquivos

- `index.html`: o site (vitrine, compra por Pix, criação de vídeo).
- `api/`: as rotas do servidor (`pacotes`, `pix`, `webhook`, `creditos`, `upload`, `gerar`, `status`).
- `lib/config.js`: **preços dos pacotes**, modelo, duração máxima. É aqui que você ajusta.

## Passo a passo para colocar no ar

### 1. fal.ai
1. Crie a conta em https://fal.ai e adicione crédito.
2. Em Dashboard > Keys, crie uma chave de API. Guarde como `FAL_KEY`.

### 2. Mercado Pago
1. Crie a conta e uma aplicação em https://www.mercadopago.com.br/developers.
2. Pegue o **Access Token de produção**. Guarde como `MP_ACCESS_TOKEN`.
3. Confirme que a sua conta pode receber Pix.

### 3. Vercel
1. Suba esta pasta para um repositório no GitHub e importe em https://vercel.com (ou use `npx vercel`).
2. No projeto, abra **Storage** e crie:
   - um banco **Upstash Redis** (plano grátis);
   - um **Blob** store. Isso cria `BLOB_READ_WRITE_TOKEN` automaticamente.
3. Em **Settings > Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `FAL_KEY` | chave da fal.ai |
| `MP_ACCESS_TOKEN` | token do Mercado Pago |
| `SITE_URL` | endereço do site, por exemplo `https://mjmotion.vercel.app` |
| `MAX_SECONDS` | (opcional) duração máxima do vídeo, padrão 5 |
| `CHARACTER_ORIENTATION` | (opcional) `video` (padrão) ou `image` |

As variáveis do Redis entram sozinhas quando você conecta o banco ao projeto.

4. Faça o deploy de novo depois de adicionar as variáveis.

### 4. Testar antes de vender
1. Compre o pacote mais barato com o seu próprio Pix e veja o crédito entrar.
2. Gere um vídeo com um MP4 de até 5 s.
3. Confira o gasto no painel da fal.ai.

## Preços

Edite `PACOTES` em `lib/config.js`. Regra prática: converta o custo (US$ 0,63) pelo dólar do dia e cobre pelo menos o dobro, para cobrir taxa do Pix, tentativas refeitas e lucro.

## Limites conhecidos

- O código de acesso fica no navegador do cliente. Quem perder o código e limpar o navegador perde o saldo. Um login por e-mail seria o próximo passo.
- Não há limite de pedidos por minuto. Se aparecer abuso, adicione um limite no `api/pix.js`.
- O link do vídeo gerado vem da fal.ai e pode expirar. O site pede para o cliente baixar na hora.
- Defina termos de uso e proíba conteúdo impróprio e imitação de pessoas sem autorização.
