// Inicio (#/) y catálogo de materias (#/materias).
import { MATERIAS, materiaPorId, areaPorId } from "./config.js?v=20261022132627";
import { listar, contar, where, orderBy, limit, concursosPublicados, estadoConcurso } from "./datos.js?v=20261022132627";
import { sesion } from "./sesion.js?v=20261022132627";
import { esc, vacio, fechaCorta, hora, mesCorto, aFecha, partesTiempo, dos, etiquetaEjemplo } from "./ui.js?v=20261022132627";

// Cuántos recursos y reactivos de práctica tiene cada materia.
async function conteos() {
  const pares = await Promise.all(
    MATERIAS.map(async (m) => {
      const [rec, pre] = await Promise.all([
        contar("recursos", where("materiaId", "==", m.id)).catch(() => null),
        contar("reactivos", where("materiaId", "==", m.id)).catch(() => null)
      ]);
      return [m.id, { recursos: rec, reactivos: pre }];
    })
  );
  return Object.fromEntries(pares);
}

export function areasHTML(cuentas = {}) {
  return `<div class="areas">${MATERIAS.map((m) => {
    const c = cuentas[m.id] || {};
    const meta =
      c.recursos == null
        ? `<span>${esc(m.descripcion)}</span>`
        : `<span><b>${c.recursos}</b> recursos</span><span><b>${c.reactivos}</b> preguntas de práctica</span>`;
    return `
      <a class="area" href="#/recursos/${m.id}">
        <span class="area__cod">${m.codigo}</span>
        <span class="area__ico">${m.icono}</span>
        <h3>${esc(m.nombre)}</h3>
        <span class="area__meta">${meta}</span>
      </a>`;
  }).join("")}</div>`;
}

export function fechasHTML(eventos, { pasados = false } = {}) {
  const ahora = Date.now();
  return `<ul class="fechas">${eventos.map((e) => {
    const ini = aFecha(e.fechaInicio);
    const fin = aFecha(e.fechaFin);
    const area = areaPorId(e.area);
    const rango = fin && fechaCorta(fin) !== fechaCorta(ini) ? `${fechaCorta(ini)} – ${fechaCorta(fin)}` : `${fechaCorta(ini)}${e.conHora ? ", " + hora(ini) : ""}`;
    const fue = pasados && (fin || ini) && (fin || ini).getTime() < ahora;
    return `
      <li class="fecha${fue ? " pasado" : ""}">
        <div class="fecha__dia" aria-hidden="true"><span>${esc(mesCorto(ini))}</span><b>${ini ? ini.getDate() : "—"}</b></div>
        <div>
          <div class="fecha__tags"><span class="tag">${esc(e.tipo || "Fecha")}</span><span class="tag tag--oro">${esc(area.nombre)}</span>${etiquetaEjemplo(e)}</div>
          <h3>${esc(e.titulo)}</h3>
          <p>${esc(rango)}${e.lugar ? " · " + esc(e.lugar) : ""}</p>
          ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ""}
          ${e.enlace ? `<p><a href="${esc(e.enlace)}" target="_blank" rel="noopener">Ver bases o detalles</a></p>` : ""}
        </div>
      </li>`;
  }).join("")}</ul>`;
}

export function avisosHTML(avisos) {
  return avisos
    .map(
      (a) => `
      <article class="aviso">
        <span class="aviso__fecha">${esc(fechaCorta(a.fecha))}</span>${a.fijado ? '<span class="fijado">Fijado</span>' : ""} ${etiquetaEjemplo(a)}
        <h3>${esc(a.titulo)}</h3>
        <p>${esc(a.cuerpo)}</p>
      </article>`
    )
    .join("");
}

function cajetinHTML(c) {
  if (!c) {
    return `
      <aside class="cajetin cajetin--vacio" aria-label="Próximo concurso">
        <div class="cajetin__titulo"><span class="cajetin__rot">Próximo concurso</span><strong>Sin concursos programados por ahora</strong></div>
        <div class="cajetin__codigo"><span class="cajetin__rot">Área</span><b>CYT</b></div>
        <div class="cajetin__pie"><span>Las convocatorias se publican en el calendario.</span><a class="btn btn--linea btn--peq" href="#/calendario">Ver calendario</a></div>
      </aside>`;
  }
  const m = materiaPorId(c.area);
  const est = estadoConcurso(c);
  return `
    <aside class="cajetin" aria-label="Próximo concurso">
      <div class="cajetin__titulo"><span class="cajetin__rot">${est.id === "curso" ? "Concurso en curso" : "Próximo concurso"}</span><strong>${esc(c.titulo)}</strong></div>
      <div class="cajetin__codigo"><span class="cajetin__rot">Área</span><b>${m ? m.codigo : "CYT"}</b></div>
      <div><span class="cajetin__rot">Fecha</span>${esc(fechaCorta(c.inicio))}</div>
      <div class="cajetin__codigo"><span class="cajetin__rot">Hora</span>${esc(hora(c.inicio))}</div>
      <div class="cajetin__cuenta" data-cuenta="${aFecha(est.id === "curso" ? c.fin : c.inicio).getTime()}" aria-live="off">
        <div><b data-d>--</b><span class="cajetin__rot">días</span></div>
        <div><b data-h>--</b><span class="cajetin__rot">horas</span></div>
        <div><b data-m>--</b><span class="cajetin__rot">min</span></div>
        <div><b data-s>--</b><span class="cajetin__rot">seg</span></div>
      </div>
      <div class="cajetin__pie"><span>${est.id === "curso" ? "Termina en el tiempo indicado" : esc(est.texto)}</span><a class="btn btn--oro btn--peq" href="#/concursos/${c.id}">Ver concurso</a></div>
    </aside>`;
}

function arrancarCuenta(raiz) {
  const el = raiz.querySelector("[data-cuenta]");
  if (!el) return null;
  const meta = Number(el.dataset.cuenta);
  const pintar = () => {
    const t = partesTiempo(meta - Date.now());
    el.querySelector("[data-d]").textContent = t.d;
    el.querySelector("[data-h]").textContent = dos(t.h);
    el.querySelector("[data-m]").textContent = dos(t.m);
    el.querySelector("[data-s]").textContent = dos(t.s);
  };
  pintar();
  const id = setInterval(pintar, 1000);
  return () => clearInterval(id);
}

export async function inicio(main) {
  const ahora = Date.now();
  const [cuentas, avisos, eventos, concursos] = await Promise.all([
    conteos(),
    listar("avisos", orderBy("fecha", "desc"), limit(6)).catch(() => []),
    listar("eventos").catch(() => []),
    concursosPublicados().catch(() => [])
  ]);
  const proximo = concursos.find((c) => (c.fin?.toMillis?.() ?? 0) >= ahora) || null;
  const avisosOrden = [...avisos].sort((a, b) => (b.fijado ? 1 : 0) - (a.fijado ? 1 : 0)).slice(0, 4);
  const proximas = eventos
    .filter((e) => (aFecha(e.fechaFin) || aFecha(e.fechaInicio))?.getTime() >= ahora - 86400000)
    .sort((a, b) => aFecha(a.fechaInicio) - aFecha(b.fechaInicio))
    .slice(0, 5);

  const acciones = sesion.user
    ? `<a class="btn btn--oro" href="#/materias">Explorar materias</a><a class="btn btn--linea" href="#/panel">Ir a mi panel</a>`
    : `<a class="btn btn--oro" href="#/materias">Explorar materias</a><a class="btn btn--linea" href="#/registro">Crear cuenta</a>`;

  main.innerHTML = `
    <section class="hero">
      <div class="hero__in">
        <div>
          <p class="etq">Departamento de Ciencia y Tecnología · EIAO · UANL</p>
          <h1>Estudia, practica y <em>compite.</em></h1>
          <p class="hero__sub">Temarios, documentos, vídeos y prácticas con retroalimentación de seis áreas, más los concursos internos de la prepa con resultados y constancias.</p>
          <div class="hero__acciones">${acciones}</div>
        </div>
        ${cajetinHTML(proximo)}
      </div>
    </section>

    <section class="seccion">
      <div class="contenedor">
        <div class="seccion__cab">
          <div><p class="etq">Áreas académicas</p><h2>Elige una materia</h2></div>
        </div>
        <p class="cota cota--ancho" aria-hidden="true">6 áreas</p>
        ${areasHTML(cuentas)}
      </div>
    </section>

    <section class="seccion">
      <div class="contenedor columnas columnas--2">
        <div class="tarjeta">
          <div class="seccion__cab"><div><p class="etq">Departamento</p><h2>Avisos</h2></div></div>
          ${avisosOrden.length ? avisosHTML(avisosOrden) : vacio("Sin avisos por ahora", "Aquí aparecerán los comunicados del departamento.")}
        </div>
        <div class="tarjeta">
          <div class="seccion__cab"><div><p class="etq">Calendario</p><h2>Próximas fechas</h2></div><a href="#/calendario">Ver calendario completo</a></div>
          ${proximas.length ? fechasHTML(proximas) : vacio("No hay fechas próximas", "Las convocatorias y etapas de concursos se publican aquí.")}
        </div>
      </div>
    </section>`;

  return arrancarCuenta(main);
}

export async function materias(main) {
  const cuentas = await conteos();
  main.innerHTML = `
    <header class="hoja">
      <div class="contenedor">
        <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Materias</span></div>
        <h1>Materias</h1>
        <p>Cada área reúne su temario, documentos, vídeos, formularios y prácticas autogestivas con retroalimentación inmediata.</p>
      </div>
    </header>
    <section class="seccion"><div class="contenedor">${areasHTML(cuentas)}</div></section>`;
}
