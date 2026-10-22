// Datos fijos del portal. Lo editable (recursos, temarios, avisos, fechas,
// reactivos, concursos, planteles, carreras) vive en Firestore y se
// administra desde #/admin.

// Dominio de correo institucional permitido para crear cuentas.
export const DOMINIO_INSTITUCIONAL = "@uanl.edu.mx";

// Cuentas con rol de administrador garantizado (también en firestore.rules).
// Sirven para entrar al panel la primera vez, antes de que exista cualquier
// otro admin. Desde ahí se pueden nombrar más admins y docentes.
export const ADMIN_EMAILS = [
  "andre.riverac@uanl.edu.mx",
  "cienciaytecnologia.eiao@uanl.edu.mx"
];

// URL pública del sitio: se usa en el QR de las constancias.
export const SITE_URL = "https://davidcr33p.github.io/portal-cyt-eiao/";

const ico = (d) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// Las seis áreas del Departamento de Ciencia y Tecnología.
export const MATERIAS = [
  {
    id: "fisica",
    nombre: "Física",
    codigo: "FIS",
    descripcion: "Cinemática, dinámica, energía, ondas y electricidad.",
    icono: ico('<path d="M8 8h32"/><path d="M24 8v26" stroke-dasharray="2 4"/><path d="M24 8l10 24"/><circle cx="35.6" cy="35.6" r="4.6"/><path d="M14 30.5a14 14 0 0 0 20 1.5"/>')
  },
  {
    id: "matematicas",
    nombre: "Matemáticas",
    codigo: "MAT",
    descripcion: "Álgebra, geometría, trigonometría, cálculo y probabilidad.",
    icono: ico('<path d="M8 40h32M8 40V8"/><path d="M10 34c5 0 7-20 13-20s7 16 15 16"/><circle cx="23" cy="14" r="1.6" fill="currentColor"/><path d="M23 40v-2M38 40v-2" />')
  },
  {
    id: "quimica",
    nombre: "Química",
    codigo: "QUI",
    descripcion: "Materia, enlaces, reacciones, estequiometría y química orgánica.",
    icono: ico('<path d="M19 6h10M21 6v13L10 38.5A2.8 2.8 0 0 0 12.4 42.5h23.2a2.8 2.8 0 0 0 2.4-4L27 19V6"/><path d="M14.5 31h19"/><circle cx="21" cy="36" r="1.4"/><circle cx="27.5" cy="34" r="2"/>')
  },
  {
    id: "biologia",
    nombre: "Biología",
    codigo: "BIO",
    descripcion: "Célula, genética, evolución, ecología y cuerpo humano.",
    icono: ico('<path d="M8 24c0-9 7-16 16-16s16 7 16 16-7 16-16 16S8 33 8 24z"/><circle cx="21" cy="21" r="5.5"/><circle cx="21" cy="21" r="1.4" fill="currentColor"/><circle cx="32" cy="30" r="1.8"/><circle cx="15" cy="32" r="1.4"/><path d="M29 14.5c2 .5 4 2 5 4"/>')
  },
  {
    id: "programacion",
    nombre: "Programación",
    codigo: "PRG",
    descripcion: "Lógica, algoritmos, estructuras de datos y desarrollo de software.",
    icono: ico('<path d="M16 14L6 24l10 10M32 14l10 10-10 10M27 9l-6 30"/>')
  },
  {
    id: "robotica",
    nombre: "Robótica",
    codigo: "ROB",
    descripcion: "Electrónica, sensores, actuadores, microcontroladores y control.",
    icono: ico('<path d="M7 42h20"/><path d="M12 42v-4h10v4"/><circle cx="17" cy="33" r="3"/><path d="M18.8 30.6l9.4-11.2"/><circle cx="30" cy="17" r="3"/><path d="M33 17h5"/><path d="M38 17l3-4M38 17l3 4"/>')
  }
];

export const materiaPorId = (id) => MATERIAS.find((m) => m.id === id);

// "general" agrupa avisos/fechas que no son de una sola materia.
export const AREAS = [{ id: "general", nombre: "General", codigo: "CYT" }, ...MATERIAS];
export const areaPorId = (id) => AREAS.find((a) => a.id === id) || AREAS[0];

export const TIPOS_RECURSO = [
  { id: "documento", nombre: "Documento (PDF)", pestana: "documentos" },
  { id: "enlace", nombre: "Enlace / página web", pestana: "documentos" },
  { id: "video", nombre: "Vídeo (YouTube)", pestana: "videos" },
  { id: "formulario", nombre: "Formulario (Google o Microsoft Forms)", pestana: "formularios" }
];

export const TIPOS_EVENTO = [
  "Convocatoria",
  "Entrenamiento",
  "Examen selectivo",
  "Concurso",
  "Etapa estatal",
  "Ceremonia",
  "Otro"
];

export const SEMESTRES = ["1", "2", "3", "4", "5", "6"];

// Tamaño de una práctica autogestiva.
export const PREGUNTAS_POR_PRACTICA = 10;
