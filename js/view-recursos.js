// Vista de una materia (#/recursos/:materia/:pestana) con pestañas:
// Temario, Documentos, Vídeos, Formularios y Prácticas.
import { materiaPorId, TIPOS_RECURSO, PREGUNTAS_POR_PRACTICA } from "./config.js?v=20261022140330";
import { listar, obtener, where } from "./datos.js?v=20261022140330";
import { sesion, esStaff } from "./sesion.js?v=20261022140330";
import { esc, vacio, youtubeId, urlVistaPrevia, fechaCorta, etiquetaEjemplo, matematicas } from "./ui.js?v=20261022140330";

const PESTANAS = [
  { id: "temario", nombre: "Temario" },
  { id: "documentos", nombre: "Documentos" },
  { id: "videos", nombre: "Vídeos" },
  { id: "formularios", nombre: "Formularios" },
  { id: "practicas", nombre: "Prácticas" }
];

const pestanaDe = (tipo) => TIPOS_RECURSO.find((t) => t.id === tipo)?.pestana || "documentos";

export async function render(main, { materia, pestana = "temario" }) {
  const m = materiaPorId(materia);
  if (!m) {
    main.innerHTML = `<section class="proximamente contenedor"><h1>Esa materia no existe</h1><a class="btn" href="#/materias">Ver materias</a></section>`;
    return;
  }
  if (!PESTANAS.some((p) => p.id === pestana)) pestana = "temario";

  const [temario, recursos, reactivos, intentos] = await Promise.all([
    obtener("temarios", m.id),
    listar("recursos", where("materiaId", "==", m.id)),
    listar("reactivos", where("materiaId", "==", m.id)),
    sesion.user ? listar("intentos", where("uid", "==", sesion.user.uid)).catch(() => []) : Promise.resolve([])
  ]);
  recursos.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.titulo).localeCompare(b.titulo, "es"));
  const unidades = temario?.unidades || [];

  const porPestana = { temario: unidades.length, practicas: reactivos.length, documentos: 0, videos: 0, formularios: 0 };
  recursos.forEach((r) => porPestana[pestanaDe(r.tipo)]++);

  const ctx = { m, unidades, recursos, reactivos, intentos: intentos.filter((i) => i.materiaId === m.id) };
  const contenido = {
    temario: temarioHTML,
    documentos: documentosHTML,
    videos: videosHTML,
    formularios: formulariosHTML,
    practicas: practicasHTML
  }[pestana](ctx);

  main.innerHTML = `
    <header class="hoja">
      <div class="contenedor">
        <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><a href="#/materias">Materias</a><span>/</span><span>${esc(m.nombre)}</span></div>
        <div class="hoja__fila">
          <div><h1>${esc(m.nombre)}</h1><p>${esc(m.descripcion)}</p></div>
          <span class="sello" title="Código de área">${m.codigo}</span>
        </div>
        <nav class="pestanas" aria-label="Secciones de ${esc(m.nombre)}">
          ${PESTANAS.map(
            (p) => `<a href="#/recursos/${m.id}/${p.id}" ${p.id === pestana ? 'aria-current="page"' : ""}>${p.nombre}<span class="cuenta">${porPestana[p.id]}</span></a>`
          ).join("")}
        </nav>
      </div>
    </header>
    <section class="seccion"><div class="contenedor" id="panel-pestana">${contenido}</div></section>`;

  const panel = main.querySelector("#panel-pestana");
  matematicas(panel);

  // Vista previa de documentos y carga diferida de vídeos.
  panel.addEventListener("click", (e) => {
    const prev = e.target.closest("[data-previa]");
    if (prev) {
      const item = prev.closest(".recurso");
      const existente = item.querySelector(".visor");
      if (existente) {
        existente.remove();
        prev.textContent = "Vista previa";
        prev.setAttribute("aria-expanded", "false");
      } else {
        item.insertAdjacentHTML("beforeend", `<iframe class="visor" src="${esc(prev.dataset.previa)}" title="Vista previa del documento" loading="lazy"></iframe>`);
        prev.textContent = "Ocultar vista previa";
        prev.setAttribute("aria-expanded", "true");
      }
    }
    const vid = e.target.closest("[data-video]");
    if (vid) {
      vid.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vid.dataset.video)}?autoplay=1&rel=0" title="${esc(vid.getAttribute("aria-label"))}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
  });
}

function sinContenido(m, que) {
  const accion = esStaff() ? `<a class="btn" href="#/admin/recursos?materia=${m.id}">Agregar ${que}</a>` : "";
  return vacio(`Todavía no hay ${que} de ${m.nombre}`, "El departamento los irá agregando a lo largo del semestre.", accion);
}

function temarioHTML({ m, unidades, recursos }) {
  if (!unidades.length) {
    const accion = esStaff() ? `<a class="btn" href="#/admin/temarios?materia=${m.id}">Cargar temario</a>` : "";
    return vacio(`El temario de ${m.nombre} aún no está cargado`, "Mientras tanto puedes revisar documentos, vídeos y prácticas.", accion);
  }
  return `<ol class="temario">${unidades
    .map((u, i) => {
      const ligados = recursos.filter((r) => r.unidad === u.titulo);
      return `
      <li>
        <details class="unidad" ${i === 0 ? "open" : ""}>
          <summary><span class="unidad__num">UNIDAD ${i + 1}</span><span class="unidad__tit">${esc(u.titulo)}</span><span class="unidad__ind" aria-hidden="true">+</span></summary>
          <div class="unidad__cuerpo">
            ${u.temas?.length ? `<ul>${u.temas.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
            ${ligados.length ? `<div class="unidad__recursos">${ligados.map((r) => `<a class="tag" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.titulo)}</a>`).join("")}</div>` : ""}
          </div>
        </details>
      </li>`;
    })
    .join("")}</ol>`;
}

function filaRecurso(r, textoBoton) {
  const previa = r.tipo === "documento" ? urlVistaPrevia(r.url) : null;
  const tipo = TIPOS_RECURSO.find((t) => t.id === r.tipo)?.nombre.split(" (")[0] || "Recurso";
  return `
    <li class="recurso">
      <div>
        <span class="tag">${esc(tipo)}</span> ${r.unidad ? `<span class="tag tag--oro">${esc(r.unidad)}</span>` : ""} ${etiquetaEjemplo(r)}
        <h3>${esc(r.titulo)}</h3>
        ${r.descripcion ? `<p>${esc(r.descripcion)}</p>` : ""}
      </div>
      <div class="recurso__acciones">
        ${previa ? `<button type="button" class="btn btn--linea btn--peq" data-previa="${esc(previa)}" aria-expanded="false">Vista previa</button>` : ""}
        <a class="btn btn--peq" href="${esc(r.url)}" target="_blank" rel="noopener">${textoBoton}</a>
      </div>
    </li>`;
}

function documentosHTML({ m, recursos }) {
  const lista = recursos.filter((r) => pestanaDe(r.tipo) === "documentos");
  if (!lista.length) return sinContenido(m, "documentos");
  return `<ul class="recursos">${lista.map((r) => filaRecurso(r, r.tipo === "enlace" ? "Abrir enlace" : "Abrir documento")).join("")}</ul>`;
}

function formulariosHTML({ m, recursos }) {
  const lista = recursos.filter((r) => r.tipo === "formulario");
  if (!lista.length) return sinContenido(m, "formularios");
  return `<p class="muted">Los formularios se abren en una pestaña nueva (Google Forms o Microsoft Forms).</p><ul class="recursos">${lista.map((r) => filaRecurso(r, "Abrir formulario")).join("")}</ul>`;
}

function videosHTML({ m, recursos }) {
  const lista = recursos.filter((r) => r.tipo === "video");
  if (!lista.length) return sinContenido(m, "vídeos");
  return `<div class="videos">${lista
    .map((r) => {
      const id = youtubeId(r.url);
      const marco = id
        ? `<button type="button" data-video="${esc(id)}" aria-label="Reproducir: ${esc(r.titulo)}" style="background-image:url('https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg')"></button>`
        : "";
      return `
      <article class="video">
        ${id ? `<div class="video__marco">${marco}</div>` : ""}
        <div class="video__cuerpo">
          ${r.unidad ? `<span class="tag tag--oro">${esc(r.unidad)}</span> ` : ""}${etiquetaEjemplo(r)}
          <h3>${esc(r.titulo)}</h3>
          ${r.descripcion ? `<p>${esc(r.descripcion)}</p>` : ""}
          ${id ? "" : `<p><a href="${esc(r.url)}" target="_blank" rel="noopener">Ver vídeo</a></p>`}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function practicasHTML({ m, reactivos, intentos }) {
  if (!reactivos.length) {
    const accion = esStaff() ? `<a class="btn" href="#/admin/practica?materia=${m.id}">Agregar preguntas</a>` : "";
    return vacio(`Aún no hay preguntas de práctica de ${m.nombre}`, "", accion);
  }
  const temas = {};
  reactivos.forEach((r) => (temas[r.tema || "General"] = (temas[r.tema || "General"] || 0) + 1));
  const n = Math.min(PREGUNTAS_POR_PRACTICA, reactivos.length);
  const recientes = [...intentos].sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)).slice(0, 5);
  return `
    <div class="columnas columnas--31">
      <div class="tarjeta">
        <p class="etq">Práctica autogestiva</p>
        <h2>Pon a prueba lo que sabes</h2>
        <p class="muted">Cada práctica toma ${n} preguntas al azar. Al responder ves si acertaste y la explicación del procedimiento. Puedes repetirla las veces que quieras.</p>
        <div class="form__acciones"><a class="btn btn--oro" href="#/practica/${m.id}">Empezar práctica de ${esc(m.nombre)}</a></div>
        <h3 style="margin-top:32px">Por tema</h3>
        <ul class="recursos">${Object.entries(temas)
          .sort((a, b) => a[0].localeCompare(b[0], "es"))
          .map(
            ([t, c]) => `<li class="recurso"><div><h3>${esc(t)}</h3><p>${c} ${c === 1 ? "pregunta" : "preguntas"}</p></div><div class="recurso__acciones"><a class="btn btn--linea btn--peq" href="#/practica/${m.id}?tema=${encodeURIComponent(t)}">Practicar este tema</a></div></li>`
          )
          .join("")}</ul>
      </div>
      <div class="tarjeta">
        <p class="etq">Tu historial</p>
        ${
          !sesion.user
            ? `<p class="muted">Inicia sesión para guardar tus resultados y ver tu avance.</p><a class="btn btn--linea" href="#/ingresar?next=${encodeURIComponent("recursos/" + m.id + "/practicas")}">Iniciar sesión</a>`
            : recientes.length
            ? `<ul class="fechas">${recientes
                .map((i) => `<li class="fecha" style="grid-template-columns:1fr auto"><div><h3>${esc(i.tema || "Todos los temas")}</h3><p>${esc(fechaCorta(i.fecha))}</p></div><b class="mono">${i.aciertos}/${i.total}</b></li>`)
                .join("")}</ul>`
            : `<p class="muted">Todavía no tienes prácticas de ${esc(m.nombre)}. Tus resultados aparecerán aquí.</p>`
        }
      </div>
    </div>`;
}
