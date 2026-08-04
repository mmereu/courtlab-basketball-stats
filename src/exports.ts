import {
  calculateLine, calculateOpponentStats, calculateStats, calculateTeamStats, formatClock,
  formatMinutes, GameState, opponentScoreTotal, pct,
} from "./domain";
import type { Worksheet } from "exceljs";

const columns = [
  "Giocatore", "PT", "MIN", "+/-", "2P", "2P%", "3P", "3P%", "TL", "TL%",
  "RT", "RO", "RD", "PP", "PR", "AS", "STF", "STS", "FS", "FC", "CPF", "CPS", "VAL",
];

export const periodColumns = [
  "Periodo", "PT", "PT avversario", "2P", "3P", "TL", "RT", "PR", "PP", "AS", "CPF", "CPS", "VAL",
];

function fileBase(state: GameState) {
  const date = new Date().toISOString().slice(0, 10);
  const teams = `${state.teamName}-${state.opponentName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `statistiche-${teams}-${date}`;
}

async function reportLogo(state: GameState) {
  const source = state.teamLogoUrl || "/novara-basket-v4.jpeg";
  if (source.startsWith("data:image/")) return source;
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error("Impossibile caricare il logo per il report");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function statRow(
  name: string,
  row: ReturnType<typeof calculateTeamStats>,
  fastBreakPointsAgainst = 0,
  secondsPlayed?: number,
  plusMinus?: number,
) {
  return [
    name,
    row.pts,
    secondsPlayed === undefined ? "—" : formatMinutes(secondsPlayed),
    plusMinus === undefined ? "—" : plusMinus,
    `${row.twoPm}/${row.twoPa}`,
    pct(row.twoPm, row.twoPa),
    `${row.threePm}/${row.threePa}`,
    pct(row.threePm, row.threePa),
    `${row.ftm}/${row.fta}`,
    pct(row.ftm, row.fta),
    row.oreb + row.dreb,
    row.oreb,
    row.dreb,
    row.tov,
    row.stl,
    row.ast,
    row.blk,
    row.blockedAgainst,
    row.foulDrawn,
    row.foul,
    row.fastBreakPoints,
    fastBreakPointsAgainst,
    row.pir,
  ];
}

function playerRows(state: GameState) {
  return calculateStats(state).map((row) =>
    statRow(`#${row.player.number} ${row.player.name}`, row, 0, row.secondsPlayed, row.plusMinus));
}

export function periodRows(state: GameState) {
  const maxPeriod = Math.max(4, state.period, ...state.events.map((event) => event.period));
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);
  const groups = [
    ...periods.map((period) => ({
      label: period <= 4 ? `Q${period}` : `OT${period - 4}`,
      periods: [period],
    })),
    { label: "1° TEMPO (Q1+Q2)", periods: [1, 2] },
    { label: "2° TEMPO (Q3+Q4)", periods: [3, 4] },
    { label: "TOTALE 4 QUARTI", periods: [1, 2, 3, 4] },
    ...(maxPeriod > 4 ? [{ label: "TOTALE GARA + OT", periods }] : []),
  ];
  return groups.map((group) => {
    const own = calculateLine(state.events.filter((event) => !event.isOpponent && group.periods.includes(event.period)));
    const opponent = calculateLine(state.events.filter((event) => event.isOpponent && group.periods.includes(event.period)));
    return [
      group.label,
      own.pts,
      opponent.pts,
      `${own.twoPm}/${own.twoPa}`,
      `${own.threePm}/${own.threePa}`,
      `${own.ftm}/${own.fta}`,
      own.oreb + own.dreb,
      own.stl,
      own.tov,
      own.ast,
      own.fastBreakPoints,
      opponent.fastBreakPoints,
      own.pir,
    ];
  });
}

export async function exportGamePdf(state: GameState) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const team = calculateTeamStats(state);
  const opponent = calculateOpponentStats(state);
  const logo = await reportLogo(state);
  const logoFormat = logo.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(17, 23, 20);
  doc.rect(0, 0, 297, 35, "F");
  doc.setTextColor(255, 184, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COURTLAB · REPORT STATISTICHE", 14, 12);
  doc.setTextColor(245, 247, 246);
  doc.setFontSize(19);
  doc.text(`${state.teamName}  ${team.pts} — ${opponentScoreTotal(state)}  ${state.opponentName}`, 14, 24);
  doc.setFontSize(9);
  doc.setTextColor(105, 114, 109);
  doc.text(`Periodo ${state.period} · ${formatClock(state.clock)} · ${state.events.length} eventi`, 14, 31);
  doc.addImage(logo, logoFormat, 262, 4, 27, 27, undefined, "FAST");

  autoTable(doc, {
    startY: 43,
    head: [columns],
    body: [
      statRow("SQUADRA", team, opponent.fastBreakPoints),
      ...playerRows(state),
    ],
    styles: { fontSize: 7.2, cellPadding: 2.1, halign: "center" },
    headStyles: { fillColor: [31, 40, 35], textColor: [236, 241, 237], fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", cellWidth: 34 } },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = [244, 235, 214];
        data.cell.styles.textColor = [54, 45, 28];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  doc.setTextColor(90, 98, 94);
  doc.setFontSize(8);
  doc.text(
    "VAL = PT + RT + AS + PR + STF + FS - tiri sbagliati - TL sbagliati - PP - FC - STS",
    14,
    Math.min(finalY + 9, 198),
  );
  doc.addPage("a4", "landscape");
  doc.addImage(logo, logoFormat, 266, 5, 18, 18, undefined, "FAST");
  doc.setTextColor(25, 34, 29);
  doc.setFontSize(16);
  doc.text("STATISTICHE PER QUARTO", 14, 16);
  autoTable(doc, {
    startY: 23,
    head: [periodColumns],
    body: periodRows(state),
    styles: { fontSize: 9, cellPadding: 3, halign: "center" },
    headStyles: { fillColor: [31, 40, 35], textColor: [255, 255, 255] },
  });
  doc.save(`${fileBase(state)}.pdf`);
}

export async function exportGameExcel(state: GameState) {
  const { default: ExcelJS } = await import("exceljs");
  const team = calculateTeamStats(state);
  const opponent = calculateOpponentStats(state);
  const logo = await reportLogo(state);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CourtLab";
  workbook.created = new Date();
  const logoId = workbook.addImage({
    base64: logo,
    extension: logo.startsWith("data:image/jpeg") ? "jpeg" : "png",
  });

  const decorate = (sheet: Worksheet, title: string, columnCount: number) => {
    sheet.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 76, height: 76 } });
    sheet.mergeCells(1, 2, 2, Math.min(8, columnCount));
    const titleCell = sheet.getCell("B1");
    titleCell.value = title;
    titleCell.font = { bold: true, size: 18, color: { argb: "FFED643A" } };
    titleCell.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.getRow(2).height = 28;
    sheet.getRow(3).height = 8;
  };
  const styleHeader = (row: ReturnType<Worksheet["getRow"]>) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF17221D" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4C542" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB58D13" } } };
    });
    row.height = 24;
  };
  const configure = (sheet: Worksheet, widths: number[]) => {
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.views = [{ state: "frozen", ySplit: 5 }];
  };

  const summarySheet = workbook.addWorksheet("Riepilogo squadra");
  decorate(summarySheet, "COURTLAB · REPORT STATISTICHE", columns.length);
  summarySheet.addRow([]);
  [
    ["Partita", `${state.teamName} - ${state.opponentName}`],
    ["Punteggio", `${team.pts} - ${opponentScoreTotal(state)}`],
    ["Periodo", state.period],
    ["Tempo rimanente", formatClock(state.clock)],
    ["Eventi registrati", state.events.length],
    ["Palle rubate squadra", team.stl],
    ["Punti in contropiede realizzati", team.fastBreakPoints],
    ["Punti in contropiede subiti", opponent.fastBreakPoints],
  ].forEach((row) => summarySheet.addRow(row));
  summarySheet.addRow([]);
  const summaryHeader = summarySheet.addRow(columns);
  styleHeader(summaryHeader);
  summarySheet.addRow(statRow("SQUADRA", team, opponent.fastBreakPoints));
  configure(summarySheet, [28, 28, ...columns.slice(2).map(() => 11)]);

  const playersSheet = workbook.addWorksheet("Giocatori");
  decorate(playersSheet, `${state.teamName} · GIOCATORI`, columns.length);
  playersSheet.addRow([]);
  const playersHeader = playersSheet.addRow(columns);
  styleHeader(playersHeader);
  playerRows(state).forEach((row) => playersSheet.addRow(row));
  configure(playersSheet, [28, ...columns.slice(1).map(() => 11)]);

  const eventsSheet = workbook.addWorksheet("Eventi");
  const eventColumns = ["Periodo", "Tempo", "Squadra", "Giocatore", "Azione", "Punti", "Contropiede", "X", "Y", "Modificato"];
  decorate(eventsSheet, `${state.teamName} · PLAY-BY-PLAY`, eventColumns.length);
  eventsSheet.addRow([]);
  const eventsHeader = eventsSheet.addRow(eventColumns);
  styleHeader(eventsHeader);
  state.events.forEach((event) => {
    const eventPlayer = state.roster.find((player) => player.id === event.playerId);
    eventsSheet.addRow([
      event.period,
      formatClock(event.clock),
      event.isOpponent ? state.opponentName : state.teamName,
      eventPlayer ? `#${eventPlayer.number} ${eventPlayer.name}` : "Squadra / da assegnare",
      event.label,
      event.points,
      event.fastBreak ? "Sì" : "",
      event.x ?? "",
      event.y ?? "",
      event.revisedAt ? new Date(event.revisedAt).toLocaleString("it-IT") : "",
    ]);
  });
  configure(eventsSheet, [10, 12, 22, 28, 34, 10, 14, 12, 12, 20]);

  const periodsSheet = workbook.addWorksheet("Per quarto");
  decorate(periodsSheet, `${state.teamName} · STATISTICHE PER QUARTO`, periodColumns.length);
  periodsSheet.addRow([]);
  const periodsHeader = periodsSheet.addRow(periodColumns);
  styleHeader(periodsHeader);
  periodRows(state).forEach((row) => periodsSheet.addRow(row));
  configure(periodsSheet, [20, ...periodColumns.slice(1).map(() => 14)]);

  if (state.trackOpponent) {
    const opponentSheet = workbook.addWorksheet("Avversario");
    decorate(opponentSheet, `${state.opponentName} · TOTALI`, columns.length);
    opponentSheet.addRow([]);
    const opponentHeader = opponentSheet.addRow(columns);
    styleHeader(opponentHeader);
    opponentSheet.addRow(statRow(state.opponentName, opponent, team.fastBreakPoints));
    configure(opponentSheet, [28, ...columns.slice(1).map(() => 11)]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    buffer,
    `${fileBase(state)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
