import PDFDocument from "@react-pdf/pdfkit";

const PAGE_MARGIN = 36;
const COLORS = {
  ink: "#0f172a",
  text: "#1f2937",
  textMuted: "#5b6b7c",
  border: "#d7e3f1",
  panel: "#f8fbff",
  panelAlt: "#eef5fb",
  accent: "#0f6cbd",
  accentDark: "#0b5aa3",
  accentSoft: "#dbeafe",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  headerBg: "#edf6ff",
  headerBorder: "#bfd6eb",
  heroBg: "#ffffff",
  heroBorder: "#c7daee",
  heroLabel: "#6883a1",
};

const ensureSpace = (doc, cursor, height) => {
  const bottomLimit = doc.page.height - PAGE_MARGIN;
  if (cursor.y + height <= bottomLimit) return;
  doc.addPage();
  cursor.y = PAGE_MARGIN;
};

const drawPanel = (doc, x, y, width, height, options = {}) => {
  const { fill = COLORS.panel, stroke = COLORS.border, radius = 12, lineWidth = 1 } = options;
  doc.save();
  doc.lineWidth(lineWidth);
  doc.fillColor(fill);
  doc.strokeColor(stroke);
  doc.roundedRect(x, y, width, height, radius).fillAndStroke();
  doc.restore();
};

const drawBadge = (doc, x, y, text, color = COLORS.accent) => {
  const label = String(text || "").trim() || "N/A";
  doc.font("Helvetica-Bold").fontSize(9);
  const width = Math.max(58, doc.widthOfString(label) + 20);
  doc.save();
  doc.fillColor(color);
  doc.roundedRect(x, y, width, 20, 10).fill();
  doc.fillColor("#ffffff");
  doc.font("Helvetica-Bold").fontSize(9).text(label, x, y + 6, { width, align: "center" });
  doc.restore();
  return width;
};

const drawSectionHeading = (doc, cursor, title, subtitle) => {
  ensureSpace(doc, cursor, subtitle ? 38 : 28);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(13).text(title, PAGE_MARGIN, cursor.y);
  if (subtitle) {
    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(9).text(subtitle, PAGE_MARGIN, cursor.y + 16);
    cursor.y += 34;
    return;
  }
  cursor.y += 24;
};

const measureCardHeight = (doc, width, card) => {
  const innerWidth = width - 24;
  let height = 50;

  if (card.subtitle) {
    height += doc.heightOfString(card.subtitle, { width: innerWidth, align: "left" }) + 8;
  }

  (card.lines || []).forEach((line) => {
    height += doc.heightOfString(line, { width: innerWidth, align: "left" }) + 4;
  });

  if (card.note) {
    height += doc.heightOfString(card.note, { width: innerWidth, align: "left" }) + 10;
  }

  return Math.max(height, 132);
};

const drawSectionCard = (doc, x, y, width, height, card) => {
  drawPanel(doc, x, y, width, height, {
    fill: COLORS.panel,
    stroke: card.badgeColor || COLORS.border,
    lineWidth: 1.1,
  });

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text(card.title, x + 12, y + 12, {
    width: width - 24,
  });

  const badgeY = y + 34;
  const badgeWidth = drawBadge(doc, x + 12, badgeY, card.badge || "Info", card.badgeColor || COLORS.accent);

  if (card.badgeDetail) {
    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8.5).text(card.badgeDetail, x + 18 + badgeWidth, badgeY + 6, {
      width: width - badgeWidth - 34,
    });
  }

  let contentY = badgeY + 30;

  if (card.subtitle) {
    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8.5).text(card.subtitle, x + 12, contentY, {
      width: width - 24,
    });
    contentY += doc.heightOfString(card.subtitle, { width: width - 24 }) + 8;
  }

  (card.lines || []).forEach((line) => {
    doc.fillColor(COLORS.text).font("Helvetica").fontSize(9).text(line, x + 12, contentY, {
      width: width - 24,
    });
    contentY += doc.heightOfString(line, { width: width - 24 }) + 4;
  });

  if (card.note) {
    doc.fillColor(COLORS.textMuted).font("Helvetica-Oblique").fontSize(8.5).text(card.note, x + 12, height + y - 26, {
      width: width - 24,
      align: "left",
    });
  }
};

const drawKpiCards = (doc, cursor, cards) => {
  if (!cards?.length) return;
  const gap = 12;
  const columns = 4;
  const width = (doc.page.width - PAGE_MARGIN * 2 - gap * (columns - 1)) / columns;
  const height = 74;

  ensureSpace(doc, cursor, height);

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (width + gap);
    drawPanel(doc, x, cursor.y, width, height, {
      fill: COLORS.panelAlt,
      stroke: card.accentColor || COLORS.border,
    });

    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8).text(card.label, x + 12, cursor.y + 12, {
      width: width - 24,
    });
    doc.fillColor(card.accentColor || COLORS.accent).font("Helvetica-Bold").fontSize(15).text(card.value, x + 12, cursor.y + 28, {
      width: width - 24,
    });
    if (card.helper) {
      doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8.5).text(card.helper, x + 12, cursor.y + 50, {
        width: width - 24,
      });
    }
  });

  cursor.y += height + 14;
};

const drawAssetGrid = (doc, cursor, meta) => {
  if (!meta?.length) return;

  drawSectionHeading(doc, cursor, "Asset Snapshot", "Transformer identity, loading, and selected test context.");

  const columns = 2;
  const gap = 12;
  const width = (doc.page.width - PAGE_MARGIN * 2 - gap) / columns;
  const rowHeight = 36;
  const rows = Math.ceil(meta.length / columns);
  const boxHeight = rows * rowHeight + 18;

  ensureSpace(doc, cursor, boxHeight);
  drawPanel(doc, PAGE_MARGIN, cursor.y, doc.page.width - PAGE_MARGIN * 2, boxHeight, {
    fill: COLORS.panel,
    stroke: COLORS.border,
  });

  meta.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE_MARGIN + 14 + col * (width + gap);
    const y = cursor.y + 12 + row * rowHeight;

    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8).text(item.label, x, y, { width: width - 16 });
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(item.value || "-", x, y + 12, { width: width - 16 });
  });

  cursor.y += boxHeight + 16;
};

const drawGasTable = (doc, cursor, rows) => {
  if (!rows?.length) return;

  drawSectionHeading(doc, cursor, "Current Gas Readings", "Live values used for this report and their current IEEE status.");

  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const headerHeight = 24;
  const rowHeight = 22;
  const tableHeight = headerHeight + rows.length * rowHeight;
  const columns = [
    { key: "label", title: "Gas", width: 92 },
    { key: "value", title: "Reading", width: 92 },
    { key: "share", title: "Share of TDCG", width: 100 },
    { key: "status", title: "Condition", width: 90 },
    { key: "limit", title: "IEEE Poor Limit", width: tableWidth - 92 - 92 - 100 - 90 },
  ];

  ensureSpace(doc, cursor, tableHeight);

  drawPanel(doc, PAGE_MARGIN, cursor.y, tableWidth, tableHeight, {
    fill: "#ffffff",
    stroke: COLORS.border,
    radius: 10,
  });

  doc.save();
  doc.fillColor(COLORS.ink);
  doc.rect(PAGE_MARGIN, cursor.y, tableWidth, headerHeight).fill(COLORS.panelAlt);
  doc.restore();

  let x = PAGE_MARGIN;
  columns.forEach((column) => {
    doc.fillColor(COLORS.textMuted).font("Helvetica-Bold").fontSize(8.2).text(column.title, x + 8, cursor.y + 8, {
      width: column.width - 16,
    });
    x += column.width;
  });

  rows.forEach((row, index) => {
    const y = cursor.y + headerHeight + index * rowHeight;
    const fill = index % 2 === 0 ? "#ffffff" : "#f8fbff";
    doc.save();
    doc.rect(PAGE_MARGIN, y, tableWidth, rowHeight).fill(fill);
    doc.restore();

    let cellX = PAGE_MARGIN;
    columns.forEach((column) => {
      const value = row[column.key] ?? "-";
      const textColor = column.key === "status" ? row.statusColor || COLORS.text : COLORS.text;
      doc.fillColor(textColor).font(column.key === "label" ? "Helvetica-Bold" : "Helvetica").fontSize(8.8).text(value, cellX + 8, y + 7, {
        width: column.width - 16,
      });
      cellX += column.width;
    });
  });

  cursor.y += tableHeight + 18;
};

const drawSectionCardGrid = (doc, cursor, cards) => {
  if (!cards?.length) return;

  drawSectionHeading(doc, cursor, "Diagnostic Interpretation", "Selected diagnostic methods rendered as clean report sections.");

  const gap = 14;
  const columnWidth = (doc.page.width - PAGE_MARGIN * 2 - gap) / 2;

  for (let index = 0; index < cards.length; index += 2) {
    const rowCards = cards.slice(index, index + 2);
    const rowHeight = Math.max(...rowCards.map((card) => measureCardHeight(doc, columnWidth, card)));
    ensureSpace(doc, cursor, rowHeight);

    rowCards.forEach((card, colIndex) => {
      const x = PAGE_MARGIN + colIndex * (columnWidth + gap);
      drawSectionCard(doc, x, cursor.y, columnWidth, rowHeight, card);
    });

    cursor.y += rowHeight + 14;
  }
};

const drawVisuals = (doc, cursor, visuals) => {
  if (!visuals?.length) return;

  drawSectionHeading(doc, cursor, "Visual Snapshots", "Focused chart captures embedded into the report instead of full-page HTML screenshots.");

  visuals.forEach((visual) => {
    const imageHeight = Math.min((doc.page.width - PAGE_MARGIN * 2) * (visual.image?.aspectRatio || 0.62), 320);
    const blockHeight = imageHeight + (visual.caption ? 38 : 22);
    ensureSpace(doc, cursor, blockHeight);

    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text(visual.title, PAGE_MARGIN, cursor.y);
    if (visual.caption) {
      doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8.5).text(visual.caption, PAGE_MARGIN, cursor.y + 14, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    }

    const imageY = cursor.y + (visual.caption ? 32 : 18);
    drawPanel(doc, PAGE_MARGIN, imageY, doc.page.width - PAGE_MARGIN * 2, imageHeight + 12, {
      fill: COLORS.panel,
      stroke: COLORS.border,
    });

    if (visual.image?.src) {
      doc.image(visual.image.src, PAGE_MARGIN + 6, imageY + 6, {
        fit: [doc.page.width - PAGE_MARGIN * 2 - 12, imageHeight],
        align: "center",
        valign: "center",
      });
    }

    cursor.y += blockHeight + 14;
  });
};

const drawHistoryTable = (doc, cursor, rows) => {
  if (!rows?.length) return;

  drawSectionHeading(doc, cursor, "Recent Diagnostic History", "Latest samples up to the currently selected diagnostic date.");

  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const headerHeight = 24;
  const rowHeight = 22;
  const tableHeight = headerHeight + rows.length * rowHeight;
  const columns = [
    { key: "date", title: "Date", width: 88 },
    { key: "fault", title: "Fault", width: 92 },
    { key: "faultLabel", title: "Interpretation", width: 170 },
    { key: "condition", title: "Condition", width: 80 },
    { key: "tdcg", title: "TDCG", width: tableWidth - 88 - 92 - 170 - 80 },
  ];

  ensureSpace(doc, cursor, tableHeight);
  drawPanel(doc, PAGE_MARGIN, cursor.y, tableWidth, tableHeight, {
    fill: "#ffffff",
    stroke: COLORS.border,
  });

  doc.save();
  doc.rect(PAGE_MARGIN, cursor.y, tableWidth, headerHeight).fill(COLORS.panelAlt);
  doc.restore();

  let x = PAGE_MARGIN;
  columns.forEach((column) => {
    doc.fillColor(COLORS.textMuted).font("Helvetica-Bold").fontSize(8.2).text(column.title, x + 8, cursor.y + 8, {
      width: column.width - 16,
    });
    x += column.width;
  });

  rows.forEach((row, index) => {
    const y = cursor.y + headerHeight + index * rowHeight;
    const fill = index % 2 === 0 ? "#ffffff" : "#f8fbff";
    doc.save();
    doc.rect(PAGE_MARGIN, y, tableWidth, rowHeight).fill(fill);
    doc.restore();

    let cellX = PAGE_MARGIN;
    columns.forEach((column) => {
      const value = row[column.key] ?? "-";
      const color = column.key === "fault" ? row.faultColor || COLORS.text : COLORS.text;
      doc.fillColor(color).font(column.key === "date" ? "Helvetica-Bold" : "Helvetica").fontSize(8.8).text(value, cellX + 8, y + 7, {
        width: column.width - 16,
      });
      cellX += column.width;
    });
  });

  cursor.y += tableHeight + 16;
};

const writeFooter = (doc, report) => {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerY = doc.page.height - 22;
    doc.moveTo(PAGE_MARGIN, footerY - 8).lineTo(doc.page.width - PAGE_MARGIN, footerY - 8).strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(8).text(
      `Transformer Asset Management | ${report.footerLabel || "Diagnostics report"}`,
      PAGE_MARGIN,
      footerY,
    );
    doc.text(`Page ${index + 1 - range.start} of ${range.count}`, doc.page.width - PAGE_MARGIN - 80, footerY, {
      width: 80,
      align: "right",
    });
  }
};

export const generateDiagnosticsPdfReport = (report) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: report.title || "Transformer Diagnostic Report",
        Author: "Transformer Asset Management",
        Subject: report.subtitle || "Diagnostics report",
      },
    });
    const chunks = [];
    const cursor = { y: PAGE_MARGIN };
    const contentWidth = doc.page.width - PAGE_MARGIN * 2;

    doc.on("data", (chunk) => {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    });
    doc.on("end", () => {
      resolve({
        blob: new Blob(chunks, { type: "application/pdf" }),
        filename: report.filename || "diagnostic-report.pdf",
      });
    });
    doc.on("error", reject);

    drawPanel(doc, PAGE_MARGIN, 22, contentWidth, 92, {
      fill: COLORS.headerBg,
      stroke: COLORS.headerBorder,
      radius: 18,
      lineWidth: 1.2,
    });

    doc.fillColor(COLORS.accentDark).font("Helvetica-Bold").fontSize(22).text(report.title || "Transformer Diagnostic Report", PAGE_MARGIN + 14, 38, {
      width: contentWidth - 160,
    });
    doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(10).text(report.subtitle || "Professional transformer diagnostic summary", PAGE_MARGIN + 14, 66, {
      width: contentWidth - 180,
    });

    drawBadge(doc, PAGE_MARGIN + 14, 86, report.hero?.badge || "READY", report.hero?.badgeColor || COLORS.accent);

    const heroX = doc.page.width - PAGE_MARGIN - 168;
    drawPanel(doc, heroX, 28, 168, 72, {
      fill: COLORS.heroBg,
      stroke: COLORS.heroBorder,
    });
    doc.fillColor(COLORS.heroLabel).font("Helvetica").fontSize(8).text("Generated", heroX + 12, 40);
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(report.generatedAt || "-", heroX + 12, 52, {
      width: 144,
    });
    doc.fillColor(COLORS.heroLabel).font("Helvetica").fontSize(8).text("Sample Context", heroX + 12, 72);
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(report.hero?.context || "-", heroX + 12, 84, {
      width: 144,
    });

    cursor.y = 132;

    drawKpiCards(doc, cursor, report.kpis);
    drawAssetGrid(doc, cursor, report.assetMeta);
    drawGasTable(doc, cursor, report.gasReadings);
    drawSectionCardGrid(doc, cursor, report.sectionCards);
    drawVisuals(doc, cursor, report.visuals);
    drawHistoryTable(doc, cursor, report.historyRows);

    if (report.notes?.length) {
      drawSectionHeading(doc, cursor, "Report Notes", null);
      report.notes.forEach((note) => {
        const height = doc.heightOfString(note, { width: contentWidth }) + 8;
        ensureSpace(doc, cursor, height);
        doc.fillColor(COLORS.text).font("Helvetica").fontSize(9).text(note, PAGE_MARGIN, cursor.y, {
          width: contentWidth,
        });
        cursor.y += height;
      });
    }

    writeFooter(doc, report);

    doc.end();
  } catch (error) {
    reject(error);
  }
});
