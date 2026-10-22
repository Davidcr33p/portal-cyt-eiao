// Constancia en PDF con código y QR de validación. Se genera en el
// navegador; lo que la hace auténtica es el registro en constancias/{codigo},
// que cualquiera puede consultar en #/validar/{codigo}.
import { SITE_URL } from "./config.js?v=20261022132627";
import { cargarScript, fechaLarga } from "./ui.js?v=20261022132627";

const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const QR = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";

export const urlValidacion = (codigo) => `${SITE_URL}#/validar/${codigo}`;

export async function descargarConstancia(c) {
  await Promise.all([cargarScript(JSPDF), cargarScript(QR)]);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279.4;
  const H = 215.9;
  const navy = [10, 31, 61];
  const oro = [212, 167, 44];
  const gris = [75, 91, 114];

  // Marco: azul exterior, filete oro interior.
  pdf.setDrawColor(...navy);
  pdf.setLineWidth(3);
  pdf.rect(10, 10, W - 20, H - 20);
  pdf.setDrawColor(...oro);
  pdf.setLineWidth(0.8);
  pdf.rect(15, 15, W - 30, H - 30);

  const centro = (texto, y, tam, estilo = "normal", color = navy) => {
    pdf.setFont("helvetica", estilo);
    pdf.setFontSize(tam);
    pdf.setTextColor(...color);
    pdf.text(texto, W / 2, y, { align: "center", maxWidth: W - 60 });
  };

  centro("UNIVERSIDAD AUTÓNOMA DE NUEVO LEÓN", 32, 11, "bold", gris);
  centro("Escuela Industrial y Preparatoria Técnica “Álvaro Obregón”", 39, 12, "normal", gris);
  centro("Departamento de Ciencia y Tecnología", 45, 12, "normal", gris);

  pdf.setDrawColor(...oro);
  pdf.setLineWidth(0.6);
  pdf.line(W / 2 - 30, 52, W / 2 + 30, 52);

  centro("CONSTANCIA", 70, 34, "bold");
  centro("se otorga a", 82, 13, "normal", gris);
  centro(c.nombre, 98, 26, "bold");
  pdf.setDrawColor(...navy);
  pdf.setLineWidth(0.3);
  pdf.line(50, 102, W - 50, 102);

  const motivo =
    c.reconocimiento === "Participación"
      ? "por su participación en"
      : `por obtener ${c.reconocimiento.toUpperCase()} en`;
  centro(motivo, 114, 13, "normal", gris);
  centro(c.concursoTitulo, 124, 17, "bold");
  const detalle = [c.posicion ? `Posición ${c.posicion}` : "", c.total ? `${c.aciertos} de ${c.total} aciertos` : ""].filter(Boolean).join(" · ");
  if (detalle) centro(detalle, 133, 11, "normal", gris);
  centro(`Monterrey, Nuevo León, ${fechaLarga(c.fecha)}`, 145, 11, "normal", gris);

  // Firma
  pdf.setDrawColor(...navy);
  pdf.line(W / 2 - 45, 178, W / 2 + 45, 178);
  centro("Coordinación del Departamento de Ciencia y Tecnología", 184, 10, "normal", gris);

  // QR de validación (dibujado como vector, módulo por módulo).
  const qr = window.qrcode(0, "M");
  qr.addData(urlValidacion(c.id));
  qr.make();
  const n = qr.getModuleCount();
  const lado = 30;
  const x0 = W - 22 - lado;
  const y0 = H - 22 - lado - 6;
  const paso = lado / n;
  pdf.setFillColor(...navy);
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(r, col)) pdf.rect(x0 + col * paso, y0 + r * paso, paso + 0.02, paso + 0.02, "F");
    }
  }
  pdf.setFont("courier", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...navy);
  pdf.text(c.id, x0 + lado / 2, y0 + lado + 4, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...gris);
  pdf.text("Valida esta constancia escaneando el código QR", 22, H - 26);
  pdf.text(`o en ${SITE_URL}#/validar`, 22, H - 22);

  pdf.save(`constancia-${c.id}.pdf`);
}
