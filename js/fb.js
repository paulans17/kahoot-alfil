import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, collection, setDoc, getDoc, updateDoc, onSnapshot,
  query, where, writeBatch, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js?v=3";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, collection, setDoc, getDoc, updateDoc, onSnapshot, query, where, writeBatch, serverTimestamp, getDocs };

export const SHAPES = ["▲", "◆", "●", "■"];

export function points(ms, durationS) {
  const t = Math.min(Math.max(ms / (durationS * 1000), 0), 1);
  return Math.round(1000 * (1 - t / 2));
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
