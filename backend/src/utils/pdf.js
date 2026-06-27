const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function writeSimplePdf({ filePath, title, author, bodyLines }) {
  ensureDir(path.dirname(filePath));

  const doc = new PDFDocument({ size: "A4", margin: 54 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown(0.5);
  if (author) {
    doc.fontSize(11).fillColor("#444").text(`Author: ${author}`, { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(1);
  }

  doc.fontSize(12);
  for (const line of bodyLines) {
    doc.text(line, { align: "left" });
    doc.moveDown(0.4);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

module.exports = { writeSimplePdf };

