// Simula N alumnos conectados a una partida (prueba de carga). Sin dependencias, Node 18+.
// Uso:  node tools/simular.mjs <PIN> [N=120]
const BASE = "https://firestore.googleapis.com/v1/projects/kahoot-alfil/databases/(default)/documents";
const KEY = "AIzaSyC8936TaP7blcMYszthJIy5597wiuLDFyI";
const pin = process.argv[2];
const N = Number(process.argv[3] || 120);
if (!pin) { console.error("Uso: node tools/simular.mjs <PIN> [N]"); process.exit(1); }

const val = v => typeof v === "string" ? { stringValue: v } : v === null ? { nullValue: null } : Number.isInteger(v) ? { integerValue: String(v) } : { booleanValue: v };
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
async function create(path, id, data) {
  const r = await fetch(`${BASE}/${path}?documentId=${encodeURIComponent(id)}&key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: fields(data) }) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
}
async function getGame() {
  const r = await fetch(`${BASE}/games/${pin}?key=${KEY}`);
  const f = (await r.json()).fields || {};
  return { state: f.state?.stringValue, qIndex: Number(f.qIndex?.integerValue ?? -1), duration: Number(f.duration?.integerValue ?? 20) };
}

const ids = Array.from({ length: N }, (_, i) => `bot-${i}-${Math.random().toString(16).slice(2, 8)}`);
const t0 = Date.now();
const res = await Promise.allSettled(ids.map((id, i) => create(`games/${pin}/players`, id, { name: `Huésped ${i + 1}`, score: 0, rank: null, lastPoints: 0, lastCorrect: null })));
console.log(`${res.filter(r => r.status === "fulfilled").length}/${N} bots dentro en ${Date.now() - t0} ms`, res.find(r => r.status === "rejected")?.reason?.message || "");

let lastQ = -1;
while (true) {
  const g = await getGame();
  if (g.state === "end") { console.log("Partida terminada"); break; }
  if (g.state === "question" && g.qIndex !== lastQ) {
    lastQ = g.qIndex;
    const dur = g.duration * 1000;
    let ok = 0, ko = 0;
    const jobs = ids.filter(() => Math.random() > 0.05).map(id => new Promise(done => {
      const ms = Math.floor(800 + Math.random() * (dur - 3000));
      setTimeout(() => create(`games/${pin}/answers`, `${g.qIndex}_${id}`, { qIndex: g.qIndex, playerId: id, choice: Math.floor(Math.random() * 4), ms })
        .then(() => ok++).catch(() => ko++).finally(done), ms);
    }));
    Promise.all(jobs).then(() => console.log(`P${g.qIndex + 1}: ${ok} respuestas OK, ${ko} fallos`));
  }
  await new Promise(r => setTimeout(r, 1000));
}
