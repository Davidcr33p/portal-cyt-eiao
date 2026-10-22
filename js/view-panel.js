// Panel del alumno (#/panel): datos, avance en prácticas, concursos y constancias.
import { MATERIAS, materiaPorId, SEMESTRES } from "./config.js?v=20261022132627";
import { listar, obtener, where, obtenerCatalogos, concursosPublicados, estadoConcurso } from "./datos.js?v=20261022132627";
import { sesion, esStaff, nombreCompleto, actualizarPerfil } from "./sesion.js?v=20261022132627";
import { esc, vacio, fechaCorta, fechaHora, toast, mensajeError, abrirDialogo, ir } from "./ui.js?v=20261022132627";
import { descargarConstancia } from "./constancia.js?v=20261022132627";

export async function render(main) {
  if (!sesion.user) return ir("ingresar?next=panel");
  const p = sesion.perfil || {};
  const uid = sesion.user.uid;

  const [intentos, constancias, concursos] = await Promise.all([
    listar("intentos", where("uid", "==", uid)).catch(() => []),
    listar("constancias", where("uid", "==", uid)).catch(() => []),
    concursosPublicados().catch(() => [])
  ]);
  // Inscripciones: una lectura por concurso publicado (son pocos).
  const inscritos = (
    await Promise.all(
      concursos.map(async (c) => ((await obtener(["concursos", c.id, "inscripciones"], uid).catch(() => null)) ? c : null))
    )
  ).filter(Boolean);

  const avance = MATERIAS.map((m) => {
    const lista = intentos.filter((i) => i.materiaId === m.id);
    const aciertos = lista.reduce((s, i) => s + (i.aciertos || 0), 0);
    const total = lista.reduce((s, i) => s + (i.total || 0), 0);
    return { m, n: lista.length, pct: total ? Math.round((aciertos / total) * 100) : 0 };
  });
  const recientes = [...intentos].sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)).slice(0, 8);

  const rolTexto = { alumno: "Alumno", docente: "Docente", admin: "Administrador" }[sesion.rol] || "Alumno";
  const dato = (k, v) => `<div><dt>${k}</dt><dd>${esc(v || "—")}</dd></div>`;

  main.innerHTML = `
    <header class="hoja">
      <div class="contenedor">
        <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Mi panel</span></div>
        <div class="hoja__fila">
          <div><h1>Hola, ${esc(p.nombre || nombreCompleto() || "")}</h1><p>${esc(sesion.user.email)}</p></div>
          <span class="sello">${rolTexto.toUpperCase()}</span>
        </div>
      </div>
    </header>
    <section class="seccion"><div class="contenedor">
      ${!sesion.user.emailVerified ? `<p class="alerta" style="margin-bottom:24px">Confirma tu correo para inscribirte a concursos. <a href="#/verificar">Ver cómo</a></p>` : ""}
      ${p.solicitaDocente && sesion.rol === "alumno" ? `<p class="alerta" style="margin-bottom:24px">Tu solicitud de cuenta docente está pendiente de aprobación por el departamento.</p>` : ""}
      ${esStaff() ? `<p class="alerta alerta--ok" style="margin-bottom:24px">Tienes permisos de ${rolTexto.toLowerCase()}. <a href="#/admin">Ir a administración</a></p>` : ""}

      <div class="tarjeta">
        <div class="seccion__cab"><div><p class="etq">Mis datos</p><h2>${esc(nombreCompleto(p))}</h2></div><button type="button" class="btn btn--linea btn--peq" data-editar>Editar mis datos</button></div>
        <dl class="ficha">
          ${dato(p.tipo === "docente" ? "No. de empleado" : "Matrícula", p.matricula)}
          ${dato("Plantel", p.plantel)}
          ${p.tipo === "docente" ? "" : dato("Carrera técnica", p.carrera) + dato("Semestre", p.semestre ? p.semestre + ".º" : "") + dato("Grupo", p.grupo)}
        </dl>
      </div>

      <div class="columnas columnas--2" style="margin-top:24px">
        <div class="tarjeta">
          <p class="etq">Prácticas autogestivas</p>
          <h2>Mi avance</h2>
          <ul class="progreso">${avance
            .map(
              (a) => `<li><a href="#/recursos/${a.m.id}/practicas">${esc(a.m.nombre)}</a><span class="progreso__dato">${a.n ? `${a.pct}% de aciertos · ${a.n} ${a.n === 1 ? "práctica" : "prácticas"}` : "Sin prácticas"}</span><span class="progreso__barra"><i style="width:${a.pct}%"></i></span></li>`
            )
            .join("")}</ul>
        </div>
        <div class="tarjeta">
          <p class="etq">Historial</p>
          <h2>Últimas prácticas</h2>
          ${
            recientes.length
              ? `<div class="tabla-env"><table><thead><tr><th>Materia</th><th>Tema</th><th class="num">Resultado</th><th>Fecha</th></tr></thead><tbody>${recientes
                  .map((i) => `<tr><td>${esc(materiaPorId(i.materiaId)?.nombre || i.materiaId)}</td><td>${esc(i.tema || "Todos")}</td><td class="num">${i.aciertos}/${i.total}</td><td>${esc(fechaCorta(i.fecha))}</td></tr>`)
                  .join("")}</tbody></table></div>`
              : vacio("Aún no haces prácticas", "Elige una materia y empieza con 10 preguntas.", '<a class="btn" href="#/materias">Ver materias</a>')
          }
        </div>
      </div>

      <div class="columnas columnas--2" style="margin-top:24px">
        <div class="tarjeta">
          <p class="etq">Concursos</p>
          <h2>Mis inscripciones</h2>
          ${
            inscritos.length
              ? `<ul class="fechas">${inscritos
                  .map((c) => {
                    const e = estadoConcurso(c);
                    return `<li class="fecha" style="grid-template-columns:1fr auto"><div><span class="tag ${e.clase}">${e.texto}</span><h3>${esc(c.titulo)}</h3><p>${esc(fechaHora(c.inicio))}</p></div><a class="btn btn--peq" href="#/concursos/${c.id}${e.id === "resultados" ? "/resultados" : ""}">${e.id === "resultados" ? "Resultados" : "Abrir"}</a></li>`;
                  })
                  .join("")}</ul>`
              : vacio("No estás inscrito en ningún concurso", "", '<a class="btn" href="#/concursos">Ver concursos</a>')
          }
        </div>
        <div class="tarjeta">
          <p class="etq">Reconocimientos</p>
          <h2>Mis constancias</h2>
          ${
            constancias.length
              ? `<ul class="fechas">${constancias
                  .map((c) => `<li class="fecha" style="grid-template-columns:1fr auto"><div><span class="tag tag--oro">${esc(c.reconocimiento)}</span><h3>${esc(c.concursoTitulo)}</h3><p class="mono">${esc(c.id)}</p></div><button type="button" class="btn btn--peq" data-constancia="${esc(c.id)}">Descargar PDF</button></li>`)
                  .join("")}</ul>`
              : vacio("Todavía no tienes constancias", "Se generan cuando el departamento publica los resultados de un concurso.")
          }
        </div>
      </div>
    </div></section>`;

  main.querySelectorAll("[data-constancia]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await descargarConstancia(constancias.find((c) => c.id === b.dataset.constancia));
      } catch (err) {
        toast(mensajeError(err), "error");
      }
      b.disabled = false;
    })
  );

  main.querySelector("[data-editar]").addEventListener("click", () => editarDatos(p));
}

async function editarDatos(p) {
  const { planteles, carreras } = await obtenerCatalogos();
  const sel = (nombre, lista, valor) =>
    `<select name="${nombre}">${lista.map((x) => `<option ${x.nombre === valor ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>`;
  const docente = p.tipo === "docente";
  const d = abrirDialogo(
    "Editar mis datos",
    `<form class="form form--2">
      <label class="campo"><span>Nombre(s)</span><input type="text" name="nombre" value="${esc(p.nombre)}" required></label>
      <label class="campo"><span>Apellidos</span><input type="text" name="apellidos" value="${esc(p.apellidos)}" required></label>
      <label class="campo"><span>${docente ? "No. de empleado" : "Matrícula"}</span><input type="text" name="matricula" value="${esc(p.matricula)}" required></label>
      <label class="campo"><span>Plantel</span>${sel("plantel", planteles, p.plantel)}</label>
      ${
        docente
          ? ""
          : `<label class="campo"><span>Semestre</span><select name="semestre">${SEMESTRES.map((s) => `<option value="${s}" ${s === String(p.semestre) ? "selected" : ""}>${s}.º</option>`).join("")}</select></label>
      <label class="campo"><span>Grupo</span><input type="text" name="grupo" value="${esc(p.grupo)}"></label>
      <label class="campo ancho-completo"><span>Carrera técnica</span>${sel("carrera", carreras, p.carrera)}</label>`
      }
      <p class="form__error ancho-completo" hidden></p>
      <div class="form__acciones ancho-completo"><button class="btn" type="submit">Guardar cambios</button></div>
    </form>`
  );
  const form = d.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    Object.keys(datos).forEach((k) => (datos[k] = String(datos[k]).trim()));
    if (!datos.nombre || !datos.apellidos || !datos.matricula) {
      const er = form.querySelector(".form__error");
      er.textContent = "Nombre, apellidos y matrícula son obligatorios.";
      er.hidden = false;
      return;
    }
    try {
      await actualizarPerfil(datos);
      d.close();
      toast("Datos guardados.");
    } catch (err) {
      toast(mensajeError(err), "error");
    }
  });
}
