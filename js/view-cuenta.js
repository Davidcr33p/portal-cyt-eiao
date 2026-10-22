// Cuenta: iniciar sesión, crear cuenta, recuperar contraseña y verificar correo.
import { DOMINIO_INSTITUCIONAL, SEMESTRES } from "./config.js?v=20261022140330";
import { obtenerCatalogos } from "./datos.js?v=20261022140330";
import { sesion, ingresar as entrar, registrar, recuperarContrasena, reenviarVerificacion, recargarSesion } from "./sesion.js?v=20261022140330";
import { esc, toast, mensajeError, ir } from "./ui.js?v=20261022140330";

const hoja = (titulo, texto) => `
  <header class="hoja"><div class="contenedor"><h1>${esc(titulo)}</h1>${texto ? `<p>${texto}</p>` : ""}</div></header>`;

function destino(query) {
  const n = query.next || "panel";
  return /^[a-z0-9/_?=&%.-]*$/i.test(n) ? n : "panel";
}

export async function ingresar(main, _p, query) {
  if (sesion.user) return ir(destino(query));
  main.innerHTML = `
    ${hoja("Iniciar sesión", "Entra con tu correo institucional para guardar tu avance e inscribirte a concursos.")}
    <section class="seccion"><div class="contenedor">
      <form class="tarjeta tarjeta--estrecha form" novalidate>
        <label class="campo"><span>Correo institucional</span><input type="email" name="email" autocomplete="username" required placeholder="nombre${DOMINIO_INSTITUCIONAL}"></label>
        <label class="campo"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
        <p class="form__error" hidden></p>
        <div class="form__acciones"><button class="btn" type="submit">Iniciar sesión</button><a href="#/recuperar">Olvidé mi contraseña</a></div>
        <p class="muted">¿No tienes cuenta? <a href="#/registro">Crea una</a>.</p>
      </form>
    </div></section>`;
  const form = main.querySelector("form");
  const error = form.querySelector(".form__error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      // Al cambiar la sesión, esta misma vista se vuelve a dibujar y
      // redirige a "next".
      await entrar(form.email.value, form.password.value);
      toast("Sesión iniciada.");
    } catch (err) {
      error.textContent = mensajeError(err);
      error.hidden = false;
      btn.disabled = false;
    }
  });
}

export async function registro(main) {
  if (sesion.user) return ir(sesion.user.emailVerified ? "panel" : "verificar");
  const { planteles, carreras } = await obtenerCatalogos();
  const opciones = (lista, ph) => `<option value="">${ph}</option>` + lista.map((x) => `<option>${esc(x.nombre)}</option>`).join("");

  main.innerHTML = `
    ${hoja("Crear cuenta", `Usa tu correo institucional ${esc(DOMINIO_INSTITUCIONAL)}. Tu nombre aparecerá tal como lo escribas en resultados y constancias.`)}
    <section class="seccion"><div class="contenedor">
      <form class="tarjeta tarjeta--estrecha form form--2" novalidate style="max-width:760px">
        <fieldset class="campo ancho-completo">
          <legend>Tipo de cuenta</legend>
          <div class="segmentado">
            <label><input type="radio" name="tipo" value="alumno" checked><span>Alumno</span></label>
            <label><input type="radio" name="tipo" value="docente"><span>Docente</span></label>
          </div>
          <small data-nota-docente hidden>Las cuentas de docente las aprueba el Departamento de Ciencia y Tecnología. Mientras tanto podrás usar el portal como alumno.</small>
        </fieldset>
        <label class="campo"><span>Nombre(s)</span><input type="text" name="nombre" required autocomplete="given-name"></label>
        <label class="campo"><span>Apellidos</span><input type="text" name="apellidos" required autocomplete="family-name"></label>
        <label class="campo"><span data-lbl-matricula>Matrícula</span><input type="text" name="matricula" required inputmode="numeric" autocomplete="off"></label>
        <label class="campo"><span>Correo institucional</span><input type="email" name="email" required autocomplete="email" placeholder="nombre${DOMINIO_INSTITUCIONAL}"></label>
        <label class="campo ancho-completo"><span>Plantel / unidad</span><select name="plantel" required>${opciones(planteles, "Elige tu plantel")}</select></label>
        <label class="campo" data-alumno><span>Semestre</span><select name="semestre" required><option value="">Elige</option>${SEMESTRES.map((s) => `<option value="${s}">${s}.º semestre</option>`).join("")}</select></label>
        <label class="campo" data-alumno><span>Grupo</span><input type="text" name="grupo" required placeholder="Ej. 301" autocomplete="off"></label>
        <label class="campo ancho-completo" data-alumno><span>Carrera técnica</span><select name="carrera" required>${opciones(carreras, "Elige tu carrera técnica")}</select></label>
        <label class="campo"><span>Contraseña</span><input type="password" name="password" required minlength="6" autocomplete="new-password"><small>Mínimo 6 caracteres.</small></label>
        <label class="campo"><span>Confirmar contraseña</span><input type="password" name="password2" required autocomplete="new-password"></label>
        <p class="form__error ancho-completo" hidden></p>
        <div class="form__acciones ancho-completo"><button class="btn" type="submit">Crear cuenta</button><span class="muted">¿Ya tienes cuenta? <a href="#/ingresar">Inicia sesión</a></span></div>
      </form>
    </div></section>`;

  const form = main.querySelector("form");
  const error = form.querySelector(".form__error");
  const tipo = () => form.querySelector("[name=tipo]:checked").value;
  form.addEventListener("change", (e) => {
    if (e.target.name !== "tipo") return;
    const docente = tipo() === "docente";
    form.querySelectorAll("[data-alumno]").forEach((el) => (el.hidden = docente));
    form.querySelector("[data-nota-docente]").hidden = !docente;
    form.querySelector("[data-lbl-matricula]").textContent = docente ? "Número de empleado" : "Matrícula";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    const f = Object.fromEntries(new FormData(form));
    const faltan = [...form.querySelectorAll("[required]")].filter((el) => !el.closest("[hidden]") && !String(el.value).trim());
    let msg = "";
    if (faltan.length) msg = "Completa todos los campos.";
    else if (!f.email.toLowerCase().trim().endsWith(DOMINIO_INSTITUCIONAL)) msg = `Usa tu correo institucional (${DOMINIO_INSTITUCIONAL}).`;
    else if (f.password.length < 6) msg = "La contraseña debe tener al menos 6 caracteres.";
    else if (f.password !== f.password2) msg = "Las contraseñas no coinciden.";
    if (msg) {
      error.textContent = msg;
      error.hidden = false;
      faltan[0]?.focus();
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "Creando cuenta…";
    try {
      await registrar(f);
      ir("verificar");
    } catch (err) {
      error.textContent = mensajeError(err);
      error.hidden = false;
      btn.disabled = false;
      btn.textContent = "Crear cuenta";
    }
  });
}

export async function recuperar(main) {
  main.innerHTML = `
    ${hoja("Recuperar contraseña", "Te enviaremos un enlace a tu correo para crear una contraseña nueva.")}
    <section class="seccion"><div class="contenedor">
      <form class="tarjeta tarjeta--estrecha form" novalidate>
        <label class="campo"><span>Correo institucional</span><input type="email" name="email" required autocomplete="username"></label>
        <p class="form__error" hidden></p>
        <div class="form__acciones"><button class="btn" type="submit">Enviar enlace</button><a href="#/ingresar">Volver a iniciar sesión</a></div>
      </form>
    </div></section>`;
  const form = main.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = form.querySelector(".form__error");
    error.hidden = true;
    try {
      await recuperarContrasena(form.email.value);
      form.innerHTML = `<p class="alerta alerta--ok">Si existe una cuenta con <strong>${esc(form.email.value)}</strong>, te llegará un correo con el enlace. Revisa también la carpeta de correo no deseado.</p><a class="btn" href="#/ingresar">Volver a iniciar sesión</a>`;
    } catch (err) {
      error.textContent = mensajeError(err);
      error.hidden = false;
    }
  });
}

export async function verificar(main) {
  if (!sesion.user) return ir("ingresar");
  if (sesion.user.emailVerified) {
    main.innerHTML = `${hoja("Tu correo ya está verificado")}<section class="seccion"><div class="contenedor"><a class="btn" href="#/panel">Ir a mi panel</a></div></section>`;
    return;
  }
  main.innerHTML = `
    ${hoja("Confirma tu correo", "")}
    <section class="seccion"><div class="contenedor">
      <div class="tarjeta tarjeta--estrecha">
        <p>Enviamos un enlace de confirmación a <strong>${esc(sesion.user.email)}</strong>. Ábrelo desde tu correo institucional y luego vuelve aquí.</p>
        <p class="muted">Si no lo ves en unos minutos, revisa la carpeta de correo no deseado.</p>
        <p class="form__error" hidden></p>
        <div class="form__acciones">
          <button class="btn" type="button" data-listo>Ya confirmé mi correo</button>
          <button class="btn btn--linea" type="button" data-reenviar>Reenviar correo</button>
        </div>
      </div>
    </div></section>`;
  const error = main.querySelector(".form__error");
  main.querySelector("[data-listo]").addEventListener("click", async () => {
    await recargarSesion();
    if (sesion.user?.emailVerified) {
      toast("Correo confirmado.");
      ir("panel");
    } else {
      error.textContent = "Todavía no aparece como confirmado. Abre el enlace del correo y vuelve a intentar.";
      error.hidden = false;
    }
  });
  main.querySelector("[data-reenviar]").addEventListener("click", async (e) => {
    try {
      await reenviarVerificacion();
      e.target.disabled = true;
      toast("Correo reenviado.");
    } catch (err) {
      toast(mensajeError(err), "error");
    }
  });
}
