import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { PlotReport, ReportAiBlock, ReportRow, ReportSection, ReportTable } from "./model";
import { drawable, wrap } from "./pdf-text";

/**
 * Draws a report on A4 pages. Layout only: every text arrives already written
 * in `PlotReport`. The colours are the product's (ink, cinnabar, muted, line).
 */

const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 48;
const FOOTER_HEIGHT = 46;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const COLUMN_GAP = 24;
/** Part of a row's width given to its label; the value takes the rest. */
const LABEL_SHARE = 0.56;
/** The plot's own facts have short labels and long values. */
const FACT_LABEL_SHARE = 0.28;

const INK = rgb(0.09, 0.09, 0.102);
const CINNABAR = rgb(1, 0.388, 0.29);
const CINNABAR_DEEP = rgb(0.784, 0.216, 0.122);
const MUTED = rgb(0.357, 0.357, 0.388);
const LINE = rgb(0.824, 0.824, 0.831);

interface Style {
  readonly font: PDFFont;
  readonly size: number;
  readonly color: RGB;
  /** Distance between baselines, as a multiple of the size. */
  readonly leading: number;
}

interface Pen {
  readonly doc: PDFDocument;
  readonly supported: ReadonlySet<number>;
  page: PDFPage;
  /** Baseline of the next line, measured from the bottom of the page. */
  y: number;
}

function newPage(pen: Pen): void {
  pen.page = pen.doc.addPage([PAGE.width, PAGE.height]);
  pen.y = PAGE.height - MARGIN;
}

/** Starts a new page when fewer than `height` points are left above the footer. */
function need(pen: Pen, height: number): void {
  if (pen.y - height < MARGIN + FOOTER_HEIGHT) newPage(pen);
}

function linesOf(pen: Pen, text: string, style: Style, width: number): string[] {
  return wrap(drawable(text, pen.supported), width, (part) => style.font.widthOfTextAtSize(part, style.size));
}

/** Writes wrapped text at `x` and moves the pen down. Returns the lines written. */
function write(pen: Pen, text: string, style: Style, x = MARGIN, width = CONTENT_WIDTH): number {
  const lines = linesOf(pen, text, style, width);
  const step = style.size * style.leading;
  for (const line of lines) {
    need(pen, step);
    pen.y -= step;
    pen.page.drawText(line, { x, y: pen.y, size: style.size, font: style.font, color: style.color });
  }
  return lines.length;
}

function rule(pen: Pen, color: RGB = LINE, thickness = 0.6): void {
  pen.page.drawLine({
    start: { x: MARGIN, y: pen.y },
    end: { x: PAGE.width - MARGIN, y: pen.y },
    thickness,
    color,
  });
}

interface Styles {
  readonly brand: Style;
  readonly title: Style;
  readonly heading: Style;
  readonly subheading: Style;
  readonly tag: Style;
  readonly body: Style;
  readonly strong: Style;
  readonly label: Style;
  readonly small: Style;
}

/** Label on the left, value on the right of the same column; either may wrap. */
function writeRow(pen: Pen, row: ReportRow, styles: Styles, x: number, width: number, labelShare = LABEL_SHARE): void {
  const labelWidth = width * labelShare;
  const valueWidth = width - labelWidth - 8;
  const label = linesOf(pen, row.label, styles.label, labelWidth);
  const value = linesOf(pen, row.value, styles.strong, valueWidth);
  const step = styles.strong.size * styles.strong.leading;
  const count = Math.max(label.length, value.length);
  for (let index = 0; index < count; index += 1) {
    pen.y -= step;
    if (label[index]) {
      pen.page.drawText(label[index], { x, y: pen.y, size: styles.label.size, font: styles.label.font, color: styles.label.color });
    }
    if (value[index]) {
      const w = styles.strong.font.widthOfTextAtSize(value[index], styles.strong.size);
      pen.page.drawText(value[index], { x: x + width - w, y: pen.y, size: styles.strong.size, font: styles.strong.font, color: styles.strong.color });
    }
  }
  pen.y -= 4;
  pen.page.drawLine({ start: { x, y: pen.y }, end: { x: x + width, y: pen.y }, thickness: 0.4, color: LINE });
}

function rowHeight(pen: Pen, row: ReportRow, styles: Styles, width: number, labelShare = LABEL_SHARE): number {
  const label = linesOf(pen, row.label, styles.label, width * labelShare).length;
  const value = linesOf(pen, row.value, styles.strong, width - width * labelShare - 8).length;
  return Math.max(label, value) * styles.strong.size * styles.strong.leading + 4;
}

/** Rows in two columns, filled left to right, each pair kept on one page. */
function writeRows(pen: Pen, rows: readonly ReportRow[], styles: Styles): void {
  const width = (CONTENT_WIDTH - COLUMN_GAP) / 2;
  for (let index = 0; index < rows.length; index += 2) {
    const pair = rows.slice(index, index + 2);
    const height = Math.max(...pair.map((row) => rowHeight(pen, row, styles, width)));
    need(pen, height + 2);
    const top = pen.y;
    pair.forEach((row, column) => {
      pen.y = top;
      writeRow(pen, row, styles, MARGIN + column * (width + COLUMN_GAP), width);
    });
    pen.y = top - height;
  }
}

/** The facts that identify the plot, one per line across the whole page. */
function writeFacts(pen: Pen, rows: readonly ReportRow[], styles: Styles): void {
  for (const row of rows) {
    need(pen, rowHeight(pen, row, styles, CONTENT_WIDTH, FACT_LABEL_SHARE) + 2);
    writeRow(pen, row, styles, MARGIN, CONTENT_WIDTH, FACT_LABEL_SHARE);
    pen.y -= 2;
  }
}

function writeTable(pen: Pen, table: ReportTable, styles: Styles): void {
  need(pen, 60);
  pen.y -= 10;
  write(pen, table.title, styles.subheading);
  writeRows(pen, table.rows, styles);
}

function writeSection(pen: Pen, section: ReportSection, styles: Styles): void {
  need(pen, 120);
  pen.y -= 22;
  rule(pen, INK, 1);
  pen.y -= 4;
  write(pen, section.heading.toUpperCase(), styles.heading);
  if (section.tag) write(pen, section.tag.toUpperCase(), styles.tag);
  pen.y -= 4;
  for (const paragraph of section.paragraphs) {
    write(pen, paragraph, styles.body);
    pen.y -= 3;
  }
  if (section.rows.length > 0) {
    pen.y -= 6;
    writeRows(pen, section.rows, styles);
  }
  for (const table of section.tables) writeTable(pen, table, styles);
  if (section.notes.length > 0) pen.y -= 8;
  section.notes.forEach((note, index) => {
    // Several notes under one label (the limits) are listed under it once.
    const repeats = section.notes[index - 1]?.label === note.label;
    const opens = !repeats && section.notes[index + 1]?.label === note.label;
    if (opens) write(pen, `${note.label}:`, styles.small);
    write(pen, repeats || opens ? `- ${note.value}` : `${note.label}: ${note.value}`, styles.small);
    pen.y -= 2;
  });
}

function writeAi(pen: Pen, block: ReportAiBlock, styles: Styles): void {
  need(pen, 100);
  pen.y -= 22;
  rule(pen, CINNABAR, 2);
  pen.y -= 4;
  write(pen, block.heading.toUpperCase(), styles.heading);
  pen.y -= 4;
  if (block.intro) write(pen, block.intro, styles.body);
  for (const group of block.groups) {
    if (group.heading) {
      need(pen, 50);
      pen.y -= 10;
      write(pen, group.heading.toUpperCase(), styles.tag);
    }
    for (const point of group.points) {
      need(pen, 44);
      pen.y -= 6;
      write(pen, point.title, styles.strong);
      point.lines.forEach((line, index) =>
        write(pen, line, index === point.lines.length - 1 ? styles.small : styles.body),
      );
    }
  }
}

function writeFooters(pen: Pen, report: PlotReport, styles: Styles): void {
  const pages = pen.doc.getPages();
  pages.forEach((page, index) => {
    const y = MARGIN + FOOTER_HEIGHT - 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.6, color: LINE });
    const label = drawable(
      report.pageLabel.replace("{page}", String(index + 1)).replace("{pages}", String(pages.length)),
      pen.supported,
    );
    const labelWidth = styles.small.font.widthOfTextAtSize(label, styles.small.size);
    page.drawText(label, { x: PAGE.width - MARGIN - labelWidth, y: MARGIN, size: styles.small.size, font: styles.small.font, color: MUTED });
    const lines = linesOf(pen, report.disclaimer, styles.small, CONTENT_WIDTH - labelWidth - 24);
    lines.slice(0, 3).forEach((line, row) => {
      page.drawText(line, { x: MARGIN, y: y - 11 - row * 10, size: styles.small.size, font: styles.small.font, color: MUTED });
    });
  });
}

/** Renders the report and returns the bytes of the PDF file. */
export async function renderPlotReport(report: PlotReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(report.title);
  doc.setCreator("Before the Seed");
  doc.setProducer("Before the Seed");

  const styles: Styles = {
    brand: { font: bold, size: 9, color: INK, leading: 1.4 },
    title: { font: bold, size: 24, color: INK, leading: 1.25 },
    heading: { font: bold, size: 13, color: INK, leading: 1.5 },
    subheading: { font: bold, size: 9.5, color: INK, leading: 1.6 },
    tag: { font: bold, size: 8, color: CINNABAR_DEEP, leading: 1.6 },
    body: { font: regular, size: 10, color: INK, leading: 1.45 },
    strong: { font: bold, size: 10, color: INK, leading: 1.45 },
    label: { font: regular, size: 9.5, color: MUTED, leading: 1.45 },
    small: { font: regular, size: 8, color: MUTED, leading: 1.4 },
  };

  const first = doc.addPage([PAGE.width, PAGE.height]);
  const pen: Pen = {
    doc,
    supported: new Set(regular.getCharacterSet()),
    page: first,
    y: PAGE.height - MARGIN,
  };

  // Masthead: the brand mark, the title and when the file was made.
  pen.page.drawRectangle({ x: MARGIN, y: pen.y - 12, width: 12, height: 12, color: CINNABAR });
  pen.page.drawText("BEFORE THE SEED", { x: MARGIN + 20, y: pen.y - 10, size: styles.brand.size, font: bold, color: INK });
  pen.y -= 30;
  write(pen, report.title, styles.title);
  pen.y -= 4;
  write(pen, report.generated, styles.small);
  pen.y -= 10;
  writeFacts(pen, report.facts, styles);

  for (const block of report.ai) writeAi(pen, block, styles);
  if (report.aiNote) {
    pen.y -= 8;
    write(pen, report.aiNote, styles.small);
  }
  for (const section of report.sections) writeSection(pen, section, styles);

  writeFooters(pen, report, styles);
  return doc.save();
}
