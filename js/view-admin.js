// Administración (#/admin/:seccion): contenido para docentes y admins;
// usuarios y catálogos solo para admins. Las reglas de Firestore aplican
// los mismos permisos del lado del servidor.
import { MATERIAS, AREAS, TIPOS_RECURSO, TIPOS_EVENTO, materiaPorId } from "./config.js?v=20261022132627";
import { listar, obtener, guardar, actualizar, borrar, where, Timestamp, serverTimestamp, porNombre, obtenerCatalogos } from "./datos.js?v=20261022132627";
import { sesion, esStaff, esAdmin } from "./sesion.js?v=20261022132627";
import { esc, rico, matematicas, vacio, cargando, toast, mensajeError, abrirDialogo, aInputFecha, fechaCorta, fechaHora, descargarCSV, ir, LETRAS } from "./ui.js?v=20261022132627";
import * as adminConcursos from "./admin-concursos.js?v=20261022132627";

const SECCIONES = [
  { id: "recursos", nombre: "Recursos", render: seccionRecursos },
  { id: "temarios", nombre: "Temarios", render: seccionTemarios },
  { id: "practica", nombre: "Banco de práctica", render: seccionPractica },
  { id: "avisos", nombre: "Avisos", render: seccionAvisos },
  { id: "calendario", nombre: "Calendario", render: seccionCalendario },
  { id: "concursos", nombre: "Concursos", render: adminConcursos.render },
  { id: "usuarios", nombre: "Usuarios", soloAdmin: true, render: seccionUsuarios },
  { id: "catalogos", nombre: "Planteles y carreras", soloAdmin: true, render: seccionCatalogos }
];

export async function render(main, { seccion = "recursos", id }, query) {
  if (!sesion.user) return ir("ingresar?next=admin");
  if (!esStaff()) {
    main.innerHTML = `<section class="proximamente contenedor"><p class="etq">Sin permiso</p><h1>Esta sección es para docentes y administradores</h1><p class="muted">${
      sesion.user.emailVerified ? "Si eres docente, pide al departamento que apruebe tu cuenta." : "Primero confirma tu correo institucional."
    }</p><a class="btn" href="#/panel">Ir a mi panel</a></section>`;
    return;
  }
  const visibles = SECCIONES.filter((s) => !s.soloAdmin || esAdmin());
  const actual = visibles.find((s) => s.id === seccion) || visibles[0];

  main.innerHTML = `
    <header class="hoja"><div class="contenedor">
      <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Administración</span></div>
      <div class="hoja__fila"><div><h1>Administración</h1><p>Lo que guardes aquí se publica de inmediato en el portal.</p></div><span class="sello">${esAdmin() ? "ADMIN" : "DOCENTE"}</span></div>
    </div></header>
    <div class="contenedor admin">
      <nav class="admin__nav" aria-label="Secciones de administración">
        ${visibles.map((s) => `<a href="#/admin/${s.id}" ${s.id === actual.id ? 'aria-current="page"' : ""}>${s.nombre}</a>`).join("")}
      </nav>
      <div id="admin-contenido"></div>
    </div>`;
  return actual.render(main.querySelector("#admin-contenido"), { id, query });
}

/* ---------------------------------------------------------------------------
   Formularios genéricos
   ------------------------------------------------------------------------ */
export function campoHTML(c, v) {
  const req = c.req ? "required" : "";
  const ayuda = c.ayuda ? `<small>${esc(c.ayuda)}</small>` : "";
  const clase = "campo" + (c.ancho ? " ancho-completo" : "");
  let control;
  switch (c.tipo) {
    case "textarea":
      control = `<textarea name="${c.n}" rows="${c.filas || 4}" ${req}>${esc(v ?? "")}</textarea>`;
      break;
    case "select": {
      const ops = typeof c.opciones === "function" ? c.opciones() : c.opciones;
      const sel = String(v ?? c.def ?? "");
      control = `<select name="${c.n}" ${req}>${ops.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === sel ? "selected" : ""}>${esc(o.t)}</option>`).join("")}</select>`;
      break;
    }
    case "checkbox":
      return `<label class="${clase}" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="${c.n}" ${v ? "checked" : ""}><span>${esc(c.t)}</span>${ayuda}</label>`;
    case "datetime":
      control = `<input type="datetime-local" name="${c.n}" value="${aInputFecha(v)}" ${req}>`;
      break;
    case "date":
      control = `<input type="date" name="${c.n}" value="${aInputFecha(v).slice(0, 10)}" ${req}>`;
      break;
    case "opciones": {
      const ops = v?.opciones || ["", "", "", ""];
      while (ops.length < 4) ops.push("");
      control = `<div class="editor-opciones">${ops
        .map(
          (o, i) => `<label><input type="radio" name="correcta" value="${i}" ${Number(v?.correcta) === i ? "checked" : ""} aria-label="Marcar ${LETRAS[i]} como correcta"><input type="text" name="opcion${i}" value="${esc(o)}" placeholder="Opción ${LETRAS[i]}${i > 1 ? " (opcional)" : ""}"></label>`
        )
        .join("")}</div>`;
      break;
    }
    default:
      control = `<input type="${c.tipo || "text"}" name="${c.n}" value="${esc(v ?? "")}" ${req} ${c.lista ? `list="dl-${c.n}"` : ""} ${c.ph ? `placeholder="${esc(c.ph)}"` : ""}>${
        c.lista ? `<datalist id="dl-${c.n}">${c.lista.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>` : ""
      }`;
  }
  return `<label class="${clase}"><span>${esc(c.t)}${c.req ? "" : ' <span class="muted">(opcional)</span>'}</span>${control}${ayuda}</label>`;
}

export function leerCampos(form, campos) {
  const out = {};
  for (const c of campos) {
    if (c.tipo === "opciones") {
      const ops = [0, 1, 2, 3].map((i) => form.elements["opcion" + i].value.trim());
      const marcada = form.querySelector("[name=correcta]:checked");
      // Se quitan las opciones vacías conservando cuál es la correcta.
      const correctaTexto = marcada ? ops[Number(marcada.value)] : "";
      const opciones = ops.filter(Boolean);
      out.opciones = opciones;
      out.correcta = correctaTexto ? opciones.indexOf(correctaTexto) : -1;
      continue;
    }
    const el = form.elements[c.n];
    if (!el) continue;
    if (c.tipo === "checkbox") out[c.n] = el.checked;
    else if (c.tipo === "datetime" || c.tipo === "date")
      out[c.n] = el.value ? Timestamp.fromDate(new Date(c.tipo === "date" ? el.value + "T12:00" : el.value)) : null;
    else if (c.tipo === "number") out[c.n] = el.value === "" ? null : Number(el.value);
    else out[c.n] = el.value.trim();
  }
  return out;
}

function validar(datos, campos) {
  for (const c of campos) {
    if (c.tipo === "opciones") {
      if (datos.opciones.length < 2) return "Escribe al menos dos opciones.";
      if (datos.correcta < 0) return "Marca cuál opción es la correcta.";
      continue;
    }
    if (c.req && (datos[c.n] === "" || datos[c.n] == null)) return `Falta: ${c.t}.`;
    if (c.tipo === "url" && datos[c.n] && !/^https?:\/\//i.test(datos[c.n])) return `${c.t}: debe empezar con https://`;
  }
  return "";
}

// Diálogo de alta/edición. guardarFn recibe los datos leídos.
export function editar({ titulo, campos, item = {}, guardarFn, vistaPrevia }) {
  const d = abrirDialogo(
    titulo,
    `<form class="form form--2" novalidate>
      ${campos.map((c) => campoHTML(c, c.tipo === "opciones" ? item : item[c.n])).join("")}
      ${vistaPrevia ? '<div class="ancho-completo"><p class="etq">Vista previa</p><div class="vista-previa" data-previa></div></div>' : ""}
      <p class="form__error ancho-completo" hidden></p>
      <div class="form__acciones ancho-completo"><button class="btn" type="submit">Guardar</button><button class="btn btn--linea" type="button" data-cancelar>Cancelar</button></div>
    </form>`
  );
  const form = d.querySelector("form");
  d.querySelector("[data-cancelar]").addEventListener("click", () => d.close());
  if (vistaPrevia) {
    const caja = form.querySelector("[data-previa]");
    const pintar = () => {
      caja.innerHTML = vistaPrevia(leerCampos(form, campos));
      matematicas(caja);
    };
    form.addEventListener("input", pintar);
    pintar();
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = leerCampos(form, campos);
    const err = validar(datos, campos);
    const caja = form.querySelector(".form__error");
    if (err) {
      caja.textContent = err;
      caja.hidden = false;
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await guardarFn(datos);
      d.close();
      toast("Guardado.");
    } catch (er) {
      caja.textContent = mensajeError(er);
      caja.hidden = false;
      btn.disabled = false;
    }
  });
  return d;
}

const sello = () => ({ actualizadoEn: serverTimestamp(), actualizadoPor: sesion.user.email });

// Lista + alta/edición/baja de una colección.
async function crud(el, cfg) {
  async function pintar() {
    el.innerHTML = cargando();
    const items = await listar(cfg.col, ...(cfg.consulta || []));
    if (cfg.ordenar) items.sort(cfg.ordenar);
    el.innerHTML = `
      <div class="admin__barra"><h2>${esc(cfg.titulo)}</h2><div class="fila-acciones"><button class="btn" type="button" data-nuevo>${esc(cfg.textoNuevo)}</button></div></div>
      ${cfg.encabezado || ""}
      ${
        items.length
          ? `<div class="tabla-env"><table><thead><tr>${cfg.columnas.map((c) => `<th>${c.t}</th>`).join("")}<th><span class="sr">Acciones</span></th></tr></thead><tbody>${items
              .map(
                (it) => `<tr>${cfg.columnas.map((c) => `<td>${c.v(it)}</td>`).join("")}<td><div class="fila-acciones"><button class="btn btn--linea btn--peq" data-editar="${it.id}">Editar</button><button class="btn btn--peligro btn--peq" data-borrar="${it.id}">Borrar</button></div></td></tr>`
              )
              .join("")}</tbody></table></div>`
          : vacio(cfg.vacio || "No hay registros todavía", "", "")
      }`;
    matematicas(el);
    el.querySelector("[data-nuevo]").addEventListener("click", () => abrir({ ...(cfg.nuevo ? cfg.nuevo() : {}) }, null));
    el.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => abrir(items.find((i) => i.id === b.dataset.editar), b.dataset.editar)));
    el.querySelectorAll("[data-borrar]").forEach((b) =>
      b.addEventListener("click", async () => {
        const it = items.find((i) => i.id === b.dataset.borrar);
        if (!confirm(`¿Borrar “${cfg.nombreDe(it)}”? Esta acción no se puede deshacer.`)) return;
        try {
          await borrar(cfg.col, it.id);
          toast("Borrado.");
          pintar();
        } catch (err) {
          toast(mensajeError(err), "error");
        }
      })
    );
    if (cfg.alPintar) cfg.alPintar(el);
  }
  function abrir(item, id) {
    editar({
      titulo: id ? `Editar ${cfg.singular}` : cfg.textoNuevo,
      campos: typeof cfg.campos === "function" ? cfg.campos() : cfg.campos,
      item,
      vistaPrevia: cfg.vistaPrevia,
      guardarFn: async (datos) => {
        await guardar(cfg.col, id, { ...datos, ...sello(), ...(id ? {} : { creadoEn: serverTimestamp() }) });
        pintar();
      }
    });
  }
  await pintar();
}

// Selector de materia como chips que cambian ?materia= en la URL.
function chipsMateria(seccion, actual) {
  return `<div class="chips" role="group" aria-label="Materia">${MATERIAS.map(
    (m) => `<button type="button" class="chip" aria-pressed="${m.id === actual}" data-materia="${m.id}">${esc(m.nombre)}</button>`
  ).join("")}</div>`;
}
function conectarChips(el, seccion) {
  el.querySelectorAll("[data-materia]").forEach((b) => b.addEventListener("click", () => ir(`admin/${seccion}?materia=${b.dataset.materia}`)));
}
const materiaDe = (query) => (materiaPorId(query.materia) ? query.materia : MATERIAS[0].id);
const opcionesMaterias = () => MATERIAS.map((m) => ({ v: m.id, t: m.nombre }));

/* ---------------------------------------------------------------------------
   Secciones
   ------------------------------------------------------------------------ */
async function seccionRecursos(el, { query }) {
  const materia = materiaDe(query);
  const temario = await obtener("temarios", materia);
  const unidades = (temario?.unidades || []).map((u) => u.titulo);
  await crud(el, {
    col: "recursos",
    titulo: `Recursos de ${materiaPorId(materia).nombre}`,
    singular: "recurso",
    textoNuevo: "Agregar recurso",
    consulta: [where("materiaId", "==", materia)],
    ordenar: (a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.titulo).localeCompare(b.titulo, "es"),
    encabezado:
      chipsMateria("recursos", materia) +
      `<p class="alerta" style="margin-bottom:16px">Los documentos se enlazan desde Google Drive, OneDrive o una página web: comparte el archivo como “Cualquier persona con el enlace” y pega aquí la liga. Los vídeos van con su liga de YouTube (pueden ser “no listados”).</p>`,
    nombreDe: (r) => r.titulo,
    nuevo: () => ({ materiaId: materia, tipo: "documento" }),
    campos: [
      { n: "materiaId", t: "Materia", tipo: "select", opciones: opcionesMaterias, req: true },
      { n: "tipo", t: "Tipo", tipo: "select", opciones: TIPOS_RECURSO.map((t) => ({ v: t.id, t: t.nombre })), req: true },
      { n: "titulo", t: "Título", req: true, ancho: true },
      { n: "url", t: "Liga (URL)", tipo: "url", req: true, ancho: true, ph: "https://" },
      { n: "descripcion", t: "Descripción", tipo: "textarea", filas: 3, ancho: true },
      { n: "unidad", t: "Unidad del temario", lista: unidades, ayuda: "Escribe o elige la unidad para que aparezca ligada en el temario." },
      { n: "orden", t: "Orden", tipo: "number", ayuda: "Número menor aparece primero." }
    ],
    columnas: [
      { t: "Título", v: (r) => `${esc(r.titulo)} ${r.ejemplo ? '<span class="tag tag--ejemplo">Ejemplo</span>' : ""}` },
      { t: "Tipo", v: (r) => esc(TIPOS_RECURSO.find((t) => t.id === r.tipo)?.nombre.split(" (")[0] || r.tipo) },
      { t: "Unidad", v: (r) => esc(r.unidad || "—") },
      { t: "Liga", v: (r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">Abrir</a>` }
    ],
    vacio: "Esta materia no tiene recursos todavía",
    alPintar: (e) => conectarChips(e, "recursos")
  });
}

async function seccionTemarios(el, { query }) {
  const materia = materiaDe(query);
  const m = materiaPorId(materia);
  const doc = await obtener("temarios", materia);
  let unidades = (doc?.unidades || []).map((u) => ({ titulo: u.titulo, temas: [...(u.temas || [])] }));

  function pintar() {
    el.innerHTML = `
      <div class="admin__barra"><h2>Temario de ${esc(m.nombre)}</h2><div class="fila-acciones"><button class="btn btn--linea" type="button" data-agregar>Agregar unidad</button><button class="btn" type="button" data-guardar>Guardar temario</button></div></div>
      ${chipsMateria("temarios", materia)}
      <p class="muted">Escribe un tema por renglón. Los cambios se publican al pulsar “Guardar temario”.</p>
      ${
        unidades.length
          ? `<div class="form">${unidades
              .map(
                (u, i) => `
            <div class="tarjeta form" data-unidad="${i}">
              <div class="admin__barra" style="margin:0"><span class="etq">Unidad ${i + 1}</span><div class="fila-acciones">
                <button type="button" class="btn btn--linea btn--peq" data-subir="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir unidad ${i + 1}">Subir</button>
                <button type="button" class="btn btn--linea btn--peq" data-bajar="${i}" ${i === unidades.length - 1 ? "disabled" : ""} aria-label="Bajar unidad ${i + 1}">Bajar</button>
                <button type="button" class="btn btn--peligro btn--peq" data-quitar="${i}">Quitar</button></div></div>
              <label class="campo"><span>Título de la unidad</span><input type="text" data-titulo value="${esc(u.titulo)}"></label>
              <label class="campo"><span>Temas</span><textarea data-temas rows="5">${esc(u.temas.join("\n"))}</textarea></label>
            </div>`
              )
              .join("")}</div>`
          : vacio("Este temario está vacío", "Agrega la primera unidad.")
      }`;
    el.querySelectorAll("[data-materia]").forEach((b) => b.addEventListener("click", () => ir(`admin/temarios?materia=${b.dataset.materia}`)));
  }
  // Lee lo escrito antes de reordenar o agregar, para no perderlo.
  function leer() {
    el.querySelectorAll("[data-unidad]").forEach((caja) => {
      const i = Number(caja.dataset.unidad);
      unidades[i] = {
        titulo: caja.querySelector("[data-titulo]").value.trim(),
        temas: caja.querySelector("[data-temas]").value.split("\n").map((t) => t.trim()).filter(Boolean)
      };
    });
  }
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || b.closest(".chips")) return;
    leer();
    if (b.dataset.agregar !== undefined) unidades.push({ titulo: "", temas: [] });
    else if (b.dataset.quitar !== undefined) unidades.splice(Number(b.dataset.quitar), 1);
    else if (b.dataset.subir !== undefined) {
      const i = Number(b.dataset.subir);
      [unidades[i - 1], unidades[i]] = [unidades[i], unidades[i - 1]];
    } else if (b.dataset.bajar !== undefined) {
      const i = Number(b.dataset.bajar);
      [unidades[i + 1], unidades[i]] = [unidades[i], unidades[i + 1]];
    } else if (b.dataset.guardar !== undefined) {
      const limpias = unidades.filter((u) => u.titulo);
      try {
        await guardar("temarios", materia, { unidades: limpias, ...sello() }, { merge: false });
        unidades = limpias;
        toast("Temario guardado.");
      } catch (err) {
        return toast(mensajeError(err), "error");
      }
    } else return;
    pintar();
  });
  pintar();
}

async function seccionPractica(el, { query }) {
  const materia = materiaDe(query);
  const existentes = await listar("reactivos", where("materiaId", "==", materia));
  const temas = [...new Set(existentes.map((r) => r.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  await crud(el, {
    col: "reactivos",
    titulo: `Banco de práctica de ${materiaPorId(materia).nombre}`,
    singular: "pregunta",
    textoNuevo: "Agregar pregunta",
    consulta: [where("materiaId", "==", materia)],
    ordenar: (a, b) => String(a.tema).localeCompare(String(b.tema), "es"),
    encabezado:
      chipsMateria("practica", materia) +
      `<p class="alerta" style="margin-bottom:16px">Fórmulas: escribe entre signos de dólar, por ejemplo <code>$v = \\frac{d}{t}$</code> o <code>$x^2 + 3x - 4 = 0$</code>. Estas preguntas son de práctica: los alumnos ven la respuesta correcta y la explicación al contestar.</p>`,
    nombreDe: (r) => r.enunciado.slice(0, 60),
    nuevo: () => ({ materiaId: materia, dificultad: "Básica" }),
    campos: [
      { n: "materiaId", t: "Materia", tipo: "select", opciones: opcionesMaterias, req: true },
      { n: "tema", t: "Tema", req: true, lista: temas },
      { n: "enunciado", t: "Pregunta", tipo: "textarea", req: true, ancho: true },
      { n: "opciones", t: "Opciones (marca la correcta)", tipo: "opciones", ancho: true },
      { n: "explicacion", t: "Explicación paso a paso", tipo: "textarea", filas: 4, ancho: true, req: true },
      { n: "dificultad", t: "Dificultad", tipo: "select", opciones: ["Básica", "Intermedia", "Avanzada"].map((x) => ({ v: x, t: x })) }
    ],
    vistaPrevia: (d) =>
      `<p>${rico(d.enunciado || "")}</p><ol type="A">${(d.opciones || []).map((o, i) => `<li ${i === d.correcta ? 'style="font-weight:700;color:var(--ok)"' : ""}>${rico(o)}</li>`).join("")}</ol>${
        d.explicacion ? `<p class="muted">${rico(d.explicacion)}</p>` : ""
      }`,
    columnas: [
      { t: "Tema", v: (r) => esc(r.tema || "—") },
      { t: "Pregunta", v: (r) => `${rico(r.enunciado)} ${r.ejemplo ? '<span class="tag tag--ejemplo">Ejemplo</span>' : ""}` },
      { t: "Correcta", v: (r) => (r.opciones ? `${LETRAS[r.correcta]}) ${rico(r.opciones[r.correcta] || "")}` : "—") },
      { t: "Dificultad", v: (r) => esc(r.dificultad || "—") }
    ],
    vacio: "Esta materia no tiene preguntas de práctica",
    alPintar: (e) => conectarChips(e, "practica")
  });
}

async function seccionAvisos(el) {
  await crud(el, {
    col: "avisos",
    titulo: "Avisos",
    singular: "aviso",
    textoNuevo: "Publicar aviso",
    ordenar: (a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0),
    nombreDe: (a) => a.titulo,
    nuevo: () => ({ fecha: new Date() }),
    campos: [
      { n: "titulo", t: "Título", req: true, ancho: true },
      { n: "cuerpo", t: "Texto del aviso", tipo: "textarea", req: true, ancho: true },
      { n: "fecha", t: "Fecha", tipo: "date", req: true },
      { n: "fijado", t: "Fijar arriba en el inicio", tipo: "checkbox" }
    ],
    columnas: [
      { t: "Fecha", v: (a) => esc(fechaCorta(a.fecha)) },
      { t: "Título", v: (a) => `${esc(a.titulo)} ${a.fijado ? '<span class="fijado">Fijado</span>' : ""} ${a.ejemplo ? '<span class="tag tag--ejemplo">Ejemplo</span>' : ""}` }
    ],
    vacio: "No hay avisos publicados"
  });
}

async function seccionCalendario(el) {
  await crud(el, {
    col: "eventos",
    titulo: "Calendario y convocatorias",
    singular: "fecha",
    textoNuevo: "Agregar fecha",
    ordenar: (a, b) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0),
    nombreDe: (e) => e.titulo,
    nuevo: () => ({ area: "general", tipo: "Convocatoria" }),
    campos: [
      { n: "titulo", t: "Título", req: true, ancho: true },
      { n: "tipo", t: "Tipo", tipo: "select", opciones: TIPOS_EVENTO.map((t) => ({ v: t, t })), req: true },
      { n: "area", t: "Área", tipo: "select", opciones: AREAS.map((a) => ({ v: a.id, t: a.nombre })), req: true },
      { n: "fechaInicio", t: "Inicia", tipo: "datetime", req: true },
      { n: "fechaFin", t: "Termina", tipo: "datetime", ayuda: "Déjalo vacío si es un solo día." },
      { n: "conHora", t: "Mostrar la hora de inicio", tipo: "checkbox" },
      { n: "lugar", t: "Lugar", ph: "Ej. Auditorio, en línea" },
      { n: "descripcion", t: "Descripción", tipo: "textarea", filas: 3, ancho: true },
      { n: "enlace", t: "Liga a bases o convocatoria", tipo: "url", ancho: true, ph: "https://" }
    ],
    columnas: [
      { t: "Fecha", v: (e) => esc(e.conHora ? fechaHora(e.fechaInicio) : fechaCorta(e.fechaInicio)) },
      { t: "Título", v: (e) => `${esc(e.titulo)} ${e.ejemplo ? '<span class="tag tag--ejemplo">Ejemplo</span>' : ""}` },
      { t: "Tipo", v: (e) => esc(e.tipo) },
      { t: "Área", v: (e) => esc(AREAS.find((a) => a.id === e.area)?.nombre || e.area) }
    ],
    vacio: "No hay fechas en el calendario"
  });
}

async function seccionUsuarios(el, { query }) {
  const usuarios = (await listar("usuarios")).sort((a, b) => `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, "es"));
  const filtro = { texto: query.q || "", rol: query.rol || "", solicitudes: query.solicitudes === "1" };

  function pintar() {
    const t = filtro.texto.toLowerCase();
    const lista = usuarios.filter(
      (u) =>
        (!filtro.rol || (u.rol || "alumno") === filtro.rol) &&
        (!filtro.solicitudes || (u.solicitaDocente && u.rol === "alumno")) &&
        (!t || `${u.nombre} ${u.apellidos} ${u.email} ${u.matricula} ${u.grupo}`.toLowerCase().includes(t))
    );
    const pendientes = usuarios.filter((u) => u.solicitaDocente && u.rol === "alumno").length;
    el.innerHTML = `
      <div class="admin__barra"><h2>Usuarios <span class="muted mono" style="font-size:.6em">${usuarios.length}</span></h2><div class="fila-acciones"><button class="btn btn--linea" type="button" data-csv>Descargar CSV</button></div></div>
      ${pendientes ? `<p class="alerta" style="margin-bottom:16px">${pendientes} ${pendientes === 1 ? "solicitud" : "solicitudes"} de cuenta docente. Cambia su rol a “Docente” para aprobarlas.</p>` : ""}
      <div class="form form--2" style="margin-bottom:16px">
        <label class="campo"><span>Buscar</span><input type="search" data-q value="${esc(filtro.texto)}" placeholder="Nombre, correo, matrícula o grupo"></label>
        <label class="campo"><span>Rol</span><select data-rol><option value="">Todos</option><option value="alumno">Alumno</option><option value="docente">Docente</option><option value="admin">Administrador</option></select></label>
        <label class="campo" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" data-sol ${filtro.solicitudes ? "checked" : ""}><span>Solo solicitudes de docente</span></label>
      </div>
      ${
        lista.length
          ? `<div class="tabla-env"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Matrícula</th><th>Plantel</th><th>Carrera / grupo</th><th>Rol</th></tr></thead><tbody>${lista
              .map(
                (u) => `<tr>
              <td>${esc(`${u.nombre} ${u.apellidos}`)}${u.solicitaDocente ? ' <span class="tag tag--oro">Docente</span>' : ""}</td>
              <td>${esc(u.email)}</td><td class="mono">${esc(u.matricula)}</td><td>${esc(u.plantel || "—")}</td>
              <td>${esc(u.carrera || "—")}${u.semestre ? `<br><span class="muted">${esc(u.semestre)}.º · ${esc(u.grupo || "")}</span>` : ""}</td>
              <td><select data-uid="${u.id}" aria-label="Rol de ${esc(u.nombre)}" ${u.id === sesion.user.uid ? "disabled" : ""}>${["alumno", "docente", "admin"]
                .map((r) => `<option value="${r}" ${(u.rol || "alumno") === r ? "selected" : ""}>${{ alumno: "Alumno", docente: "Docente", admin: "Administrador" }[r]}</option>`)
                .join("")}</select></td></tr>`
              )
              .join("")}</tbody></table></div>`
          : vacio("Ningún usuario coincide con el filtro")
      }`;
    el.querySelector("[data-rol]").value = filtro.rol;
    const q = el.querySelector("[data-q]");
    q.addEventListener("input", () => {
      filtro.texto = q.value;
      const pos = q.selectionStart;
      pintar();
      const nq = el.querySelector("[data-q]");
      nq.focus();
      nq.setSelectionRange(pos, pos);
    });
    el.querySelector("[data-rol]").addEventListener("change", (e) => {
      filtro.rol = e.target.value;
      pintar();
    });
    el.querySelector("[data-sol]").addEventListener("change", (e) => {
      filtro.solicitudes = e.target.checked;
      pintar();
    });
    el.querySelectorAll("[data-uid]").forEach((s) =>
      s.addEventListener("change", async () => {
        const u = usuarios.find((x) => x.id === s.dataset.uid);
        try {
          await actualizar("usuarios", u.id, { rol: s.value, ...sello() });
          u.rol = s.value;
          toast(`${u.nombre} ahora es ${s.options[s.selectedIndex].text.toLowerCase()}.`);
        } catch (err) {
          s.value = u.rol || "alumno";
          toast(mensajeError(err), "error");
        }
      })
    );
    el.querySelector("[data-csv]").addEventListener("click", () =>
      descargarCSV("usuarios-cyt-eiao.csv", [
        ["Nombre", "Apellidos", "Correo", "Matrícula", "Plantel", "Carrera", "Semestre", "Grupo", "Rol", "Solicita docente"],
        ...lista.map((u) => [u.nombre, u.apellidos, u.email, u.matricula, u.plantel, u.carrera, u.semestre, u.grupo, u.rol, u.solicitaDocente ? "Sí" : ""])
      ])
    );
  }
  pintar();
}

async function seccionCatalogos(el) {
  el.innerHTML = `<div id="cat-planteles"></div><div id="cat-carreras" style="margin-top:40px"></div>`;
  const base = (col, titulo, singular) => ({
    col,
    titulo,
    singular,
    textoNuevo: `Agregar ${singular}`,
    ordenar: porNombre,
    nombreDe: (x) => x.nombre,
    campos: [{ n: "nombre", t: "Nombre", req: true, ancho: true }],
    columnas: [{ t: "Nombre", v: (x) => esc(x.nombre) }],
    vacio: `No hay ${titulo.toLowerCase()}`,
    alPintar: () => obtenerCatalogos(true)
  });
  await Promise.all([
    crud(el.querySelector("#cat-planteles"), base("planteles", "Planteles / unidades", "plantel")),
    crud(el.querySelector("#cat-carreras"), base("carreras", "Carreras técnicas", "carrera"))
  ]);
}
