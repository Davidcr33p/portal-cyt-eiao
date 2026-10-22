// Administración de concursos: alta, preguntas con su clave, inscritos,
// calificación, publicación de resultados y emisión de constancias.
import { MATERIAS, materiaPorId } from "./config.js?v=20261022140330";
import { db, doc, listar, obtener, guardar, actualizar, writeBatch, serverTimestamp, estadoConcurso } from "./datos.js?v=20261022140330";
import { sesion } from "./sesion.js?v=20261022140330";
import { esc, rico, matematicas, vacio, cargando, toast, mensajeError, fechaHora, duracion, descargarCSV, codigoConstancia, ir, etiquetaEjemplo } from "./ui.js?v=20261022140330";
import { editar } from "./view-admin.js?v=20261022140330";

const ms = (t) => t?.toMillis?.() ?? 0;
const sello = () => ({ actualizadoEn: serverTimestamp(), actualizadoPor: sesion.user.email });

const CAMPOS_CONCURSO = [
  { n: "titulo", t: "Nombre del concurso", req: true, ancho: true },
  { n: "area", t: "Área", tipo: "select", req: true, opciones: () => [...MATERIAS.map((m) => ({ v: m.id, t: m.nombre })), { v: "general", t: "General (varias áreas)" }] },
  { n: "publicado", t: "Publicado (visible para alumnos)", tipo: "checkbox" },
  { n: "inicio", t: "Inicio", tipo: "datetime", req: true },
  { n: "fin", t: "Fin", tipo: "datetime", req: true, ayuda: "Todos los alumnos tienen el mismo horario." },
  { n: "descripcion", t: "Descripción", tipo: "textarea", filas: 3, ancho: true },
  { n: "reglas", t: "Reglas (una por renglón)", tipo: "textarea", filas: 5, ancho: true }
];

const CAMPOS_PREGUNTA = [
  { n: "orden", t: "Número de pregunta", tipo: "number", req: true },
  { n: "enunciado", t: "Pregunta", tipo: "textarea", req: true, ancho: true, ayuda: "Fórmulas entre signos de dólar: $F = ma$" },
  { n: "opciones", t: "Opciones (marca la correcta)", tipo: "opciones", ancho: true }
];

function editarConcurso(c, alGuardar) {
  editar({
    titulo: c?.id ? "Editar concurso" : "Nuevo concurso",
    campos: CAMPOS_CONCURSO,
    item: c || { area: "fisica", publicado: false },
    guardarFn: async (d) => {
      if (ms(d.fin) <= ms(d.inicio)) throw new Error("La hora de fin debe ser posterior a la de inicio.");
      const nuevo = !c?.id;
      const id = await guardar("concursos", c?.id || null, {
        ...d,
        ...sello(),
        ...(nuevo ? { creadoEn: serverTimestamp(), resultadosPublicados: false } : {})
      });
      alGuardar(id);
    }
  });
}

export async function render(el, { id }) {
  return id ? detalle(el, id) : lista(el);
}

async function lista(el) {
  el.innerHTML = cargando();
  const concursos = (await listar("concursos")).sort((a, b) => ms(b.inicio) - ms(a.inicio));
  el.innerHTML = `
    <div class="admin__barra"><h2>Concursos</h2><div class="fila-acciones"><button class="btn" type="button" data-nuevo>Nuevo concurso</button></div></div>
    <p class="muted">Crea el concurso sin publicar, agrégale preguntas y publícalo cuando esté listo.</p>
    ${
      concursos.length
        ? `<div class="tabla-env"><table><thead><tr><th>Concurso</th><th>Horario</th><th>Estado</th><th><span class="sr">Acciones</span></th></tr></thead><tbody>${concursos
            .map((c) => {
              const e = estadoConcurso(c);
              return `<tr><td><a href="#/admin/concursos/${c.id}">${esc(c.titulo)}</a> ${etiquetaEjemplo(c)}<br><span class="muted">${esc(materiaPorId(c.area)?.nombre || "General")}</span></td><td>${esc(fechaHora(c.inicio))}<br><span class="muted">a ${esc(fechaHora(c.fin))}</span></td><td>${
                c.publicado ? `<span class="tag ${e.clase}">${e.texto}</span>` : '<span class="tag">Borrador</span>'
              }</td><td><div class="fila-acciones"><a class="btn btn--peq" href="#/admin/concursos/${c.id}">Administrar</a></div></td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : vacio("No hay concursos", "Crea el primero con el botón “Nuevo concurso”.")
    }`;
  el.querySelector("[data-nuevo]").addEventListener("click", () => editarConcurso(null, (nuevoId) => ir(`admin/concursos/${nuevoId}`)));
}

async function detalle(el, id) {
  el.innerHTML = cargando();
  const c = await obtener("concursos", id);
  if (!c) {
    el.innerHTML = vacio("Ese concurso no existe", "", '<a class="btn" href="#/admin/concursos">Ver concursos</a>');
    return;
  }
  const ruta = (sub) => ["concursos", id, sub];
  const [preguntas, claves, inscritos, respuestas, resultados] = await Promise.all([
    listar(ruta("preguntas")),
    listar(ruta("clave")),
    listar(ruta("inscripciones")),
    listar(ruta("respuestas")),
    listar(ruta("resultados"))
  ]);
  preguntas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  inscritos.sort((a, b) => `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, "es"));
  resultados.sort((a, b) => a.posicion - b.posicion);
  const clave = Object.fromEntries(claves.map((k) => [k.id, k.correcta]));
  const hojaDe = Object.fromEntries(respuestas.map((r) => [r.id, r]));
  const e = estadoConcurso(c);
  const terminado = Date.now() > ms(c.fin);
  const empezado = Date.now() >= ms(c.inicio);

  el.innerHTML = `
    <p class="hoja__ruta"><a href="#/admin/concursos">Concursos</a><span>/</span><span>${esc(c.titulo)}</span></p>
    <div class="admin__barra">
      <div><h2>${esc(c.titulo)} ${etiquetaEjemplo(c)}</h2><p class="muted" style="margin:0">${esc(fechaHora(c.inicio))} a ${esc(fechaHora(c.fin))} · ${c.publicado ? `<span class="tag ${e.clase}">${e.texto}</span>` : '<span class="tag">Borrador (no visible)</span>'}</p></div>
      <div class="fila-acciones"><a class="btn btn--linea btn--peq" href="#/concursos/${id}">Ver como alumno</a><button class="btn btn--linea btn--peq" type="button" data-editar>Editar datos</button><button class="btn btn--peligro btn--peq" type="button" data-borrar ${inscritos.length ? "disabled title='Tiene inscritos'" : ""}>Borrar</button></div>
    </div>

    <div class="tarjeta">
      <div class="admin__barra"><h3 style="margin:0">Preguntas <span class="muted mono">${preguntas.length}</span></h3><button class="btn btn--peq" type="button" data-nueva-pregunta>Agregar pregunta</button></div>
      ${empezado && !terminado ? '<p class="alerta alerta--bad">El concurso está en curso: cambiar preguntas ahora afecta a quienes ya respondieron.</p>' : ""}
      ${
        preguntas.length
          ? `<ol class="recursos">${preguntas
              .map(
                (p) => `<li class="recurso"><div><span class="etq">Pregunta ${p.orden}</span><div>${rico(p.enunciado)}</div><ol type="A" style="margin:8px 0 0">${(p.opciones || [])
                  .map((o, i) => `<li ${clave[p.id] === i ? 'style="color:var(--ok);font-weight:700"' : ""}>${rico(o)}${clave[p.id] === i ? " ✓" : ""}</li>`)
                  .join("")}</ol>${clave[p.id] == null ? '<p class="form__error">Falta marcar la respuesta correcta.</p>' : ""}</div>
                <div class="recurso__acciones"><button class="btn btn--linea btn--peq" type="button" data-editar-p="${esc(p.id)}">Editar</button><button class="btn btn--peligro btn--peq" type="button" data-borrar-p="${esc(p.id)}">Borrar</button></div></li>`
              )
              .join("")}</ol>`
          : vacio("Este concurso no tiene preguntas", "Agrega al menos una antes de publicarlo.")
      }
    </div>

    <div class="tarjeta">
      <div class="admin__barra"><h3 style="margin:0">Inscritos <span class="muted mono">${inscritos.length}</span></h3>${inscritos.length ? '<button class="btn btn--linea btn--peq" type="button" data-csv-inscritos>Descargar CSV</button>' : ""}</div>
      ${
        inscritos.length
          ? `<div class="tabla-env"><table><thead><tr><th>Nombre</th><th>Matrícula</th><th>Plantel</th><th>Carrera / grupo</th><th>Examen</th></tr></thead><tbody>${inscritos
              .map((i) => {
                const h = hojaDe[i.id];
                const n = h ? Object.keys(h.respuestas || {}).length : 0;
                return `<tr><td>${esc(`${i.nombre} ${i.apellidos}`)}</td><td class="mono">${esc(i.matricula)}</td><td>${esc(i.plantel || "—")}</td><td>${esc(i.carrera || "—")} ${i.grupo ? `<span class="muted">· ${esc(i.grupo)}</span>` : ""}</td><td>${
                  h ? `${h.enviado ? '<span class="tag tag--ok">Entregó</span>' : '<span class="tag tag--oro">Respondiendo</span>'} <span class="muted">${n}/${preguntas.length}</span>` : '<span class="muted">Sin respuestas</span>'
                }</td></tr>`;
              })
              .join("")}</tbody></table></div>`
          : vacio("Nadie se ha inscrito todavía")
      }
    </div>

    <div class="tarjeta">
      <div class="admin__barra"><h3 style="margin:0">Calificación y resultados</h3>
        <div class="fila-acciones">
          ${resultados.length ? '<button class="btn btn--linea btn--peq" type="button" data-csv-resultados>Descargar CSV</button>' : ""}
          ${terminado ? `<button class="btn btn--peq" type="button" data-calificar>${resultados.length ? "Volver a calificar" : "Calificar"}</button>` : ""}
          ${resultados.length ? `<button class="btn ${c.resultadosPublicados ? "btn--peligro" : "btn--oro"} btn--peq" type="button" data-publicar>${c.resultadosPublicados ? "Ocultar resultados" : "Publicar resultados"}</button>` : ""}
        </div>
      </div>
      ${
        !terminado
          ? `<p class="muted">Podrás calificar cuando termine el concurso (${esc(fechaHora(c.fin))}).</p>`
          : resultados.length
          ? `<p class="muted">Calificado ${esc(fechaHora(c.calificadoEn))}. ${c.resultadosPublicados ? "Los alumnos ya ven los resultados y pueden descargar su constancia." : "Revisa la tabla y publica los resultados cuando estén listos."} <a href="#/concursos/${id}/resultados">Ver página de resultados</a></p>
             <div class="tabla-env"><table><thead><tr><th class="num">Pos.</th><th>Nombre</th><th class="num">Aciertos</th><th class="num">Tiempo</th><th>Reconocimiento</th><th>Constancia</th></tr></thead><tbody>${resultados
               .map((r) => `<tr><td class="num">${r.posicion}</td><td>${esc(r.nombre)}</td><td class="num">${r.aciertos}/${r.total}</td><td class="num">${esc(duracion(r.tiempoSeg))}</td><td>${esc(r.reconocimiento)}</td><td class="mono"><a href="#/validar/${esc(r.constanciaCodigo)}">${esc(r.constanciaCodigo)}</a></td></tr>`)
               .join("")}</tbody></table></div>`
          : `<p class="muted">${respuestas.length} ${respuestas.length === 1 ? "alumno respondió" : "alumnos respondieron"}. Al calificar se ordena por aciertos y, en empate, por menor tiempo; también se generan las constancias.</p>`
      }
    </div>`;
  matematicas(el);

  const recargar = () => detalle(el, id);
  // Al terminar el concurso se vuelve a dibujar para mostrar "Calificar".
  // (Solo si faltan menos de 24 h: setTimeout no admite esperas de semanas.)
  const faltan = ms(c.fin) - Date.now() + 1500;
  const espera = !terminado && faltan < 86400000 ? setTimeout(() => el.isConnected && recargar(), faltan) : null;

  el.querySelector("[data-editar]").addEventListener("click", () => editarConcurso(c, recargar));
  el.querySelector("[data-borrar]")?.addEventListener("click", async () => {
    if (!confirm(`¿Borrar el concurso “${c.titulo}” y sus preguntas?`)) return;
    try {
      const b = writeBatch(db);
      preguntas.forEach((p) => b.delete(doc(db, "concursos", id, "preguntas", p.id)));
      claves.forEach((k) => b.delete(doc(db, "concursos", id, "clave", k.id)));
      b.delete(doc(db, "concursos", id));
      await b.commit();
      toast("Concurso borrado.");
      ir("admin/concursos");
    } catch (err) {
      toast(mensajeError(err), "error");
    }
  });

  const editarPregunta = (p) =>
    editar({
      titulo: p ? `Editar pregunta ${p.orden}` : "Agregar pregunta",
      campos: CAMPOS_PREGUNTA,
      item: p ? { ...p, correcta: clave[p.id] } : { orden: (preguntas.at(-1)?.orden || 0) + 1 },
      vistaPrevia: (d) => `<p>${rico(d.enunciado || "")}</p><ol type="A">${(d.opciones || []).map((o, i) => `<li ${i === d.correcta ? 'style="font-weight:700;color:var(--ok)"' : ""}>${rico(o)}</li>`).join("")}</ol>`,
      guardarFn: async (d) => {
        const pid = p?.id || crypto.randomUUID().slice(0, 8);
        const b = writeBatch(db);
        b.set(doc(db, "concursos", id, "preguntas", pid), { orden: d.orden, enunciado: d.enunciado, opciones: d.opciones });
        b.set(doc(db, "concursos", id, "clave", pid), { correcta: d.correcta });
        await b.commit();
        recargar();
      }
    });
  el.querySelector("[data-nueva-pregunta]").addEventListener("click", () => editarPregunta(null));
  el.querySelectorAll("[data-editar-p]").forEach((b) => b.addEventListener("click", () => editarPregunta(preguntas.find((p) => p.id === b.dataset.editarP))));
  el.querySelectorAll("[data-borrar-p]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta pregunta?")) return;
      const b = writeBatch(db);
      b.delete(doc(db, "concursos", id, "preguntas", btn.dataset.borrarP));
      b.delete(doc(db, "concursos", id, "clave", btn.dataset.borrarP));
      try {
        await b.commit();
        recargar();
      } catch (err) {
        toast(mensajeError(err), "error");
      }
    })
  );

  el.querySelector("[data-csv-inscritos]")?.addEventListener("click", () =>
    descargarCSV(`inscritos-${id}.csv`, [
      ["Nombre", "Apellidos", "Matrícula", "Correo", "Plantel", "Carrera", "Semestre", "Grupo", "Respondidas", "Entregó"],
      ...inscritos.map((i) => {
        const h = hojaDe[i.id];
        return [i.nombre, i.apellidos, i.matricula, i.email, i.plantel, i.carrera, i.semestre, i.grupo, h ? Object.keys(h.respuestas || {}).length : 0, h?.enviado ? "Sí" : "No"];
      })
    ])
  );
  el.querySelector("[data-csv-resultados]")?.addEventListener("click", () =>
    descargarCSV(`resultados-${id}.csv`, [
      ["Posición", "Nombre", "Plantel", "Carrera", "Semestre", "Grupo", "Aciertos", "Total", "Tiempo (s)", "Reconocimiento", "Constancia"],
      ...resultados.map((r) => [r.posicion, r.nombre, r.plantel, r.carrera, r.semestre, r.grupo, r.aciertos, r.total, r.tiempoSeg, r.reconocimiento, r.constanciaCodigo])
    ])
  );

  el.querySelector("[data-calificar]")?.addEventListener("click", async (ev) => {
    if (!preguntas.length) return toast("El concurso no tiene preguntas.", "error");
    if (preguntas.some((p) => clave[p.id] == null)) return toast("Hay preguntas sin respuesta correcta marcada.", "error");
    if (!respuestas.length) return toast("Nadie respondió este concurso.", "error");
    if (resultados.length && !confirm("Se volverán a calcular las posiciones. Las constancias conservan su código. ¿Continuar?")) return;
    ev.target.disabled = true;
    ev.target.textContent = "Calificando…";
    try {
      await calificar(c, preguntas, clave, inscritos, respuestas, resultados);
      toast("Concurso calificado. Revisa la tabla y publica los resultados.");
      recargar();
    } catch (err) {
      ev.target.disabled = false;
      toast(mensajeError(err), "error");
    }
  });
  el.querySelector("[data-publicar]")?.addEventListener("click", async () => {
    const publicar = !c.resultadosPublicados;
    if (publicar && !confirm("Los alumnos verán la tabla de resultados, las respuestas correctas y podrán descargar su constancia. ¿Publicar?")) return;
    try {
      await actualizar("concursos", id, { resultadosPublicados: publicar, ...sello() });
      toast(publicar ? "Resultados publicados." : "Resultados ocultos.");
      recargar();
    } catch (err) {
      toast(mensajeError(err), "error");
    }
  });
  return () => clearTimeout(espera);
}

// Ordena por aciertos (desc) y tiempo de entrega (asc), escribe resultados y
// constancias. Al volver a calificar, cada alumno conserva su código.
async function calificar(c, preguntas, clave, inscritos, respuestas, previos) {
  const total = preguntas.length;
  const inicio = ms(c.inicio);
  const codigoPrevio = Object.fromEntries(previos.map((r) => [r.id, r.constanciaCodigo]));
  const datos = Object.fromEntries(inscritos.map((i) => [i.id, i]));

  const filas = respuestas.map((r) => {
    const i = datos[r.id] || {};
    const aciertos = preguntas.filter((p) => r.respuestas?.[p.id] === clave[p.id]).length;
    const entrega = ms(r.enviadoEn) || ms(r.actualizadoEn) || ms(c.fin);
    return {
      uid: r.id,
      nombre: `${i.nombre || ""} ${i.apellidos || ""}`.trim() || i.email || "Alumno",
      plantel: i.plantel || "",
      carrera: i.carrera || "",
      semestre: i.semestre || "",
      grupo: i.grupo || "",
      aciertos,
      total,
      tiempoSeg: Math.max(0, Math.round((Math.min(entrega, ms(c.fin)) - inicio) / 1000))
    };
  });
  filas.sort((a, b) => b.aciertos - a.aciertos || a.tiempoSeg - b.tiempoSeg);
  const LUGARES = ["Primer lugar", "Segundo lugar", "Tercer lugar"];
  filas.forEach((f, i) => {
    f.posicion = i + 1;
    f.reconocimiento =
      i < 3 && f.aciertos > 0 ? LUGARES[i] : total && f.aciertos / total >= 0.8 ? "Mención honorífica" : "Participación";
    f.constanciaCodigo = codigoPrevio[f.uid] || codigoConstancia();
  });

  // Lotes de hasta 400 escrituras.
  const ops = [];
  filas.forEach((f) => {
    ops.push([doc(db, "concursos", c.id, "resultados", f.uid), f]);
    ops.push([
      doc(db, "constancias", f.constanciaCodigo),
      {
        uid: f.uid,
        nombre: f.nombre,
        concursoId: c.id,
        concursoTitulo: c.titulo,
        reconocimiento: f.reconocimiento,
        posicion: f.posicion,
        aciertos: f.aciertos,
        total: f.total,
        fecha: c.inicio,
        ejemplo: !!c.ejemplo,
        emitidaEn: serverTimestamp()
      }
    ]);
  });
  // Quien ya no aparece (p. ej. se borró su hoja) pierde su resultado anterior.
  previos.filter((p) => !filas.some((f) => f.uid === p.id)).forEach((p) => ops.push([doc(db, "concursos", c.id, "resultados", p.id), null]));
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, d]) => (d ? b.set(ref, d) : b.delete(ref)));
    await b.commit();
  }
  await actualizar("concursos", c.id, { calificadoEn: serverTimestamp(), participantes: filas.length, ...sello() });
}
