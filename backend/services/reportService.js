import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function slugify(value) {
  return String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "report";
}

function asText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function buildReportFileName(baseName, extension) {
  const timestamp = normalizeDate().toISOString().replace(/[:.]/g, "-");
  return `${slugify(baseName)}-${timestamp}.${extension}`;
}

function scoreStatus(status) {
  const normalized = asText(status).toLowerCase();
  if (normalized === "correct") return "Correct";
  if (normalized === "partially_correct") return "Partially Correct";
  if (normalized === "incorrect") return "Incorrect";
  if (normalized === "not_found") return "Not Found";
  return asText(status, "N/A");
}

function extractReportRows(review) {
  const rows = Array.isArray(review?.lineReviews) ? review.lineReviews : [];
  return rows.map((item) => ({
    lineNumber: item?.lineNumber ?? "",
    lineText: asText(item?.lineText),
    status: scoreStatus(item?.status),
    percentage: Number.isFinite(item?.percentage) ? Number(item.percentage) : "",
    explanation: asText(item?.explanation),
    supportingRule: asText(item?.supportingRule),
    source: asText(item?.source),
    page: asText(item?.page, "N/A"),
  }));
}

function writeHeader(doc, title, metadata = []) {
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(title)
    .moveDown(0.5);

  doc.fontSize(10).font("Helvetica");
  metadata.forEach(({ key, value }) => {
    doc.text(`${key}: ${asText(value, "N/A")}`);
  });
  doc.moveDown(1);
}

function ensurePageSpace(doc, requiredHeight = 80) {
  if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

async function createPdfReport(payload) {
  const {
    sessionTitle,
    messageId,
    askedAt,
    submission,
    answer,
    review,
    language,
    sources,
  } = payload;

  const rows = extractReportRows(review);
  const date = normalizeDate(askedAt);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, left: 40, right: 40, bottom: 40 },
  });

  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  writeHeader(doc, "Compliance Audit Report", [
    { key: "Session", value: sessionTitle },
    { key: "Record", value: messageId },
    { key: "Created", value: date.toISOString() },
    { key: "Language", value: language },
    { key: "Overall Compliance", value: `${review?.overallPercentage ?? "N/A"}%` },
  ]);

  doc.font("Helvetica-Bold").fontSize(12).text("Summary");
  doc.font("Helvetica").fontSize(10).text(asText(review?.summary, "No summary provided."));
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).text("Submission");
  doc.font("Helvetica").fontSize(10).text(asText(submission, "N/A"));
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).text("Formatted Result");
  doc.font("Helvetica").fontSize(10).text(asText(answer, "N/A"));
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(12).text("Line-by-Line Audit");
  doc.moveDown(0.5);

  rows.forEach((row, index) => {
    ensurePageSpace(doc, 140);
    doc.font("Helvetica-Bold").fontSize(10).text(`${index + 1}. Line ${row.lineNumber || "N/A"} - ${row.status}`);
    doc.font("Helvetica").fontSize(10).text(`Text: ${row.lineText || "N/A"}`);
    doc.text(`Score: ${row.percentage === "" ? "N/A" : `${row.percentage}%`}`);
    doc.text(`Explanation: ${row.explanation || "N/A"}`);
    doc.text(`Supporting Rule: ${row.supportingRule || "N/A"}`);
    doc.text(`Source: ${row.source || "N/A"} (Page ${row.page || "N/A"})`);
    doc.moveDown(0.5);
  });

  if (Array.isArray(sources) && sources.length > 0) {
    ensurePageSpace(doc, 80);
    doc.font("Helvetica-Bold").fontSize(12).text("Source Snippets");
    doc.moveDown(0.4);
    sources.forEach((item, index) => {
      ensurePageSpace(doc, 60);
      doc
        .font("Helvetica")
        .fontSize(9)
        .text(
          `${index + 1}. ${asText(item?.source, "unknown")} | Page ${asText(item?.page, "N/A")} | Score ${item?.score ?? "N/A"}`,
        )
        .text(asText(item?.text, ""));
      doc.moveDown(0.4);
    });
  }

  doc.end();
  const buffer = await done;

  return {
    buffer,
    contentType: "application/pdf",
    fileName: buildReportFileName(`${sessionTitle || "compliance"}-audit-report`, "pdf"),
  };
}

async function createExcelReport(payload) {
  const { sessionTitle, messageId, askedAt, submission, answer, review, language } = payload;
  const rows = extractReportRows(review);
  const date = normalizeDate(askedAt);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Municipal RAG";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 26 },
    { header: "Value", key: "value", width: 120 },
  ];

  [
    ["Session", sessionTitle],
    ["Record", messageId],
    ["Created", date.toISOString()],
    ["Language", language],
    ["Overall Compliance (%)", review?.overallPercentage ?? "N/A"],
    ["Summary", asText(review?.summary, "No summary provided.")],
    ["Submission", asText(submission, "N/A")],
    ["Formatted Result", asText(answer, "N/A")],
  ].forEach(([field, value]) => summary.addRow({ field, value }));

  summary.getRow(1).font = { bold: true };
  summary.getColumn("value").alignment = { wrapText: true, vertical: "top" };

  const lineReviews = workbook.addWorksheet("Line Reviews");
  lineReviews.columns = [
    { header: "Line #", key: "lineNumber", width: 10 },
    { header: "Line Text", key: "lineText", width: 48 },
    { header: "Status", key: "status", width: 18 },
    { header: "Compliance %", key: "percentage", width: 14 },
    { header: "Explanation", key: "explanation", width: 56 },
    { header: "Supporting Rule", key: "supportingRule", width: 56 },
    { header: "Source", key: "source", width: 26 },
    { header: "Page", key: "page", width: 12 },
  ];

  rows.forEach((row) => lineReviews.addRow(row));
  lineReviews.getRow(1).font = { bold: true };
  ["lineText", "explanation", "supportingRule"].forEach((key) => {
    lineReviews.getColumn(key).alignment = { wrapText: true, vertical: "top" };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(buffer),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: buildReportFileName(`${sessionTitle || "compliance"}-audit-report`, "xlsx"),
  };
}

export async function buildComplianceReport(payload) {
  const format = String(payload?.format || "pdf").toLowerCase();

  if (format === "excel" || format === "xlsx") {
    return createExcelReport(payload);
  }

  return createPdfReport(payload);
}
