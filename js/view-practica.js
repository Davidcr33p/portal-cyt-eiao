// Práctica autogestiva (#/practica/:materia?tema=...): preguntas al azar
// del banco de reactivos, retroalimentación inmediata y registro del intento.
import { materiaPorId, PREGUNTAS_POR_PRACTICA } from "./config.js?v=20261022140330";
import { listar, guardar, where, serverTimestamp } from "./datos.js?v=20261022140330";
import { sesion } from "./sesion.js?v=20261022140330";
import { esc, rico, matematicas, mezclar, LETRAS, vacio, toast, mensajeError } from "./ui.js?v=20261022140330";

export async function render(main, { materia }, { tema }) {
  const m = materiaPorId(materia);
  if (!m) {
    main.innerHTML = vacio("Esa materia no existe", "", '<a class="btn" href="#/materias">Ver materias</a>');
    return;
  }
  let banco = await listar("reactivos", where("materiaId", "==", m.id));
  if (tema) banco = banco.filter((r) => (r.tema || "General") === tema);

  const cabecera = `
    <header class="hoja">
      <div class="contenedor">
        <div class="hoja__ruta"><a href="#/materias">Materias</a><span>/</span><a href="#/recursos/${m.id}/practicas">${esc(m.nombre)}</a><span>/</span><span>Práctica</span></div>
        <div class="hoja__fila"><div><h1>Práctica de ${esc(m.nombre)}</h1><p>${tema ? "Tema: " + esc(tema) : "Todos los temas"}</p></div><span class="sello">${m.codigo}</span></div>
      </div>
    </header>`;

  if (!banco.length) {
    main.innerHTML = cabecera + `<section class="seccion"><div class="contenedor">${vacio("No hay preguntas para esta práctica", "", `<a class="btn" href="#/recursos/${m.id}/practicas">Volver a ${esc(m.nombre)}</a>`)}</div></section>`;
    return;
  }

  // Cada pregunta con sus opciones barajadas; se recuerda cuál es la correcta.
  const preguntas = mezclar(banco)
    .slice(0, PREGUNTAS_POR_PRACTICA)
    .map((r) => {
      const orden = mezclar(r.opciones.map((texto, i) => ({ texto, correcta: i === Number(r.correcta) })));
      return { ...r, orden };
    });
  const respuestas = [];
  let actual = 0;

  main.innerHTML = cabecera + `<section class="seccion"><div class="contenedor"><div class="practica" id="practica"></div></div></section>`;
  const caja = main.querySelector("#practica");

  function pasos() {
    return `<div class="pasos" aria-hidden="true">${preguntas
      .map((_, i) => `<i class="${i < respuestas.length ? (respuestas[i] ? "ok" : "bad") : i === actual ? "actual" : ""}"></i>`)
      .join("")}</div>`;
  }

  function pintarPregunta() {
    const p = preguntas[actual];
    caja.innerHTML = `
      <div class="practica__barra"><span>Pregunta ${actual + 1} de ${preguntas.length}</span>${pasos()}</div>
      <article class="pregunta" tabindex="-1">
        <p class="etq pregunta__tema">${esc(p.tema || "General")}</p>
        <div class="pregunta__texto">${rico(p.enunciado)}</div>
        <div class="opciones" role="group" aria-label="Opciones">
          ${p.orden.map((o, i) => `<button type="button" class="opcion" data-i="${i}"><span class="opcion__letra">${LETRAS[i]}</span><span>${rico(o.texto)}</span></button>`).join("")}
        </div>
        <div id="retro" aria-live="polite"></div>
      </article>`;
    matematicas(caja);
    // Foco en la pregunta (no en una opción, para no sugerir respuesta).
    if (actual > 0) caja.querySelector(".pregunta").focus({ preventScroll: true });
  }

  function responder(i) {
    const p = preguntas[actual];
    const acierto = p.orden[i].correcta;
    respuestas.push(acierto);
    caja.querySelectorAll(".opcion").forEach((b, j) => {
      b.disabled = true;
      if (p.orden[j].correcta) b.classList.add("correcta");
      else if (j === i) b.classList.add("incorrecta");
    });
    const ultima = actual === preguntas.length - 1;
    const retro = caja.querySelector("#retro");
    retro.innerHTML = `
      <div class="explicacion ${acierto ? "explicacion--ok" : "explicacion--bad"}">
        <h3>${acierto ? "Correcto" : "Incorrecto: la respuesta es la " + LETRAS[p.orden.findIndex((o) => o.correcta)]}</h3>
        ${p.explicacion ? `<div>${rico(p.explicacion)}</div>` : ""}
      </div>
      <div class="form__acciones" style="margin-top:16px"><button type="button" class="btn" data-siguiente>${ultima ? "Ver resultado" : "Siguiente pregunta"}</button></div>`;
    caja.querySelector(".practica__barra .pasos").outerHTML = pasos();
    matematicas(retro);
    retro.querySelector("[data-siguiente]").focus();
  }

  async function terminar() {
    const aciertos = respuestas.filter(Boolean).length;
    const total = preguntas.length;
    let nota = "";
    if (sesion.user) {
      try {
        await guardar("intentos", null, {
          uid: sesion.user.uid,
          materiaId: m.id,
          tema: tema || "",
          aciertos,
          total,
          fecha: serverTimestamp()
        });
        nota = `<p class="alerta alerta--ok">Guardamos este resultado en tu panel.</p>`;
      } catch (err) {
        toast("No se pudo guardar el resultado: " + mensajeError(err), "error");
      }
    } else {
      nota = `<p class="alerta"><a href="#/ingresar?next=${encodeURIComponent("recursos/" + m.id + "/practicas")}">Inicia sesión</a> para guardar tus resultados y ver tu avance.</p>`;
    }
    caja.innerHTML = `
      <article class="pregunta">
        <p class="etq">Resultado</p>
        <p class="resultado-grande">${aciertos}<span class="muted" style="font-size:.45em">/${total}</span></p>
        <p>${aciertos === total ? "Todas correctas. Prueba con otro tema." : aciertos >= total * 0.7 ? "Buen resultado. Repasa las que fallaste." : "Repasa el temario y los vídeos, y vuelve a intentarlo."}</p>
        ${nota}
        <h3 style="margin-top:24px">Repaso</h3>
        <ol>${preguntas
          .map((p, i) => `<li style="margin-bottom:8px"><span class="tag ${respuestas[i] ? "tag--ok" : "tag--bad"}">${respuestas[i] ? "Bien" : "Mal"}</span> ${rico(p.enunciado)}</li>`)
          .join("")}</ol>
        <div class="form__acciones" style="margin-top:24px">
          <button type="button" class="btn btn--oro" data-otra>Practicar otra vez</button>
          <a class="btn btn--linea" href="#/recursos/${m.id}/temario">Repasar el temario</a>
        </div>
      </article>`;
    matematicas(caja);
    caja.querySelector("[data-otra]").addEventListener("click", () => render(main, { materia }, { tema }));
  }

  caja.addEventListener("click", (e) => {
    const op = e.target.closest(".opcion");
    if (op && !op.disabled) return responder(Number(op.dataset.i));
    if (e.target.closest("[data-siguiente]")) {
      if (actual < preguntas.length - 1) {
        actual++;
        pintarPregunta();
      } else terminar();
    }
  });

  pintarPregunta();
}
