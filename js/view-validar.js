// Validación pública de constancias (#/validar/:codigo).
import { obtener } from "./datos.js?v=20261022140330";
import { esc, fechaLarga, ir } from "./ui.js?v=20261022140330";

export async function render(main, { codigo }) {
  const limpio = (codigo || "").trim().toUpperCase();
  const c = limpio ? await obtener("constancias", limpio).catch(() => null) : null;

  let resultado = "";
  if (limpio && c) {
    resultado = `
      <div class="tarjeta constancia-ok" style="margin-top:24px">
        <div class="seccion__cab"><div><p class="etq">Constancia válida</p><h2>${esc(c.nombre)}</h2></div><span class="sello">VÁLIDA</span></div>
        <dl class="ficha">
          <div><dt>Reconocimiento</dt><dd>${esc(c.reconocimiento)}</dd></div>
          <div><dt>Concurso</dt><dd>${esc(c.concursoTitulo)}</dd></div>
          <div><dt>Fecha</dt><dd>${esc(fechaLarga(c.fecha))}</dd></div>
          <div><dt>Código</dt><dd class="mono">${esc(c.id)}</dd></div>
        </dl>
      </div>`;
  } else if (limpio) {
    resultado = `<p class="alerta alerta--bad" style="margin-top:24px">No existe ninguna constancia con el código <strong class="mono">${esc(limpio)}</strong>. Revisa que esté escrito igual que en el documento.</p>`;
  }

  main.innerHTML = `
    <header class="hoja"><div class="contenedor">
      <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Validar constancia</span></div>
      <h1>Validar constancia</h1>
      <p>Escribe el código impreso junto al QR de la constancia (por ejemplo CYT-AB12-CD34) para confirmar que la emitió el Departamento de Ciencia y Tecnología.</p>
    </div></header>
    <section class="seccion"><div class="contenedor" style="max-width:760px">
      <form class="form__acciones" role="search">
        <label class="sr" for="codigo">Código de la constancia</label>
        <input id="codigo" type="text" name="codigo" value="${esc(limpio)}" placeholder="CYT-XXXX-XXXX" class="mono" style="max-width:320px" autocomplete="off" required>
        <button class="btn" type="submit">Validar</button>
      </form>
      ${resultado}
    </div></section>`;

  main.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = e.target.codigo.value.trim().toUpperCase();
    if (v) ir("validar/" + encodeURIComponent(v));
  });
}
