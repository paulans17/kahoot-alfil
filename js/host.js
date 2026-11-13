import { db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot, query, where, writeBatch, serverTimestamp, SHAPES, points, esc } from "./fb.js?v=5";
import { QUESTIONS } from "./questions.js?v=5";

const $ = id => document.getElementById(id);
const views = ["hStart", "hLobby", "hQ", "hRev", "hBoard", "hEnd"];
const show = v => { views.forEach(x => $(x).classList.toggle("hidden", x !== v)); document.body.classList.toggle("playing", !["hStart", "hLobby"].includes(v)); };

let pin = null, game = null;
let players = new Map();     // id -> data
let answers = new Map();     // playerId -> {choice, ms}
let unsubAnswers = null, timerInt = null, closing = false;

$("qInfo").textContent = `${QUESTIONS.length} preguntas cargadas`;
const savedPin = localStorage.getItem("aj_host_pin");
if (savedPin) $("btnResume").classList.remove("hidden");

$("btnCreate").onclick = createGame;
$("btnResume").onclick = () => resume(savedPin);
$("btnStartGame").onclick = () => startQuestion(0);
$("btnSkip").onclick = () => closeQuestion();
$("btnToBoard").onclick = showBoard;
$("btnNext").onclick = () => {
  const next = game.qIndex + 1;
  if (next >= QUESTIONS.length) endGame(); else startQuestion(next);
};
$("btnNew").onclick = () => { localStorage.removeItem("aj_host_pin"); location.reload(); };

async function createGame() {
  $("btnCreate").disabled = true;
  try {
    let p;
    for (let i = 0; i < 5; i++) {
      p = String(Math.floor(100000 + Math.random() * 900000));
      const s = await getDoc(doc(db, "games", p));
      if (!s.exists()) break;
    }
    await setDoc(doc(db, "games", p), { state: "lobby", qIndex: -1, total: QUESTIONS.length, createdAt: serverTimestamp() });
    localStorage.setItem("aj_host_pin", p);
    await resume(p);
  } catch (e) {
    alertBox("No se ha podido crear la partida: " + e.message);
    $("btnCreate").disabled = false;
  }
}

async function resume(p) {
  const s = await getDoc(doc(db, "games", p));
  if (!s.exists()) { localStorage.removeItem("aj_host_pin"); return location.reload(); }
  pin = p; game = s.data();
  onSnapshot(collection(db, "games", pin, "players"), snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === "removed") players.delete(ch.doc.id);
      else players.set(ch.doc.id, ch.doc.data());
    });
    renderLobby();
    if (game.state === "question") updateAnswerCount();
  });
  if (game.state === "lobby") showLobby();
  else if (game.state === "question") startQuestion(game.qIndex, true);
  else if (game.state === "reveal" || game.state === "leaderboard") showBoard();
  else if (game.state === "end") endGame();
}

function joinLink() {
  const base = location.href.replace(/host\.html.*$/, "");
  return `${base}?pin=${pin}`;
}

function showLobby() {
  $("pin").textContent = pin;
  $("joinUrl").textContent = location.host + location.pathname.replace(/host\.html$/, "");
  $("qr").innerHTML = "";
  new QRCode($("qr"), { text: joinLink(), width: 220, height: 220, colorDark: "#3d0d1c", colorLight: "#ffffff" });
  renderLobby();
  show("hLobby");
}

function renderLobby() {
  $("nPlayers").textContent = players.size;
  if (game && game.state === "lobby") {
    const all = [...players.values()];
    $("names").innerHTML = all.slice(-60).reverse().map(p => `<span class="chip">${esc(p.name)}</span>`).join("");
  }
}

async function startQuestion(qi, resuming = false) {
  const q = QUESTIONS[qi];
  const dur = q.tiempo || 20;
  closing = false;
  answers = new Map();
  if (!resuming) {
    await updateDoc(doc(db, "games", pin), { state: "question", qIndex: qi, duration: dur, startedAt: serverTimestamp() });
  }
  game.state = "question"; game.qIndex = qi;

  $("qCounter").textContent = `Pregunta ${qi + 1} de ${QUESTIONS.length}`;
  $("qTitle").textContent = q.pregunta;
  $("qAnswers").innerHTML = q.respuestas.map((r, i) =>
    `<div class="ans c${i}"><span class="shape">${SHAPES[i]}</span><span>${esc(r)}</span></div>`).join("");
  $("nAns").textContent = "0";
  show("hQ");

  if (unsubAnswers) unsubAnswers();
  unsubAnswers = onSnapshot(query(collection(db, "games", pin, "answers"), where("qIndex", "==", qi)), snap => {
    snap.docChanges().forEach(ch => { if (ch.type !== "removed") answers.set(ch.doc.data().playerId, ch.doc.data()); });
    updateAnswerCount();
  });

  const t0 = performance.now();
  clearInterval(timerInt);
  const tick = () => {
    // +1,5 s de margen para la latencia de los móviles
    const left = Math.max(0, Math.ceil(dur - (performance.now() - t0) / 1000));
    $("timer").textContent = left;
    if (performance.now() - t0 > (dur + 1.5) * 1000) closeQuestion();
  };
  tick(); timerInt = setInterval(tick, 200);
}

function updateAnswerCount() {
  $("nAns").textContent = answers.size;
  if (game.state === "question" && players.size > 0 && answers.size >= players.size) {
    setTimeout(() => closeQuestion(), 600);
  }
}

async function closeQuestion() {
  if (closing || game.state !== "question") return;
  closing = true;
  clearInterval(timerInt);
  if (unsubAnswers) { unsubAnswers(); unsubAnswers = null; }

  const qi = game.qIndex;
  const q = QUESTIONS[qi];
  const dur = q.tiempo || 20;

  // Puntuación
  const counts = q.respuestas.map(() => 0);
  const updates = [];
  for (const [id, p] of players) {
    const a = answers.get(id);
    let pts = 0, correct = false;
    if (a) {
      if (counts[a.choice] !== undefined) counts[a.choice]++;
      if (a.choice === q.correcta) { correct = true; pts = points(a.ms, dur); }
    }
    p.score = (p.score || 0) + pts;
    updates.push({ id, pts, correct, answered: !!a });
  }
  const ranked = [...players.entries()].sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const rankOf = new Map(ranked.map(([id], i) => [id, i + 1]));

  try {
    for (let i = 0; i < updates.length; i += 450) {
      const batch = writeBatch(db);
      updates.slice(i, i + 450).forEach(u => {
        batch.update(doc(db, "games", pin, "players", u.id), {
          score: players.get(u.id).score, rank: rankOf.get(u.id),
          lastPoints: u.pts, lastCorrect: u.correct, lastAnswered: u.answered, lastQ: qi
        });
      });
      if (i + 450 >= updates.length) batch.update(doc(db, "games", pin), { state: "reveal" });
      await batch.commit();
    }
    if (!updates.length) await updateDoc(doc(db, "games", pin), { state: "reveal" });
  } catch (e) {
    alertBox("Error guardando puntos: " + e.message);
  }
  game.state = "reveal";

  // Pantalla de resultados
  const max = Math.max(1, ...counts);
  $("rTitle").textContent = q.pregunta;
  $("bars").innerHTML = counts.map((n, i) => `
    <div class="bar"><div class="n">${n}</div>
      <div class="fill c${i}" style="height:0%" data-h="${(n / max) * 80}"></div>
      <div class="lbl c${i}">${SHAPES[i]}${i === q.correcta ? " ✓" : ""}</div></div>`).join("");
  $("rAnswers").innerHTML = q.respuestas.map((r, i) =>
    `<div class="ans c${i} ${i === q.correcta ? "correct" : "dim"}"><span class="shape">${SHAPES[i]}</span><span>${esc(r)}</span></div>`).join("");
  show("hRev");
  requestAnimationFrame(() => setTimeout(() => {
    $("bars").querySelectorAll(".fill").forEach(f => (f.style.height = f.dataset.h + "%"));
  }, 50));
}

function rankedList() {
  return [...players.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

async function showBoard() {
  if (game.state !== "leaderboard") {
    game.state = "leaderboard";
    updateDoc(doc(db, "games", pin), { state: "leaderboard" }).catch(() => {});
  }
  const top = rankedList().slice(0, 5);
  $("board").innerHTML = top.map((p, i) =>
    `<div class="row" style="animation-delay:${i * 0.12}s"><span class="pos">${i + 1}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score || 0}</span></div>`).join("");
  $("btnNext").textContent = game.qIndex + 1 >= QUESTIONS.length ? "Ver podio" : "Siguiente pregunta";
  show("hBoard");
}

async function endGame() {
  game.state = "end";
  updateDoc(doc(db, "games", pin), { state: "end" }).catch(() => {});
  const list = rankedList();
  const order = [1, 0, 2]; // 2º, 1º, 3º
  const heights = { 0: 220, 1: 160, 2: 120 };
  $("podium").innerHTML = order.filter(i => list[i]).map(i => `
    <div class="step"><div class="who">${esc(list[i].name)}</div><div class="pts">${list[i].score || 0} pts</div>
    <div class="block" style="height:${heights[i]}px">${i + 1}</div></div>`).join("");
  $("restBoard").innerHTML = list.slice(3, 10).map((p, i) =>
    `<div class="row" style="font-size:1.2rem;padding:10px 18px"><span class="pos">${i + 4}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score || 0}</span></div>`).join("");
  show("hEnd");
}

function alertBox(msg) {
  console.error(msg);
  const d = document.createElement("div");
  d.textContent = msg;
  d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#b3364a;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;z-index:99";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 6000);
}
