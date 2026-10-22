// Utilidades de interfaz compartidas por todas las vistas.

export function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Navega a una ruta del sitio ("panel", "concursos/abc"...). Si ya está
// ahí, vuelve a dibujar la página.
export function ir(ruta) {
  const destino = "#/" + ruta.replace(/^#?\/?/, "");
  if (location.hash === destino) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = destino;
}

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// Texto con formato mínimo: saltos de línea, **negritas**, `código` y
// fórmulas entre $...$ (las renderiza KaTeX después con matematicas()).
export function rico(texto) {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// Renderiza fórmulas KaTeX dentro de un elemento. KaTeX se carga con
// "defer", así que si todavía no está listo se reintenta al cargar.
export function matematicas(el) {
  if (!el) return;
  const aplicar = () =>
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  if (window.renderMathInElement) aplicar();
  else window.addEventListener("load", () => window.renderMathInElement && aplicar(), { once: true });
}

let toastTimer;
export function toast(mensaje, tipo = "ok") {
  const el = document.getElementById("toast");
  el.textContent = mensaje;
  el.className = "toast" + (tipo === "error" ? " toast--bad" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4200);
}

// Convierte Timestamp de Firestore, Date, número o texto a Date.
export function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);
  const d = new Date(valor);
  return isNaN(d) ? null : d;
}

const fmt = (opciones) => new Intl.DateTimeFormat("es-MX", opciones);
const fFecha = fmt({ day: "numeric", month: "short", year: "numeric" });
const fFechaLarga = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fHora = fmt({ hour: "2-digit", minute: "2-digit" });
const fMes = fmt({ month: "long", year: "numeric" });
const fMesCorto = fmt({ month: "short" });

export const fechaCorta = (v) => (aFecha(v) ? fFecha.format(aFecha(v)) : "");
export const fechaLarga = (v) => (aFecha(v) ? fFechaLarga.format(aFecha(v)) : "");
export const hora = (v) => (aFecha(v) ? fHora.format(aFecha(v)) : "");
export const fechaHora = (v) => (aFecha(v) ? `${fFecha.format(aFecha(v))}, ${fHora.format(aFecha(v))}` : "");
export const mes = (v) => (aFecha(v) ? fMes.format(aFecha(v)) : "");
export const mesCorto = (v) => (aFecha(v) ? fMesCorto.format(aFecha(v)).replace(".", "") : "");

// Valor para <input type="datetime-local"> en hora local.
export function aInputFecha(valor) {
  const d = aFecha(valor);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Partes de una cuenta regresiva.
export function partesTiempo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export const dos = (n) => String(n).padStart(2, "0");

export function duracion(seg) {
  if (seg == null || isNaN(seg)) return "—";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m} min ${dos(s)} s`;
}

export function vacio(titulo, texto = "", accion = "") {
  return `<div class="vacio"><strong>${esc(titulo)}</strong>${texto ? `<p>${esc(texto)}</p>` : ""}${accion}</div>`;
}

export const cargando = (texto = "Cargando") => `<div class="cargando">${esc(texto)}…</div>`;

export const etiquetaEjemplo = (item) => (item && item.ejemplo ? '<span class="tag tag--ejemplo">Ejemplo</span>' : "");

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (u.hostname.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch (_) { /* URL inválida */ }
  return null;
}

// URL que se puede mostrar en un <iframe> de vista previa, si existe.
export function urlVistaPrevia(url) {
  try {
    const u = new URL(url);
    const drive = u.hostname === "drive.google.com" && u.pathname.match(/\/file\/d\/([^/]+)/);
    if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
    const docs = u.hostname === "docs.google.com" && u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
    if (docs) return `https://docs.google.com/${docs[1]}/d/${docs[2]}/preview`;
    if (u.pathname.toLowerCase().endsWith(".pdf")) return url;
  } catch (_) { /* URL inválida */ }
  return null;
}

export function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LETRAS = ["A", "B", "C", "D", "E", "F"];

// Código legible para constancias: sin 0/O ni 1/I para evitar confusiones.
export function codigoConstancia() {
  const abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const c = [...bytes].map((b) => abc[b % abc.length]).join("");
  return `CYT-${c.slice(0, 4)}-${c.slice(4)}`;
}

export function descargarCSV(nombreArchivo, filas) {
  const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombreArchivo });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const scriptsCargados = new Map();
export function cargarScript(src) {
  if (!scriptsCargados.has(src)) {
    scriptsCargados.set(
      src,
      new Promise((ok, falla) => {
        const s = Object.assign(document.createElement("script"), { src, async: true });
        s.onload = ok;
        s.onerror = () => {
          scriptsCargados.delete(src);
          falla(new Error("No se pudo cargar " + src));
        };
        document.head.appendChild(s);
      })
    );
  }
  return scriptsCargados.get(src);
}

// Mensaje entendible para errores comunes de Firebase.
export function mensajeError(err) {
  const c = err?.code || "";
  const mapa = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No hay una cuenta con ese correo.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
    "auth/network-request-failed": "Sin conexión con el servidor. Revisa tu internet.",
    "permission-denied": "No tienes permiso para esta acción.",
    "unavailable": "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo."
  };
  return mapa[c] || err?.message || "Ocurrió un error inesperado.";
}

// Diálogo modal reutilizable. Devuelve el <dialog> ya abierto.
export function abrirDialogo(titulo, cuerpoHTML) {
  const d = document.createElement("dialog");
  d.className = "dialogo";
  d.innerHTML = `
    <div class="dialogo__cab"><h2>${esc(titulo)}</h2><button type="button" class="btn btn--linea btn--peq" data-cerrar>Cerrar</button></div>
    <div class="dialogo__cuerpo">${cuerpoHTML}</div>`;
  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  d.querySelector("[data-cerrar]").addEventListener("click", () => d.close());
  d.showModal();
  return d;
}
