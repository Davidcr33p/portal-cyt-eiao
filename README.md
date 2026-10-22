# Portal de Ciencia y Tecnología · EIAO

Portal de recursos educativos y concursos internos del Departamento de Ciencia y Tecnología de la Escuela Industrial y Preparatoria Técnica “Álvaro Obregón” (UANL).

- **Sitio:** https://davidcr33p.github.io/portal-cyt-eiao/
- **Firebase:** proyecto `portal-cyt-eiao` (plan Spark, gratuito)
- **Áreas:** Física, Matemáticas, Química, Biología, Programación y Robótica

## Qué hace

| Sección | Ruta | Quién |
|---|---|---|
| Inicio: próximas fechas, avisos, próximo concurso | `#/` | Todos |
| Materias: temario, documentos, vídeos, formularios, prácticas | `#/recursos/fisica/temario` | Todos |
| Práctica autogestiva con retroalimentación | `#/practica/fisica` | Todos (se guarda si hay sesión) |
| Calendario y convocatorias | `#/calendario` | Todos |
| Concursos: inscripción, sala de espera, examen, resultados | `#/concursos` | Alumnos con correo verificado |
| Validar constancia | `#/validar/CYT-XXXX-XXXX` | Todos |
| Mi panel: datos, avance, inscripciones, constancias | `#/panel` | Con sesión |
| Administración | `#/admin` | Docentes y administradores |
| Foros | `#/foros` | Próximamente |

## Cuentas y roles

- Cualquier persona con correo **@uanl.edu.mx** crea su cuenta en `#/registro` y confirma su correo. Todas las cuentas nacen como **alumno**.
- Quien se registra como docente queda con la solicitud marcada; un administrador la aprueba en **Administración → Usuarios** cambiando el rol a **Docente**.
- **Docente:** administra recursos, temarios, banco de práctica, avisos, calendario y concursos.
- **Administrador:** además administra usuarios/roles, planteles y carreras.
- Administradores garantizados (también en `firestore.rules`): `andre.riverac@uanl.edu.mx` y `cienciaytecnologia.eiao@uanl.edu.mx`. Solo tienen que registrarse y confirmar su correo.

Nadie puede darse a sí mismo un rol: lo impiden las reglas de Firestore, no solo la interfaz.

## Contenido

Todo se edita desde `#/admin`, sin tocar código:

- **Documentos:** el plan Spark no incluye almacenamiento de archivos, así que los PDF se enlazan desde Google Drive u OneDrive (compartidos como “Cualquier persona con el enlace”). Los enlaces de Drive y Docs muestran vista previa dentro del portal.
- **Vídeos:** liga de YouTube (puede ser “no listado”).
- **Formularios:** liga de Google Forms o Microsoft Forms.
- **Fórmulas:** en preguntas y explicaciones, entre signos de dólar: `$v = \frac{d}{t}$`.

Lo que trae la etiqueta **Ejemplo** se cargó para mostrar cómo se ve el portal; se puede editar o borrar.

## Concursos

1. Un docente crea el concurso en **Administración → Concursos** (horario de inicio y fin, reglas) y le agrega preguntas.
2. Los alumnos se inscriben; las preguntas no se pueden leer antes de la hora de inicio (lo valida el servidor).
3. Cada respuesta se guarda al momento con la hora del servidor; las reglas rechazan respuestas fuera del horario o después de entregar.
4. Al terminar, el docente pulsa **Calificar**: se ordena por aciertos y, en empate, por menor tiempo. Luego **Publicar resultados**.
5. Al calificar se generan las constancias (1.º, 2.º y 3.º lugar, mención honorífica con 80 % o más, y participación). El PDF lleva un código y un QR que llevan a `#/validar/<código>`.

Las respuestas correctas de los concursos viven en una subcolección (`clave`) que los alumnos no pueden leer hasta que se publican los resultados. El banco de práctica, en cambio, es público a propósito.

## Estructura

```
index.html            Página única; las rutas van después de "#"
css/styles.css        Estilos y paleta
js/app.js             Arranque, barra y enrutador
js/config.js          Materias, admins garantizados, tipos de recurso/evento
js/datos.js           Acceso a Firestore
js/sesion.js          Cuenta, perfil y rol
js/view-*.js          Una vista por sección
js/admin-concursos.js Administración de concursos y calificación
js/constancia.js      PDF de constancias (jsPDF + QR)
firestore.rules       Reglas de seguridad (fuente de verdad)
scripts/seed.mjs      Carga inicial de contenido
```

Sin paso de compilación: HTML, CSS y módulos de JavaScript servidos tal cual. Librerías por CDN con versión fija: Firebase 10.12.2, KaTeX 0.16.11, jsPDF 2.5.1, qrcode-generator 1.4.4.

## Datos (Firestore)

| Colección | Contenido | Lectura | Escritura |
|---|---|---|---|
| `temarios/{materia}` | `unidades: [{titulo, temas[]}]` | Pública | Staff |
| `recursos` | `materiaId, tipo, titulo, url, descripcion, unidad, orden` | Pública | Staff |
| `reactivos` | Banco de práctica: `materiaId, tema, enunciado, opciones[], correcta, explicacion` | Pública | Staff |
| `avisos` | `titulo, cuerpo, fecha, fijado` | Pública | Staff |
| `eventos` | `titulo, tipo, area, fechaInicio, fechaFin, lugar, enlace` | Pública | Staff |
| `planteles`, `carreras` | Catálogos del registro | Pública | Admin |
| `usuarios/{uid}` | Perfil y `rol` | Dueño y staff | Dueño (sin cambiar rol) y admin |
| `intentos` | Resultado de cada práctica | Dueño y staff | Dueño crea |
| `concursos/{id}` | Datos del concurso | Publicados: pública | Staff |
| `…/preguntas/{pid}` | Enunciado y opciones | Inscritos desde la hora de inicio | Staff |
| `…/clave/{pid}` | Respuesta correcta | Staff; todos al publicar resultados | Staff |
| `…/inscripciones/{uid}` | Datos del alumno al inscribirse | Dueño y staff | Dueño antes del fin |
| `…/respuestas/{uid}` | Hoja de respuestas | Dueño y staff | Dueño, solo en horario |
| `…/resultados/{uid}` | Posición y aciertos | Staff; todos al publicar | Staff |
| `constancias/{codigo}` | Constancia emitida | Pública (para validar) | Staff |

Todas las consultas usan índices automáticos de un campo; no hay índices compuestos que mantener.

## Mantenimiento

```bash
# Reglas de seguridad (el archivo del repo es la fuente de verdad)
firebase deploy --only firestore:rules

# Contenido inicial (ids fijos: volver a correrlo actualiza, no duplica)
ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/seed.mjs base
ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/seed.mjs concurso
```

**Caché de GitHub Pages:** Pages guarda los archivos hasta 10 minutos. El hook `.githooks/pre-commit` pone el mismo `?v=<fecha>` en todas las referencias locales en cada commit. En un clon nuevo hay que activarlo una vez:

```bash
git config core.hooksPath .githooks
```

**Redes escolares:** Firestore usa `experimentalAutoDetectLongPolling` porque los proxies institucionales suelen cortar la conexión por streaming.

**Límites del plan Spark:** autenticación con correo y contraseña sin costo hasta 3,000 usuarios activos al día; Firestore con 50,000 lecturas y 20,000 escrituras diarias gratis. Suficiente para el uso de una preparatoria; un concurso de 300 alumnos con 20 preguntas son unas 6,000 escrituras.

## Paleta

| Uso | Color | Contraste |
|---|---|---|
| Azul plano (fondo de barra y portada) | `#0A1F3D` | — |
| Oro sobre azul | `#D4A72C` | 7.3:1 |
| Texto secundario sobre azul | `#A9B8CE` | 8.2:1 |
| Oro para texto sobre blanco | `#7A5B00` | 6.3:1 |
| Texto secundario sobre fondo claro | `#4B5B72` | 6.3:1 |

El logotipo oficial va en `index.html`, dentro de `.marca__logo` (hay un comentario en el lugar exacto).
