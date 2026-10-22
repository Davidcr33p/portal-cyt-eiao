// Acceso a Firestore. Todas las consultas usan índices de un solo campo
// (automáticos) para no tener que administrar índices compuestos; los
// ordenamientos combinados se hacen en el navegador.
import { db } from "./firebase.js?v=20261022140330";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getCountFromServer,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { db, doc, collection, query, where, orderBy, limit, serverTimestamp, Timestamp, writeBatch, deleteField };

const conId = (snap) => ({ id: snap.id, ...snap.data() });

// ruta: "avisos" o ["concursos", id, "preguntas"]
const ref = (ruta) => (Array.isArray(ruta) ? collection(db, ...ruta) : collection(db, ruta));

export async function listar(ruta, ...restricciones) {
  const snap = await getDocs(restricciones.length ? query(ref(ruta), ...restricciones) : ref(ruta));
  return snap.docs.map(conId);
}

export async function obtener(ruta, id) {
  const r = Array.isArray(ruta) ? doc(db, ...ruta, id) : doc(db, ruta, id);
  const snap = await getDoc(r);
  return snap.exists() ? conId(snap) : null;
}

// Crea (sin id) o reemplaza/combina (con id) un documento.
export async function guardar(ruta, id, datos, { merge = true } = {}) {
  if (!id) {
    const r = await addDoc(ref(ruta), datos);
    return r.id;
  }
  const r = Array.isArray(ruta) ? doc(db, ...ruta, id) : doc(db, ruta, id);
  await setDoc(r, datos, { merge });
  return id;
}

export async function actualizar(ruta, id, datos) {
  const r = Array.isArray(ruta) ? doc(db, ...ruta, id) : doc(db, ruta, id);
  await updateDoc(r, datos);
}

export async function borrar(ruta, id) {
  const r = Array.isArray(ruta) ? doc(db, ...ruta, id) : doc(db, ruta, id);
  await deleteDoc(r);
}

export async function contar(ruta, ...restricciones) {
  const snap = await getCountFromServer(restricciones.length ? query(ref(ruta), ...restricciones) : ref(ruta));
  return snap.data().count;
}

// Ordena por nombre en español, sin importar acentos.
export const porNombre = (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");

// Catálogos de registro (planteles y carreras técnicas), con caché.
let catalogos = null;
export async function obtenerCatalogos(forzar = false) {
  if (!catalogos || forzar) {
    const [planteles, carreras] = await Promise.all([listar("planteles"), listar("carreras")]);
    catalogos = { planteles: planteles.sort(porNombre), carreras: carreras.sort(porNombre) };
  }
  return catalogos;
}

// Concursos visibles para alumnos (publicados), ordenados por inicio.
export async function concursosPublicados() {
  const lista = await listar("concursos", where("publicado", "==", true));
  return lista.sort((a, b) => (a.inicio?.seconds || 0) - (b.inicio?.seconds || 0));
}

// Estado de un concurso según la hora actual.
export function estadoConcurso(c, ahora = Date.now()) {
  const ini = c.inicio?.toMillis?.() ?? 0;
  const fin = c.fin?.toMillis?.() ?? 0;
  if (ahora < ini) return { id: "proximo", texto: "Inscripciones abiertas", clase: "tag--oro" };
  if (ahora <= fin) return { id: "curso", texto: "En curso", clase: "tag--ok" };
  if (c.resultadosPublicados) return { id: "resultados", texto: "Resultados publicados", clase: "" };
  return { id: "cerrado", texto: "En revisión", clase: "" };
}
