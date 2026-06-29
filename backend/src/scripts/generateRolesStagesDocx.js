/**
 * Generates docs/ROLES_AND_STAGES_GUIDE.docx from docs/ROLES_AND_STAGES_GUIDE.txt
 * Run: node src/scripts/generateRolesStagesDocx.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} = require("docx");

const DEFAULT_TXT = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.txt");
const DEFAULT_OUT = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.docx");

function isRuleLine(line) {
  const t = line.trim();
  return t.length >= 10 && /^[=\-]+$/.test(t);
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
    while (i < lines.length && (isRuleLine(lines[i].trim()) || !lines[i].trim() || titleLines.includes(lines[i].trim()))) {
      i += 1;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isRuleLine(trimmed)) {
      const prev = (lines[i - 1] || "").trim();
      const next = (lines[i + 1] || "").trim();
      if (prev && !isRuleLine(prev) && isRuleLine(next)) {
        if (/^QAYBTA |^DHAMAAD|^1\. HORDHAC/.test(prev)) {
          children.push(new Paragraph({ text: prev, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
        }
      }
      i += 1;
      continue;
    }

    if (/^[A-C]\.\d+\s/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        })
      );
      i += 1;
      continue;
    }

    if (/^QAYBTA |^1\. HORDHAC|^DHAMAAD/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
        })
      );
      i += 1;
      continue;
    }

    if (/^(Magaca nidaamka|Sharaxaad:|Mas'uuliyadaha|Modules-ka|Ma geli|Xaddidaad:|Yaa |Xaalad|Shuruud:|Noocyada|Proposal ethicsStatus:|Ethics Application|8 Modules|Extension:|Xeerka|Bogga:|Tallaabo kasta|Kani waa)/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, bold: trimmed.endsWith(":") })],
          spacing: { after: 60 },
        })
      );
      i += 1;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed) && trimmed.length < 120) {
      children.push(
        new Paragraph({
          text: trimmed,
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("  •")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^\s*•\s*/, ""),
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
      i += 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line) && trimmed.includes("—")) {
      children.push(
        new Paragraph({
          text: trimmed,
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      );
      i += 1;
      continue;
    }

    let para = trimmed;
    while (i + 1 < lines.length) {
      const nxt = lines[i + 1].trim();
      if (!nxt || isRuleLine(nxt) || /^[A-C]\.\d+/.test(nxt) || /^QAYBTA/.test(nxt)) break;
      if (/^(Magaca|Sharaxaad|Mas'uuliyadaha|Modules|Ma geli|Xaddidaad|Yaa |Xaalad|Shuruud|Noocyada|Proposal|Ethics Application|8 Modules|Extension|Xeerka|Bogga|Tallaabo|Kani)/.test(nxt)) break;
      if (nxt.startsWith("•") || /^\d+\.\s/.test(nxt)) break;
      i += 1;
      para += ` ${nxt}`;
    }
    children.push(new Paragraph({ text: para, spacing: { after: 80 } }));
    i += 1;
  }

  const header = [];
  if (titleLines.length) {
    header.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: titleLines[0] || "JAMHURIYA RMS", bold: true, size: 32 })],
      })
    );
    if (titleLines[1]) {
      header.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: titleLines[1], bold: true, size: 28 })],
        })
      );
    }
    if (titleLines[2]) {
      header.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: titleLines[2], italics: true, size: 22, color: "64748B" })],
        })
      );
    }
    header.push(
      new Paragraph({
        border: { bottom: { color: "0369A1", space: 1, style: BorderStyle.SINGLE, size: 12 } },
        spacing: { after: 240 },
      })
    );
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
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
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
