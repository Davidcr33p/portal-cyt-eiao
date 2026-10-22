// Concursos: catálogo (#/concursos), sala de espera (#/concursos/:id),
// examen (#/concursos/:id/examen) y resultados (#/concursos/:id/resultados).
import { materiaPorId } from "./config.js?v=20261022140330";
import { listar, obtener, guardar, borrar, serverTimestamp, concursosPublicados, estadoConcurso } from "./datos.js?v=20261022140330";
import { sesion, esStaff, nombreCompleto } from "./sesion.js?v=20261022140330";
import { esc, rico, matematicas, vacio, fechaLarga, fechaHora, hora, partesTiempo, dos, duracion, toast, mensajeError, ir, LETRAS, etiquetaEjemplo } from "./ui.js?v=20261022140330";
import { descargarConstancia } from "./constancia.js?v=20261022140330";

const ms = (t) => t?.toMillis?.() ?? 0;
const minutos = (c) => Math.round((ms(c.fin) - ms(c.inicio)) / 60000);
const area = (c) => materiaPorId(c.area) || { nombre: "General", codigo: "CYT" };

function hojaConcurso(c, extra = "") {
  const a = area(c);
  return `
    <header class="hoja"><div class="contenedor">
      <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><a href="#/concursos">Concursos</a><span>/</span><span>${esc(c.titulo)}</span></div>
      <div class="hoja__fila">
        <div><h1>${esc(c.titulo)} ${etiquetaEjemplo(c)}</h1><p>${esc(a.nombre)} · ${esc(fechaLarga(c.inicio))}, de ${esc(hora(c.inicio))} a ${esc(hora(c.fin))}</p>${extra}</div>
        <span class="sello">${a.codigo}</span>
      </div>
    </div></header>`;
}

async function cargarConcurso(id) {
  return obtener("concursos", id).catch(() => null);
}
const noExiste = (main) => {
  main.innerHTML = `<section class="proximamente contenedor"><h1>Este concurso no existe o aún no se publica</h1><a class="btn" href="#/concursos">Ver concursos</a></section>`;
};

function cuenta(meta, alTerminar, raiz) {
  const pintar = () => {
    const resta = meta - Date.now();
    const t = partesTiempo(resta);
    const set = (k, v) => raiz.querySelector(`[data-${k}]`) && (raiz.querySelector(`[data-${k}]`).textContent = v);
    set("d", t.d);
    set("h", dos(t.h));
    set("m", dos(t.m));
    set("s", dos(t.s));
    if (resta <= 0) {
      clearInterval(id);
      alTerminar?.();
    }
  };
  const id = setInterval(pintar, 1000);
  pintar();
  return () => clearInterval(id);
}

const relojHTML = `<div class="cuenta-grande" aria-live="off">
  <div><b data-d>0</b><span>días</span></div><div><b data-h>00</b><span>horas</span></div><div><b data-m>00</b><span>min</span></div><div><b data-s>00</b><span>seg</span></div></div>`;

/* ---------------------------------------------------------------------------
   Catálogo
   ------------------------------------------------------------------------ */
export async function catalogo(main) {
  const todos = await concursosPublicados();
  const ahora = Date.now();
  const vigentes = todos.filter((c) => ms(c.fin) >= ahora);
  const pasados = todos.filter((c) => ms(c.fin) < ahora).reverse();

  const tarjeta = (c) => {
    const e = estadoConcurso(c);
    const a = area(c);
    const destino = e.id === "resultados" ? `#/concursos/${c.id}/resultados` : `#/concursos/${c.id}`;
    return `
      <article class="concurso">
        <div class="concurso__cab"><span class="tag ${e.clase}">${e.texto}</span><span class="area__cod">${a.codigo}</span></div>
        <div class="concurso__cuerpo">
          <h3>${esc(c.titulo)} ${etiquetaEjemplo(c)}</h3>
          ${c.descripcion ? `<p class="muted">${esc(c.descripcion)}</p>` : ""}
          <dl class="concurso__datos">
            <dt>Fecha</dt><dd>${esc(fechaLarga(c.inicio))}</dd>
            <dt>Horario</dt><dd>${esc(hora(c.inicio))} a ${esc(hora(c.fin))} (${minutos(c)} min)</dd>
            <dt>Área</dt><dd>${esc(a.nombre)}</dd>
          </dl>
        </div>
        <div class="concurso__pie"><a class="btn ${e.id === "proximo" || e.id === "curso" ? "btn--oro" : "btn--linea"} btn--peq" href="${destino}">${
          e.id === "resultados" ? "Ver resultados" : e.id === "curso" ? "Entrar" : e.id === "proximo" ? "Ver e inscribirme" : "Ver detalles"
        }</a></div>
      </article>`;
  };

  main.innerHTML = `
    <header class="hoja"><div class="contenedor">
      <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Concursos</span></div>
      <h1>Concursos</h1>
      <p>Exámenes en línea con horario fijo para toda la prepa. Inscríbete antes, entra a la sala de espera y responde desde tu celular o computadora. Los resultados y constancias se publican aquí.</p>
    </div></header>
    <section class="seccion"><div class="contenedor">
      <div class="seccion__cab"><div><p class="etq">Abiertos</p><h2>Próximos y en curso</h2></div></div>
      ${vigentes.length ? `<div class="concursos">${vigentes.map(tarjeta).join("")}</div>` : vacio("No hay concursos abiertos", "Revisa el calendario para conocer las próximas convocatorias.", '<a class="btn" href="#/calendario">Ver calendario</a>')}
    </div></section>
    ${
      pasados.length
        ? `<section class="seccion"><div class="contenedor"><div class="seccion__cab"><div><p class="etq">Historial</p><h2>Concursos anteriores</h2></div></div><div class="concursos">${pasados.map(tarjeta).join("")}</div></div></section>`
        : ""
    }`;
}

/* ---------------------------------------------------------------------------
   Sala de espera
   ------------------------------------------------------------------------ */
export async function sala(main, { id }) {
  const c = await cargarConcurso(id);
  if (!c) return noExiste(main);
  const uid = sesion.user?.uid;
  const [inscripcion, hoja] = uid
    ? await Promise.all([
        obtener(["concursos", id, "inscripciones"], uid).catch(() => null),
        obtener(["concursos", id, "respuestas"], uid).catch(() => null)
      ])
    : [null, null];
  const e = estadoConcurso(c);

  let panel = "";
  let meta = null;
  if (e.id === "proximo" || e.id === "curso") {
    meta = e.id === "proximo" ? ms(c.inicio) : ms(c.fin);
    const titulo = e.id === "proximo" ? "Empieza en" : "Termina en";
    let accion;
    if (!sesion.user) {
      accion = `<p>Inicia sesión con tu correo institucional para inscribirte.</p><a class="btn btn--oro" href="#/ingresar?next=${encodeURIComponent("concursos/" + id)}">Iniciar sesión</a> <a class="btn btn--linea" href="#/registro">Crear cuenta</a>`;
    } else if (!sesion.user.emailVerified) {
      accion = `<p class="alerta">Confirma tu correo institucional para poder inscribirte. <a href="#/verificar">Ver cómo</a></p>`;
    } else if (!inscripcion) {
      accion = `<p>Te inscribirás como <strong>${esc(nombreCompleto())}</strong>${sesion.perfil?.plantel ? ", " + esc(sesion.perfil.plantel) : ""}. Así aparecerá tu nombre en resultados y constancias.</p>
        <div class="form__acciones"><button class="btn btn--oro" type="button" data-inscribir>${e.id === "curso" ? "Inscribirme y entrar" : "Inscribirme"}</button><a href="#/panel">Corregir mis datos</a></div>`;
    } else if (hoja?.enviado) {
      accion = `<p class="alerta alerta--ok">Ya entregaste tu examen. Los resultados se publicarán en esta página.</p>`;
    } else if (e.id === "curso") {
      accion = `<p class="alerta alerta--ok">Estás inscrito.</p><a class="btn btn--oro" href="#/concursos/${id}/examen">Entrar al examen</a>`;
    } else {
      accion = `<p class="alerta alerta--ok">Estás inscrito. El botón para comenzar aparece aquí a la hora de inicio; no hace falta recargar la página.</p>
        <div class="form__acciones"><button class="btn" type="button" disabled>Comenzar examen</button><button class="enlace-btn" type="button" data-cancelar>Cancelar mi inscripción</button></div>`;
    }
    panel = `<p class="etq">${titulo}</p>${relojHTML}${accion}`;
  } else if (e.id === "resultados") {
    panel = `<p class="etq">Concurso terminado</p><h2>Resultados publicados</h2><a class="btn btn--oro" href="#/concursos/${id}/resultados">Ver resultados</a>`;
  } else {
    panel = `<p class="etq">Concurso terminado</p><h2>Resultados en revisión</h2><p class="muted">El departamento está revisando las respuestas. Los resultados y constancias se publicarán en esta página.</p>`;
  }

  main.innerHTML = `
    ${hojaConcurso(c)}
    <section class="seccion"><div class="contenedor columnas columnas--31">
      <div class="tarjeta">
        <p class="etq">Acerca del concurso</p>
        ${c.descripcion ? `<p>${esc(c.descripcion)}</p>` : ""}
        <dl class="concurso__datos">
          <dt>Inicio</dt><dd>${esc(fechaHora(c.inicio))}</dd>
          <dt>Fin</dt><dd>${esc(fechaHora(c.fin))}</dd>
          <dt>Duración</dt><dd>${minutos(c)} minutos</dd>
        </dl>
        ${c.reglas ? `<h3 style="margin-top:24px">Reglas</h3><ul>${c.reglas.split("\n").filter(Boolean).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${esStaff() ? `<p style="margin-top:24px"><a class="btn btn--linea btn--peq" href="#/admin/concursos/${id}">Administrar este concurso</a></p>` : ""}
      </div>
      <aside class="tarjeta sala" aria-live="polite">${panel}</aside>
    </div></section>`;

  main.querySelector("[data-inscribir]")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    const p = sesion.perfil || {};
    try {
      await guardar(["concursos", id, "inscripciones"], uid, {
        uid,
        nombre: p.nombre || nombreCompleto(),
        apellidos: p.apellidos || "",
        matricula: p.matricula || "",
        email: sesion.user.email,
        plantel: p.plantel || "",
        carrera: p.carrera || "",
        semestre: p.semestre || "",
        grupo: p.grupo || "",
        inscritoEn: serverTimestamp()
      });
      toast("Inscripción lista.");
      ir(e.id === "curso" ? `concursos/${id}/examen` : `concursos/${id}`);
    } catch (err) {
      ev.target.disabled = false;
      toast(mensajeError(err), "error");
    }
  });
  main.querySelector("[data-cancelar]")?.addEventListener("click", async () => {
    if (!confirm("¿Cancelar tu inscripción a este concurso?")) return;
    try {
      await borrar(["concursos", id, "inscripciones"], uid);
      toast("Inscripción cancelada.");
      ir(`concursos/${id}`);
    } catch (err) {
      toast(mensajeError(err), "error");
    }
  });

  // Al llegar a cero se vuelve a dibujar la sala (habilita el examen o lo cierra).
  return meta ? cuenta(meta, () => setTimeout(() => ir(`concursos/${id}`), 800), main) : null;
}

/* ---------------------------------------------------------------------------
   Examen
   ------------------------------------------------------------------------ */
export async function examen(main, { id }) {
  if (!sesion.user) return ir(`ingresar?next=${encodeURIComponent("concursos/" + id)}`);
  const c = await cargarConcurso(id);
  if (!c) return noExiste(main);
  const uid = sesion.user.uid;
  const inscripcion = await obtener(["concursos", id, "inscripciones"], uid).catch(() => null);
  if (!inscripcion || Date.now() < ms(c.inicio) - 5000) return ir(`concursos/${id}`);

  let preguntas;
  try {
    preguntas = (await listar(["concursos", id, "preguntas"])).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  } catch (err) {
    // El reloj de la computadora puede ir unos segundos adelantado.
    main.innerHTML = `${hojaConcurso(c)}<section class="seccion"><div class="contenedor">${vacio(
      "Las preguntas todavía no están disponibles",
      "El servidor aún no marca la hora de inicio. Espera unos segundos.",
      `<button class="btn" type="button" onclick="location.reload()">Volver a intentar</button>`
    )}</div></section>`;
    return;
  }
  const hoja = await obtener(["concursos", id, "respuestas"], uid).catch(() => null);
  const respuestas = { ...(hoja?.respuestas || {}) };

  if (hoja?.enviado || Date.now() > ms(c.fin)) return terminado(main, c, preguntas, respuestas, hoja?.enviado);

  // Diferencia entre el reloj del servidor y el local (se ajusta al guardar).
  let desfase = 0;
  const ahora = () => Date.now() + desfase;
  let cerrado = false;

  main.innerHTML = `
    <div class="cronometro" role="timer"><div class="cronometro__in">
      <div><span class="guardado">Tiempo restante</span><br><b data-reloj>--:--</b></div>
      <div style="text-align:right"><span class="guardado" data-estado>${Object.keys(respuestas).length ? "Respuestas recuperadas" : "Aún sin respuestas"}</span><br><span data-contador></span></div>
    </div></div>
    <div class="examen">
      <div><p class="etq">${esc(area(c).nombre)}</p><h1 style="font-size:var(--t-xl)">${esc(c.titulo)}</h1><p class="muted">Cada respuesta se guarda en cuanto la eliges. Puedes cambiarla hasta que entregues o se acabe el tiempo.</p></div>
      ${preguntas
        .map(
          (p, n) => `
        <article class="pregunta" data-pid="${esc(p.id)}">
          <p class="etq pregunta__tema">Pregunta ${n + 1} de ${preguntas.length}</p>
          <div class="pregunta__texto">${rico(p.enunciado)}</div>
          <div class="opciones" role="group" aria-label="Opciones de la pregunta ${n + 1}">
            ${(p.opciones || [])
              .map((o, i) => `<button type="button" class="opcion" data-i="${i}" aria-pressed="${respuestas[p.id] === i}"><span class="opcion__letra">${LETRAS[i]}</span><span>${rico(o)}</span></button>`)
              .join("")}
          </div>
        </article>`
        )
        .join("")}
      <div class="tarjeta"><p class="muted" data-resumen></p><button class="btn btn--oro" type="button" data-entregar>Entregar examen</button></div>
    </div>`;
  matematicas(main);

  const reloj = main.querySelector("[data-reloj]");
  const estado = main.querySelector("[data-estado]");
  const contador = () => {
    const n = Object.keys(respuestas).length;
    main.querySelector("[data-contador]").textContent = `${n} de ${preguntas.length} respondidas`;
    main.querySelector("[data-resumen]").textContent =
      n < preguntas.length ? `Te faltan ${preguntas.length - n} preguntas por responder.` : "Respondiste todas las preguntas.";
  };
  contador();

  // Guardado en serie: siempre se manda el estado más reciente completo.
  let cola = Promise.resolve();
  let primera = true;
  function guardarAhora(extra = {}) {
    const tarea = cola
      .catch(() => {})
      .then(async () => {
        estado.textContent = "Guardando…";
        try {
          const t0 = Date.now();
          await guardar(["concursos", id, "respuestas"], uid, { uid, respuestas: { ...respuestas }, actualizadoEn: serverTimestamp(), ...extra });
          const t1 = Date.now();
          estado.textContent = `Guardado ${new Date().toLocaleTimeString("es-MX")}`;
          if (primera) {
            primera = false;
            const leida = await obtener(["concursos", id, "respuestas"], uid).catch(() => null);
            const servidor = ms(leida?.actualizadoEn);
            if (servidor) desfase = servidor - (t0 + t1) / 2;
          }
        } catch (err) {
          const abierto = ahora() <= ms(c.fin);
          // Solo se reintentan las fallas de red; un rechazo de permisos no se arregla solo.
          const red = err?.code === "unavailable" || err?.code === "deadline-exceeded";
          if (!abierto) estado.textContent = "El concurso ya cerró";
          else if (red) estado.textContent = "Sin conexión: se reintentará";
          else estado.textContent = "No se pudo guardar: " + mensajeError(err);
          if (abierto && red && !extra.enviado) setTimeout(() => guardarAhora().catch(() => {}), 3000);
          throw err;
        }
      });
    cola = tarea;
    return tarea;
  }

  main.querySelector(".examen").addEventListener("click", async (ev) => {
    const op = ev.target.closest(".opcion");
    if (op && !cerrado) {
      const art = op.closest("[data-pid]");
      const pid = art.dataset.pid;
      respuestas[pid] = Number(op.dataset.i);
      art.querySelectorAll(".opcion").forEach((b) => b.setAttribute("aria-pressed", String(b === op)));
      contador();
      guardarAhora().catch(() => {});
      return;
    }
    if (ev.target.closest("[data-entregar]") && !cerrado) {
      const faltan = preguntas.length - Object.keys(respuestas).length;
      if (!confirm(faltan ? `Te faltan ${faltan} preguntas. ¿Entregar de todos modos? Ya no podrás cambiar tus respuestas.` : "¿Entregar tu examen? Ya no podrás cambiar tus respuestas.")) return;
      try {
        await guardarAhora({ enviado: true, enviadoEn: serverTimestamp() });
        cerrado = true;
        toast("Examen entregado.");
        terminado(main, c, preguntas, respuestas, true);
      } catch (err) {
        toast("No se pudo entregar: " + mensajeError(err), "error");
      }
    }
  });

  const tic = () => {
    const resta = ms(c.fin) - ahora();
    const t = partesTiempo(resta);
    reloj.textContent = `${t.d * 24 + t.h ? dos(t.d * 24 + t.h) + ":" : ""}${dos(t.m)}:${dos(t.s)}`;
    main.querySelector(".cronometro").classList.toggle("urgente", resta < 5 * 60000);
    if (resta <= 0 && !cerrado) {
      cerrado = true;
      clearInterval(intervalo);
      main.querySelectorAll(".opcion, [data-entregar]").forEach((b) => (b.disabled = true));
      estado.textContent = "Se acabó el tiempo";
      setTimeout(() => terminado(main, c, preguntas, respuestas, false), 1500);
    }
  };
  const intervalo = setInterval(tic, 1000);
  tic();
  return () => clearInterval(intervalo);
}

function terminado(main, c, preguntas, respuestas, enviado) {
  const n = Object.keys(respuestas).length;
  main.innerHTML = `
    ${hojaConcurso(c)}
    <section class="seccion"><div class="contenedor"><div class="tarjeta tarjeta--estrecha">
      <p class="etq">${enviado ? "Examen entregado" : "Tiempo terminado"}</p>
      <h2>${enviado ? "Listo, recibimos tu examen" : "El concurso ya cerró"}</h2>
      <p>Quedaron guardadas <strong>${n} de ${preguntas.length}</strong> respuestas. Los resultados y las constancias se publicarán en la página del concurso.</p>
      <div class="form__acciones"><a class="btn" href="#/concursos/${c.id}">Volver a la sala</a><a class="btn btn--linea" href="#/panel">Ir a mi panel</a></div>
    </div></div></section>`;
}

/* ---------------------------------------------------------------------------
   Resultados
   ------------------------------------------------------------------------ */
export async function resultados(main, { id }, query) {
  const c = await cargarConcurso(id);
  if (!c) return noExiste(main);
  if (!c.resultadosPublicados && !esStaff()) {
    main.innerHTML = `${hojaConcurso(c)}<section class="seccion"><div class="contenedor">${vacio("Los resultados aún no se publican", "Vuelve más tarde a esta página.", `<a class="btn" href="#/concursos/${id}">Volver al concurso</a>`)}</div></section>`;
    return;
  }
  const uid = sesion.user?.uid;
  const filas = (await listar(["concursos", id, "resultados"])).sort((a, b) => a.posicion - b.posicion);
  const mio = uid ? filas.find((f) => f.uid === uid) : null;

  // Revisión de mis respuestas (las preguntas solo las leen los inscritos).
  let revision = "";
  if (mio) {
    const [preguntas, clave, hoja] = await Promise.all([
      listar(["concursos", id, "preguntas"]).catch(() => []),
      listar(["concursos", id, "clave"]).catch(() => []),
      obtener(["concursos", id, "respuestas"], uid).catch(() => null)
    ]);
    const correcta = Object.fromEntries(clave.map((k) => [k.id, k.correcta]));
    preguntas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    revision = `<h3 style="margin-top:24px">Tus respuestas</h3><ol>${preguntas
      .map((p) => {
        const r = hoja?.respuestas?.[p.id];
        const ok = r === correcta[p.id];
        return `<li style="margin-bottom:12px"><span class="tag ${ok ? "tag--ok" : "tag--bad"}">${ok ? "Correcta" : r == null ? "Sin responder" : "Incorrecta"}</span> ${rico(p.enunciado)}<br><span class="muted">Tu respuesta: ${
          r == null ? "—" : `${LETRAS[r]}) ${rico(p.opciones[r])}`
        } · Correcta: ${correcta[p.id] == null ? "—" : `${LETRAS[correcta[p.id]]}) ${rico(p.opciones[correcta[p.id]])}`}</span></li>`;
      })
      .join("")}</ol>`;
  }

  const planteles = [...new Set(filas.map((f) => f.plantel).filter(Boolean))].sort();
  const carreras = [...new Set(filas.map((f) => f.carrera).filter(Boolean))].sort();
  const fPlantel = query.plantel || "";
  const fCarrera = query.carrera || "";
  const visibles = filas.filter((f) => (!fPlantel || f.plantel === fPlantel) && (!fCarrera || f.carrera === fCarrera));
  const sel = (nombre, lista, valor, todos) =>
    `<select data-filtro="${nombre}"><option value="">${todos}</option>${lista.map((x) => `<option ${x === valor ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;

  main.innerHTML = `
    ${hojaConcurso(c, !c.resultadosPublicados ? '<p class="alerta" style="margin-top:12px">Vista previa del staff: los alumnos todavía no ven estos resultados.</p>' : "")}
    <section class="seccion"><div class="contenedor">
      ${
        mio
          ? `<div class="tarjeta" style="margin-bottom:24px">
          <div class="seccion__cab"><div><p class="etq">Tu resultado</p><h2>${esc(mio.reconocimiento)} · posición ${mio.posicion} de ${filas.length}</h2></div>
          ${mio.constanciaCodigo ? `<button class="btn btn--oro" type="button" data-constancia="${esc(mio.constanciaCodigo)}">Descargar mi constancia</button>` : ""}</div>
          <p>${mio.aciertos} de ${mio.total} aciertos · tiempo: ${esc(duracion(mio.tiempoSeg))}</p>
          ${revision}
        </div>`
          : ""
      }
      <div class="seccion__cab"><div><p class="etq">Tabla general</p><h2>Resultados</h2></div><span class="muted">${filas.length} participantes</span></div>
      <div class="form form--2" style="margin-bottom:16px">
        <label class="campo"><span>Plantel</span>${sel("plantel", planteles, fPlantel, "Todos los planteles")}</label>
        <label class="campo"><span>Carrera técnica</span>${sel("carrera", carreras, fCarrera, "Todas las carreras")}</label>
      </div>
      ${
        visibles.length
          ? `<div class="tabla-env"><table><thead><tr><th class="num">Pos.</th><th>Nombre</th><th>Plantel</th><th>Carrera</th><th class="num">Aciertos</th><th class="num">Tiempo</th><th>Reconocimiento</th></tr></thead><tbody>${visibles
              .map(
                (f) => `<tr class="${f.posicion <= 3 ? "podio-" + f.posicion : ""}" ${f.uid === uid ? 'style="background:var(--gold-100)"' : ""}><td class="num">${f.posicion}</td><td>${esc(f.nombre)}${
                  f.uid === uid ? " <strong>(tú)</strong>" : ""
                }</td><td>${esc(f.plantel || "—")}</td><td>${esc(f.carrera || "—")}</td><td class="num">${f.aciertos}/${f.total}</td><td class="num">${esc(duracion(f.tiempoSeg))}</td><td>${esc(f.reconocimiento)}</td></tr>`
              )
              .join("")}</tbody></table></div>`
          : vacio("Nadie coincide con el filtro")
      }
      <p class="muted" style="margin-top:16px">Orden: más aciertos primero; en empate, menor tiempo de entrega. Cada constancia se puede validar en <a href="#/validar">Validar constancia</a>.</p>
    </div></section>`;
  matematicas(main);

  main.querySelectorAll("[data-filtro]").forEach((s) =>
    s.addEventListener("change", () => {
      const q = new URLSearchParams();
      main.querySelectorAll("[data-filtro]").forEach((x) => x.value && q.set(x.dataset.filtro, x.value));
      ir(`concursos/${id}/resultados${q.toString() ? "?" + q : ""}`);
    })
  );
  main.querySelector("[data-constancia]")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try {
      const constancia = await obtener("constancias", ev.target.dataset.constancia);
      await descargarConstancia(constancia);
    } catch (err) {
      toast(mensajeError(err), "error");
    }
    ev.target.disabled = false;
  });
}
