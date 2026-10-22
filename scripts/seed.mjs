// Carga el contenido inicial del portal en Firestore (proyecto portal-cyt-eiao):
// catálogos de registro, temarios, banco de práctica, avisos, calendario y un
// concurso de ejemplo. Lo marcado con `ejemplo: true` se muestra en el sitio
// con la etiqueta "Ejemplo" y se puede borrar desde #/admin.
//
// Uso:
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/seed.mjs base
//   ACCESS_TOKEN=... node scripts/seed.mjs concurso
//
// El token es de una cuenta de Google con acceso al proyecto (dueño/editor):
// las escrituras con credenciales de IAM no pasan por firestore.rules, así que
// no hace falta abrir las reglas. Los ids son fijos: volver a correrlo
// actualiza los mismos documentos en lugar de duplicarlos.

const PROJECT_ID = "portal-cyt-eiao";
const RAIZ = `projects/${PROJECT_ID}/databases/(default)/documents`;
const TOKEN = process.env.ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Falta ACCESS_TOKEN (token OAuth de una cuenta con acceso al proyecto).");
  process.exit(1);
}

// --- Conversión a formato REST de Firestore -------------------------------
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: campos(v) } };
  return { stringValue: String(v) };
}
const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]));

async function commit(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map(([ruta, datos]) => ({ update: { name: `${RAIZ}/${ruta}`, fields: campos(datos) } }));
    const res = await fetch(`https://firestore.googleapis.com/v1/${RAIZ}:commit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ writes })
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  }
  console.log(`OK: ${docs.length} documentos`);
}

const slug = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// Hora de Monterrey (UTC-6 todo el año desde 2022).
const mty = (fechaHora) => new Date(`${fechaHora}:00-06:00`);
const ahora = new Date();

// La opción correcta se escribe primero; se rota para que no quede siempre en A.
function rotar(opciones, k) {
  const n = opciones.length;
  const out = new Array(n);
  opciones.forEach((o, j) => (out[(j + k) % n] = o));
  return { opciones: out, correcta: k % n };
}

// --- Catálogos ---------------------------------------------------------------
// Unidades de la EIAO según la Agenda del Estudiante UANL (ene–jun 2023).
const PLANTELES = [
  "Unidad Monterrey I (Churubusco)",
  "Unidad Monterrey II",
  "Unidad Guadalupe",
  "Unidad San Nicolás",
  "Unidad Linares"
];

// Las 18 carreras técnicas del plan de estudios (mismo catálogo que el
// proyecto Registro de Exámenes).
const CARRERAS = [
  "Técnico en Administrador Contable",
  "Técnico en Aire Acondicionado y Refrigeración",
  "Técnico en Aplicaciones Audiovisuales",
  "Técnico en Biotecnología Industrial",
  "Técnico en Dibujante Industrial",
  "Técnico en Electricista",
  "Técnico en Electromecánico Industrial",
  "Técnico en Electromovilidad",
  "Técnico en Electrónica Industrial",
  "Técnico en Energías Renovables",
  "Técnico en Inteligencia Artificial",
  "Técnico en Máquinas-Herramientas Industriales",
  "Técnico en Mecánica Automotriz y Autotrónica",
  "Técnico en Mecatrónica Industrial",
  "Técnico en Programación Web",
  "Técnico en Soldadura Industrial",
  "Técnico en Trabajo Social",
  "Técnico en Turismo"
];

// --- Temarios ------------------------------------------------------------------
const TEMARIOS = {
  fisica: [
    ["Fundamentos y mediciones", ["Magnitudes fundamentales y derivadas", "Sistema Internacional de Unidades", "Conversión de unidades", "Notación científica y cifras significativas", "Vectores: suma y descomposición"]],
    ["Cinemática", ["Movimiento rectilíneo uniforme (MRU)", "Movimiento rectilíneo uniformemente acelerado (MRUA)", "Caída libre y tiro vertical", "Tiro parabólico", "Movimiento circular uniforme"]],
    ["Dinámica", ["Leyes de Newton", "Diagramas de cuerpo libre", "Fuerza de fricción", "Ley de la gravitación universal"]],
    ["Trabajo, energía y potencia", ["Trabajo mecánico", "Energía cinética y potencial", "Conservación de la energía mecánica", "Potencia y eficiencia"]],
    ["Electricidad", ["Carga eléctrica y ley de Coulomb", "Corriente, voltaje y resistencia", "Ley de Ohm", "Circuitos en serie y en paralelo", "Potencia eléctrica"]]
  ],
  matematicas: [
    ["Álgebra", ["Productos notables y factorización", "Ecuaciones lineales", "Sistemas de ecuaciones 2×2", "Ecuaciones cuadráticas"]],
    ["Geometría y trigonometría", ["Ángulos y triángulos", "Teorema de Pitágoras", "Razones trigonométricas", "Leyes de senos y cosenos", "Identidades trigonométricas básicas"]],
    ["Geometría analítica", ["Distancia y punto medio", "La recta", "La circunferencia", "La parábola", "Elipse e hipérbola"]],
    ["Cálculo diferencial", ["Funciones y límites", "La derivada", "Reglas de derivación", "Máximos y mínimos"]],
    ["Probabilidad y estadística", ["Medidas de tendencia central", "Medidas de dispersión", "Técnicas de conteo", "Probabilidad clásica"]]
  ],
  quimica: [
    ["Materia y energía", ["Propiedades de la materia", "Estados de agregación", "Mezclas y sustancias puras", "Métodos de separación"]],
    ["Estructura atómica y tabla periódica", ["Modelos atómicos", "Números cuánticos y configuración electrónica", "Tabla periódica y propiedades periódicas"]],
    ["Enlace químico y nomenclatura", ["Enlace iónico, covalente y metálico", "Estructuras de Lewis", "Nomenclatura de compuestos inorgánicos"]],
    ["Reacciones y estequiometría", ["Tipos de reacciones químicas", "Balanceo por tanteo y por óxido-reducción", "Mol y masa molar", "Cálculos estequiométricos", "Reactivo limitante"]],
    ["Química orgánica", ["El átomo de carbono", "Hidrocarburos", "Grupos funcionales", "Polímeros"]]
  ],
  biologia: [
    ["La célula", ["Teoría celular", "Célula procariota y eucariota", "Organelos y sus funciones", "Membrana celular y transporte"]],
    ["Metabolismo", ["Enzimas", "Fotosíntesis", "Respiración celular"]],
    ["Genética", ["ADN y ARN", "Síntesis de proteínas", "Mitosis y meiosis", "Leyes de Mendel"]],
    ["Evolución y biodiversidad", ["Teorías evolutivas", "Selección natural", "Clasificación de los seres vivos"]],
    ["Ecología", ["Niveles de organización ecológica", "Cadenas y redes tróficas", "Ciclos biogeoquímicos", "Impacto ambiental"]]
  ],
  programacion: [
    ["Lógica y algoritmos", ["Algoritmos y diagramas de flujo", "Pseudocódigo", "Variables, constantes y tipos de datos", "Operadores aritméticos, relacionales y lógicos"]],
    ["Estructuras de control", ["Condicionales (if, else, switch)", "Ciclos (for, while)", "Contadores y acumuladores"]],
    ["Funciones y estructuras de datos", ["Funciones y parámetros", "Arreglos y listas", "Cadenas de texto", "Matrices"]],
    ["Programación orientada a objetos", ["Clases y objetos", "Encapsulamiento", "Herencia"]],
    ["Desarrollo web básico", ["Estructura con HTML", "Estilos con CSS", "JavaScript en el navegador"]]
  ],
  robotica: [
    ["Electrónica básica", ["Ley de Ohm aplicada", "Componentes pasivos", "Diodos y LED", "El transistor como interruptor", "Uso de protoboard y multímetro"]],
    ["Microcontroladores", ["Arquitectura de Arduino", "Entradas y salidas digitales", "Entradas analógicas y PWM", "Comunicación serial"]],
    ["Sensores", ["Sensor ultrasónico de distancia", "Sensores infrarrojos", "Sensores de luz y temperatura"]],
    ["Actuadores", ["Motores de CD y puente H", "Servomotores", "Motores a pasos"]],
    ["Control y proyectos", ["Lógica de control", "Robot seguidor de línea", "Robot evasor de obstáculos"]]
  ]
};

// --- Banco de práctica: [tema, enunciado, [correcta, ...distractores], explicación]
const REACTIVOS = {
  fisica: [
    ["Fundamentos y mediciones", "¿A cuántos m/s equivalen $72\\ \\text{km/h}$?", ["$20\\ \\text{m/s}$", "$72\\ \\text{m/s}$", "$7.2\\ \\text{m/s}$", "$259.2\\ \\text{m/s}$"], "Multiplica por los factores de conversión: $72\\ \\frac{\\text{km}}{\\text{h}} \\cdot \\frac{1000\\ \\text{m}}{1\\ \\text{km}} \\cdot \\frac{1\\ \\text{h}}{3600\\ \\text{s}} = 20\\ \\text{m/s}$. Atajo: divide los km/h entre 3.6."],
    ["Cinemática", "Un automóvil parte del reposo y acelera uniformemente a $2\\ \\text{m/s}^2$. ¿Qué velocidad tiene a los $5\\ \\text{s}$?", ["$10\\ \\text{m/s}$", "$2.5\\ \\text{m/s}$", "$7\\ \\text{m/s}$", "$25\\ \\text{m/s}$"], "En el MRUA, $v = v_0 + at$. Como parte del reposo, $v_0 = 0$: $v = 0 + (2)(5) = 10\\ \\text{m/s}$."],
    ["Cinemática", "Se deja caer una piedra desde el reposo. Con $g = 9.8\\ \\text{m/s}^2$, ¿qué distancia recorre en los primeros $2\\ \\text{s}$?", ["$19.6\\ \\text{m}$", "$9.8\\ \\text{m}$", "$39.2\\ \\text{m}$", "$4.9\\ \\text{m}$"], "En caída libre desde el reposo, $d = \\frac{1}{2} g t^2 = \\frac{1}{2}(9.8)(2)^2 = 19.6\\ \\text{m}$."],
    ["Dinámica", "¿Qué fuerza neta se necesita para que una caja de $15\\ \\text{kg}$ acelere a $3\\ \\text{m/s}^2$?", ["$45\\ \\text{N}$", "$5\\ \\text{N}$", "$18\\ \\text{N}$", "$12\\ \\text{N}$"], "Por la segunda ley de Newton, $F = ma = (15)(3) = 45\\ \\text{N}$."],
    ["Trabajo, energía y potencia", "¿Cuál es la energía cinética de un balón de $0.5\\ \\text{kg}$ que se mueve a $10\\ \\text{m/s}$?", ["$25\\ \\text{J}$", "$5\\ \\text{J}$", "$50\\ \\text{J}$", "$2.5\\ \\text{J}$"], "$E_c = \\frac{1}{2} m v^2 = \\frac{1}{2}(0.5)(10)^2 = \\frac{1}{2}(0.5)(100) = 25\\ \\text{J}$. Ojo: la velocidad va al cuadrado."],
    ["Electricidad", "Por una resistencia de $220\\ \\Omega$ circula una corriente de $0.05\\ \\text{A}$. ¿Qué voltaje hay entre sus terminales?", ["$11\\ \\text{V}$", "$4400\\ \\text{V}$", "$0.00023\\ \\text{V}$", "$220.05\\ \\text{V}$"], "Ley de Ohm: $V = IR = (0.05)(220) = 11\\ \\text{V}$."],
    ["Electricidad", "Dos resistencias de $6\\ \\Omega$ se conectan en paralelo. ¿Cuál es la resistencia equivalente?", ["$3\\ \\Omega$", "$12\\ \\Omega$", "$6\\ \\Omega$", "$36\\ \\Omega$"], "En paralelo, $\\frac{1}{R_{eq}} = \\frac{1}{6} + \\frac{1}{6} = \\frac{2}{6}$, así que $R_{eq} = 3\\ \\Omega$. Dos resistencias iguales en paralelo equivalen a la mitad de una."]
  ],
  matematicas: [
    ["Álgebra", "Resuelve: $3x - 7 = 11$", ["$x = 6$", "$x = \\frac{4}{3}$", "$x = 18$", "$x = -6$"], "Suma 7 en ambos lados: $3x = 18$. Divide entre 3: $x = 6$. Comprueba: $3(6) - 7 = 11$."],
    ["Álgebra", "¿Cuáles son las soluciones de $x^2 - 5x + 6 = 0$?", ["$x = 2$ y $x = 3$", "$x = -2$ y $x = -3$", "$x = 1$ y $x = 6$", "$x = -1$ y $x = 6$"], "Busca dos números que multiplicados den 6 y sumados den −5: −2 y −3. Entonces $(x - 2)(x - 3) = 0$, de donde $x = 2$ o $x = 3$."],
    ["Álgebra", "Factoriza: $x^2 - 49$", ["$(x + 7)(x - 7)$", "$(x - 7)^2$", "$(x + 7)^2$", "$x(x - 49)$"], "Es una diferencia de cuadrados: $a^2 - b^2 = (a + b)(a - b)$ con $a = x$ y $b = 7$."],
    ["Geometría y trigonometría", "En un triángulo rectángulo los catetos miden 6 y 8. ¿Cuánto mide la hipotenusa?", ["$10$", "$14$", "$48$", "$\\sqrt{28}$"], "Teorema de Pitágoras: $c = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$."],
    ["Geometría y trigonometría", "¿Cuánto vale $\\sin 30^\\circ$?", ["$\\frac{1}{2}$", "$\\frac{\\sqrt{3}}{2}$", "$\\frac{\\sqrt{2}}{2}$", "$1$"], "En un triángulo 30°-60°-90° con hipotenusa 2, el cateto opuesto a 30° mide 1. Por lo tanto $\\sin 30^\\circ = \\frac{1}{2}$."],
    ["Geometría analítica", "¿Cuál es la pendiente de la recta que pasa por $(1, 2)$ y $(4, 11)$?", ["$3$", "$\\frac{1}{3}$", "$9$", "$-3$"], "$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{11 - 2}{4 - 1} = \\frac{9}{3} = 3$."],
    ["Cálculo diferencial", "Si $f(x) = 3x^2 + 2x$, ¿cuál es $f'(x)$?", ["$6x + 2$", "$3x + 2$", "$6x^2 + 2$", "$6x$"], "Regla de la potencia, $\\frac{d}{dx}x^n = nx^{n-1}$: la derivada de $3x^2$ es $6x$ y la de $2x$ es $2$. Entonces $f'(x) = 6x + 2$."],
    ["Probabilidad y estadística", "Al lanzar un dado justo, ¿cuál es la probabilidad de obtener un número par?", ["$\\frac{1}{2}$", "$\\frac{1}{6}$", "$\\frac{1}{3}$", "$\\frac{2}{3}$"], "Casos favorables: {2, 4, 6} = 3. Casos posibles: 6. $P = \\frac{3}{6} = \\frac{1}{2}$."]
  ],
  quimica: [
    ["Estructura atómica y tabla periódica", "¿Cuántos protones tiene un átomo de oxígeno, cuyo número atómico es 8?", ["8", "16", "6", "10"], "El número atómico $Z$ es igual al número de protones del núcleo. El 16 corresponde a la masa atómica aproximada (protones + neutrones)."],
    ["Reacciones y estequiometría", "¿Cuál es la masa molar del agua, $\\text{H}_2\\text{O}$? (H = 1 g/mol, O = 16 g/mol)", ["18 g/mol", "17 g/mol", "16 g/mol", "34 g/mol"], "Suma las masas de cada átomo: $2(1) + 16 = 18$ g/mol."],
    ["Reacciones y estequiometría", "¿Cuántos moles hay en 88 g de $\\text{CO}_2$? (C = 12 g/mol, O = 16 g/mol)", ["2 mol", "0.5 mol", "44 mol", "88 mol"], "Masa molar del $\\text{CO}_2$: $12 + 2(16) = 44$ g/mol. Moles: $n = \\frac{m}{M} = \\frac{88}{44} = 2$ mol."],
    ["Reacciones y estequiometría", "¿Cuál es la ecuación balanceada de la formación del agua?", ["$2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O}$", "$\\text{H}_2 + \\text{O}_2 \\rightarrow \\text{H}_2\\text{O}$", "$\\text{H}_2 + \\text{O} \\rightarrow \\text{H}_2\\text{O}_2$", "$\\text{H} + \\text{O}_2 \\rightarrow \\text{H}_2\\text{O}$"], "Cuenta átomos: a la izquierda hay 4 H y 2 O; a la derecha, $2\\text{H}_2\\text{O}$ también tiene 4 H y 2 O. Las demás no conservan la masa o cambian las fórmulas."],
    ["Enlace químico y nomenclatura", "¿Qué tipo de enlace une al sodio (Na) y al cloro (Cl) en la sal de mesa?", ["Iónico", "Covalente no polar", "Metálico", "Puente de hidrógeno"], "El sodio (metal) cede un electrón y el cloro (no metal) lo acepta. La diferencia de electronegatividad es grande (≈ 2.1), por eso se forma un enlace iónico entre $\\text{Na}^+$ y $\\text{Cl}^-$."],
    ["Materia y energía", "¿Qué método permite recuperar la sal disuelta en agua?", ["Evaporación", "Filtración", "Decantación", "Imantación"], "La sal disuelta forma una mezcla homogénea: no la retiene un filtro ni se asienta. Al evaporar el agua, la sal queda como residuo sólido."],
    ["Química orgánica", "¿Qué grupo funcional caracteriza a los alcoholes?", ["–OH (hidroxilo)", "–COOH (carboxilo)", "–CHO (aldehído)", "–NH₂ (amino)"], "Los alcoholes tienen un grupo hidroxilo unido a un carbono saturado, por ejemplo el etanol, $\\text{CH}_3\\text{CH}_2\\text{OH}$."]
  ],
  biologia: [
    ["La célula", "¿Qué organelo produce la mayor parte del ATP de la célula?", ["Mitocondria", "Ribosoma", "Aparato de Golgi", "Lisosoma"], "La respiración celular aerobia (ciclo de Krebs y cadena de transporte de electrones) ocurre en la mitocondria y genera la mayor parte del ATP."],
    ["La célula", "¿Qué característica distingue a una célula procariota?", ["No tiene núcleo definido", "Tiene mitocondrias", "Tiene membrana plasmática", "Tiene ribosomas"], "En las procariotas el ADN está en el nucleoide, sin envoltura nuclear. Membrana plasmática y ribosomas los tienen todas las células; las mitocondrias solo las eucariotas."],
    ["Metabolismo", "¿Cuáles son los productos de la fotosíntesis?", ["Glucosa y oxígeno", "Dióxido de carbono y agua", "Glucosa y dióxido de carbono", "ATP y dióxido de carbono"], "$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{luz}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$. El $\\text{CO}_2$ y el agua son los reactivos, no los productos."],
    ["Genética", "Si se cruzan dos plantas heterocigotas $Aa$, ¿qué proporción de la descendencia será homocigota recesiva ($aa$)?", ["$\\frac{1}{4}$", "$\\frac{1}{2}$", "$\\frac{3}{4}$", "Ninguna"], "El cuadro de Punnett da AA, Aa, Aa y aa: solo 1 de 4 combinaciones es $aa$."],
    ["Genética", "En el ADN, ¿con qué base se aparea la adenina?", ["Timina", "Guanina", "Citosina", "Uracilo"], "Adenina con timina (dos puentes de hidrógeno) y guanina con citosina (tres). El uracilo sustituye a la timina en el ARN."],
    ["Genética", "¿Cuántas células produce la meiosis y cuántos cromosomas tienen respecto a la célula madre?", ["4 células con la mitad de cromosomas", "2 células con el mismo número", "4 células con el mismo número", "2 células con la mitad"], "La meiosis tiene dos divisiones sucesivas y produce 4 células haploides ($n$). La mitosis produce 2 células idénticas a la madre."],
    ["Ecología", "En la cadena pasto → conejo → zorro, ¿qué papel tiene el conejo?", ["Consumidor primario", "Productor", "Consumidor secundario", "Descomponedor"], "El conejo se alimenta directamente del productor (el pasto), por eso es consumidor primario. El zorro es consumidor secundario."]
  ],
  programacion: [
    ["Lógica y algoritmos", "¿Qué valor imprime `print(17 % 5)` en Python?", ["2", "3", "3.4", "12"], "El operador `%` devuelve el residuo de la división entera: $17 = 5 \\cdot 3 + 2$, así que el residuo es 2."],
    ["Estructuras de control", "¿Cuántas veces se ejecuta el cuerpo de `for i in range(2, 10, 3):`?", ["3 veces", "8 veces", "4 veces", "2 veces"], "`range(inicio, fin, paso)` no incluye el fin: genera 2, 5 y 8. El siguiente sería 11, que ya pasa de 10."],
    ["Lógica y algoritmos", "¿Qué tipo de dato es `\"25\"` (entre comillas) en Python?", ["Cadena de texto (str)", "Entero (int)", "Flotante (float)", "Booleano (bool)"], "Todo lo que va entre comillas es una cadena. Para usarlo como número hay que convertirlo con `int(\"25\")`."],
    ["Lógica y algoritmos", "¿Cuál es el resultado de `(5 > 3) and (2 == 3)`?", ["False", "True", "Error", "None"], "`and` solo es verdadero si ambas partes lo son. `5 > 3` es True, pero `2 == 3` es False, así que el resultado es False."],
    ["Funciones y estructuras de datos", "Si `lista = [4, 8, 15, 16, 23, 42]`, ¿qué devuelve `lista[2]`?", ["15", "8", "4", "16"], "Los índices empiezan en 0: `lista[0]` es 4, `lista[1]` es 8 y `lista[2]` es 15."],
    ["Estructuras de control", "En el pseudocódigo `s ← 0; para i desde 1 hasta 4: s ← s + i`, ¿cuál es el valor final de `s`?", ["10", "4", "15", "6"], "El acumulador suma 1 + 2 + 3 + 4 = 10."],
    ["Desarrollo web básico", "¿Qué etiqueta HTML crea un enlace a otra página?", ["`<a>`", "`<link>`", "`<href>`", "`<url>`"], "Se usa `<a href=\"...\">texto</a>`. La etiqueta `<link>` sirve para relacionar recursos externos, como hojas de estilo CSS."]
  ],
  robotica: [
    ["Electrónica básica", "Un LED rojo (caída de 2 V, corriente de 20 mA) se conecta a una fuente de 5 V. ¿Qué resistencia limitadora necesita?", ["$150\\ \\Omega$", "$250\\ \\Omega$", "$100\\ \\Omega$", "$0.15\\ \\Omega$"], "La resistencia debe absorber el voltaje que sobra: $R = \\frac{V_{fuente} - V_{LED}}{I} = \\frac{5 - 2}{0.020} = 150\\ \\Omega$."],
    ["Microcontroladores", "En un Arduino UNO, ¿qué rango de valores devuelve `analogRead()`?", ["0 a 1023", "0 a 255", "0 a 5", "0 a 100"], "El convertidor analógico-digital es de 10 bits: $2^{10} = 1024$ niveles, del 0 al 1023."],
    ["Microcontroladores", "Con `analogWrite(pin, 127)` en un Arduino UNO, ¿qué ciclo de trabajo aproximado tiene la señal PWM?", ["50 %", "12.7 %", "100 %", "25 %"], "`analogWrite` usa valores de 0 a 255: $\\frac{127}{255} \\approx 0.5$, es decir, la señal está en alto la mitad del tiempo."],
    ["Sensores", "Un sensor ultrasónico mide un eco de $1160\\ \\mu\\text{s}$. Si el sonido viaja a $343\\ \\text{m/s}$, ¿a qué distancia está el objeto?", ["≈ 20 cm", "≈ 40 cm", "≈ 10 cm", "≈ 2 m"], "El sonido va y regresa, así que se divide entre 2: $d = \\frac{343 \\times 0.00116}{2} \\approx 0.199\\ \\text{m} \\approx 20\\ \\text{cm}$."],
    ["Actuadores", "¿Qué circuito permite invertir el sentido de giro de un motor de CD desde un microcontrolador?", ["Puente H", "Divisor de voltaje", "Regulador de voltaje", "Filtro RC"], "Un puente H (por ejemplo L298N o L293D) cambia la polaridad con la que se alimenta el motor, y con eso su sentido de giro."],
    ["Actuadores", "Un servomotor de hobby se controla con…", ["Pulsos PWM cuyo ancho indica el ángulo", "Un voltaje variable proporcional al ángulo", "Una secuencia de pasos por bobina", "Corriente alterna"], "El servo recibe un pulso cada 20 ms; el ancho del pulso (≈ 1 ms a 2 ms) indica la posición, de 0° a 180°."],
    ["Electrónica básica", "¿Para qué sirve un transistor NPN entre un pin de Arduino y un motor pequeño?", ["Como interruptor que maneja más corriente de la que da el pin", "Para aumentar el voltaje de la fuente", "Para convertir corriente alterna en directa", "Para medir la velocidad del motor"], "Un pin entrega pocos miliamperios (≈ 20 mA). El transistor funciona como interruptor: el pin lo activa y la corriente del motor llega desde la fuente."]
  ]
};

// --- Avisos y calendario ------------------------------------------------------
const AVISOS = [
  {
    id: "bienvenida",
    titulo: "Bienvenida al portal de Ciencia y Tecnología",
    cuerpo: "Aquí encuentras temarios, documentos, vídeos y prácticas de Física, Matemáticas, Química, Biología, Programación y Robótica. Crea tu cuenta con tu correo institucional para guardar tu avance e inscribirte a los concursos.",
    fecha: mty("2026-10-22T08:00"),
    fijado: true,
    ejemplo: false
  },
  {
    id: "ej-asesorias",
    titulo: "Asesorías de preparación para concursos",
    cuerpo: "Martes y jueves de 14:00 a 15:30 en el laboratorio de Física. Trae las dudas que te salgan en las prácticas en línea.",
    fecha: mty("2026-10-20T08:00"),
    fijado: false,
    ejemplo: true
  },
  {
    id: "ej-registro-olimpiada",
    titulo: "Inscripciones abiertas: Olimpiada interna de Física",
    cuerpo: "Inscríbete desde la sección Concursos antes del 13 de noviembre. El examen es en línea, de opción múltiple, y dura una hora.",
    fecha: mty("2026-10-19T08:00"),
    fijado: false,
    ejemplo: true
  }
];

const EVENTOS = [
  ["ej-taller-arduino", "Taller de introducción a Arduino", "Entrenamiento", "robotica", "2026-10-09T13:00", null, true, "Laboratorio de Electrónica", "Primeros pasos con entradas, salidas y PWM."],
  ["ej-conv-fisica", "Convocatoria: Olimpiada interna de Física 2026", "Convocatoria", "fisica", "2026-10-19T08:00", "2026-11-13T23:00", false, "", "Abierta a alumnos de 1.º a 6.º semestre de todas las unidades."],
  ["ej-entrena-mate", "Sesiones de preparación de Matemáticas", "Entrenamiento", "matematicas", "2026-11-03T14:00", "2026-11-24T15:30", false, "Aula 12", "Álgebra, geometría y combinatoria tipo olimpiada."],
  ["ej-olimpiada-fisica", "Olimpiada interna de Física: examen en línea", "Concurso", "fisica", "2026-11-14T10:00", null, true, "En línea, en este portal", "Una hora, opción múltiple. Entra 10 minutos antes a la sala de espera."],
  ["ej-selectivo-prog", "Examen selectivo de Programación", "Examen selectivo", "programacion", "2026-11-21T09:00", null, true, "Laboratorio de cómputo", "Selección del equipo que representará a la escuela."],
  ["ej-torneo-robots", "Torneo interno de robots seguidores de línea", "Concurso", "robotica", "2026-12-04T10:00", null, true, "Gimnasio", "Equipos de hasta 3 integrantes."],
  ["ej-premiacion", "Ceremonia de premiación del semestre", "Ceremonia", "general", "2026-12-11T12:00", null, true, "Auditorio", "Entrega de reconocimientos de todos los concursos del semestre."]
];

// --- Concurso de ejemplo ------------------------------------------------------
const CONCURSO = {
  id: "ej-olimpiada-fisica-2026",
  titulo: "Olimpiada interna de Física 2026",
  area: "fisica",
  descripcion: "Examen en línea de opción múltiple sobre mediciones, cinemática, dinámica, energía y electricidad. Gana quien tenga más aciertos; el empate se rompe con el menor tiempo de entrega.",
  reglas: "Entra a la sala de espera 10 minutos antes.\nTodas las preguntas están en una sola página y cada respuesta se guarda sola.\nPuedes cambiar tus respuestas hasta que entregues o se acabe el tiempo.\nUsa calculadora científica, no el celular.\nLos resultados y constancias se publican cuando el departamento termina de revisar.",
  inicio: mty("2026-11-14T10:00"),
  fin: mty("2026-11-14T11:00"),
  publicado: true,
  resultadosPublicados: false,
  ejemplo: true
};
const PREGUNTAS_CONCURSO = [
  ["Un ciclista recorre 1.2 km en 4 minutos con rapidez constante. ¿Cuál es su rapidez?", ["$5\\ \\text{m/s}$", "$0.3\\ \\text{m/s}$", "$300\\ \\text{m/s}$", "$18\\ \\text{m/s}$"]],
  ["Se lanza una pelota verticalmente hacia arriba a $19.6\\ \\text{m/s}$. ¿Cuánto tarda en alcanzar su altura máxima? ($g = 9.8\\ \\text{m/s}^2$)", ["$2\\ \\text{s}$", "$1\\ \\text{s}$", "$4\\ \\text{s}$", "$19.6\\ \\text{s}$"]],
  ["Una fuerza de $50\\ \\text{N}$ empuja una caja $4\\ \\text{m}$ en la misma dirección de la fuerza. ¿Qué trabajo realiza?", ["$200\\ \\text{J}$", "$12.5\\ \\text{J}$", "$54\\ \\text{J}$", "$46\\ \\text{J}$"]],
  ["¿Cuál es el peso de una persona de $60\\ \\text{kg}$ en la Tierra? ($g = 9.8\\ \\text{m/s}^2$)", ["$588\\ \\text{N}$", "$60\\ \\text{N}$", "$6.12\\ \\text{N}$", "$69.8\\ \\text{N}$"]],
  ["Un objeto de $2\\ \\text{kg}$ está a $10\\ \\text{m}$ de altura. ¿Cuál es su energía potencial gravitacional? ($g = 9.8\\ \\text{m/s}^2$)", ["$196\\ \\text{J}$", "$20\\ \\text{J}$", "$98\\ \\text{J}$", "$49\\ \\text{J}$"]],
  ["Tres resistencias de $10\\ \\Omega$, $20\\ \\Omega$ y $30\\ \\Omega$ se conectan en serie a $12\\ \\text{V}$. ¿Qué corriente circula?", ["$0.2\\ \\text{A}$", "$5\\ \\text{A}$", "$0.6\\ \\text{A}$", "$720\\ \\text{A}$"]],
  ["Una bomba realiza un trabajo de $3000\\ \\text{J}$ en $60\\ \\text{s}$. ¿Qué potencia desarrolla?", ["$50\\ \\text{W}$", "$180\\,000\\ \\text{W}$", "$0.02\\ \\text{W}$", "$3060\\ \\text{W}$"]],
  ["Según la tercera ley de Newton, cuando empujas una pared…", ["La pared te empuja con una fuerza igual y opuesta", "La pared no ejerce ninguna fuerza", "La pared te empuja con una fuerza menor", "Las fuerzas se anulan porque la pared no se mueve"]]
];

// --- Armado ----------------------------------------------------------------------
function base() {
  const docs = [];
  PLANTELES.forEach((nombre) => docs.push([`planteles/${slug(nombre)}`, { nombre }]));
  CARRERAS.forEach((nombre) => docs.push([`carreras/${slug(nombre.replace(/^Técnico en /, ""))}`, { nombre }]));
  Object.entries(TEMARIOS).forEach(([materia, unidades]) =>
    docs.push([`temarios/${materia}`, { unidades: unidades.map(([titulo, temas]) => ({ titulo, temas })), actualizadoEn: ahora, actualizadoPor: "carga inicial" }])
  );
  Object.entries(REACTIVOS).forEach(([materia, lista]) =>
    lista.forEach(([tema, enunciado, opciones, explicacion], i) =>
      docs.push([
        `reactivos/ej-${materia}-${String(i + 1).padStart(2, "0")}`,
        { materiaId: materia, tema, enunciado, ...rotar(opciones, i), explicacion, dificultad: "Básica", ejemplo: true, creadoEn: ahora }
      ])
    )
  );
  AVISOS.forEach(({ id, ...a }) => docs.push([`avisos/${id}`, { ...a, creadoEn: ahora }]));
  EVENTOS.forEach(([id, titulo, tipo, area, ini, fin, conHora, lugar, descripcion]) =>
    docs.push([
      `eventos/${id}`,
      { titulo, tipo, area, fechaInicio: mty(ini), fechaFin: fin ? mty(fin) : null, conHora, lugar, descripcion, enlace: "", ejemplo: true, creadoEn: ahora }
    ])
  );
  return docs;
}

function concurso() {
  const { id, ...datos } = CONCURSO;
  const docs = [[`concursos/${id}`, { ...datos, creadoEn: ahora }]];
  PREGUNTAS_CONCURSO.forEach(([enunciado, opciones], i) => {
    const pid = `p${String(i + 1).padStart(2, "0")}`;
    const r = rotar(opciones, (i * 3 + 1) % 4);
    docs.push([`concursos/${id}/preguntas/${pid}`, { orden: i + 1, enunciado, opciones: r.opciones }]);
    docs.push([`concursos/${id}/clave/${pid}`, { correcta: r.correcta }]);
  });
  return docs;
}

const que = process.argv[2] || "base";
const docs = que === "concurso" ? concurso() : que === "base" ? base() : null;
if (!docs) {
  console.error('Uso: node scripts/seed.mjs base|concurso');
  process.exit(1);
}
await commit(docs);
