// Calendario y convocatorias (#/calendario?area=fisica&pasadas=1).
import { AREAS } from "./config.js?v=20261022132627";
import { listar } from "./datos.js?v=20261022132627";
import { esc, vacio, aFecha, mes, ir } from "./ui.js?v=20261022132627";
import { fechasHTML } from "./view-inicio.js?v=20261022132627";

export async function render(main, _params, query) {
  const area = query.area || "todas";
  const pasadas = query.pasadas === "1";
  const eventos = (await listar("eventos")).sort((a, b) => aFecha(a.fechaInicio) - aFecha(b.fechaInicio));
  const hoy = Date.now() - 86400000;

  const visibles = eventos.filter((e) => {
    if (area !== "todas" && e.area !== area) return false;
    if (!pasadas && (aFecha(e.fechaFin) || aFecha(e.fechaInicio))?.getTime() < hoy) return false;
    return true;
  });

  // Agrupa por mes.
  const grupos = [];
  visibles.forEach((e) => {
    const etiqueta = mes(e.fechaInicio);
    const g = grupos[grupos.length - 1];
    if (g && g.etiqueta === etiqueta) g.items.push(e);
    else grupos.push({ etiqueta, items: [e] });
  });

  const chip = (id, nombre) =>
    `<button type="button" class="chip" data-area="${id}" aria-pressed="${id === area}">${esc(nombre)}</button>`;

  main.innerHTML = `
    <header class="hoja">
      <div class="contenedor">
        <div class="hoja__ruta"><a href="#/">Inicio</a><span>/</span><span>Calendario</span></div>
        <h1>Calendario y convocatorias</h1>
        <p>Etapas de entrenamiento, exámenes selectivos, concursos, etapas estatales y ceremonias del Departamento de Ciencia y Tecnología.</p>
      </div>
    </header>
    <section class="seccion">
      <div class="contenedor">
        <div class="chips" role="group" aria-label="Filtrar por área">
          ${chip("todas", "Todas")}${AREAS.map((a) => chip(a.id, a.nombre)).join("")}
        </div>
        <label class="form__acciones" style="margin-bottom:24px"><input type="checkbox" data-pasadas ${pasadas ? "checked" : ""}> Mostrar fechas pasadas</label>
        ${
          grupos.length
            ? grupos
                .map((g) => `<div class="tarjeta"><p class="etq">${esc(g.etiqueta)}</p>${fechasHTML(g.items, { pasados: true })}</div>`)
                .join("")
            : vacio("No hay fechas con este filtro", pasadas ? "Prueba con otra área." : "Activa “Mostrar fechas pasadas” o elige otra área.")
        }
      </div>
    </section>`;

  const actualizar = (cambios) => {
    const q = new URLSearchParams({ ...(area !== "todas" && { area }), ...(pasadas && { pasadas: "1" }), ...cambios });
    for (const [k, v] of [...q]) if (!v || v === "todas") q.delete(k);
    ir("calendario" + (q.toString() ? "?" + q : ""));
  };
  main.querySelectorAll("[data-area]").forEach((b) => b.addEventListener("click", () => actualizar({ area: b.dataset.area })));
  main.querySelector("[data-pasadas]").addEventListener("change", (e) => actualizar({ pasadas: e.target.checked ? "1" : "" }));
}
