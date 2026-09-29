// barcode.js — A from-scratch Code128 (subset B) linear barcode encoder.
// Subset B covers ASCII 32-127 (space through DEL minus DEL), which comfortably covers the
// school's ID formats (e.g. "NIB/2026/001"). Renders directly to an inline SVG <g> of bars —
// no canvas, no library — so it can be dropped into any print/HTML view the same way the QR
// encoder is used elsewhere in this app.

// Code128B symbol table: index = symbol value (0-102), value = the 11-bit bar/space pattern
// as a string of alternating widths (bar,space,bar,space,bar,space) — 6 widths per symbol,
// each 1-4 modules wide. This is the standard Code128 pattern table.
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];
const CODE128B_START = 104, CODE128B_STOP = 106;

function code128Encode(text) {
  const chars = [...text].map(ch => {
    const code = ch.codePointAt(0);
    if (code < 32 || code > 127) throw new Error(`Character "${ch}" can't be barcoded (Code128B supports space through ~ only).`);
    return code - 32; // symbol value for subset B
  });
  const symbols = [CODE128B_START, ...chars];
  let checksum = CODE128B_START;
  chars.forEach((val, i) => { checksum += val * (i + 1); });
  symbols.push(checksum % 103, CODE128B_STOP);
  return symbols.map(v => CODE128_PATTERNS[v]).join('');
}

// Renders a barcode as an SVG string. `value` is the text to encode; returns a self-contained
// <svg> with bars plus the human-readable text underneath (the usual barcode label convention).
function renderBarcodeSvg(value, opts = {}) {
  const moduleWidth = opts.moduleWidth || 2;
  const barHeight = opts.barHeight || 50;
  const showText = opts.showText !== false;
  let widths;
  try { widths = code128Encode(value); }
  catch (e) { return `<svg viewBox="0 0 200 30"><text x="4" y="20" font-size="11" fill="#c1372b">Barcode error: ${e.message}</text></svg>`; }

  let x = 0;
  let bars = '';
  let isBar = true; // Code128 patterns always start with a bar
  for (const ch of widths) {
    const w = Number(ch) * moduleWidth;
    if (isBar) bars += `<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="#000"/>`;
    x += w;
    isBar = !isBar;
  }
  const totalWidth = x;
  const svgHeight = barHeight + (showText ? 16 : 4);
  return `<svg viewBox="0 0 ${totalWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:260px;height:auto">
    ${bars}
    ${showText ? `<text x="${totalWidth / 2}" y="${barHeight + 13}" font-size="11" font-family="monospace" text-anchor="middle" fill="#000">${value.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>` : ''}
  </svg>`;
}

// ---------- Decoding a Code128 barcode from a captured camera image ----------
// This is a genuinely different problem from generating one: it has to find the barcode inside
// a real photo, cope with imprecise module widths (varying with camera distance/angle), and
// reject anything that doesn't check out — rather than trust whatever pattern it finds.

// Scans one horizontal row of a binary (0/1) pixel array and returns the run-lengths of
// alternating black/white pixels, e.g. [12, 4, 8, 4, ...] — bar, space, bar, space...
function getRunLengths(binaryRow) {
  const runs = [];
  let current = binaryRow[0];
  let count = 1;
  for (let i = 1; i < binaryRow.length; i++) {
    if (binaryRow[i] === current) { count++; }
    else { runs.push({ value: current, length: count }); current = binaryRow[i]; count = 1; }
  }
  runs.push({ value: current, length: count });
  return runs;
}

// Converts a run of black/white lengths into Code128's 6-widths-per-symbol digit strings by
// scaling each run to the nearest whole "module" count, using the local average module width
// (the sum of the 6 runs in a symbol should be 11 modules — 13 for the start/stop pair).
function runsToModuleWidths(runLengths, moduleWidth) {
  return runLengths.map(r => Math.max(1, Math.round(r.length / moduleWidth)));
}

// Attempts to decode ONE horizontal scanline of black(1)/white(0) pixels. Returns the decoded
// string on success, or null if this particular row doesn't contain a valid, checksum-verified
// barcode — the caller tries multiple rows since real photos are noisy.
function decodeScanline(binaryRow) {
  const runs = getRunLengths(binaryRow).filter(r => r.length >= 1);
  // A Code128 start pattern is 6 runs: bar,space,bar,space,bar,space starting with a bar (1).
  // Slide a 6-run window looking for one that plausibly matches a start symbol's proportions,
  // then use ITS total width / 11 as the module width estimate for the rest of that scanline.
  for (let startIdx = 0; startIdx < runs.length - 6; startIdx++) {
    if (runs[startIdx].value !== 1) continue; // symbols always start on a bar
    const window = runs.slice(startIdx, startIdx + 6);
    const totalWidth = window.reduce((s, r) => s + r.length, 0);
    const moduleWidth = totalWidth / 11;
    if (moduleWidth < 0.5) continue; // too small to be real modules — likely noise
    const widths = runsToModuleWidths(window, moduleWidth).join('');
    const startSymbol = CODE128_PATTERNS.indexOf(widths);
    if (startSymbol !== CODE128B_START) continue;

    // Found a plausible start — decode symbol by symbol from here using the SAME module width
    // estimate, re-deriving it fresh from each symbol's own total (barcodes are rarely printed
    // at perfectly uniform scale end-to-end, especially photographed at a slight angle).
    // At each position, try a 7-run STOP window FIRST — checking whether it actually decodes to
    // the stop symbol, not just whether it's the last 7 runs in the array (real photos always
    // have some background/noise after the barcode, so "exactly 7 runs left" essentially never
    // happens and previously made stop detection silently impossible).
    let pos = startIdx;
    const values = [CODE128B_START];
    pos += 6;
    let safety = 0;
    let foundStop = false;
    while (pos + 6 <= runs.length && safety++ < 40) {
      if (pos + 7 <= runs.length) {
        const stopWindow = runs.slice(pos, pos + 7);
        const stopTotal = stopWindow.reduce((s, r) => s + r.length, 0);
        const stopModuleWidth = stopTotal / 13;
        if (stopModuleWidth >= 0.5) {
          const stopWidths = runsToModuleWidths(stopWindow, stopModuleWidth).join('');
          if (CODE128_PATTERNS.indexOf(stopWidths) === CODE128B_STOP) {
            values.push(CODE128B_STOP);
            foundStop = true;
            break;
          }
        }
      }
      const symWindow = runs.slice(pos, pos + 6);
      const symTotal = symWindow.reduce((s, r) => s + r.length, 0);
      const symModuleWidth = symTotal / 11;
      if (symModuleWidth < 0.5) break;
      const symWidths = runsToModuleWidths(symWindow, symModuleWidth).join('');
      const symValue = CODE128_PATTERNS.indexOf(symWidths);
      if (symValue === -1) break;
      values.push(symValue);
      pos += 6;
    }
    if (!foundStop || values.length < 4) continue;

    // Validate the checksum before trusting anything — this is what protects against a noisy
    // photo producing a plausible-looking but wrong result.
    const dataValues = values.slice(1, -2);
    const checksum = values[values.length - 2];
    let expected = CODE128B_START;
    dataValues.forEach((v, i) => { expected += v * (i + 1); });
    expected %= 103;
    if (expected !== checksum) continue;
    try {
      return dataValues.map(v => String.fromCodePoint(v + 32)).join('');
    } catch (e) { continue; }
  }
  return null;
}

// Public entry point: given a captured image's pixel data (RGBA, from a <canvas>), tries to
// find and decode a Code128 barcode by scanning several horizontal rows. Returns the decoded
// text, or null if nothing in the image decoded to a checksum-valid barcode.
function decodeBarcodeFromImageData(imageData, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = imageData[i * 4], g = imageData[i * 4 + 1], b = imageData[i * 4 + 2];
    gray[i] = (r * 0.299 + g * 0.587 + b * 0.114);
  }
  const rowsToTry = [];
  for (let f = 0.3; f <= 0.7; f += 0.05) rowsToTry.push(Math.floor(height * f));
  for (const y of rowsToTry) {
    const rowPixels = gray.subarray(y * width, (y + 1) * width);
    let sum = 0; for (let i = 0; i < rowPixels.length; i++) sum += rowPixels[i];
    const threshold = sum / rowPixels.length;
    const binaryRow = new Uint8Array(width);
    for (let i = 0; i < width; i++) binaryRow[i] = rowPixels[i] < threshold ? 1 : 0;
    const result = decodeScanline(binaryRow);
    if (result) return result;
  }
  return null;
}
