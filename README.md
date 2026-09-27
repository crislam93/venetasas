# Tasa al día

Portal con el dólar BCV, USDT en Binance P2P y euro BCV en bolívares, actualizados cada 30 segundos.

## Publicarlo (gratis, ~5 minutos)
1. Crea una cuenta en https://vercel.com (puedes entrar con GitHub).
2. Sube esta carpeta a un repositorio de GitHub e impórtalo en Vercel, o desde la terminal: `npm i -g vercel` y luego `vercel` dentro de la carpeta.
3. Listo: Vercel te da una dirección tipo `tasas-ve.vercel.app`. Puedes conectar tu propio dominio en Settings → Domains.

## Cómo funciona
- `api/tasas.js` consulta en el servidor: ve.dolarapi.com (dólar y euro oficiales del BCV) y Binance P2P (USDT/VES). Si Binance falla, usa la tasa paralela de DolarApi y la página lo indica.
- La respuesta se cachea 30 s en el CDN: aunque entren miles de personas, las fuentes reciben pocas consultas.
- `vercel.json` ejecuta la función en São Paulo (`gru1`), porque Binance suele bloquear peticiones desde EE. UU.
- `index.html` pide `/api/tasas` cada 30 s y se pausa cuando la pestaña no está visible.
