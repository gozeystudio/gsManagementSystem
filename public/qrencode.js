// qrencode.js — A from-scratch QR Code encoder (ISO/IEC 18004), Byte mode only.
// No dependencies. Supports versions 1-10, error correction levels L/M/Q/H.
// This file is written to be portable: pure functions, no DOM/canvas here.

'use strict';

// ---------- GF(256) tables for Reed-Solomon ----------
const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D; // primitive polynomial for QR: x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}
function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    // poly_new = poly_old * (x - alpha^i) = poly_old*x + poly_old*alpha^i  (GF(2): subtraction == addition)
    const term = GF_EXP[i];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= gfMul(poly[j], term); // the "* alpha^i" term, same degree
      newPoly[j + 1] ^= poly[j];          // the "* x" term, shifts degree up by one
    }
    poly = newPoly;
  }
  return poly;
}
function rsEncode(dataCodewords, ecCount) {
  // rsGeneratorPoly returns coefficients in ascending-degree order (index 0 = constant term).
  // The long-division loop below needs descending order (index 0 = leading/highest-degree term,
  // which is always 1 for this monic generator) to line up with how `combined` is indexed.
  const generator = rsGeneratorPoly(ecCount).slice().reverse();
  const ec = new Array(ecCount).fill(0);
  const combined = dataCodewords.concat(ec);
  for (let i = 0; i < dataCodewords.length; i++) {
    const coef = combined[i];
    if (coef === 0) continue;
    for (let j = 0; j < generator.length; j++) {
      combined[i + j] ^= gfMul(generator[j], coef);
    }
  }
  return combined.slice(dataCodewords.length);
}

// ---------- QR version capacity tables (versions 1-10) ----------
// [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataPerBlockGroup1, numBlocksGroup2, dataPerBlockGroup2]
// Values from the QR spec, for EC levels L, M, Q, H.
const VERSION_INFO = {
  1: { L: [26, 7, 1, 19, 0, 0], M: [26, 10, 1, 16, 0, 0], Q: [26, 13, 1, 13, 0, 0], H: [26, 17, 1, 9, 0, 0] },
  2: { L: [44, 10, 1, 34, 0, 0], M: [44, 16, 1, 28, 0, 0], Q: [44, 22, 1, 22, 0, 0], H: [44, 28, 1, 16, 0, 0] },
  3: { L: [70, 15, 1, 55, 0, 0], M: [70, 26, 1, 44, 0, 0], Q: [70, 18, 2, 17, 0, 0], H: [70, 22, 2, 13, 0, 0] },
  4: { L: [100, 20, 1, 80, 0, 0], M: [100, 18, 2, 32, 0, 0], Q: [100, 26, 2, 24, 0, 0], H: [100, 16, 4, 9, 0, 0] },
  5: { L: [134, 26, 1, 108, 0, 0], M: [134, 24, 2, 43, 0, 0], Q: [134, 18, 2, 15, 2, 16], H: [134, 22, 2, 11, 2, 12] },
  6: { L: [172, 18, 2, 68, 0, 0], M: [172, 16, 4, 27, 0, 0], Q: [172, 24, 4, 19, 0, 0], H: [172, 28, 4, 15, 0, 0] },
  7: { L: [196, 20, 2, 78, 0, 0], M: [196, 18, 4, 31, 0, 0], Q: [196, 18, 2, 14, 4, 15], H: [196, 26, 4, 13, 1, 14] },
  8: { L: [242, 24, 2, 97, 0, 0], M: [242, 22, 2, 38, 2, 39], Q: [242, 22, 4, 18, 2, 19], H: [242, 26, 4, 14, 2, 15] },
  9: { L: [292, 30, 2, 116, 0, 0], M: [292, 22, 3, 36, 2, 37], Q: [292, 20, 4, 16, 4, 17], H: [292, 24, 4, 12, 4, 13] },
  10: { L: [346, 18, 2, 68, 2, 69], M: [346, 26, 4, 43, 1, 44], Q: [346, 24, 6, 19, 2, 20], H: [346, 28, 6, 15, 2, 16] },
};
const ALIGNMENT_POSITIONS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};
const EC_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

function charCountBits(version) { return version <= 9 ? 8 : 16; }

// ---------- Bit buffer ----------
class BitBuffer {
  constructor() { this.bits = []; }
  put(val, len) { for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1); }
  get length() { return this.bits.length; }
  toBytes() {
    const bytes = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | (this.bits[i + j] || 0);
      bytes.push(byte);
    }
    return bytes;
  }
}

function pickVersion(dataLen, ecLevel) {
  for (let v = 1; v <= 10; v++) {
    const info = VERSION_INFO[v][ecLevel];
    const totalDataCodewords = info[2] * info[3] + info[4] * info[5];
    const capacityBits = totalDataCodewords * 8;
    const headerBits = 4 + charCountBits(v);
    if (headerBits + dataLen * 8 <= capacityBits) return v;
  }
  throw new Error('Data too long for supported QR versions (max ~200 bytes in this implementation)');
}

function encodeDataCodewords(text, version, ecLevel) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const buf = new BitBuffer();
  buf.put(0b0100, 4); // byte mode indicator
  buf.put(bytes.length, charCountBits(version));
  for (const b of bytes) buf.put(b, 8);

  const info = VERSION_INFO[version][ecLevel];
  const totalDataCodewords = info[2] * info[3] + info[4] * info[5];
  const capacityBits = totalDataCodewords * 8;

  // Terminator (up to 4 bits of zero)
  const termLen = Math.min(4, capacityBits - buf.length);
  if (termLen > 0) buf.put(0, termLen);
  // Pad to byte boundary
  while (buf.length % 8 !== 0) buf.put(0, 1);
  // Pad bytes 0xEC/0x11 alternating
  let dataBytes = buf.toBytes();
  const padBytes = [0xEC, 0x11];
  let p = 0;
  while (dataBytes.length < totalDataCodewords) { dataBytes.push(padBytes[p % 2]); p++; }
  return dataBytes;
}

function buildFinalCodewords(dataBytes, version, ecLevel) {
  const info = VERSION_INFO[version][ecLevel];
  const [, ecPerBlock, numBlocks1, dataPerBlock1, numBlocks2, dataPerBlock2] = info;
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < numBlocks1; i++) { blocks.push(dataBytes.slice(offset, offset + dataPerBlock1)); offset += dataPerBlock1; }
  for (let i = 0; i < numBlocks2; i++) { blocks.push(dataBytes.slice(offset, offset + dataPerBlock2)); offset += dataPerBlock2; }
  const ecBlocks = blocks.map(b => rsEncode(b, ecPerBlock));

  const maxDataLen = Math.max(dataPerBlock1, dataPerBlock2 || 0);
  const interleavedData = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) if (i < block.length) interleavedData.push(block[i]);
  }
  const interleavedEc = [];
  for (let i = 0; i < ecPerBlock; i++) {
    for (const eb of ecBlocks) interleavedEc.push(eb[i]);
  }
  return interleavedData.concat(interleavedEc);
}

// ---------- Matrix construction ----------
function createMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null)); // null = not yet set
  return { size, modules };
}
function setFunctionModule(modules, r, c, val) { modules[r][c] = val ? 2 : 3; } // 2 = function-dark, 3 = function-light
function placeFinder(modules, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || cc < 0 || rr >= modules.length || cc >= modules.length) continue;
      const isBorder = (r === -1 || r === 7 || c === -1 || c === 7);
      const isRing = (r >= 0 && r <= 6 && c >= 0 && c <= 6) && (r === 0 || r === 6 || c === 0 || c === 6);
      const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      const dark = isRing || isCenter;
      setFunctionModule(modules, rr, cc, isBorder ? false : dark);
    }
  }
}
function placeTimingPatterns(modules, size) {
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) setFunctionModule(modules, 6, i, i % 2 === 0);
    if (modules[i][6] === null) setFunctionModule(modules, i, 6, i % 2 === 0);
  }
}
function placeAlignmentPatterns(modules, version) {
  const positions = ALIGNMENT_POSITIONS[version];
  if (!positions.length) return;
  for (const r of positions) {
    for (const c of positions) {
      // Skip if overlapping a finder pattern corner
      if ((r === positions[0] && c === positions[0]) ||
          (r === positions[0] && c === positions[positions.length - 1]) ||
          (r === positions[positions.length - 1] && c === positions[0])) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(modules, r + dr, c + dc, dark);
        }
      }
    }
  }
}
function placeDarkModule(modules, version) { setFunctionModule(modules, 4 * version + 9, 8, true); }

function reserveFormatAreas(modules, size) {
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) setFunctionModule(modules, 8, i, false);
    if (modules[i][8] === null) setFunctionModule(modules, i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === null) setFunctionModule(modules, 8, size - 1 - i, false);
    if (modules[size - 1 - i][8] === null) setFunctionModule(modules, size - 1 - i, 8, false);
  }
}

function bchFormatBits(ecLevel, mask) {
  const data = (EC_LEVEL_BITS[ecLevel] << 3) | mask; // 5 bits
  let g = data << 10;
  const poly = 0b10100110111; // generator for format info (degree 10)
  for (let i = 4; i >= 0; i--) {
    if (g & (1 << (i + 10))) g ^= poly << i;
  }
  const bits = (data << 10) | g;
  return bits ^ 0b101010000010010; // mask
}
function placeFormatInfo(modules, size, ecLevel, mask) {
  const bits = bchFormatBits(ecLevel, mask); // 15-bit value: bit14 = MSB ... bit0 = LSB
  const get = (i) => (bits >> i) & 1;

  // Copy 1: sequential path around the top-left finder, bit 14 down to bit 0, in spec order.
  const copy1Positions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let k = 0; k < 15; k++) {
    const bitVal = get(14 - k);
    const [r, c] = copy1Positions[k];
    modules[r][c] = bitVal ? 2 : 3;
  }
  // Copy 2, part A: bottom-left column (near bottom-left finder) — bits 14..8, descending.
  for (let k = 0; k < 7; k++) modules[size - 1 - k][8] = get(14 - k) ? 2 : 3;
  // Copy 2, part B: top-right row (near top-right finder) — bits 7..0, descending.
  for (let k = 0; k < 8; k++) modules[8][size - 8 + k] = get(7 - k) ? 2 : 3;
}

function isFunctionModule(v) { return v === 2 || v === 3; }

function applyMask(maskId, r, c) {
  switch (maskId) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function placeData(modules, size, codewords) {
  const bits = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  let bitIndex = 0;
  let dir = -1; // upward
  let col = size - 1;
  while (col > 0) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = dir === -1 ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (modules[row][c] !== null) continue; // function module, skip
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        modules[row][c] = bit; // 0/1 raw data bit (pre-mask)
        bitIndex++;
      }
    }
    dir = -dir;
    col -= 2;
  }
}

function maskDataModules(modules, size, maskId) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunctionModule(modules[r][c])) continue;
      const invert = applyMask(maskId, r, c);
      if (invert) modules[r][c] = modules[r][c] ? 0 : 1;
    }
  }
}

function penaltyScore(modules, size) {
  let score = 0;
  const dark = (r, c) => (isFunctionModule(modules[r][c]) ? (modules[r][c] === 2 ? 1 : 0) : modules[r][c]);
  // Rule 1: runs of 5+ same color in a row/col
  for (let r = 0; r < size; r++) {
    let runColor = -1, runLen = 0;
    for (let c = 0; c < size; c++) {
      const v = dark(r, c);
      if (v === runColor) runLen++;
      else { runColor = v; runLen = 1; }
      if (runLen === 5) score += 3; else if (runLen > 5) score += 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let runColor = -1, runLen = 0;
    for (let r = 0; r < size; r++) {
      const v = dark(r, c);
      if (v === runColor) runLen++;
      else { runColor = v; runLen = 1; }
      if (runLen === 5) score += 3; else if (runLen > 5) score += 1;
    }
  }
  // Rule 2: 2x2 blocks same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = dark(r, c);
      if (v === dark(r, c + 1) && v === dark(r + 1, c) && v === dark(r + 1, c + 1)) score += 3;
    }
  }
  // Rule 3: finder-like patterns 1:1:3:1:1 with 4 light either side
  const pattern1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pattern2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  function matchPattern(arr, start, pat) {
    for (let i = 0; i < pat.length; i++) if (arr[start + i] !== pat[i]) return false;
    return true;
  }
  for (let r = 0; r < size; r++) {
    const rowVals = []; for (let c = 0; c < size; c++) rowVals.push(dark(r, c));
    for (let c = 0; c <= size - 11; c++) {
      if (matchPattern(rowVals, c, pattern1) || matchPattern(rowVals, c, pattern2)) score += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    const colVals = []; for (let r = 0; r < size; r++) colVals.push(dark(r, c));
    for (let r = 0; r <= size - 11; r++) {
      if (matchPattern(colVals, r, pattern1) || matchPattern(colVals, r, pattern2)) score += 40;
    }
  }
  // Rule 4: overall dark ratio
  let darkCount = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) darkCount += dark(r, c);
  const percent = (darkCount * 100) / (size * size);
  const deviation = Math.abs(percent - 50) / 5;
  score += Math.floor(deviation) * 10;
  return score;
}

function cloneModules(modules) { return modules.map(row => row.slice()); }

function generateQRMatrix(text, ecLevel) {
  ecLevel = ecLevel || 'M';
  const dataLenEstimate = new TextEncoder().encode(text).length;
  const version = pickVersion(dataLenEstimate, ecLevel);
  const dataBytes = encodeDataCodewords(text, version, ecLevel);
  const finalCodewords = buildFinalCodewords(dataBytes, version, ecLevel);

  const { size, modules: baseModules } = createMatrix(version);
  placeFinder(baseModules, 0, 0);
  placeFinder(baseModules, 0, size - 7);
  placeFinder(baseModules, size - 7, 0);
  placeTimingPatterns(baseModules, size);
  placeAlignmentPatterns(baseModules, version);
  placeDarkModule(baseModules, version);
  reserveFormatAreas(baseModules, size);
  // Version info block for version >= 7 omitted (not needed for versions 1-10... actually needed for v7+)
  if (version >= 7) placeVersionInfo(baseModules, size, version);

  let best = null, bestScore = Infinity, bestMask = 0;
  for (let maskId = 0; maskId < 8; maskId++) {
    const modules = cloneModules(baseModules);
    placeData(modules, size, finalCodewords);
    maskDataModules(modules, size, maskId);
    placeFormatInfo(modules, size, ecLevel, maskId);
    const score = penaltyScore(modules, size);
    if (score < bestScore) { bestScore = score; best = modules; bestMask = maskId; }
  }
  // Convert to plain boolean matrix (true = dark)
  const finalMatrix = best.map(row => row.map(v => v === 1 || v === 2));
  return { size, matrix: finalMatrix, version, mask: bestMask };
}

function placeVersionInfo(modules, size, version) {
  let g = version << 12;
  const poly = 0b1111100100101;
  for (let i = 5; i >= 0; i--) if (g & (1 << (i + 12))) g ^= poly << i;
  const bits = (version << 12) | g;
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const row = Math.floor(i / 3);
    const col = i % 3;
    setFunctionModule(modules, row, size - 11 + col, !!bit);
    setFunctionModule(modules, size - 11 + col, row, !!bit);
  }
}

// (No module.exports here — this file is loaded as a plain <script> in the browser,
// so generateQRMatrix is simply available as a global function.)

// Renders a generated QR matrix onto a <canvas> element, with a proper white quiet-zone border.
// moduleSize = pixels per module; quietZone = modules of white border (4 is the spec minimum).
function renderQRToCanvas(canvas, text, ecLevel, moduleSize, quietZone) {
  moduleSize = moduleSize || 6;
  quietZone = quietZone == null ? 4 : quietZone;
  const { size, matrix } = generateQRMatrix(text, ecLevel || 'M');
  const total = (size + quietZone * 2) * moduleSize;
  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = '#000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quietZone) * moduleSize, (r + quietZone) * moduleSize, moduleSize, moduleSize);
      }
    }
  }
  return canvas;
}
