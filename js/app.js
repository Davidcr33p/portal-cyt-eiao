// Arranque, barra de navegación y enrutador por hash (#/ruta). GitHub Pages
// no permite reescrituras de URL, por eso todas las páginas viven en
// index.html y la ruta va después del "#".
import { sesion, iniciar, alCambiar, salir, esStaff, nombreCompleto } from "./sesion.js?v=20261022140330";
import { esc, toast, cargando, mensajeError, ir } from "./ui.js?v=20261022140330";
import * as inicio from "./view-inicio.js?v=20261022140330";
import * as recursos from "./view-recursos.js?v=20261022140330";
import * as calendario from "./view-calendario.js?v=20261022140330";
import * as cuenta from "./view-cuenta.js?v=20261022140330";
import * as panel from "./view-panel.js?v=20261022140330";
import * as practica from "./view-practica.js?v=20261022140330";
import * as concursos from "./view-concursos.js?v=20261022140330";
import * as validar from "./view-validar.js?v=20261022140330";
import * as admin from "./view-admin.js?v=20261022140330";
import * as foros from "./view-foros.js?v=20261022140330";

// [patrón, vista, sección de la barra]
const RUTAS = [
  ["", inicio.inicio, ""],
  ["materias", inicio.materias, "materias"],
  ["recursos/:materia/:pestana?", recursos.render, "materias"],
  ["practica/:materia", practica.render, "materias"],
  ["calendario", calendario.render, "calendario"],
  ["concursos", concursos.catalogo, "concursos"],
  ["concursos/:id", concursos.sala, "concursos"],
  ["concursos/:id/examen", concursos.examen, "concursos"],
  ["concursos/:id/resultados", concursos.resultados, "concursos"],
  ["validar/:codigo?", validar.render, ""],
  ["ingresar", cuenta.ingresar, ""],
  ["registro", cuenta.registro, ""],
  ["recuperar", cuenta.recuperar, ""],
  ["verificar", cuenta.verificar, ""],
  ["panel", panel.render, ""],
  ["admin/:seccion?/:id?", admin.render, ""],
  ["foros", foros.render, "foros"]
];

const main = document.getElementById("contenido");
let limpiar = null;
let turno = 0;

function coincidir(partes) {
  for (const [patron, vista, nav] of RUTAS) {
    const p = patron ? patron.split("/") : [];
    const obligatorias = p.filter((x) => !x.endsWith("?")).length;
    if (partes.length < obligatorias || partes.length > p.length) continue;
    const params = {};
    let ok = true;
    p.forEach((seg, i) => {
      const valor = partes[i];
      if (seg.startsWith(":")) {
        if (valor !== undefined) params[seg.replace(/[:?]/g, "")] = decodeURIComponent(valor);
      } else if (seg !== valor) ok = false;
    });
    if (ok) return { vista, nav, params };
  }
  return null;
}

function leerRuta() {
  const crudo = location.hash.replace(/^#\/?/, "");
  const [camino, consulta = ""] = crudo.split("?");
  return { partes: camino.split("/").filter(Boolean), query: Object.fromEntries(new URLSearchParams(consulta)) };
}

async function mostrar() {
  if (typeof limpiar === "function") limpiar();
  limpiar = null;
  const { partes, query } = leerRuta();
  const r = coincidir(partes);
  const mio = ++turno;
  marcarNav(r?.nav ?? "");
  cerrarMenu();
  if (!r) {
    main.innerHTML = `<section class="proximamente contenedor"><p class="etq">Error 404</p><h1>Esta página no existe</h1><p class="muted">Revisa la dirección o vuelve al inicio.</p><a class="btn" href="#/">Ir al inicio</a></section>`;
    return;
  }
  main.innerHTML = cargando();
  try {
    const resultado = await r.vista(main, r.params, query);
    // Si el usuario navegó a otra parte mientras cargaba, se descarta.
    if (mio !== turno) {
      if (typeof resultado === "function") resultado();
      return;
    }
    limpiar = resultado;
  } catch (err) {
    console.error(err);
    if (mio !== turno) return;
    main.innerHTML = `<section class="proximamente contenedor"><p class="etq">Error</p><h1>No se pudo cargar esta página</h1><p class="muted">${esc(mensajeError(err))}</p><button class="btn" type="button" onclick="location.reload()">Volver a intentar</button></section>`;
  }
  if (!partes.length || !document.activeElement || document.activeElement === document.body) window.scrollTo(0, 0);
}

function marcarNav(seccion) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === seccion) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

const nav = document.getElementById("nav-principal");
const botonMenu = document.querySelector(".barra__menu");
function cerrarMenu() {
  nav.classList.remove("abierta");
  botonMenu.setAttribute("aria-expanded", "false");
}
botonMenu.addEventListener("click", () => {
  const abierta = nav.classList.toggle("abierta");
  botonMenu.setAttribute("aria-expanded", String(abierta));
});

function pintarSesion() {
  const el = document.getElementById("nav-sesion");
  if (!sesion.user) {
    el.innerHTML = `<a href="#/ingresar">Iniciar sesión</a><a class="btn btn--oro btn--peq" href="#/registro">Crear cuenta</a>`;
  } else {
    const nombre = sesion.perfil?.nombre || nombreCompleto() || sesion.user.email;
    el.innerHTML = `
      <a href="#/panel">Mi panel</a>
      ${esStaff() ? '<a href="#/admin">Administrar</a>' : ""}
      <span class="nav__usuario">${esc(nombre)}</span>
      <button type="button" class="enlace-btn" data-salir>Salir</button>`;
    el.querySelector("[data-salir]").addEventListener("click", async () => {
      await salir();
      toast("Cerraste sesión.");
      ir("");
    });
  }
  const franja = document.getElementById("aviso-verificacion");
  if (sesion.user && !sesion.user.emailVerified) {
    franja.innerHTML = `<div class="franja__in">Confirma tu correo para inscribirte a concursos y guardar tu progreso. <a href="#/verificar">Cómo verificar mi cuenta</a></div>`;
    franja.hidden = false;
  } else franja.hidden = true;
}

window.addEventListener("hashchange", mostrar);

(async () => {
  await iniciar();
  pintarSesion();
  alCambiar(() => {
    pintarSesion();
    mostrar();
  });
  mostrar();
})();
