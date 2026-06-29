/**
 * Generates docs/ROLES_AND_STAGES_GUIDE.docx from ROLES_AND_STAGES_GUIDE.txt
 * Run: node src/scripts/generateRolesGuideDocx.js
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
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} = require("docx");

const IN_PATH = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.txt");
const OUT_PATH = path.resolve(__dirname, "../../../docs/ROLES_AND_STAGES_GUIDE.docx");

function isMajorDivider(line) {
  return /^={10,}/.test(line);
}

function isMinorDivider(line) {
  return /^-{10,}/.test(line);
}

function isSectionTitle(line) {
  return /^QAYBTA [A-Z]:/.test(line.trim()) || /^[0-9]+\. HORDHAC/.test(line.trim());
}

function isSubSectionTitle(line) {
  return /^[A-Z]\.[0-9]+ /.test(line.trim()) || /^[BCH]\.[0-9]+ /.test(line.trim());
}

function isBullet(line) {
  return /^\s*•/.test(line);
}

function parseLines(text) {
  const lines = text.split(/\r?\n/);
  const children = [];
  let paraBuffer = [];

  function flushParagraph() {
    const joined = paraBuffer.join(" ").trim();
    if (joined) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: joined, size: 22 })],
        })
      );
    }
    paraBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (isMajorDivider(line)) {
      flushParagraph();
      continue;
    }

    if (isMinorDivider(line)) {
      flushParagraph();
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("JAMHURIYA RESEARCH") || trimmed.startsWith("SHARAXAADDA ROLES")) {
      flushParagraph();
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: trimmed, bold: true, size: 32 })],
        })
      );
      continue;
    }

    if (trimmed.startsWith("Document for Microsoft")) {
      flushParagraph();
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: trimmed, italics: true, size: 22, color: "64748B" })],
        })
      );
      continue;
    }

    if (isSectionTitle(trimmed)) {
      flushParagraph();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 160 },
          children: [new TextRun({ text: trimmed, bold: true, size: 28, color: "0369A1" })],
        })
      );
      continue;
    }

    if (isSubSectionTitle(trimmed)) {
      flushParagraph();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: trimmed, bold: true, size: 24, color: "334155" })],
        })
      );
      continue;
    }

    if (trimmed.startsWith("DHAMAAD") || trimmed.startsWith("GitHub:")) {
      flushParagraph();
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: trimmed, size: 22 })],
        })
      );
      continue;
    }

    if (isBullet(trimmed)) {
      flushParagraph();
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: trimmed.replace(/^\s*•\s*/, ""), size: 22 })],
        })
      );
      continue;
    }

    if (/^  [a-z_]+ +—/.test(line) || /^  draft|^  submitted|^  active|^  not_required|^  paper,/.test(line)) {
      flushParagraph();
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          children: [new TextRun({ text: trimmed, size: 21, font: "Consolas" })],
        })
      );
      continue;
    }

    if (trimmed.endsWith(":") && trimmed.length < 40) {
      flushParagraph();
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [new TextRun({ text: trimmed, bold: true, size: 22 })],
        })
      );
      continue;
    }

    paraBuffer.push(trimmed);
  }

  flushParagraph();
  return children;
}

function statusLegendTable() {
  const rows = [
    ["Calamaad", "Ingiriis", "Somali", "Midab"],
    ["✓", "Done", "Waa la dhammeeyay", "Cagaar"],
    ["→", "Current step", "Hadda waa kan aad ku jirto", "Buluug"],
    ["○", "Pending", "Wali ma imaan", "Cawl"],
    ["✕", "Blocked", "Waa la xannibay", "Guduud"],
    ["—", "Skipped", "Looma baahna", "Guduud/huruud"],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) =>
      new TableRow({
        children: cells.map(
          (text) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      bold: rowIdx === 0,
                      size: 20,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    ),
  });
}

async function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error("Missing input:", IN_PATH);
    process.exit(1);
  }

  const text = fs.readFileSync(IN_PATH, "utf8");
  const body = parseLines(text);

  body.splice(
    body.findIndex((p) => p.root?.[0]?.root?.[0]?.root?.text?.includes?.("Tallaabo kasta")) + 2 || body.length,
    0,
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    statusLegendTable(),
    new Paragraph({ spacing: { after: 200 }, children: [] })
  );

  const doc = new Document({
    creator: "Jamhuriya RMS",
    title: "Sharaxaadda Roles-ka iyo Stages-ka",
    description: "Jamhuriya Research Management System — roles and workflow stages guide",
    sections: [
      {
        properties: {},
        children: body,
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
