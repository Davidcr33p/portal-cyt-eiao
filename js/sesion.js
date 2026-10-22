// Sesión: cuenta de Firebase Auth + perfil en usuarios/{uid} + rol efectivo.
import { auth } from "./firebase.js?v=20261022132627";
import { DOMINIO_INSTITUCIONAL, ADMIN_EMAILS } from "./config.js?v=20261022132627";
import { obtener, guardar, serverTimestamp } from "./datos.js?v=20261022132627";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const sesion = { user: null, perfil: null, rol: null, listo: false };
const oyentes = new Set();
// Durante el registro no se re-dibuja la página a medias: se avisa al final.
let pausado = false;

export const alCambiar = (fn) => oyentes.add(fn);
const avisar = () => oyentes.forEach((fn) => fn(sesion));

export function emailInstitucional(email) {
  return email.toLowerCase().trim().endsWith(DOMINIO_INSTITUCIONAL);
}

function calcularRol() {
  const u = sesion.user;
  if (!u) return null;
  if (u.emailVerified && ADMIN_EMAILS.includes(u.email.toLowerCase())) return "admin";
  return sesion.perfil?.rol || "alumno";
}

export const verificado = () => !!sesion.user?.emailVerified;
export const esStaff = () => verificado() && ["docente", "admin"].includes(sesion.rol);
export const esAdmin = () => verificado() && sesion.rol === "admin";

export function nombreCompleto(p = sesion.perfil) {
  return p ? `${p.nombre || ""} ${p.apellidos || ""}`.trim() : sesion.user?.displayName || "";
}

async function cargarPerfil() {
  sesion.perfil = sesion.user ? await obtener("usuarios", sesion.user.uid).catch(() => null) : null;
  sesion.rol = calcularRol();
}

export function iniciar() {
  return new Promise((resolver) => {
    onAuthStateChanged(auth, async (user) => {
      sesion.user = user;
      await cargarPerfil();
      const primera = !sesion.listo;
      sesion.listo = true;
      if (primera) resolver(sesion);
      else if (!pausado) avisar();
    });
  });
}

export async function recargarSesion() {
  if (auth.currentUser) await auth.currentUser.reload();
  sesion.user = auth.currentUser;
  // El token debe refrescarse para que las reglas vean email_verified.
  if (sesion.user) await sesion.user.getIdToken(true);
  await cargarPerfil();
  avisar();
}

export async function registrar(datos) {
  const correo = datos.email.trim().toLowerCase();
  if (!emailInstitucional(correo)) throw new Error(`Usa tu correo institucional (${DOMINIO_INSTITUCIONAL}).`);
  pausado = true;
  try {
    return await crearCuenta(correo, datos);
  } finally {
    pausado = false;
  }
}

async function crearCuenta(correo, datos) {
  const cred = await createUserWithEmailAndPassword(auth, correo, datos.password);
  await updateProfile(cred.user, { displayName: `${datos.nombre} ${datos.apellidos}`.trim() });
  const perfil = {
    nombre: datos.nombre.trim(),
    apellidos: datos.apellidos.trim(),
    matricula: datos.matricula.trim(),
    email: correo,
    plantel: datos.plantel,
    tipo: datos.tipo,
    solicitaDocente: datos.tipo === "docente",
    rol: "alumno",
    creadoEn: serverTimestamp()
  };
  if (datos.tipo === "alumno") {
    Object.assign(perfil, { semestre: datos.semestre, carrera: datos.carrera, grupo: datos.grupo.trim() });
  }
  await guardar("usuarios", cred.user.uid, perfil, { merge: false });
  await sendEmailVerification(cred.user);
  sesion.user = cred.user;
  await cargarPerfil();
  avisar();
  return cred.user;
}

export async function actualizarPerfil(cambios) {
  await guardar("usuarios", sesion.user.uid, cambios);
  await cargarPerfil();
  avisar();
}

export const ingresar = (email, password) => signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
export const salir = () => signOut(auth);
export const reenviarVerificacion = () => auth.currentUser && sendEmailVerification(auth.currentUser);
export const recuperarContrasena = (email) => sendPasswordResetEmail(auth, email.trim().toLowerCase());
