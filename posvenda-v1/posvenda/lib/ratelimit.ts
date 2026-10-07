// Limitador em memória (1 instância). [NECESSÁRIO CONFIGURAR] trocar por Redis/Upstash ao escalar para várias instâncias.
const hits = new Map<string, number[]>();
export function tooMany(key: string, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
