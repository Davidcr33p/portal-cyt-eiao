// Foros de discusión: pendiente (fase 4).
export async function render(main) {
  main.innerHTML = `
    <section class="proximamente contenedor">
      <p class="etq">Próximamente</p>
      <h1>Foros de discusión</h1>
      <p class="muted">Aquí podrás publicar dudas por materia, responder a tus compañeros y recibir respuestas marcadas por los docentes. Mientras tanto, practica con las preguntas de cada materia.</p>
      <a class="btn" href="#/materias">Ir a materias</a>
    </section>`;
}
