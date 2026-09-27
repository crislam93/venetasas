// Función serverless (Vercel, Node 18+). Reúne las tasas en una sola respuesta
// y la cachea en el CDN 30 s para no saturar las fuentes.

const DOLARAPI = "https://ve.dolarapi.com/v1";
const BINANCE_P2P = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const TIMEOUT_MS = 8000;

let memo = { at: 0, data: null }; // caché en memoria de la instancia

async function getJSON(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function mediana(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function binanceLado(tradeType) {
  const body = {
    asset: "USDT",
    fiat: "VES",
    tradeType,            // BUY = anuncios donde tú compras USDT
    page: 1,
    rows: 15,
    payTypes: [],
    publisherType: "merchant", // solo comerciantes verificados: menos ruido
    transAmount: "",
    countries: [],
  };
  const j = await getJSON(BINANCE_P2P, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify(body),
  });
  const precios = (j.data || [])
    .map((a) => parseFloat(a?.adv?.price))
    .filter((p) => Number.isFinite(p) && p > 0)
    .slice(0, 10);
  if (precios.length < 3) throw new Error("Binance P2P devolvió muy pocos anuncios");
  return mediana(precios);
}

async function dolarBCV() {
  const j = await getJSON(`${DOLARAPI}/dolares/oficial`);
  return { valor: j.promedio, fecha: j.fechaActualizacion, fuente: "BCV" };
}

async function euroBCV() {
  const j = await getJSON(`${DOLARAPI}/euros/oficial`);
  return { valor: j.promedio, fecha: j.fechaActualizacion, fuente: "BCV" };
}

async function usdtBinance() {
  try {
    const [compra, venta] = await Promise.all([binanceLado("BUY"), binanceLado("SELL")]);
    return {
      valor: (compra + venta) / 2,
      compra,
      venta,
      fecha: new Date().toISOString(),
      fuente: "Binance P2P",
    };
  } catch (e) {
    // Respaldo: tasa paralela de DolarApi, marcada como tal en la interfaz.
    const j = await getJSON(`${DOLARAPI}/dolares/paralelo`);
    return {
      valor: j.promedio,
      fecha: j.fechaActualizacion,
      fuente: "Paralelo (respaldo)",
      respaldo: true,
      motivo: e.message,
    };
  }
}

function resultado(p) {
  return p.status === "fulfilled" ? p.value : { error: p.reason?.message || "No disponible" };
}

module.exports = async function handler(req, res) {
  const ahora = Date.now();
  if (!memo.data || ahora - memo.at > 20000) {
    const [usd, usdt, eur] = await Promise.allSettled([dolarBCV(), usdtBinance(), euroBCV()]);
    memo = {
      at: ahora,
      data: { consultado: new Date(ahora).toISOString(), usd: resultado(usd), usdt: resultado(usdt), eur: resultado(eur) },
    };
  }
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(memo.data);
};
