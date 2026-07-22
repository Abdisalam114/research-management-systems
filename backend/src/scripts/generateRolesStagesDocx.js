/**
 * Generates Word (.docx) guides from plain .txt sources.
 * Run: npm run docs:usage-docx
 *
 * Formatting:
 * - Document title = very large bold
 * - Section titles = large bold
 * - Two blank lines between major sections
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} = require("docx");

const DEFAULT_TXT = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.txt");
const DEFAULT_OUT = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.docx");

/** Empty paragraph ≈ one blank line in Word */
function blankLine() {
  return new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 0, before: 0, line: 276 } });
}

function twoBlankLines() {
  return [blankLine(), blankLine()];
}

function isRuleLine(line) {
  const t = line.trim();
  return t.length >= 8 && /^[=\-]+$/.test(t);
}

function isSectionHeading(trimmed) {
  return (
    /^QAYBTA\s+\d+/i.test(trimmed) ||
    /^DHAMAAD/i.test(trimmed) ||
    /^END(\s|$)/i.test(trimmed) ||
    /^\d+\.\s+[A-ZÁÉÍÓÚÄÖÜ]/.test(trimmed) ||
    /^STEP\s+\d+/i.test(trimmed) ||
    /^[A-C]\.\d+\s/.test(trimmed)
  );
}

function extractTitleBlock(lines) {
  if (!lines.length || !isRuleLine(lines[0].trim())) return [];
  const titles = [];
  for (let j = 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (isRuleLine(t)) break;
    if (t) titles.push(t);
  }
  return titles;
}

function parseTxtToParagraphs(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const children = [];
  let i = 0;
  const titleLines = extractTitleBlock(lines);
  if (titleLines.length) {
    while (
      i < lines.length &&
      (isRuleLine(lines[i].trim()) || !lines[i].trim() || titleLines.includes(lines[i].trim()))
    ) {
      i += 1;
    }
  }

  let sectionCount = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isRuleLine(trimmed)) {
      i += 1;
      continue;
    }

    if (isSectionHeading(trimmed)) {
      if (sectionCount > 0) {
        children.push(...twoBlankLines());
      }
      sectionCount += 1;
      const isMainSection = /^QAYBTA\s+\d+/i.test(trimmed) || /^\d+\.\s/.test(trimmed);
      children.push(
        new Paragraph({
          spacing: { before: sectionCount === 1 ? 120 : 200, after: 160 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: isMainSection ? 36 : 30,
              color: "0C4A6E",
            }),
          ],
        })
      );
      i += 1;
      continue;
    }

    if (/^(NOTE|XUSUUSIN|IMPORTANT|MUHIIM|English|Somali|EN:|SO:)/i.test(trimmed) && trimmed.includes(":")) {
      const colon = trimmed.indexOf(":");
      const label = trimmed.slice(0, colon + 1);
      const rest = trimmed.slice(colon + 1).trim();
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: label + (rest ? " " : ""), bold: true, size: 22 }),
            ...(rest ? [new TextRun({ text: rest, size: 22 })] : []),
          ],
        })
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("- ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^\s*[•\-]\s*/, ""),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      i += 1;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed) && trimmed.length < 160) {
      children.push(
        new Paragraph({
          text: trimmed,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      i += 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line)) {
      children.push(
        new Paragraph({
          text: trimmed,
          indent: { left: 360 },
          spacing: { after: 60 },
        })
      );
      i += 1;
      continue;
    }

    let para = trimmed;
    while (i + 1 < lines.length) {
      const nxt = lines[i + 1].trim();
      if (!nxt || isRuleLine(nxt) || isSectionHeading(nxt)) break;
      if (nxt.startsWith("•") || nxt.startsWith("- ") || /^\d+\.\s/.test(nxt)) break;
      if (/^(NOTE|XUSUUSIN|IMPORTANT|MUHIIM|English|Somali|EN:|SO:)/i.test(nxt)) break;
      i += 1;
      para += ` ${nxt}`;
    }
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: para, size: 22 })],
      })
    );
    i += 1;
  }

  const header = [];
  if (titleLines.length) {
    // Main title — very large + bold
    header.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: titleLines[0] || "JAMHURIYA RMS",
            bold: true,
            size: 56,
            color: "0C4A6E",
          }),
        ],
      })
    );
    // Subtitles — bold, smaller than main
    for (let t = 1; t < titleLines.length; t++) {
      header.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: titleLines[t],
              bold: true,
              size: t === 1 ? 32 : 24,
              color: t === 1 ? "0369A1" : "64748B",
            }),
          ],
        })
      );
    }
    header.push(
      new Paragraph({
        border: { bottom: { color: "0369A1", space: 1, style: BorderStyle.SINGLE, size: 18 } },
        spacing: { after: 200 },
      })
    );
    header.push(...twoBlankLines());
  }

  return [...header, ...children];
}

async function main() {
  const TXT_PATH = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TXT;
  const OUT_PATH = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT;
  if (!fs.existsSync(TXT_PATH)) {
    console.error("Missing:", TXT_PATH);
    process.exit(1);
  }
  const text = fs.readFileSync(TXT_PATH, "utf8");
  const doc = new Document({
    creator: "Jamhuriya RMS",
    title: path.basename(OUT_PATH, ".docx"),
    description: "Jamhuriya Research Management System documentation",
    styles: {
      default: {
        document: {
          styles: [{ id: "Normal", run: { font: "Calibri", size: 22 } }],
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: parseTxtToParagraphs(text),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_PATH, buffer);
  console.log("Written:", OUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
