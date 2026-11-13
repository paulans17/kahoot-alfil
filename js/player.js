import { db, doc, setDoc, getDoc, onSnapshot, serverTimestamp, SHAPES, esc } from "./fb.js?v=4";
import { QUESTIONS } from "./questions.js?v=4";

const $ = id => document.getElementById(id);
const views = ["vJoin", "vWait", "vQ", "vRes"];
const show = v => views.forEach(x => $(x).classList.toggle("hidden", x !== v));

let pin = null, playerId = null, name = null;
let game = null, me = null;
let shownAt = 0, answeredQ = -1, timerInt = null;

const params = new URLSearchParams(location.search);
if (params.get("pin")) $("inPin").value = params.get("pin");

// Reconexión si recarga la página
const saved = JSON.parse(localStorage.getItem("aj_kahoot") || "null");
if (saved && (!params.get("pin") || params.get("pin") === saved.pin)) {
  getDoc(doc(db, "games", saved.pin, "players", saved.playerId)).then(s => {
    if (s.exists()) { pin = saved.pin; playerId = saved.playerId; name = saved.name; listen(); }
  }).catch(() => {});
}

$("btnJoin").onclick = join;
$("inName").addEventListener("keydown", e => { if (e.key === "Enter") join(); });

async function join() {
  const p = $("inPin").value.trim();
  const n = $("inName").value.trim();
  $("joinErr").textContent = "";
  if (!/^\d{6}$/.test(p)) return ($("joinErr").textContent = "El PIN tiene 6 números");
  if (n.length < 2) return ($("joinErr").textContent = "Pon tu nombre");
  $("btnJoin").disabled = true;
  try {
    const g = await getDoc(doc(db, "games", p));
    if (!g.exists()) throw new Error("No existe ninguna partida con ese PIN");
    if (g.data().state === "end") throw new Error("Esta partida ya ha terminado");
    playerId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    await setDoc(doc(db, "games", p, "players", playerId), { name: n, score: 0, rank: null, lastPoints: 0, lastCorrect: null, joinedAt: serverTimestamp() });
    pin = p; name = n;
    localStorage.setItem("aj_kahoot", JSON.stringify({ pin, playerId, name }));
    listen();
  } catch (e) {
    $("joinErr").textContent = e.message || "No se ha podido entrar";
  } finally {
    $("btnJoin").disabled = false;
  }
}

function listen() {
  ["wName", "rName"].forEach(id => ($(id).textContent = name));
  show("vWait");
  onSnapshot(doc(db, "games", pin, "players", playerId), s => { me = s.data(); render(); });
  onSnapshot(doc(db, "games", pin), s => { game = s.data(); render(); });
}

function render() {
  if (!game) return;
  const score = me ? `${me.score} pts` : "";
  ["wScore", "rScore"].forEach(id => ($(id).textContent = score));
  clearInterval(timerInt);

  if (game.state === "lobby") {
    $("waitMsg").textContent = "¡Estás dentro!";
    $("waitSub").textContent = "Mira la pantalla grande. Enseguida empezamos.";
    return show("vWait");
  }
  if (game.state === "question") {
    if (answeredQ === game.qIndex || localStorage.getItem(`aj_ans_${pin}_${game.qIndex}`)) {
      $("waitMsg").textContent = "Respuesta enviada";
      $("waitSub").textContent = "Esperando al resto de huéspedes…";
      return show("vWait");
    }
    return showQuestion();
  }
  if (game.state === "reveal" || game.state === "leaderboard") {
    if (!me || me.lastQ !== game.qIndex) {
      $("waitMsg").textContent = "¡Estás dentro!";
      $("waitSub").textContent = "Espera a la siguiente pregunta y mira la pantalla grande.";
      return show("vWait");
    }
    const box = $("resBox");
    if (me.lastCorrect) {
      box.className = "result ok";
      box.innerHTML = `<h2>¡Correcto!</h2><p style="font-size:1.4rem;margin-top:8px">+${me.lastPoints} puntos</p>`;
    } else {
      box.className = "result ko";
      box.innerHTML = `<h2>${me.lastAnswered ? "Incorrecto" : "¡Se acabó el tiempo!"}</h2><p style="margin-top:8px">La próxima es tuya</p>`;
    }
    $("rRank").textContent = me.rank ? `Vas en el puesto ${me.rank}` : "";
    return show("vRes");
  }
  if (game.state === "end") {
    $("waitMsg").textContent = me && me.rank ? `Puesto ${me.rank}` : "¡Fin!";
    $("waitSub").textContent = `Has terminado con ${me ? me.score : 0} puntos. Gracias por jugar en el Gran Hotel Alfil.`;
    localStorage.removeItem("aj_kahoot");
    return show("vWait");
  }
}

function showQuestion() {
  const qi = game.qIndex;
  const q = QUESTIONS[qi];
  if (!$("vQ").dataset.q || Number($("vQ").dataset.q) !== qi || $("vQ").classList.contains("hidden")) {
    shownAt = performance.now();
  }
  $("vQ").dataset.q = qi;
  $("qNum").textContent = `Pregunta ${qi + 1}/${QUESTIONS.length}`;
  $("qText").textContent = q.pregunta;
  $("qAnswers").innerHTML = q.respuestas.map((r, i) =>
    `<button class="ans c${i}" data-i="${i}"><span class="shape">${SHAPES[i]}</span><span>${esc(r)}</span></button>`).join("");
  $("qAnswers").querySelectorAll(".ans").forEach(b => (b.onclick = () => answer(qi, Number(b.dataset.i))));
  const dur = q.tiempo || 20;
  const tick = () => {
    const left = Math.max(0, Math.ceil(dur - (performance.now() - shownAt) / 1000));
    $("qTime").textContent = `${left}s`;
  };
  tick(); timerInt = setInterval(tick, 250);
  show("vQ");
}

async function answer(qi, choice) {
  if (answeredQ === qi) return;
  answeredQ = qi;
  const ms = Math.round(performance.now() - shownAt);
  localStorage.setItem(`aj_ans_${pin}_${qi}`, "1");
  clearInterval(timerInt);
  $("waitMsg").textContent = "Respuesta enviada";
  $("waitSub").textContent = "Esperando al resto de huéspedes…";
  show("vWait");
  try {
    await setDoc(doc(db, "games", pin, "answers", `${qi}_${playerId}`), { qIndex: qi, playerId, choice, ms, at: serverTimestamp() });
  } catch (e) {
    console.warn(e);
  }
}
