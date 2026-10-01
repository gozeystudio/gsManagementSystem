// server.js — Nibras Educational Complex Offline School Management System
// Zero external dependencies: uses only Node.js built-ins (http, node:sqlite, crypto, fs, path).

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const url = require('node:url');
const zlib = require('node:zlib');
const os = require('node:os');
const { db, DB_PATH, DB_DIR, hashPassword, verifyPassword, logAudit, generateSequentialId, getOrCreateCheckinCredential, generateUnlockToken } = require('./db.js');
const { sendBackupEmail } = require('./mailer.js');
// Online-only Postgres/Supabase backend (see SUPABASE_MIGRATION.md) — loaded only when
// DATABASE_URL is set. The offline install never sets this, so `dbpg` stays null and every line
// below that checks USE_POSTGRES takes the original SQLite path, completely unchanged.
// Migration status: authentication, session/currentUser resolution, and public branding now run
// against Postgres when enabled. Most other endpoints below are NOT yet converted — see
// SUPABASE_MIGRATION.md for exactly which ones and the plan for the rest.
const dbpg = process.env.DATABASE_URL ? require('./db-postgres.js') : null;
const USE_POSTGRES = !!dbpg;
// Resolves which school a pre-login request is for: an explicit slug (from ?school= or the
// login form) if given, otherwise the one school in the database if this deployment only has
// one yet — so a single-school Supabase deployment works with no frontend changes, while a
// multi-school deployment works once the slug is passed through.
async function resolveSchoolPg(explicitSlug) {
  if (explicitSlug) return dbpg.getSchoolBySlug(explicitSlug);
  const { rows } = await dbpg.query('SELECT id, slug, name FROM schools', []);
  return rows.length === 1 ? rows[0] : null;
}
async function getUserByIdPg(schoolId, id) {
  const { rows } = await dbpg.query(
    `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1 AND u.school_id = $2`,
    [id, schoolId]
  );
  return rows[0] || null;
}
async function getPermissionsPg(schoolId, roleId, moduleName) {
  const { rows } = await dbpg.query('SELECT * FROM role_permissions WHERE school_id=$1 AND role_id=$2 AND module=$3', [schoolId, roleId, moduleName]);
  return rows[0] || { can_view: 0, can_add: 0, can_edit: 0, can_delete: 0, can_export: 0 };
}

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const PUBLIC_DIR = path.join(__dirname, 'public');
// DATA_DIR lets a cloud host point uploads/backups/certs at a persistent disk mounted outside
// the app folder (e.g. Render's disk), so they survive redeploys instead of being wiped along
// with the rest of the container filesystem. Left unset, everything stays exactly where the
// offline Windows install has always kept it (uploads inside public/, backups next to the app).
const UPLOADS_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'uploads') : path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const DEFAULT_BACKUP_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'backups') : path.join(__dirname, 'backups');
if (!fs.existsSync(DEFAULT_BACKUP_DIR)) fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
// Where backups are actually written — the default "backups" folder next to the app unless the
// admin has set a custom location (e.g. a USB drive or a separate backup disk) in Settings the
// first time they set this system up. Read fresh each time rather than cached once at startup,
// so changing it in Settings takes effect immediately without a restart.
function getBackupDir() {
  const settings = db.prepare('SELECT custom_backup_folder FROM school_settings WHERE id=1').get();
  const custom = settings && settings.custom_backup_folder;
  if (!custom) return DEFAULT_BACKUP_DIR;
  try {
    if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
    fs.accessSync(custom, fs.constants.W_OK);
    return custom;
  } catch (e) {
    // The custom folder is missing/unwritable (e.g. a USB drive that's been unplugged) — fall
    // back to the default rather than losing a backup entirely, and let the caller know via the
    // return value being the default so a mismatch can be surfaced in the UI if needed.
    return DEFAULT_BACKUP_DIR;
  }
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
function savePhotoFromDataUrl(dataUrl, prefix) {
  const match = /^data:image\/(png|jpe?g|webp);base64,([a-zA-Z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Please upload a valid JPG, PNG, or WEBP image.');
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('That image could not be read. Please try a different file.');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('That photo is too large. Please use an image under 3MB.');
  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return filename;
}
function deletePhotoFile(filename) {
  if (!filename) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, filename)); } catch (e) { /* ignore missing file */ }
}

// Saves any file type (not just images) from a data URL — used for Forum/Announcement
// attachments, where someone might attach a PDF or Word document rather than a photo.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB — generous for a school LAN, but bounded
function saveAttachmentFromDataUrl(dataUrl, originalName) {
  const match = /^data:([-\w.]+\/[-\w.+]+);base64,([a-zA-Z0-9+/=]+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('That file could not be read. Please try a different one.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('That file could not be read. Please try a different one.');
  if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('That file is too large. Please attach something under 8MB.');
  const safeExt = (originalName && originalName.includes('.')) ? originalName.split('.').pop().replace(/[^a-z0-9]/gi, '').slice(0, 8) : 'bin';
  const filename = `attach_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${safeExt || 'bin'}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return filename;
}

// ---------- MTN Mobile Money (Collections API) ----------
// Real integration against MTN's actual Collections API — https://momodeveloper.mtn.com.
// Needs real credentials (Subscription Key, API User, API Key) entered in Settings before any
// of this can actually reach MTN; without them, the request-payment endpoint below fails
// early with a clear message rather than pretending to succeed.
async function getMomoSettings() {
  return db.prepare(`SELECT momo_subscription_key, momo_api_user, momo_api_key, momo_target_environment, momo_base_url, momo_callback_host FROM school_settings WHERE id=1`).get() || {};
}
function momoConfigured(cfg) {
  return !!(cfg.momo_subscription_key && cfg.momo_api_user && cfg.momo_api_key);
}
async function getMomoAccessToken(cfg) {
  const auth = Buffer.from(`${cfg.momo_api_user}:${cfg.momo_api_key}`).toString('base64');
  const res = await fetch(`${cfg.momo_base_url}/collection/token/`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Ocp-Apim-Subscription-Key': cfg.momo_subscription_key },
  });
  if (!res.ok) throw new Error(`MTN MoMo authentication failed (${res.status}). Check the API credentials in Settings.`);
  const data = await res.json();
  return data.access_token;
}
async function momoRequestToPay(cfg, { amount, phone, externalId, note }) {
  const token = await getMomoAccessToken(cfg);
  const referenceId = crypto.randomUUID();
  const res = await fetch(`${cfg.momo_base_url}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': cfg.momo_target_environment || 'sandbox',
      'Ocp-Apim-Subscription-Key': cfg.momo_subscription_key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(amount), currency: 'GHS', externalId: String(externalId),
      payer: { partyIdType: 'MSISDN', partyId: phone.replace(/\D/g, '') },
      payerMessage: note || 'School fees payment', payeeNote: note || 'School fees payment',
    }),
  });
  if (res.status !== 202) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MTN MoMo declined the request (${res.status}). ${errText}`.trim());
  }
  return referenceId;
}
async function momoCheckStatus(cfg, referenceId) {
  const token = await getMomoAccessToken(cfg);
  const res = await fetch(`${cfg.momo_base_url}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Target-Environment': cfg.momo_target_environment || 'sandbox',
      'Ocp-Apim-Subscription-Key': cfg.momo_subscription_key,
    },
  });
  if (!res.ok) throw new Error(`Could not check payment status (${res.status}).`);
  return res.json(); // { status: 'PENDING'|'SUCCESSFUL'|'FAILED', financialTransactionId, reason, ... }
}

// ---------- A minimal ZIP file writer, built from scratch (no library) ----------
// Needed so a backup can bundle the database together with every uploaded image (student
// photos, the school logo, forum/announcement attachments) into one downloadable file, the
// same "implement the actual file format" approach already used for this app's PDF writer and
// Code128 barcode encoder. Standard ZIP structure: a local file header + deflated data per
// entry, followed by a central directory, followed by the end-of-central-directory record.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function createZipBuffer(entries) {
  // entries: [{ name: 'path/in/zip.txt', data: Buffer }, ...]
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0, dosDate = 0x21; // a fixed, valid DOS date (Jan 1 1980) — exact timestamp isn't important here
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed = entry.data;
    const compressed = zlib.deflateRawSync(uncompressed);
    const useStore = compressed.length >= uncompressed.length; // tiny/incompressible files: just store them raw
    const dataToWrite = useStore ? uncompressed : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataToWrite.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuf, dataToWrite);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataToWrite.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataToWrite.length;
  }
  const centralDirStart = offset;
  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(centralDirStart, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}
// Recursively collects every file under a directory as ZIP entries, prefixed with the given
// folder name inside the archive (e.g. uploads/logo.png).
function collectFilesForZip(dir, zipPrefix) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...collectFilesForZip(full, `${zipPrefix}/${name}`));
    else entries.push({ name: `${zipPrefix}/${name}`, data: fs.readFileSync(full) });
  }
  return entries;
}

// Reads a ZIP buffer back out (the counterpart to createZipBuffer above) — walks the central
// directory at the end of the file to find every entry, then reads and inflates each one.
function extractZipBuffer(buf) {
  // Find the End Of Central Directory record by scanning backward for its signature — it's
  // always near the end, but a comment field (which we never write) could in theory follow it.
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file (no end-of-central-directory record found).');
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let pos = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Corrupt ZIP central directory.');
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    // Now read the actual data via its local file header (name/extra lengths there can differ
    // in principle, so re-read them rather than assume they match the central directory).
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawData = buf.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? zlib.inflateRawSync(rawData) : Buffer.from(rawData);
    if (data.length !== uncompressedSize) throw new Error(`ZIP entry "${name}" is corrupt (size mismatch).`);
    entries.push({ name, data });
  }
  return entries;
}
// Applies an extracted-from-ZIP backup: writes nibras.db to DB_PATH and every uploads/* entry
// back into the uploads folder, recreating subfolders as needed.
function applyZipBackup(buf) {
  const entries = extractZipBuffer(buf);
  const dbEntry = entries.find(e => e.name === 'nibras.db');
  if (!dbEntry) throw new Error('This backup file has no database in it — it may not be a Nibras backup.');
  fs.writeFileSync(DB_PATH, dbEntry.data);
  for (const entry of entries) {
    if (!entry.name.startsWith('uploads/')) continue;
    const destPath = path.join(PUBLIC_DIR, entry.name);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, entry.data);
  }
}
// A backup file might be the new ZIP format (bundles uploads/images) or an older raw .db file
// from before that existed — detect which by checking for the ZIP signature, so both kinds of
// backup can still be restored.
function isZipFile(buf) {
  return buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
}

function createBackupFile(userId) {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const filename = `Nibras_Backup_${stamp}.zip`;
  const dest = path.join(getBackupDir(), filename);
  db.exec('PRAGMA wal_checkpoint(FULL);');
  const entries = [
    { name: 'nibras.db', data: fs.readFileSync(DB_PATH) },
    ...collectFilesForZip(UPLOADS_DIR, 'uploads'),
  ];
  fs.writeFileSync(dest, createZipBuffer(entries));
  db.prepare('INSERT INTO backups (filename, created_by) VALUES (?,?)').run(filename, userId || null);
  return filename;
}

// ---------- Weekly automatic backup email (checked hourly; only acts on Fridays) ----------
// This only works while the server is actually running with internet access at the time —
// there is no way around that for a self-hosted, offline-first system without a cloud component.
async function checkWeeklyBackupEmail() {
  try {
    const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
    if (!settings.auto_backup_email_enabled || !settings.backup_email || !settings.smtp_host) return;
    const now = new Date();
    const isFriday = now.getDay() === 5;
    if (!isFriday) return;
    const todayStr = now.toISOString().slice(0, 10);
    if (settings.last_auto_backup_sent_date === todayStr) return; // already sent today
    const filename = createBackupFile(null);
    try {
      await sendBackupEmail({
        host: settings.smtp_host, port: settings.smtp_port, secure: !!settings.smtp_secure,
        username: settings.smtp_username, password: settings.smtp_password,
        to: settings.backup_email, attachmentPath: path.join(getBackupDir(), filename),
      });
      db.prepare('UPDATE school_settings SET last_auto_backup_sent_date=?, last_auto_backup_status=? WHERE id=1').run(todayStr, 'Sent successfully (automatic)');
      logAudit(null, 'Automatic weekly backup email sent', 'backup', { filename });
    } catch (e) {
      db.prepare('UPDATE school_settings SET last_auto_backup_status=? WHERE id=1').run('Failed: ' + e.message);
      logAudit(null, 'Automatic weekly backup email failed', 'backup', { filename, error: e.message });
    }
  } catch (e) {
    console.error('Weekly backup email check failed:', e.message);
  }
}

// ---------- Sessions (in-memory) ----------
const sessions = new Map(); // token -> { userId, schoolId, expires }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function createSession(userId, schoolId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, schoolId: schoolId || null, expires: Date.now() + SESSION_TTL_MS });
  return token;
}
function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) { sessions.delete(token); return null; }
  s.expires = Date.now() + SESSION_TTL_MS; // sliding expiry
  return s;
}
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function getUserById(id) {
  return db.prepare(`SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`).get(id);
}

function getPermissions(roleId, moduleName) {
  return db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(roleId, moduleName)
    || { can_view: 0, can_add: 0, can_edit: 0, can_delete: 0, can_export: 0 };
}

// ---------- Helpers ----------
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ---------- RTF (Word-compatible) export for assignments/quizzes/exams ----------
// RTF is a plain-text format Word opens and edits natively — chosen over hand-rolling a real
// .docx (a ZIP of XML files) because RTF's much simpler structure is far less likely to contain
// a subtle, hard-to-verify bug that corrupts the file for the person trying to open it.
// A sensible auto-remark when a teacher hasn't typed one in for a subject — mirrors the same
// function in public/app.js so the Word/PDF downloads never disagree with the on-screen report
// card about what a blank remark should say.
function remarkForGrade(grade) {
  const g = String(grade || '').trim();
  const remarks = {
    '1': 'Excellent', '2': 'Very Good', '3': 'Good', '4': 'Credit', '5': 'Credit',
    '6': 'Credit', '7': 'Pass', '8': 'Pass', '9': 'Needs Improvement',
    A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Credit', E: 'Pass', F: 'Needs Improvement',
  };
  return remarks[g] || '';
}
function ordinal(n) {
  n = Number(n);
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function escapeRtf(text) {
  if (text == null) return '';
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
    else if (ch === '\n') out += '\\par ';
    else if (code > 127) out += `\\u${code}?`;
    else out += ch;
  }
  return out;
}
function generateAssignmentRtf(assignment, questions, school) {
  const lines = [];
  lines.push('{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22');
  lines.push(`{\\b\\fs32 ${escapeRtf(school.school_name || 'School')}}\\par`);
  lines.push(`{\\i ${escapeRtf('"' + (school.motto || '') + '"')}}\\par\\par`);
  lines.push(`{\\b\\fs28 ${escapeRtf(assignment.title)}}\\par`);
  lines.push(`{\\b Type:} ${escapeRtf(assignment.type)}   {\\b Class:} ${escapeRtf(assignment.class_name || '—')}   {\\b Subject:} ${escapeRtf(assignment.subject_name || '—')}\\par`);
  if (assignment.due_date) lines.push(`{\\b Due:} ${escapeRtf(assignment.due_date)}\\par`);
  lines.push('\\par');
  if (assignment.instructions) {
    lines.push(`{\\b Instructions:} ${escapeRtf(assignment.instructions)}\\par\\par`);
  }
  lines.push(`{\\b Name: ________________________     Date: ______________}\\par\\par`);
  questions.forEach((q, i) => {
    lines.push(`{\\b ${i + 1}.} ${escapeRtf(q.question_text)} {\\i (${q.marks} mark${q.marks == 1 ? '' : 's'})}\\par`);
    if (q.question_type === 'mcq' && q.options) {
      let opts = [];
      try { opts = JSON.parse(q.options); } catch (e) { opts = []; }
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      opts.forEach((opt, oi) => lines.push(`     ${letters[oi] || oi + 1}) ${escapeRtf(opt)}\\par`));
    } else {
      lines.push('     _______________________________________________\\par');
      lines.push('     _______________________________________________\\par');
    }
    lines.push('\\par');
  });
  lines.push('}');
  return lines.join('\n');
}

// Builds a simple RTF table row. `widths` are cumulative right-edges in twips (1/1440 inch);
// `cells` are the already-RTF-escaped cell contents, one per column.
function rtfTableRow(widths, cells, opts = {}) {
  const border = '\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10';
  let row = '\\trowd\\trgaph80\\trleft0';
  widths.forEach(w => { row += `${border}\\cellx${w}`; });
  const boldOn = opts.bold ? '\\b ' : '';
  cells.forEach(c => { row += `\\pard\\intbl${opts.center ? '\\qc' : ''} ${boldOn}${c}\\cell`; });
  row += '\\row';
  return row;
}

// Builds a Word-compatible RTF version of a report card — the "Download as Word" option,
// mirroring buildReportCardHtml's content but in RTF's own table/paragraph syntax rather than
// HTML, since RTF is what Word actually opens natively without needing any library to write it.
// ---------- Minimal from-scratch PDF writer (no library — same spirit as the QR encoder) ----------
// Only supports what a report card needs: positioned text in one or two weights of Helvetica,
// and straight lines for a table grid. Good enough for a clean one-page report, not a general
// PDF toolkit.
function pdfEscapeText(str) {
  // PDF's base Latin text encoding doesn't cover arbitrary Unicode. Common "fancy" punctuation
  // gets swapped for plain ASCII first (rather than falling through to "?"), since it's common
  // in generated text like em-dashes between fields; anything else outside Latin-1 becomes "?".
  const substitutions = { '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2026': '...' };
  return String(str == null ? '' : str)
    .replace(/[\u2014\u2013\u2018\u2019\u201C\u201D\u2026]/g, (ch) => substitutions[ch])
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (ch) => (ch.codePointAt(0) <= 255 ? ch : '?'));
}
function buildSimplePdf(pageWidth, pageHeight, contentStream) {
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`);
  const streamBytes = Buffer.byteLength(contentStream, 'latin1');
  objects.push(`<< /Length ${streamBytes} >>\nstream\n${contentStream}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
// Small helper for building a content stream: positioned text lines and straight lines, in PDF
// user-space points where (0,0) is the bottom-left corner of the page.
function pdfContentBuilder() {
  const ops = [];
  return {
    text(x, y, str, size, bold) {
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfEscapeText(str)}) Tj ET`);
    },
    line(x1, y1, x2, y2, width) {
      ops.push(`${width || 1} w ${x1} ${y1} m ${x2} ${y2} l S`);
    },
    build() { return ops.join('\n'); },
  };
}

// Builds a one-page A4 PDF version of a report card, using the from-scratch writer above.
function generateReportCardPdf(rc) {
  const pageW = 595, pageH = 842;
  const c = pdfContentBuilder();
  let y = 800;
  const centerText = (str, size, bold) => { c.text((pageW - str.length * size * 0.5) / 2, y, str, size, bold); };

  centerText(rc.school.school_name || 'School', 20, true); y -= 22;
  centerText(`"${rc.school.motto || ''}"`, 11); y -= 26;
  centerText(`TERMINAL REPORT CARD  —  ${rc.academic_year}  —  ${rc.term}`, 13, true); y -= 26;

  const s = rc.student;
  c.text(50, y, `Name: ${s.first_name} ${s.last_name}`, 11, true);
  c.text(300, y, `Student ID: ${s.student_id}`, 11, true); y -= 16;
  c.text(50, y, `Class: ${rc.class_name || '-'}`, 11, true); y -= 20;

  // Table
  const colX = [50, 160, 205, 250, 300, 350, 400, 430];
  const tableRight = 545;
  const headerLabels = ['Subject', 'CA/60', 'CA 50%', 'Exam/100', 'Exam 50%', 'Final', 'Grade', 'Remarks'];
  const rowHeight = 18;
  const tableTop = y;
  c.line(50, y + 4, tableRight, y + 4, 1);
  headerLabels.forEach((label, i) => c.text(colX[i] + 3, y - 10, label, 8.5, true));
  y -= rowHeight;
  c.line(50, y + 4, tableRight, y + 4, 1);
  (rc.results || []).forEach(r => {
    const cells = [r.subject_name, r.ca_total != null ? Math.round(r.ca_total) : '-', r.ca_scaled != null ? Math.round(r.ca_scaled) : '-',
      r.exam_score ?? '-', r.exam_scaled != null ? Math.round(r.exam_scaled) : '-', r.final_score != null ? Math.round(r.final_score) : '-',
      r.grade || '-', r.teacher_comment || remarkForGrade(r.grade)];
    cells.forEach((val, i) => c.text(colX[i] + 3, y - 10, String(val), 8.5));
    y -= rowHeight;
    c.line(50, y + 4, tableRight, y + 4, 0.5);
  });
  colX.forEach(x => c.line(x, tableTop + 4, x, y + 4, 0.5));
  c.line(tableRight, tableTop + 4, tableRight, y + 4, 0.5);
  y -= 16;

  c.text(50, y, `Average Score: ${rc.average}`, 10.5, true);
  c.text(220, y, `Overall Grade: ${rc.overall_grade}`, 10.5, true);
  c.text(380, y, `Class Position: ${rc.class_rank ? ordinal(rc.class_rank) + ' of ' + rc.class_size : '-'}`, 10.5, true);
  y -= 16;
  if (rc.pass_mark != null) {
    c.text(50, y, `Pass Mark: ${rc.pass_mark}`, 10.5, true);
    c.text(220, y, `Result: ${rc.overall_result || '-'}`, 10.5, true);
    y -= 16;
  }
  c.text(50, y, `Attendance: ${rc.attendance.present}/${rc.attendance.total} days present`, 10.5); y -= 50;

  c.line(50, y, 190, y, 1); c.line(230, y, 370, y, 1); c.line(410, y, 545, y, 1);
  c.text(50, y - 12, "Class Teacher's Signature", 8.5);
  c.text(230, y - 12, "Head Teacher's Signature", 8.5);
  c.text(410, y - 12, "Parent/Guardian's Signature", 8.5);

  return buildSimplePdf(pageW, pageH, c.build());
}

function generateReportCardRtf(rc, gradingRows) {
  const s = rc.student;
  const lines = [];
  lines.push('{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs20');
  lines.push(`\\qc{\\b\\fs32 ${escapeRtf(rc.school.school_name || 'School')}}\\par`);
  lines.push(`{\\i\\fs20 "${escapeRtf(rc.school.motto || '')}"}\\par\\par`);
  lines.push(`{\\b\\fs24 TERMINAL REPORT CARD — ${escapeRtf(rc.academic_year)} — ${escapeRtf(rc.term)}}\\par\\par`);
  lines.push('\\ql');
  lines.push(`{\\b Name:} ${escapeRtf(s.first_name + ' ' + s.last_name)}    {\\b Student ID:} ${escapeRtf(s.student_id)}    {\\b Class:} ${escapeRtf(rc.class_name)}\\par\\par`);

  const w = [1600, 3300, 4200, 5100, 6000, 6900, 7600, 10600];
  lines.push(rtfTableRow(w, ['Subject', 'CA/60', 'CA 50%', 'Exam/100', 'Exam 50%', 'Final', 'Grade', 'Remarks'].map(escapeRtf), { bold: true, center: true }));
  (rc.results || []).forEach(r => {
    lines.push(rtfTableRow(w, [
      escapeRtf(r.subject_name),
      r.ca_total != null ? String(Math.round(r.ca_total)) : '—',
      r.ca_scaled != null ? String(Math.round(r.ca_scaled)) : '—',
      r.exam_score != null ? String(r.exam_score) : '—',
      r.exam_scaled != null ? String(Math.round(r.exam_scaled)) : '—',
      r.final_score != null ? String(Math.round(r.final_score)) : '—',
      escapeRtf(r.grade || '-'),
      escapeRtf(r.teacher_comment || remarkForGrade(r.grade)),
    ], { center: true }));
  });
  lines.push('\\par\\pard\\par');
  lines.push(`{\\b Average Score:} ${rc.average}    {\\b Overall Grade:} ${escapeRtf(rc.overall_grade)}    {\\b Class Position:} ${rc.class_rank ? ordinal(rc.class_rank) + ' out of ' + rc.class_size : '—'}\\par`);
  if (rc.pass_mark != null) {
    lines.push(`{\\b Pass Mark:} ${rc.pass_mark}    {\\b Result:} ${escapeRtf(rc.overall_result || '—')}\\par`);
  }
  lines.push(`{\\b Attendance:} ${rc.attendance.present}/${rc.attendance.total} days present\\par\\par\\par`);
  lines.push('{\\b ____________________}          {\\b ____________________}          {\\b ____________________}\\par');
  lines.push("Class Teacher's Signature          Head Teacher's Signature          Parent/Guardian's Signature\\par");
  lines.push('}');
  return lines.join('\n');
}

// ---------- Staff Check-in / Check-out ----------
// Toggles a person's attendance for today: first scan/entry of the day = check-in, second =
// check-out, third+ = already done (doesn't silently overwrite a completed day).
function performCheckin(personType, personId, method, photoDataUrl) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  let photoFile = null;
  if (photoDataUrl) {
    try { photoFile = savePhotoFromDataUrl(photoDataUrl, 'checkin'); } catch (e) { /* don't block check-in over a bad photo */ }
  }
  const record = db.prepare('SELECT * FROM staff_attendance WHERE person_type=? AND person_id=? AND date=?').get(personType, personId, today);
  if (!record) {
    db.prepare('INSERT INTO staff_attendance (person_type, person_id, date, check_in_time, method, photo) VALUES (?,?,?,?,?,?)').run(personType, personId, today, time, method, photoFile);
    return { action: 'checked_in', time };
  }
  if (!record.check_out_time) {
    db.prepare('UPDATE staff_attendance SET check_out_time=?, checkout_photo=? WHERE id=?').run(time, photoFile, record.id);
    return { action: 'checked_out', time, checkInTime: record.check_in_time };
  }
  return { action: 'already_done', checkInTime: record.check_in_time, checkOutTime: record.check_out_time };
}
function findPersonByToken(token) {
  const cred = db.prepare('SELECT * FROM checkin_credentials WHERE token=?').get(token);
  if (!cred) return null;
  const table = cred.person_type === 'teacher' ? 'teachers' : 'staff';
  const person = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(cred.person_id);
  if (!person) return null;
  return { cred, person, name: person.full_name };
}
function sendHtmlPage(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
function escapeHtmlServer(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Renders the plain confirmation page a phone shows after scanning a staff QR code — no login,
// no app chrome, just a clear result, since whoever is holding the phone is standing at the gate.
function handleCheckinPage(res, token) {
  const found = findPersonByToken(token);
  const settings = db.prepare('SELECT school_name, motto, logo_photo FROM school_settings WHERE id=1').get();
  const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
  const wrap = (title, message, sub) => sendHtmlPage(res, 200, `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — ${escapeHtmlServer(settings.school_name)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(135deg,#0a1d33,#0f2a4a);
        min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px;}
      .card{background:#fff;border-radius:16px;padding:36px 28px;max-width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);}
      img{width:64px;height:64px;border-radius:50%;object-fit:cover;margin-bottom:12px;}
      h1{font-size:18px;color:#0f2a4a;margin:0 0 4px;}
      p.motto{color:#c8973a;font-style:italic;font-size:13px;margin:0 0 20px;}
      .message{font-size:20px;font-weight:800;color:#1f8a54;margin:10px 0;}
      .sub{color:#6b7684;font-size:14px;}
    </style></head><body><div class="card">
      <img src="${logoUrl}" alt="">
      <h1>${escapeHtmlServer(settings.school_name)}</h1>
      <p class="motto">"${escapeHtmlServer(settings.motto)}"</p>
      <div class="message">${message}</div>
      <div class="sub">${sub}</div>
    </div></body></html>`);
  if (!found) return wrap('Invalid Code', '⚠️ Code Not Recognized', 'This check-in code is not valid. Please contact the school office.');
  const result = performCheckin(found.cred.person_type, found.cred.person_id, 'QR');
  logAudit(null, `Staff ${result.action} via QR`, 'staff_checkin', { personType: found.cred.person_type, personId: found.cred.person_id });
  if (result.action === 'checked_in') return wrap('Checked In', `✅ Welcome, ${escapeHtmlServer(found.name)}!`, `Checked in at ${result.time}`);
  if (result.action === 'checked_out') return wrap('Checked Out', `👋 See you, ${escapeHtmlServer(found.name)}!`, `Checked in ${result.checkInTime} · Checked out ${result.time}`);
  return wrap('Already Recorded', `ℹ️ ${escapeHtmlServer(found.name)}`, `Already checked in (${result.checkInTime}) and checked out (${result.checkOutTime}) today.`);
}
// A self-service registration page for a new teacher, reached only via a one-time invite link
// (see the /api/public/teacher-invite/... endpoints) — same fields as the admin's own "Add
// Teacher" form, minus the fields only an admin should set (Salary, Status).
function handleTeacherRegisterPage(res, token) {
  const settings = db.prepare('SELECT school_name, motto, logo_photo FROM school_settings WHERE id=1').get();
  const logoUrl = settings.logo_photo ? `/uploads/${encodeURIComponent(settings.logo_photo)}` : '/assets/logo.png';
  sendHtmlPage(res, 200, `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Registration — ${escapeHtmlServer(settings.school_name)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(135deg,#0a1d33,#0f2a4a);
        min-height:100vh;margin:0;padding:24px 16px;box-sizing:border-box;}
      .card{background:#fff;border-radius:16px;padding:32px 26px;max-width:460px;margin:0 auto;box-shadow:0 20px 60px rgba(0,0,0,.3);}
      .card img{width:56px;height:56px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 10px;}
      h1{font-size:19px;color:#0f2a4a;margin:0 0 2px;text-align:center;}
      p.motto{color:#c8973a;font-style:italic;font-size:13px;margin:0 0 4px;text-align:center;}
      h2{font-size:15px;color:#0f2a4a;text-align:center;margin:0 0 20px;font-weight:600;}
      label{display:block;font-size:12.5px;font-weight:700;color:#0f2a4a;margin:14px 0 5px;}
      input,select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d8dee6;border-radius:8px;font-size:14px;font-family:inherit;}
      input:focus,select:focus{outline:2px solid #c8973a;border-color:#c8973a;}
      .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      button{width:100%;margin-top:22px;padding:13px;border:none;border-radius:10px;background:#c8973a;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
      button:disabled{opacity:.6;}
      .err{color:#c1372b;font-size:13px;margin-top:10px;display:none;}
      .success{display:none;text-align:center;}
      .success .big{font-size:40px;margin-bottom:8px;}
      .loading{text-align:center;padding:60px 0;color:#6b7684;}
    </style></head><body>
    <div class="card">
      <div id="loading-state" class="loading">Loading…</div>
      <div id="invalid-state" style="display:none;text-align:center;color:#c1372b;">
        <p id="invalid-message"></p>
      </div>
      <div id="form-state" style="display:none">
        <img src="${logoUrl}" alt="">
        <h1>${escapeHtmlServer(settings.school_name)}</h1>
        <p class="motto">"${escapeHtmlServer(settings.motto)}"</p>
        <h2>Teacher Registration</h2>
        <form id="reg-form">
          <label>Full Name *</label><input name="full_name" required>
          <div class="row2">
            <div><label>Gender</label><select name="gender"><option value="">—</option><option>Male</option><option>Female</option></select></div>
            <div><label>Phone</label><input name="phone" type="tel"></div>
          </div>
          <label>Email</label><input name="email" type="email">
          <div class="row2">
            <div><label>Qualification</label><input name="qualification" placeholder="e.g. B.Ed"></div>
            <div><label>Specialization</label><input name="specialization" placeholder="e.g. Mathematics"></div>
          </div>
          <div class="row2">
            <div><label>Level</label><select name="teacher_level"><option value="">—</option><option>Nursery</option><option>Primary</option><option>JHS</option><option>SHS</option></select></div>
            <div><label>Teaches In</label><select name="teaching_language"><option value="English">English</option><option value="Arabic">Arabic</option><option value="Both">Both</option></select></div>
          </div>
          <label>Department</label><input name="department">
          <label>Employment Date</label><input name="employment_date" type="date">
          <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
          <label>Choose a Username *</label><input name="username" required autocomplete="username">
          <label>Choose a Password * <span style="font-weight:400;color:#8a95a3">(at least 4 characters)</span></label><input name="password" type="password" required autocomplete="new-password">
          <div class="err" id="reg-error"></div>
          <button type="submit" id="reg-submit-btn">Complete Registration</button>
        </form>
      </div>
      <div id="success-state" class="success">
        <div class="big">✅</div>
        <h1>Welcome, <span id="success-name"></span>!</h1>
        <p>Your account has been created. Your Staff ID is <b id="success-staffid"></b>.</p>
        <p style="color:#6b7684;font-size:13px">You can now log in to the school system with the username and password you just chose.</p>
      </div>
    </div>
    <script>
      const token = ${JSON.stringify(token)};
      (async function init() {
        try {
          const res = await fetch('/api/public/teacher-invite/' + token);
          const data = await res.json();
          document.getElementById('loading-state').style.display = 'none';
          if (!res.ok) {
            document.getElementById('invalid-state').style.display = 'block';
            document.getElementById('invalid-message').textContent = data.error || 'This invitation link is not valid.';
            return;
          }
          document.getElementById('form-state').style.display = 'block';
        } catch (e) {
          document.getElementById('loading-state').textContent = 'Could not connect — check your internet connection and reload.';
        }
      })();
      document.getElementById('reg-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('reg-submit-btn');
        const errBox = document.getElementById('reg-error');
        errBox.style.display = 'none';
        btn.disabled = true; btn.textContent = 'Submitting…';
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        try {
          const res = await fetch('/api/public/teacher-invite/' + token + '/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration failed.');
          document.getElementById('form-state').style.display = 'none';
          document.getElementById('success-name').textContent = body.full_name;
          document.getElementById('success-staffid').textContent = data.staff_id;
          document.getElementById('success-state').style.display = 'block';
        } catch (err) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Complete Registration';
        }
      });
    </script>
    </body></html>`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > 60 * 1024 * 1024) { reject(new Error('Body too large')); req.destroy(); } chunks.push(c); });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(req, res, pathname) {
  // Uploads may live outside PUBLIC_DIR (see UPLOADS_DIR above, when DATA_DIR points at a
  // persistent disk), so they're resolved against UPLOADS_DIR directly rather than PUBLIC_DIR.
  if (pathname.startsWith('/uploads/')) {
    const uploadPath = path.join(UPLOADS_DIR, pathname.slice('/uploads/'.length));
    if (!uploadPath.startsWith(UPLOADS_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
    return fs.readFile(uploadPath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(uploadPath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? '/index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Generic CRUD factory for straightforward tables. Backend-aware: every method takes an
// (optional, SQLite-mode-ignored) schoolId last, and runs the Postgres branch — with that
// schoolId enforced on every single read/write — whenever USE_POSTGRES is set. The SQLite branch
// below is completely unchanged from before this conversion.
function crud(table, opts = {}) {
  const orderBy = opts.orderBy || 'id DESC';
  return {
    list: async (query, schoolId) => {
      if (USE_POSTGRES) {
        const clauses = ['school_id = $1'];
        const params = [schoolId];
        if (opts.filters) {
          for (const f of opts.filters) {
            if (query[f]) { params.push(query[f]); clauses.push(`${f} = $${params.length}`); }
          }
        }
        if (query.q && opts.searchFields) {
          const ors = [];
          opts.searchFields.forEach(f => { params.push(`%${query.q}%`); ors.push(`${f} ILIKE $${params.length}`); });
          clauses.push('(' + ors.join(' OR ') + ')');
        }
        const baseSql = `FROM ${table} WHERE ${clauses.join(' AND ')}`;
        const total = Number((await dbpg.query(`SELECT COUNT(*) c ${baseSql}`, params)).rows[0].c);
        const page = parseInt(query.page) || 1;
        const pageSize = Math.min(parseInt(query.pageSize) || 50, 500);
        const { rows } = await dbpg.query(`SELECT * ${baseSql} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params);
        return { rows, total, page, pageSize };
      }
      let sql = `SELECT * FROM ${table}`;
      const clauses = [];
      const params = [];
      if (opts.filters) {
        for (const f of opts.filters) {
          if (query[f]) { clauses.push(`${f} = ?`); params.push(query[f]); }
        }
      }
      if (query.q && opts.searchFields) {
        clauses.push('(' + opts.searchFields.map(f => `${f} LIKE ?`).join(' OR ') + ')');
        opts.searchFields.forEach(() => params.push(`%${query.q}%`));
      }
      if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
      sql += ` ORDER BY ${orderBy}`;
      const page = parseInt(query.page) || 1;
      const pageSize = Math.min(parseInt(query.pageSize) || 50, 500);
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) c');
      const total = db.prepare(countSql).get(...params).c;
      sql += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      const rows = db.prepare(sql).all(...params);
      return { rows, total, page, pageSize };
    },
    get: async (id, schoolId) => {
      if (USE_POSTGRES) {
        const { rows } = await dbpg.query(`SELECT * FROM ${table} WHERE id=$1 AND school_id=$2`, [id, schoolId]);
        return rows[0] || null;
      }
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    },
    create: async (data, schoolId) => {
      if (USE_POSTGRES) {
        const cols = Object.keys(data);
        const allCols = ['school_id', ...cols];
        const placeholders = allCols.map((_, i) => `$${i + 1}`).join(',');
        const { rows } = await dbpg.query(`INSERT INTO ${table} (${allCols.join(',')}) VALUES (${placeholders}) RETURNING *`, [schoolId, ...cols.map(c => data[c])]);
        return rows[0];
      }
      const cols = Object.keys(data);
      const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      const info = stmt.run(...cols.map(c => data[c]));
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(info.lastInsertRowid));
    },
    update: async (id, data, schoolId) => {
      if (USE_POSTGRES) {
        const cols = Object.keys(data);
        if (!cols.length) return (await dbpg.query(`SELECT * FROM ${table} WHERE id=$1 AND school_id=$2`, [id, schoolId])).rows[0];
        const setClause = cols.map((c, i) => `${c}=$${i + 1}`).join(',');
        const { rows } = await dbpg.query(`UPDATE ${table} SET ${setClause} WHERE id=$${cols.length + 1} AND school_id=$${cols.length + 2} RETURNING *`, [...cols.map(c => data[c]), id, schoolId]);
        return rows[0];
      }
      const cols = Object.keys(data);
      if (!cols.length) return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
      const stmt = db.prepare(`UPDATE ${table} SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`);
      stmt.run(...cols.map(c => data[c]), id);
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    },
    delete: async (id, schoolId) => {
      if (USE_POSTGRES) { await dbpg.query(`DELETE FROM ${table} WHERE id=$1 AND school_id=$2`, [id, schoolId]); return { deleted: true }; }
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); return { deleted: true };
    }
  };
}

const resources = {
  students: crud('students', { searchFields: ['first_name', 'last_name', 'student_id', 'admission_number'], filters: ['class_id', 'status', 'gender', 'orphan_status', 'uses_bus', 'pays_canteen', 'boarding_status', 'scholarship_status'] }),
  teachers: crud('teachers', { searchFields: ['full_name', 'staff_id'], filters: ['status', 'qualification', 'department', 'teaching_language', 'teacher_level'] }),
  staff: crud('staff', { searchFields: ['full_name', 'staff_id'], filters: ['employment_status', 'position', 'department'] }),
  parents_guardians: crud('parents_guardians', { searchFields: ['full_name', 'phone'], filters: ['relationship', 'status', 'pta_member'] }),
  classes: crud('classes', { orderBy: 'name ASC', filters: ['class_teacher_id', 'academic_year_id'] }),
  subjects: crud('subjects', { orderBy: 'name ASC' }),
  academic_years: crud('academic_years', { orderBy: 'id DESC' }),
  terms: crud('terms', { filters: ['academic_year_id'] }),
  buses: crud('buses', { orderBy: 'bus_number ASC' }),
  fee_types: crud('fee_types', { orderBy: 'name ASC' }),
  expenditures: crud('expenditures', { orderBy: 'expense_date DESC' }),
  weekly_targets: crud('weekly_targets', { orderBy: 'week_start_date DESC' }),
  fees: crud('fees', { filters: ['student_id', 'term_id', 'academic_year_id'] }),
  grading_system: crud('grading_system', { orderBy: 'min_score DESC' }),
  announcements: crud('announcements', { orderBy: 'id DESC' }),
  duty_roster: crud('duty_roster', { filters: ['weekday'] }),
  exam_schedule: crud('exam_schedule', { filters: ['class_id', 'term_id'], orderBy: 'exam_date ASC, start_time ASC' }),
  live_class_rooms: crud('live_class_rooms', { filters: ['class_id', 'status'], orderBy: 'id DESC' }),
  class_groups: crud('class_groups', { filters: ['class_id'] }),
  group_tasks: crud('group_tasks', { filters: ['group_id'] }),
  student_tasks: crud('student_tasks', { filters: ['student_id'], orderBy: 'id DESC' }),
  ges_schools: crud('ges_schools', { searchFields: ['school_name', 'school_code'], filters: ['category', 'region'], orderBy: 'school_name ASC' }),
  arabic_subjects: crud('arabic_subjects', { orderBy: 'display_order ASC' }),
};

// ---- Continuous Assessment scoring rules ----
// Component names, maximum marks, and the CA/Exam weight split are all configurable by the
// system admin in Settings, so a school's own CA style is respected rather than hard-coded.
function getCAConfig() {
  const s = db.prepare(`SELECT ca_c1_name, ca_c1_max, ca_c2_name, ca_c2_max, ca_c3_name, ca_c3_max,
    ca_c4_name, ca_c4_max, exam_max, ca_weight_percent, exam_weight_percent FROM school_settings WHERE id=1`).get();
  return {
    c1: { name: s.ca_c1_name || 'Class Exercise', max: s.ca_c1_max || 15 },
    c2: { name: s.ca_c2_name || 'Class Test', max: s.ca_c2_max || 15 },
    c3: { name: s.ca_c3_name || 'Group Work', max: s.ca_c3_max || 15 },
    c4: { name: s.ca_c4_name || 'Project Work', max: s.ca_c4_max || 15 },
    examMax: s.exam_max || 100,
    caWeight: s.ca_weight_percent == null ? 50 : s.ca_weight_percent,
    examWeight: s.exam_weight_percent == null ? 50 : s.exam_weight_percent,
  };
}
function clampCA(v, max) {
  const n = Number(v);
  if (isNaN(n) || n < 0) return 0;
  return n > max ? max : n;
}
function computeCA(row, cfg) {
  cfg = cfg || getCAConfig();
  const ce = clampCA(row.class_exercise, cfg.c1.max);
  const ct = clampCA(row.class_test, cfg.c2.max);
  const gw = clampCA(row.group_work, cfg.c3.max);
  const pw = clampCA(row.project_work, cfg.c4.max);
  const exam = clampCA(row.exam_score, cfg.examMax);
  const caMaxTotal = cfg.c1.max + cfg.c2.max + cfg.c3.max + cfg.c4.max;
  const ca_total = ce + ct + gw + pw;
  const ca_scaled = caMaxTotal > 0 ? (ca_total / caMaxTotal) * cfg.caWeight : 0;
  const exam_scaled = cfg.examMax > 0 ? (exam / cfg.examMax) * cfg.examWeight : 0;
  const final_score = ca_scaled + exam_scaled;
  return { class_exercise: ce, class_test: ct, group_work: gw, project_work: pw, exam_score: exam, ca_total, ca_max_total: caMaxTotal, ca_scaled, exam_scaled, final_score };
}
function gradeFor(score) {
  const grading = db.prepare('SELECT * FROM grading_system ORDER BY min_score DESC').all();
  return grading.find(g => score >= g.min_score && score <= g.max_score) || null;
}

const MODULE_FOR_RESOURCE = {
  students: 'students', teachers: 'teachers', staff: 'staff', parents_guardians: 'parents',
  classes: 'classes', subjects: 'subjects', academic_years: 'academic_sessions', terms: 'academic_sessions',
  buses: 'bus', fee_types: 'fees', fees: 'fees', expenditures: 'fees', weekly_targets: 'fees', grading_system: 'results',
  announcements: 'announcements', duty_roster: 'classes', exam_schedule: 'exam_schedule', class_groups: 'class_groups', group_tasks: 'class_groups', student_tasks: 'class_groups', live_class_rooms: 'live_class_rooms',
  ges_schools: 'students',
  arabic_subjects: 'results',
};
// Whether a request path is one the generic `/api/<resource>[/<id>]` dispatcher (further below)
// actually handles — used by the Postgres-mode safety net so the 22 resources converted there
// are let through while everything else still gets the clear "not converted yet" response.
function isConvertedResourceRoute(pathname) {
  if (pathname === '/api/attendance' || pathname === '/api/attendance/bulk') return true;
  const segs = pathname.split('/').filter(Boolean);
  if (segs[0] !== 'api' || !resources[segs[1]]) return false;
  if (segs.length > 3) return false;
  if (segs.length === 3 && !/^\d+$/.test(segs[2])) return false;
  return true;
}

// ---------- Request handler ----------
const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsed.pathname);

    // Staff QR check-in: this is what a phone's own camera app opens after scanning the
    // printed QR code, so it needs to work with NO login at all and render a plain HTML
    // page (not JSON) — whoever is holding the phone just sees a confirmation, nothing else.
    if (pathname.match(/^\/checkin\/[a-f0-9]{32}$/) && req.method === 'GET') {
      return handleCheckinPage(res, pathname.split('/')[2]);
    }
    if (pathname.match(/^\/register-teacher\/[a-f0-9]{32}$/) && req.method === 'GET') {
      return handleTeacherRegisterPage(res, pathname.split('/')[2]);
    }

    if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

    // System-wide lock: once expired, block every API call except checking status and
    // unlocking — everything else (including login) is refused until the token is entered.
    const LOCK_EXEMPT_PATHS = ['/api/system-lock-status', '/api/system-unlock'];
    if (!LOCK_EXEMPT_PATHS.includes(pathname)) {
      const lockRow = db.prepare('SELECT expiry_date, lock_message FROM system_lock WHERE id=1').get();
      const today = new Date().toISOString().slice(0, 10);
      if (lockRow && lockRow.expiry_date && today > lockRow.expiry_date) {
        return sendJSON(res, 423, { error: lockRow.lock_message || 'System access period has ended.', locked: true });
      }
    }

    // Auth
    const cookies = parseCookies(req);
    const session = cookies.nibras_session ? getSession(cookies.nibras_session) : null;
    const currentUser = session ? (USE_POSTGRES ? await getUserByIdPg(session.schoolId, session.userId) : getUserById(session.userId)) : null;

    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      if (USE_POSTGRES) {
        const school = await resolveSchoolPg((body.school || '').trim().toLowerCase());
        if (!school) return sendJSON(res, 400, { error: 'Which school is this login for? Pass "school" (its slug) with the request.' });
        const { rows } = await dbpg.query('SELECT * FROM users WHERE school_id=$1 AND username=$2', [school.id, (body.username || '').trim()]);
        const user = rows[0];
        if (!user || user.status !== 'Active' || !verifyPassword(body.password || '', user.password_salt, user.password_hash)) {
          await dbpg.logAudit(school.id, null, 'Failed login attempt', 'auth', { username: body.username });
          return sendJSON(res, 401, { error: 'Invalid username or password' });
        }
        const token = createSession(user.id, school.id);
        await dbpg.logAudit(school.id, user, 'Login', 'auth', {});
        res.setHeader('Set-Cookie', `nibras_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Strict`);
        const { rows: roleRows } = await dbpg.query('SELECT name FROM roles WHERE id=$1', [user.role_id]);
        return sendJSON(res, 200, { id: user.id, username: user.username, full_name: user.full_name, role: roleRows[0].name, role_id: user.role_id, school: school.slug });
      }
      const user = db.prepare('SELECT * FROM users WHERE username=?').get((body.username || '').trim());
      if (!user || user.status !== 'Active' || !verifyPassword(body.password || '', user.password_salt, user.password_hash)) {
        logAudit(null, 'Failed login attempt', 'auth', { username: body.username });
        return sendJSON(res, 401, { error: 'Invalid username or password' });
      }
      const token = createSession(user.id);
      logAudit(user, 'Login', 'auth', {});
      res.setHeader('Set-Cookie', `nibras_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Strict`);
      const role = db.prepare('SELECT name FROM roles WHERE id=?').get(user.role_id);
      return sendJSON(res, 200, { id: user.id, username: user.username, full_name: user.full_name, role: role.name, role_id: user.role_id });
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
      if (currentUser) {
        if (USE_POSTGRES) await dbpg.logAudit(session.schoolId, currentUser, 'Logout', 'auth', {});
        else logAudit(currentUser, 'Logout', 'auth', {});
      }
      if (cookies.nibras_session) sessions.delete(cookies.nibras_session);
      res.setHeader('Set-Cookie', 'nibras_session=; HttpOnly; Path=/; Max-Age=0');
      return sendJSON(res, 200, { ok: true });
    }

    // Public branding (no login required) — lets the login screen show the school's own
    // name/motto/logo instead of hardcoded defaults, without exposing any private settings.
    // In Postgres mode, which school is resolved via resolveSchoolPg (see its comment above).
    if (pathname === '/api/public-settings' && req.method === 'GET') {
      if (USE_POSTGRES) {
        const school = await resolveSchoolPg((parsed.query.school || '').toString().trim().toLowerCase());
        if (!school) return sendJSON(res, 400, { error: 'Which school? Pass ?school=<slug> (this deployment has more than one school and none was given).' });
        const { rows } = await dbpg.query(`SELECT school_name, motto, logo_photo, login_background, nav_theme, page_theme, nav_font_size, cursor_style, arabic_report_font, ui_font_scale, custom_accent_color, custom_bg_color FROM school_settings WHERE school_id=$1`, [school.id]);
        return sendJSON(res, 200, { ...(rows[0] || {}), school_slug: school.slug });
      }
      const s = db.prepare('SELECT school_name, motto, logo_photo, login_background, nav_theme, page_theme, nav_font_size, cursor_style, arabic_report_font, ui_font_scale, custom_accent_color, custom_bg_color FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, s || {});
    }

    // ---- Postgres-mode safety net ----
    // Converted so far: login, logout, public-settings, currentUser resolution (above), and the
    // generic /api/<resource>[/<id>] dispatcher for the 22 resources in `resources{}` (further
    // below) — students, teachers, staff, parents_guardians, classes, subjects, academic_years,
    // terms, buses, fee_types, expenditures, weekly_targets, fees, grading_system, announcements,
    // duty_roster, exam_schedule, live_class_rooms, class_groups, group_tasks, student_tasks,
    // ges_schools, arabic_subjects — plus attendance (GET /api/attendance, POST
    // /api/attendance/bulk). Everything else is not yet — see SUPABASE_MIGRATION.md.
    // Rather than let an unconverted endpoint silently run against the local, unused SQLite
    // database and return empty or wrong data (a real risk: it would look like a bug in the data,
    // not a missing feature), refuse clearly here so that's impossible. This whole block does
    // nothing in the offline install or any deployment without DATABASE_URL set.
    if (USE_POSTGRES && !isConvertedResourceRoute(pathname)) {
      return sendJSON(res, 501, { error: 'This part of the system is not available yet in this Supabase/Postgres deployment. See SUPABASE_MIGRATION.md for progress. It works normally in the offline install.' });
    }

    // Screen Lock — lets someone step away for a moment without needing to fully log back in.
    // Requires the user to already be logged in (this is not a pre-login/public endpoint);
    // unlocking only needs the short lock PIN, not the full account password.
    if (pathname === '/api/lock-status' && req.method === 'GET') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });
      const s = db.prepare('SELECT lock_enabled, lock_pin_hash FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, { enabled: !!(s && s.lock_enabled && s.lock_pin_hash) });
    }
    if (pathname === '/api/verify-lock-pin' && req.method === 'POST') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });
      const body = await readBody(req); // { pin }
      const s = db.prepare('SELECT lock_pin_hash, lock_pin_salt FROM school_settings WHERE id=1').get();
      if (!s || !s.lock_pin_hash) return sendJSON(res, 400, { error: 'No lock PIN is set up.' });
      const ok = verifyPassword(body.pin || '', s.lock_pin_salt, s.lock_pin_hash);
      if (!ok) return sendJSON(res, 401, { error: 'Incorrect PIN.' });
      return sendJSON(res, 200, { ok: true });
    }

    // Today's check-in/out summary — public (no login) so the kiosk screen itself can show it,
    // and reused by the admin Staff Check-in page for the same live picture.
    if (pathname === '/api/checkin-summary' && req.method === 'GET') {
      const today = new Date().toISOString().slice(0, 10);
      const totalTeachers = db.prepare("SELECT COUNT(*) c FROM teachers WHERE status='Active'").get().c;
      const totalStaff = db.prepare("SELECT COUNT(*) c FROM staff WHERE employment_status='Active'").get().c;
      const rows = db.prepare('SELECT person_type, check_in_time, check_out_time FROM staff_attendance WHERE date=?').all(today);
      const summarize = (type) => {
        const forType = rows.filter(r => r.person_type === type);
        const checkedIn = forType.filter(r => r.check_in_time && !r.check_out_time).length;
        const checkedOut = forType.filter(r => r.check_out_time).length;
        return { checked_in: checkedIn, checked_out: checkedOut, total_recorded: forType.length };
      };
      const visitorRows = db.prepare('SELECT check_in_time, check_out_time FROM visitor_checkins WHERE date=?').all(today);
      const visitorsIn = visitorRows.filter(r => r.check_in_time && !r.check_out_time).length;
      const visitorsOut = visitorRows.filter(r => r.check_out_time).length;
      const totalStudents = db.prepare("SELECT COUNT(*) c FROM students WHERE status='Active'").get().c;
      const studentRows = db.prepare('SELECT check_in_time, check_out_time FROM student_checkins WHERE date=?').all(today);
      const studentsIn = studentRows.filter(r => r.check_in_time && !r.check_out_time).length;
      const studentsOut = studentRows.filter(r => r.check_out_time).length;
      return sendJSON(res, 200, {
        date: today,
        teachers: { ...summarize('teacher'), total: totalTeachers },
        staff: { ...summarize('staff'), total: totalStaff },
        non_staff: { checked_in: visitorsIn, checked_out: visitorsOut, total_recorded: visitorRows.length },
        students: { checked_in: studentsIn, checked_out: studentsOut, total: totalStudents },
      });
    }

    // Admin-side: generate a one-time invite link a prospective teacher can use to fill in
    // their own details and set their own login — the actual creation endpoint was missing
    // even though the public validation/registration endpoints below already existed, so this
    // whole feature had no way to actually be started from the admin side.
    if (pathname === '/api/teacher-invites' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      db.prepare('INSERT INTO teacher_invites (token, created_by, expires_at) VALUES (?,?,?)').run(token, currentUser.id, expiresAt);
      logAudit(currentUser, 'Generate teacher invite link', 'teachers', { token });
      return sendJSON(res, 201, { token, expires_at: expiresAt, register_url: `${req.headers.origin || ''}/register-teacher/${token}` });
    }
    if (pathname === '/api/teacher-invites' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare(`SELECT ti.*, t.full_name as used_by_name FROM teacher_invites ti
        LEFT JOIN teachers t ON t.id=ti.used_by_teacher_id ORDER BY ti.id DESC LIMIT 50`).all();
      return sendJSON(res, 200, rows);
    }

    // Public teacher self-registration — validates the invite token (unused, not expired) and
    // returns the school's branding so the registration page can show it, without exposing any
    // other private data. Deliberately public: the whole point is a new hire filling this in
    // before they have any account at all.
    if (pathname.match(/^\/api\/public\/teacher-invite\/[a-f0-9]{32}$/) && req.method === 'GET') {
      const token = pathname.split('/')[4];
      const invite = db.prepare('SELECT * FROM teacher_invites WHERE token=?').get(token);
      if (!invite) return sendJSON(res, 404, { error: 'This invitation link is not valid.' });
      if (invite.used_at) return sendJSON(res, 410, { error: 'This invitation link has already been used.' });
      if (new Date(invite.expires_at) < new Date()) return sendJSON(res, 410, { error: 'This invitation link has expired — ask the school office for a new one.' });
      const settings = db.prepare('SELECT school_name, motto, logo_photo FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, { valid: true, school: settings });
    }
    if (pathname.match(/^\/api\/public\/teacher-invite\/[a-f0-9]{32}\/register$/) && req.method === 'POST') {
      const token = pathname.split('/')[4];
      const invite = db.prepare('SELECT * FROM teacher_invites WHERE token=?').get(token);
      if (!invite) return sendJSON(res, 404, { error: 'This invitation link is not valid.' });
      if (invite.used_at) return sendJSON(res, 410, { error: 'This invitation link has already been used.' });
      if (new Date(invite.expires_at) < new Date()) return sendJSON(res, 410, { error: 'This invitation link has expired — ask the school office for a new one.' });
      const body = await readBody(req);
      if (!body.full_name || !body.full_name.trim()) return sendJSON(res, 400, { error: 'Full name is required.' });
      if (!body.username || !body.username.trim()) return sendJSON(res, 400, { error: 'Choose a username.' });
      if (!body.password || body.password.length < 4) return sendJSON(res, 400, { error: 'Choose a password (at least 4 characters).' });
      const teacherRole = db.prepare("SELECT id FROM roles WHERE name='Teacher'").get();
      if (!teacherRole) return sendJSON(res, 500, { error: 'Teacher role is missing from this installation.' });
      const idSettings = db.prepare('SELECT staff_id_prefix, id_seq_digits FROM school_settings WHERE id=1').get();
      const digits = (idSettings && idSettings.id_seq_digits) || 3;
      const year = (body.employment_date && new Date(body.employment_date).getFullYear()) || new Date().getFullYear();
      // Same counter ('staff') and prefix source the admin's own "Add Teacher" form uses, so a
      // self-registered teacher's Staff ID can never collide with one created the normal way.
      const staffId = generateSequentialId((idSettings && idSettings.staff_id_prefix) || 'ST', 'staff', year, digits);
      // Self-registration deliberately excludes admin-controlled fields (Salary, Status) — a
      // new hire fills in who they are, not their own pay or employment status.
      const info = db.prepare(`INSERT INTO teachers (staff_id, full_name, gender, phone, email, qualification, specialization, employment_date, department, teacher_level, teaching_language, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'Active')`).run(
        staffId, body.full_name.trim(), body.gender || null, body.phone || null, body.email || null,
        body.qualification || null, body.specialization || null, body.employment_date || null,
        body.department || null, body.teacher_level || null, body.teaching_language || 'English'
      );
      const teacherId = Number(info.lastInsertRowid);
      const { hash, salt } = hashPassword(body.password);
      try {
        db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, linked_teacher_id) VALUES (?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, body.full_name.trim(), teacherRole.id, teacherId);
      } catch (e) {
        db.prepare('DELETE FROM teachers WHERE id=?').run(teacherId); // roll back the teacher record if the username was taken
        return sendJSON(res, 400, { error: 'That username is already taken — choose another.' });
      }
      db.prepare(`UPDATE teacher_invites SET used_at=datetime('now'), used_by_teacher_id=? WHERE id=?`).run(teacherId, invite.id);
      logAudit(null, 'Teacher self-registered via invite link', 'teachers', { teacherId, staffId });
      return sendJSON(res, 201, { ok: true, staff_id: staffId });
    }

    // PIN kiosk check-in (no login required — this runs on a shared device at the entrance,
    // not something a specific logged-in admin has to operate). Staff enter their Staff ID and
    // their personal PIN; matching credentials toggles check-in/check-out just like the QR flow.
    if (pathname === '/api/checkin/pin' && req.method === 'POST') {
      const body = await readBody(req); // { staff_id_text, pin, photo_data }
      const staffIdText = (body.staff_id_text || '').trim();
      const pin = (body.pin || '').trim();
      if (!staffIdText || !pin) return sendJSON(res, 400, { error: 'Enter your Staff ID and PIN.' });
      const teacher = db.prepare('SELECT * FROM teachers WHERE staff_id=?').get(staffIdText);
      const staffPerson = db.prepare('SELECT * FROM staff WHERE staff_id=?').get(staffIdText);
      const person = teacher || staffPerson;
      const personType = teacher ? 'teacher' : 'staff';
      if (!person) return sendJSON(res, 404, { error: 'Staff ID not found.' });
      const cred = db.prepare('SELECT * FROM checkin_credentials WHERE person_type=? AND person_id=?').get(personType, person.id);
      if (!cred || cred.pin !== pin) return sendJSON(res, 401, { error: 'Incorrect PIN.' });
      const result = performCheckin(personType, person.id, 'PIN', body.photo_data);
      logAudit(null, `Staff ${result.action} via PIN`, 'staff_checkin', { personType, personId: person.id });
      return sendJSON(res, 200, { ...result, name: person.full_name });
    }

    // Non-staff visitor check-in/out — public, no login, same as the staff PIN endpoint above.
    // A visitor has no existing record to key off, so we match on name + today's date: if they
    // already have an open (not-yet-checked-out) visit today, this checks them out; otherwise
    // it starts a new visit. This also means the same person can check in and out more than
    // once in a day, unlike staff.
    if (pathname === '/api/checkin/visitor' && req.method === 'POST') {
      const body = await readBody(req); // { full_name, purpose, photo_data }
      const fullName = (body.full_name || '').trim();
      if (!fullName) return sendJSON(res, 400, { error: 'Enter your name.' });
      const today = new Date().toISOString().slice(0, 10);
      let photo = null;
      if (body.photo_data) { try { photo = savePhotoFromDataUrl(body.photo_data, 'visitor'); } catch (e) { /* photo is optional — never block check-in over it */ } }
      const open = db.prepare('SELECT * FROM visitor_checkins WHERE full_name=? AND date=? AND check_out_time IS NULL ORDER BY id DESC LIMIT 1').get(fullName, today);
      if (open) {
        db.prepare('UPDATE visitor_checkins SET check_out_time=? WHERE id=?').run(new Date().toTimeString().slice(0, 5), open.id);
        logAudit(null, 'Visitor checked out', 'staff_checkin', { fullName });
        return sendJSON(res, 200, { action: 'checked_out', name: fullName });
      }
      db.prepare('INSERT INTO visitor_checkins (full_name, purpose, date, check_in_time, photo) VALUES (?,?,?,?,?)')
        .run(fullName, body.purpose || null, today, new Date().toTimeString().slice(0, 5), photo);
      logAudit(null, 'Visitor checked in', 'staff_checkin', { fullName });
      return sendJSON(res, 200, { action: 'checked_in', name: fullName });
    }

    // Student kiosk check-in/out — the student's own Student ID (scanned from their barcode ID
    // card, or typed in as a fallback) toggles them in/out for today, same "open visit" pattern
    // as the other kiosk check-in flows above.
    if (pathname === '/api/checkin/student' && req.method === 'POST') {
      const body = await readBody(req); // { student_id_text, photo_data }
      const idText = (body.student_id_text || '').trim();
      if (!idText) return sendJSON(res, 400, { error: 'Scan or enter a Student ID.' });
      const student = db.prepare('SELECT * FROM students WHERE student_id=?').get(idText);
      if (!student) return sendJSON(res, 404, { error: 'No student found with that ID.' });
      const today = new Date().toISOString().slice(0, 10);
      let photo = null;
      if (body.photo_data) { try { photo = savePhotoFromDataUrl(body.photo_data, 'student_checkin'); } catch (e) { /* optional */ } }
      const existing = db.prepare('SELECT * FROM student_checkins WHERE student_id=? AND date=?').get(student.id, today);
      const now = new Date().toTimeString().slice(0, 5);
      const name = `${student.first_name} ${student.last_name}`;
      if (existing && !existing.check_out_time) {
        db.prepare('UPDATE student_checkins SET check_out_time=? WHERE id=?').run(now, existing.id);
        logAudit(null, 'Student checked out', 'staff_checkin', { studentId: student.student_id });
        return sendJSON(res, 200, { action: 'checked_out', name, time: now, checkInTime: existing.check_in_time });
      }
      if (existing && existing.check_out_time) {
        return sendJSON(res, 200, { action: 'already_done', name });
      }
      db.prepare('INSERT INTO student_checkins (student_id, date, check_in_time, method) VALUES (?,?,?,?)').run(student.id, today, now, photo ? 'Barcode+Photo' : 'Barcode');
      logAudit(null, 'Student checked in', 'staff_checkin', { studentId: student.student_id });
      return sendJSON(res, 200, { action: 'checked_in', name, time: now });
    }

    // ---- System-wide access lock (admin sets an expiry date; system locks past it until a
    // matching unlock token is entered). Public — must work BEFORE login, since once the
    // system is locked, login itself is blocked until the token is entered.
    if (pathname === '/api/system-lock-status' && req.method === 'GET') {
      const lock = db.prepare('SELECT expiry_date, lock_message FROM system_lock WHERE id=1').get();
      const today = new Date().toISOString().slice(0, 10);
      const locked = !!(lock.expiry_date && today > lock.expiry_date);
      return sendJSON(res, 200, { locked, message: lock.lock_message, expiry_date: lock.expiry_date });
    }
    if (pathname === '/api/system-unlock' && req.method === 'POST') {
      const body = await readBody(req); // { token }
      const lock = db.prepare('SELECT token FROM system_lock WHERE id=1').get();
      if (!lock.token || !body.token || body.token.trim().toUpperCase() !== lock.token.toUpperCase()) {
        return sendJSON(res, 401, { error: 'Incorrect unlock token.' });
      }
      // Unlocking clears the expiry so the system is usable again; the admin sets a fresh
      // expiry date (and gets a fresh token for next time) from Settings afterward.
      db.prepare('UPDATE system_lock SET expiry_date=NULL WHERE id=1').run();
      return sendJSON(res, 200, { ok: true });
    }

    // Everything below requires auth
    if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });

    if (pathname === '/api/visitor-checkins' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { from, to } = parsed.query;
      const today = new Date().toISOString().slice(0, 10);
      const rows = db.prepare('SELECT * FROM visitor_checkins WHERE date BETWEEN ? AND ? ORDER BY id DESC').all(from || today, to || today);
      return sendJSON(res, 200, { rows });
    }

    // Global search — one box, searches Students/Teachers/Non-teaching Staff at once by name,
    // date of birth, contact number, or ID. Each category only appears if the current role
    // actually has view permission on it, and a Teacher's student results are further scoped
    // to their own class(es), matching the same rule used everywhere else.
    // ---- Direct messages (private one-to-one, distinct from the public Discussion Forum) ----
    // Who a given account is allowed to message — kept deliberately narrow rather than "anyone
    // can message anyone": a student can reach their own classmates and their class teacher; a
    // teacher can reach their own students and other teachers. Shared by the contacts list AND
    // the send endpoint, so a message can never actually go to someone outside this list, even
    // if someone crafts the request by hand.
    function getMessageContacts(user) {
      if (user.role_name === 'Student' && user.linked_student_id) {
        const me = db.prepare('SELECT class_id FROM students WHERE id=?').get(user.linked_student_id);
        if (!me || !me.class_id) return [];
        const classmates = db.prepare(`SELECT u.id, u.full_name, 'Classmate' as role FROM users u
          JOIN students s ON s.id=u.linked_student_id WHERE s.class_id=? AND s.id != ?`).all(me.class_id, user.linked_student_id);
        const classTeacher = db.prepare(`SELECT u.id, u.full_name, 'Class Teacher' as role FROM users u
          JOIN teachers t ON t.id=u.linked_teacher_id JOIN classes c ON c.class_teacher_id=t.id WHERE c.id=?`).all(me.class_id);
        return [...classTeacher, ...classmates];
      }
      if (user.role_name === 'Teacher' && user.linked_teacher_id) {
        const myClasses = db.prepare('SELECT id FROM classes WHERE class_teacher_id=?').all(user.linked_teacher_id).map(c => c.id);
        let myStudents = [];
        if (myClasses.length) {
          myStudents = db.prepare(`SELECT u.id, u.full_name, 'My Student' as role FROM users u
            JOIN students s ON s.id=u.linked_student_id WHERE s.class_id IN (${myClasses.map(() => '?').join(',')})`).all(...myClasses);
        }
        const otherTeachers = db.prepare(`SELECT u.id, u.full_name, 'Teacher' as role FROM users u
          JOIN teachers t ON t.id=u.linked_teacher_id WHERE u.id != ?`).all(user.id);
        const staffForTeacher = db.prepare(`SELECT u.id, u.full_name, 'Staff' as role FROM users u JOIN staff s ON s.id=u.linked_staff_id`).all();
        return [...myStudents, ...otherTeachers, ...staffForTeacher];
      }
      // Super Administrator and Non-teaching Staff didn't have any messaging contacts at all
      // before this — meaning a school administrator could never message a teacher or staff
      // member, and vice versa, despite the Messages feature existing. Scoped to staff/teacher/
      // admin colleague communication here (not every individual student), matching what a
      // staff directory conversation should reasonably cover.
      if (['Super Administrator', 'Headteacher', 'Headmistress', 'Non-teaching Staff'].includes(user.role_name)) {
        const teachers = db.prepare(`SELECT u.id, u.full_name, 'Teacher' as role FROM users u JOIN teachers t ON t.id=u.linked_teacher_id`).all();
        const staffContacts = db.prepare(`SELECT u.id, u.full_name, 'Staff' as role FROM users u JOIN staff s ON s.id=u.linked_staff_id WHERE u.id != ?`).all(user.id);
        const admins = db.prepare(`SELECT u.id, u.full_name, r.name as role FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name IN ('Super Administrator','Headteacher','Headmistress') AND u.id != ?`).all(user.id);
        return [...admins, ...teachers, ...staffContacts];
      }
      // A Parent can message their own ward's Class Teacher — the one relationship that's
      // both obviously legitimate and unambiguous even with more than one child at the school.
      if (user.role_name === 'Parent/Guardian' && user.linked_parent_id) {
        const classTeachers = db.prepare(`SELECT DISTINCT u.id, u.full_name, 'Class Teacher' as role FROM users u
          JOIN teachers t ON t.id=u.linked_teacher_id JOIN classes c ON c.class_teacher_id=t.id
          JOIN students s ON s.class_id=c.id JOIN student_parents sp ON sp.student_id=s.id
          WHERE sp.parent_id=?`).all(user.linked_parent_id);
        return classTeachers;
      }
      return [];
    }
    if (pathname === '/api/messages/contacts' && req.method === 'GET') {
      return sendJSON(res, 200, getMessageContacts(currentUser));
    }
    if (pathname === '/api/messages' && req.method === 'GET') {
      const withId = Number(parsed.query.with);
      if (!withId) return sendJSON(res, 400, { error: 'Specify who to load the conversation with.' });
      const rows = db.prepare(`SELECT * FROM direct_messages WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY id ASC`)
        .all(currentUser.id, withId, withId, currentUser.id);
      db.prepare('UPDATE direct_messages SET read_at=? WHERE recipient_id=? AND sender_id=? AND read_at IS NULL').run(new Date().toISOString(), currentUser.id, withId);
      return sendJSON(res, 200, rows);
    }
    if (pathname === '/api/messages/unread-count' && req.method === 'GET') {
      const c = db.prepare('SELECT COUNT(*) c FROM direct_messages WHERE recipient_id=? AND read_at IS NULL').get(currentUser.id).c;
      return sendJSON(res, 200, { count: c });
    }
    // Combines unread Messages, new Announcements, and new Discussion Forum activity into one
    // number for the notification bell — each checked against permission the same way the
    // actual pages are, so the bell never promises something a click-through can't deliver.
    if (pathname === '/api/notifications-summary' && req.method === 'GET') {
      const since = currentUser.last_notifications_seen_at || '1970-01-01';
      let messages = 0, announcements = 0, forum = 0;
      messages = db.prepare('SELECT COUNT(*) c FROM direct_messages WHERE recipient_id=? AND read_at IS NULL').get(currentUser.id).c;
      if (getPermissions(currentUser.role_id, 'announcements').can_view) {
        announcements = db.prepare('SELECT COUNT(*) c FROM announcements WHERE posted_at > ?').get(since).c;
      }
      if (getPermissions(currentUser.role_id, 'forum').can_view) {
        let studentClassId = null;
        if (currentUser.role_name === 'Student' && currentUser.linked_student_id) {
          const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
          studentClassId = student ? student.class_id : null;
        }
        let sql = `SELECT COUNT(*) c FROM forum_messages fm JOIN forum_topics ft ON ft.id=fm.topic_id WHERE fm.created_at > ?`;
        const params = [since];
        if (currentUser.role_name === 'Student') { sql += ' AND (ft.class_id IS NULL OR ft.class_id=?)'; params.push(studentClassId); }
        forum = db.prepare(sql).get(...params).c;
      }
      return sendJSON(res, 200, { messages, announcements, forum, total: messages + announcements + forum });
    }
    if (pathname === '/api/notifications-mark-seen' && req.method === 'POST') {
      db.prepare("UPDATE users SET last_notifications_seen_at=datetime('now') WHERE id=?").run(currentUser.id);
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname === '/api/messages' && req.method === 'POST') {
      const body = await readBody(req); // { recipient_id, body }
      if (!body.recipient_id || !body.body || !body.body.trim()) return sendJSON(res, 400, { error: 'A recipient and a message are required.' });
      const allowed = getMessageContacts(currentUser).some(c => c.id === Number(body.recipient_id));
      if (!allowed) return sendJSON(res, 403, { error: 'You can only message your own classmates, class teacher, students, or fellow teachers.' });
      const info = db.prepare('INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES (?,?,?)').run(currentUser.id, body.recipient_id, body.body.trim());
      return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
    }

    // Subject teachers for a class — a many-to-many relationship distinct from the single
    // Everything needed for the "click a class name, see the details" popup: the class itself
    // (with its Class Teacher's name resolved), every student in it sorted alphabetically, and
    // a simple count — the timetable itself is fetched separately via the existing
    // /api/timetable endpoint, since that logic already exists and there's no reason to
    // duplicate it here.
    // A quick, prominent overview of every class — used by the Class List menu item, one query
    // rather than N+1 lookups per class.
    if (pathname === '/api/classes-summary' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      // A Teacher sees only their own class (as Class Teacher) here — this is meant as "my
      // class at a glance," not a directory of the whole school, which a Teacher's broader
      // 'classes' permission doesn't actually extend to browsing freely.
      const teacherScope = currentUser.role_name === 'Teacher' && currentUser.linked_teacher_id
        ? 'WHERE c.class_teacher_id = ?' : '';
      const rows = db.prepare(`SELECT c.id, c.name, c.level, t.full_name as class_teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.status='Active') as student_count
        FROM classes c LEFT JOIN teachers t ON t.id=c.class_teacher_id ${teacherScope} ORDER BY c.name ASC`)
        .all(...(teacherScope ? [currentUser.linked_teacher_id] : []));
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/classes\/\d+\/details$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const classId = Number(pathname.split('/')[3]);
      const cls = db.prepare(`SELECT c.*, t.full_name as class_teacher_name FROM classes c LEFT JOIN teachers t ON t.id=c.class_teacher_id WHERE c.id=?`).get(classId);
      if (!cls) return sendJSON(res, 404, { error: 'Class not found.' });
      const students = db.prepare(`SELECT id, student_id, first_name, middle_name, last_name, photo, status FROM students
        WHERE class_id=? ORDER BY first_name COLLATE NOCASE, last_name COLLATE NOCASE`).all(classId);
      return sendJSON(res, 200, { class: cls, students, student_count: students.length });
    }

    // "class teacher" (homeroom teacher) already on the classes table. A teacher can be a
    // subject teacher for several classes; a class can have several subject teachers.
    if (pathname.match(/^\/api\/classes\/\d+\/subject-teachers$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const classId = Number(pathname.split('/')[3]);
      const rows = db.prepare(`SELECT t.id, t.full_name, t.staff_id FROM teacher_classes tc JOIN teachers t ON t.id=tc.teacher_id WHERE tc.class_id=? ORDER BY t.full_name`).all(classId);
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/classes\/\d+\/subject-teachers$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const classId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { teacher_id }
      if (!body.teacher_id) return sendJSON(res, 400, { error: 'Choose a teacher.' });
      try { db.prepare('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?,?)').run(body.teacher_id, classId); }
      catch (e) { /* already assigned — treat as success, not an error */ }
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/classes\/\d+\/subject-teachers\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const segs2 = pathname.split('/');
      const classId = Number(segs2[3]), teacherId = Number(segs2[5]);
      db.prepare('DELETE FROM teacher_classes WHERE class_id=? AND teacher_id=?').run(classId, teacherId);
      return sendJSON(res, 200, { ok: true });
    }
    // Which subjects a teacher is assigned to teach — distinct from which classes they're
    // attached to (a teacher can teach the same subject in several classes, or several
    // subjects). This is what the Timetable's "auto-fill a default teacher per subject"
    // feature actually reads from, so without a way to populate it, that auto-fill could
    // never do anything useful.
    if (pathname.match(/^\/api\/teachers\/\d+\/subjects$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const teacherId = Number(pathname.split('/')[3]);
      const rows = db.prepare(`SELECT s.id, s.name FROM teacher_subjects ts JOIN subjects s ON s.id=ts.subject_id WHERE ts.teacher_id=? ORDER BY s.name`).all(teacherId);
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/teachers\/\d+\/subjects$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const teacherId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { subject_id }
      if (!body.subject_id) return sendJSON(res, 400, { error: 'Choose a subject.' });
      try { db.prepare('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?,?)').run(teacherId, body.subject_id); }
      catch (e) { /* already assigned — treat as success, not an error */ }
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/teachers\/\d+\/subjects\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const segs3 = pathname.split('/');
      const teacherId = Number(segs3[3]), subjectId = Number(segs3[5]);
      db.prepare('DELETE FROM teacher_subjects WHERE teacher_id=? AND subject_id=?').run(teacherId, subjectId);
      return sendJSON(res, 200, { ok: true });
    }
    // The same relationship, viewed from a Subject's side — which teachers teach this subject.
    // A subject genuinely can (and often does) have more than one teacher, e.g. several
    // Mathematics teachers across different classes.
    if (pathname.match(/^\/api\/subjects\/\d+\/teachers$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'subjects');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const subjectId = Number(pathname.split('/')[3]);
      const rows = db.prepare(`SELECT t.id, t.full_name FROM teacher_subjects ts JOIN teachers t ON t.id=ts.teacher_id WHERE ts.subject_id=? ORDER BY t.full_name`).all(subjectId);
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/subjects\/\d+\/teachers$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'subjects');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const subjectId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { teacher_id }
      if (!body.teacher_id) return sendJSON(res, 400, { error: 'Choose a teacher.' });
      try { db.prepare('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?,?)').run(body.teacher_id, subjectId); }
      catch (e) { /* already assigned — treat as success, not an error */ }
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/subjects\/\d+\/teachers\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'subjects');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const segs4 = pathname.split('/');
      const subjectId = Number(segs4[3]), teacherId = Number(segs4[5]);
      db.prepare('DELETE FROM teacher_subjects WHERE teacher_id=? AND subject_id=?').run(teacherId, subjectId);
      return sendJSON(res, 200, { ok: true });
    }
    // A teacher's own list of classes where they're a subject teacher (not class teacher) —
    // used so a Teacher account can also reach classes they teach a subject in, not just the
    // one class they're homeroom/class teacher for.
    if (pathname === '/api/my-subject-classes' && req.method === 'GET') {
      if (!currentUser.linked_teacher_id) return sendJSON(res, 200, []);
      const rows = db.prepare(`SELECT c.* FROM teacher_classes tc JOIN classes c ON c.id=tc.class_id WHERE tc.teacher_id=?`).all(currentUser.linked_teacher_id);
      return sendJSON(res, 200, rows);
    }

    // ---------- Live Class Rooms (WebRTC signaling) ----------
    // Peer-to-peer video: the teacher's browser opens a direct connection to each joined
    // student's browser. This app has no WebSocket/persistent-connection server, so the
    // signaling handshake (offer/answer/ICE candidates) that WebRTC needs before two browsers
    // can connect goes through plain HTTP polling instead — each side asks "anything new for
    // me?" every couple of seconds. It's not instant, but for a handful of students joining one
    // class session at a time, a short connect delay is a reasonable tradeoff for staying
    // dependency-free.
    if (pathname === '/api/live-rooms/active-for-my-class' && req.method === 'GET') {
      if (currentUser.role_name !== 'Student' || !currentUser.linked_student_id) return sendJSON(res, 200, null);
      const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
      if (!student || !student.class_id) return sendJSON(res, 200, null);
      const room = db.prepare(`SELECT lcr.*, t.full_name as teacher_name, sub.name as subject_name,
        (SELECT u.id FROM users u WHERE u.linked_teacher_id=lcr.teacher_id LIMIT 1) as teacher_user_id
        FROM live_class_rooms lcr
        LEFT JOIN teachers t ON t.id=lcr.teacher_id LEFT JOIN subjects sub ON sub.id=lcr.subject_id
        WHERE lcr.class_id=? AND lcr.status='active' ORDER BY lcr.id DESC LIMIT 1`).get(student.class_id);
      return sendJSON(res, 200, room || null);
    }
    if (pathname.match(/^\/api\/live-rooms\/\d+\/end$/) && req.method === 'POST') {
      const roomId = Number(pathname.split('/')[3]);
      const room = db.prepare('SELECT * FROM live_class_rooms WHERE id=?').get(roomId);
      if (!room) return sendJSON(res, 404, { error: 'Room not found.' });
      if (room.teacher_id !== currentUser.linked_teacher_id && currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'Only the hosting teacher can end this class.' });
      db.prepare(`UPDATE live_class_rooms SET status='ended', ended_at=datetime('now') WHERE id=?`).run(roomId);
      db.prepare(`UPDATE live_class_participants SET left_at=datetime('now') WHERE room_id=? AND left_at IS NULL`).run(roomId);
      logAudit(currentUser, 'End live class', 'live_class_rooms', { roomId });
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/live-rooms\/\d+\/join$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'live_class_rooms');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const roomId = Number(pathname.split('/')[3]);
      const room = db.prepare(`SELECT * FROM live_class_rooms WHERE id=? AND status='active'`).get(roomId);
      if (!room) return sendJSON(res, 404, { error: 'This class is not currently live.' });
      const existing = db.prepare('SELECT * FROM live_class_participants WHERE room_id=? AND user_id=? AND left_at IS NULL').get(roomId, currentUser.id);
      if (existing) return sendJSON(res, 200, { id: existing.id });
      const info = db.prepare('INSERT INTO live_class_participants (room_id, user_id, student_id, display_name) VALUES (?,?,?,?)')
        .run(roomId, currentUser.id, currentUser.linked_student_id || null, currentUser.full_name);
      return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
    }
    if (pathname.match(/^\/api\/live-rooms\/\d+\/leave$/) && req.method === 'POST') {
      const roomId = Number(pathname.split('/')[3]);
      db.prepare(`UPDATE live_class_participants SET left_at=datetime('now') WHERE room_id=? AND user_id=? AND left_at IS NULL`).run(roomId, currentUser.id);
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/live-rooms\/\d+\/participants$/) && req.method === 'GET') {
      const roomId = Number(pathname.split('/')[3]);
      const rows = db.prepare('SELECT * FROM live_class_participants WHERE room_id=? AND left_at IS NULL ORDER BY joined_at ASC').all(roomId);
      return sendJSON(res, 200, rows);
    }
    // Posts one signaling message (an SDP offer/answer, or an ICE network candidate) addressed
    // to a specific other participant in the room.
    if (pathname.match(/^\/api\/live-rooms\/\d+\/signal$/) && req.method === 'POST') {
      const roomId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { to_user_id, signal_type, payload }
      if (!body.to_user_id || !body.signal_type || body.payload === undefined) return sendJSON(res, 400, { error: 'to_user_id, signal_type, and payload are required.' });
      db.prepare('INSERT INTO live_class_signals (room_id, from_user_id, to_user_id, signal_type, payload) VALUES (?,?,?,?,?)')
        .run(roomId, currentUser.id, body.to_user_id, body.signal_type, JSON.stringify(body.payload));
      return sendJSON(res, 201, { ok: true });
    }
    // Polls for new signaling messages addressed to the current user in this room, since the
    // last signal id already seen (?since=). This is the "check for anything new" heartbeat
    // both the teacher's and each student's browser run every couple of seconds.
    if (pathname.match(/^\/api\/live-rooms\/\d+\/signals$/) && req.method === 'GET') {
      const roomId = Number(pathname.split('/')[3]);
      const since = Number(parsed.query.since) || 0;
      const rows = db.prepare('SELECT * FROM live_class_signals WHERE room_id=? AND to_user_id=? AND id>? ORDER BY id ASC')
        .all(roomId, currentUser.id, since);
      rows.forEach(r => { try { r.payload = JSON.parse(r.payload); } catch (e) { /* leave as raw string if malformed */ } });
      return sendJSON(res, 200, rows);
    }

    // A teacher starting a live class — teacher_id and created_by are set from the logged-in
    // account server-side, not trusted from the request body, so nobody can start a room
    // pretending to be a different teacher.
    if (pathname === '/api/live_class_rooms' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'live_class_rooms');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      if (!currentUser.linked_teacher_id) return sendJSON(res, 400, { error: 'Your account is not linked to a teacher record.' });
      const body = await readBody(req); // { class_id, subject_id, title }
      if (!body.class_id) return sendJSON(res, 400, { error: 'Choose a class.' });
      const info = db.prepare('INSERT INTO live_class_rooms (class_id, subject_id, teacher_id, title, created_by) VALUES (?,?,?,?,?)')
        .run(body.class_id, body.subject_id || null, currentUser.linked_teacher_id, body.title || 'Live Class', currentUser.id);
      logAudit(currentUser, 'Start live class', 'live_class_rooms', { roomId: Number(info.lastInsertRowid), classId: body.class_id });
      return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
    }

    if (pathname === '/api/global-search' && req.method === 'GET') {
      const q = (parsed.query.q || '').trim();
      if (q.length < 2) return sendJSON(res, 200, { students: [], teachers: [], staff: [] });
      const like = `%${q}%`;
      const result = { students: [], teachers: [], staff: [] };
      if (getPermissions(currentUser.role_id, 'students').can_view) {
        let sql = `SELECT id, student_id, first_name, last_name, dob, emergency_contact_phone, class_id FROM students
          WHERE first_name LIKE ? OR last_name LIKE ? OR dob LIKE ? OR emergency_contact_phone LIKE ? OR student_id LIKE ?`;
        const params = [like, like, like, like, like];
        if (currentUser.role_name === 'Student') {
          sql += ' AND id=?'; params.push(currentUser.linked_student_id || 0);
        } else if (currentUser.role_name === 'Teacher' && currentUser.linked_teacher_id) {
          const myClassIds = db.prepare('SELECT id FROM classes WHERE class_teacher_id=?').all(currentUser.linked_teacher_id).map(c => c.id);
          if (!myClassIds.length) { sql += ' AND 0'; }
          else { sql += ` AND class_id IN (${myClassIds.map(() => '?').join(',')})`; params.push(...myClassIds); }
        }
        result.students = db.prepare(sql + ' LIMIT 20').all(...params);
      }
      if (getPermissions(currentUser.role_id, 'teachers').can_view) {
        result.teachers = db.prepare(`SELECT id, staff_id, full_name, dob, phone FROM teachers
          WHERE full_name LIKE ? OR dob LIKE ? OR phone LIKE ? OR staff_id LIKE ? LIMIT 20`).all(like, like, like, like);
      }
      if (getPermissions(currentUser.role_id, 'staff').can_view) {
        result.staff = db.prepare(`SELECT id, staff_id, full_name, phone FROM staff
          WHERE full_name LIKE ? OR phone LIKE ? OR staff_id LIKE ? LIMIT 20`).all(like, like, like);
      }
      return sendJSON(res, 200, result);
    }

    // A user's own dashboard card selection — stored per-account (not per-browser), so it
    // follows them to any device they log in from. Anyone can read/write only their own.
    if (pathname === '/api/my-dashboard-prefs' && req.method === 'GET') {
      let prefs = null;
      try { prefs = currentUser.dashboard_prefs ? JSON.parse(currentUser.dashboard_prefs) : null; } catch (e) { prefs = null; }
      return sendJSON(res, 200, { cards: prefs });
    }
    if (pathname === '/api/my-dashboard-prefs' && req.method === 'PUT') {
      const body = await readBody(req); // { cards: [...] }
      db.prepare('UPDATE users SET dashboard_prefs=? WHERE id=?').run(JSON.stringify(body.cards || []), currentUser.id);
      return sendJSON(res, 200, { ok: true });
    }

    // Which "portal dashboard" widgets (Results, Fees, Live Class, Forum, Messages, Tasks,
    // Announcements) the CURRENT user's role is allowed to see — read by every portal
    // dashboard (Teacher/Student/Parent/Non-teaching Staff) when deciding what to render.
    // No permission gate: everyone can read their own role's widget visibility.
    if (pathname === '/api/my-dashboard-widgets' && req.method === 'GET') {
      const rows = db.prepare('SELECT widget_key, visible FROM role_dashboard_widgets WHERE role_id=?').all(currentUser.role_id);
      const map = {};
      rows.forEach(r => { map[r.widget_key] = !!r.visible; });
      return sendJSON(res, 200, map);
    }
    // Admin configuration: view or set which widgets a given role sees. Super Administrator
    // only — this controls what every Teacher/Student/Parent/Staff account sees, school-wide.
    if (pathname === '/api/role-dashboard-widgets' && req.method === 'GET') {
      if (currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'No permission' });
      const roleId = Number(parsed.query.role_id);
      if (!roleId) return sendJSON(res, 400, { error: 'role_id is required.' });
      const rows = db.prepare('SELECT widget_key, visible FROM role_dashboard_widgets WHERE role_id=?').all(roleId);
      const map = {};
      rows.forEach(r => { map[r.widget_key] = !!r.visible; });
      return sendJSON(res, 200, map);
    }
    if (pathname === '/api/role-dashboard-widgets' && req.method === 'PUT') {
      if (currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { role_id, widgets: { widgetKey: true/false, ... } }
      if (!body.role_id || !body.widgets) return sendJSON(res, 400, { error: 'role_id and widgets are required.' });
      const upsert = db.prepare(`INSERT INTO role_dashboard_widgets (role_id, widget_key, visible) VALUES (?,?,?)
        ON CONFLICT(role_id, widget_key) DO UPDATE SET visible=excluded.visible`);
      // Node's built-in node:sqlite has no db.transaction() helper (that's a better-sqlite3-only
      // convenience method) — just run the statements directly, matching the pattern used
      // everywhere else in this codebase (e.g. the system-reset endpoint).
      for (const [key, visible] of Object.entries(body.widgets)) upsert.run(body.role_id, key, visible ? 1 : 0);
      logAudit(currentUser, 'Update role dashboard widgets', 'settings', { role_id: body.role_id });
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const role = db.prepare('SELECT name FROM roles WHERE id=?').get(currentUser.role_id);
      const perms = db.prepare('SELECT * FROM role_permissions WHERE role_id=?').all(currentUser.role_id);
      // A user's own uploaded photo wins if set; otherwise fall back to their linked teacher or
      // student record's photo, since that's usually where the real picture actually lives.
      let photo = currentUser.photo || null;
      if (!photo && currentUser.linked_teacher_id) {
        const t = db.prepare('SELECT photo FROM teachers WHERE id=?').get(currentUser.linked_teacher_id);
        photo = t ? t.photo : null;
      }
      if (!photo && currentUser.linked_student_id) {
        const s = db.prepare('SELECT photo FROM students WHERE id=?').get(currentUser.linked_student_id);
        photo = s ? s.photo : null;
      }
      return sendJSON(res, 200, { id: currentUser.id, username: currentUser.username, full_name: currentUser.full_name, role: role.name, role_id: currentUser.role_id, linked_student_id: currentUser.linked_student_id || null, linked_teacher_id: currentUser.linked_teacher_id || null, photo, permissions: perms });
    }

    // ---- Dashboard stats ----
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const c = (sql, ...p) => db.prepare(sql).get(...p).c;
      const today = new Date().toISOString().slice(0, 10);
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      const year = settings.current_academic_year_id ? db.prepare('SELECT * FROM academic_years WHERE id=?').get(settings.current_academic_year_id) : null;
      const term = settings.current_term_id ? db.prepare('SELECT * FROM terms WHERE id=?').get(settings.current_term_id) : null;
      const stats = {
        total_students: c("SELECT COUNT(*) c FROM students WHERE status='Active'"),
        male_students: c("SELECT COUNT(*) c FROM students WHERE status='Active' AND gender='Male'"),
        female_students: c("SELECT COUNT(*) c FROM students WHERE status='Active' AND gender='Female'"),
        orphan_students: c("SELECT COUNT(*) c FROM students WHERE status='Active' AND orphan_status='Orphan'"),
        total_teachers: c("SELECT COUNT(*) c FROM teachers WHERE status='Active'"),
        total_staff: c("SELECT COUNT(*) c FROM staff WHERE employment_status='Active'"),
        total_parents: c('SELECT COUNT(*) c FROM parents_guardians'),
        present_today: c('SELECT COUNT(*) c FROM attendance WHERE date=? AND status=?', today, 'Present'),
        absent_today: c('SELECT COUNT(*) c FROM attendance WHERE date=? AND status=?', today, 'Absent'),
        bus_users: c("SELECT COUNT(*) c FROM students WHERE status='Active' AND uses_bus=1"),
        canteen_users: c("SELECT COUNT(*) c FROM students WHERE status='Active' AND pays_canteen=1"),
        total_fees_due: db.prepare('SELECT COALESCE(SUM(amount_due),0) t FROM fees').get().t,
        total_fees_paid: db.prepare('SELECT COALESCE(SUM(amount_paid),0) t FROM fee_payments').get().t,
        total_subjects: c('SELECT COUNT(*) c FROM subjects'),
        total_classes: c('SELECT COUNT(*) c FROM classes'),
        students_by_class: db.prepare(`SELECT cl.id as class_id, cl.name as class_name, COUNT(s.id) as count FROM classes cl LEFT JOIN students s ON s.class_id = cl.id AND s.status='Active' GROUP BY cl.id ORDER BY cl.name`).all(),
        school_name: settings.school_name, motto: settings.motto,
        dashboard_background_photo: settings.dashboard_background_photo,
        current_academic_year: year ? year.name : null, current_term: term ? term.name : null, current_term_id: settings.current_term_id || null,
      };
      stats.total_fees_outstanding = stats.total_fees_due - stats.total_fees_paid;
      return sendJSON(res, 200, stats);
    }

    // ---- Export a class's student names as a CSV (opens directly in Excel) ----
    // ---- Discussion Forum: topics + messages ----
    // Students only see topics for their own class (or general topics with no class attached);
    // everyone else sees everything, matching how the forum worked before this restriction.
    // Maps an actual role name to the simplified audience category a forum topic can be
    // targeted at — several roles collapse into the same broad category (e.g. an Arabic Head
    // Teacher is still fundamentally "Teacher" for the purposes of who a topic is meant for).
    function audienceCategoryForRole(roleName) {
      if (roleName === 'Teacher' || roleName === 'Arabic Head Teacher') return 'Teacher';
      if (roleName === 'Student') return 'Student';
      if (roleName === 'Parent/Guardian') return 'Parent';
      if (roleName === 'Non-teaching Staff' || roleName === 'Canteen Collector') return 'Non-teaching Staff';
      return null; // admin-level and other roles aren't a specific audience — see everything instead
    }
    if (pathname === '/api/forum/topics' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'forum');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      let studentClassId = null;
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, []);
        const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
        studentClassId = student ? student.class_id : null;
      }
      let sql = `SELECT ft.*, c.name as class_name, sub.name as subject_name,
        (SELECT COUNT(*) FROM forum_messages fm WHERE fm.topic_id=ft.id) as message_count,
        (SELECT MAX(created_at) FROM forum_messages fm WHERE fm.topic_id=ft.id) as last_activity
        FROM forum_topics ft LEFT JOIN classes c ON c.id=ft.class_id LEFT JOIN subjects sub ON sub.id=ft.subject_id`;
      const params = [];
      const clauses = [];
      if (currentUser.role_name === 'Student') {
        clauses.push('(ft.class_id IS NULL OR ft.class_id = ?)');
        params.push(studentClassId);
      }
      const myAudience = audienceCategoryForRole(currentUser.role_name);
      if (myAudience) {
        clauses.push(`(ft.audience = 'All' OR ft.audience = ?)`);
        params.push(myAudience);
      } // admin-level roles (myAudience === null) see every topic regardless of targeting
      if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
      sql += ` ORDER BY COALESCE((SELECT MAX(created_at) FROM forum_messages fm WHERE fm.topic_id=ft.id), ft.created_at) DESC`;
      const topics = db.prepare(sql).all(...params);
      return sendJSON(res, 200, topics);
    }
    if (pathname === '/api/forum/topics' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'forum');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { title, class_id, subject_id, first_message, audience }
      if (!body.title) return sendJSON(res, 400, { error: 'A topic title is required.' });
      const validAudiences = ['All', 'Teacher', 'Student', 'Parent', 'Non-teaching Staff'];
      const audience = validAudiences.includes(body.audience) ? body.audience : 'All';
      const info = db.prepare('INSERT INTO forum_topics (title, class_id, subject_id, created_by, created_by_name, audience) VALUES (?,?,?,?,?,?)')
        .run(body.title, body.class_id || null, body.subject_id || null, currentUser.id, currentUser.full_name, audience);
      const topicId = Number(info.lastInsertRowid);
      if (body.first_message) {
        db.prepare('INSERT INTO forum_messages (topic_id, author_id, author_name, author_role, body) VALUES (?,?,?,?,?)')
          .run(topicId, currentUser.id, currentUser.full_name, currentUser.role_name || '', body.first_message);
      }
      logAudit(currentUser, 'Create forum topic', 'forum', { topicId, title: body.title, audience });
      return sendJSON(res, 201, { id: topicId });
    }
    if (pathname.match(/^\/api\/forum\/topics\/\d+\/messages$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'forum');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const topicId = Number(pathname.split('/')[4]);
      const topic = db.prepare('SELECT * FROM forum_topics WHERE id=?').get(topicId);
      if (!topic) return sendJSON(res, 404, { error: 'Topic not found' });
      if (currentUser.role_name === 'Student' && topic.class_id) {
        const student = currentUser.linked_student_id ? db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id) : null;
        if (!student || student.class_id !== topic.class_id) return sendJSON(res, 403, { error: 'This topic belongs to a different class.' });
      }
      const messages = db.prepare('SELECT * FROM forum_messages WHERE topic_id=? ORDER BY id ASC').all(topicId);
      return sendJSON(res, 200, { topic, messages });
    }
    if (pathname.match(/^\/api\/forum\/topics\/\d+\/messages$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'forum');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const topicId = Number(pathname.split('/')[4]);
      if (currentUser.role_name === 'Student') {
        const topic = db.prepare('SELECT class_id FROM forum_topics WHERE id=?').get(topicId);
        if (topic && topic.class_id) {
          const student = currentUser.linked_student_id ? db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id) : null;
          if (!student || student.class_id !== topic.class_id) return sendJSON(res, 403, { error: 'This topic belongs to a different class.' });
        }
      }
      const body = await readBody(req); // { body, attachment_data, attachment_name }
      if ((!body.body || !body.body.trim()) && !body.attachment_data) return sendJSON(res, 400, { error: 'Write a message or attach a file.' });
      let attachment = null;
      if (body.attachment_data) {
        try { attachment = saveAttachmentFromDataUrl(body.attachment_data, body.attachment_name); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
      }
      const roleRow = db.prepare('SELECT name FROM roles WHERE id=?').get(currentUser.role_id);
      const info = db.prepare('INSERT INTO forum_messages (topic_id, author_id, author_name, author_role, body, attachment, attachment_name) VALUES (?,?,?,?,?,?,?)')
        .run(topicId, currentUser.id, currentUser.full_name, roleRow ? roleRow.name : '', (body.body || '').trim(), attachment, attachment ? (body.attachment_name || null) : null);
      logAudit(currentUser, 'Post forum message', 'forum', { topicId });
      return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
    }
    if (pathname.match(/^\/api\/forum\/topics\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'forum');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const topicId = Number(pathname.split('/')[4]);
      db.prepare('DELETE FROM forum_messages WHERE topic_id=?').run(topicId);
      db.prepare('DELETE FROM forum_topics WHERE id=?').run(topicId);
      logAudit(currentUser, 'Delete forum topic', 'forum', { topicId });
      return sendJSON(res, 200, { ok: true });
    }

    // Lets a Teacher (not just Admin) set up a student's own login — deliberately NOT the same
    // as full Users & Roles access, which would let a teacher create accounts with ANY role
    // (including Admin). This endpoint only ever creates/updates a Student-role account linked
    // to exactly the one student record it's called for.

    if (pathname.match(/^\/api\/students\/\d+\/create-login$/) && req.method === 'POST') {
      // Creating/resetting a login is a staff action, never something a student account can do
      // for themselves OR anyone else — this is a privileged action, not a self-service one.
      if (currentUser.role_name === 'Student') return sendJSON(res, 403, { error: 'No permission' });
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const studentId = Number(pathname.split('/')[3]);
      const student = db.prepare('SELECT * FROM students WHERE id=?').get(studentId);
      if (!student) return sendJSON(res, 404, { error: 'Student not found.' });
      const body = await readBody(req); // { username, password }
      if (!body.username || !body.username.trim()) return sendJSON(res, 400, { error: 'Choose a username.' });
      const studentRole = db.prepare("SELECT id FROM roles WHERE name='Student'").get();
      if (!studentRole) return sendJSON(res, 500, { error: 'Student role is missing from this installation.' });
      const existing = db.prepare('SELECT * FROM users WHERE linked_student_id=?').get(studentId);
      if (existing) {
        if (body.password) {
          const { hash, salt } = hashPassword(body.password);
          db.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, existing.id);
          logAudit(currentUser, 'Reset student login password', 'students', { studentId });
          return sendJSON(res, 200, { username: existing.username, updated: true });
        }
        return sendJSON(res, 200, { username: existing.username, alreadyExists: true });
      }
      if (!body.password || body.password.length < 4) return sendJSON(res, 400, { error: 'Choose a password (at least 4 characters).' });
      const { hash, salt } = hashPassword(body.password);
      try {
        db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, linked_student_id) VALUES (?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, `${student.first_name} ${student.last_name}`, studentRole.id, studentId);
      } catch (e) { return sendJSON(res, 400, { error: 'That username is already taken.' }); }
      logAudit(currentUser, 'Create student login', 'students', { studentId, username: body.username });
      return sendJSON(res, 201, { username: body.username, created: true });
    }

    // Same idea as the student login endpoint above, but for teachers — this is what lets a
    // Teacher-role account be reliably tied to a specific teacher record (via linked_teacher_id),
    // which the Arabic Terminal Report's teaching-language check depends on. Deliberately gated
    // on the 'teachers' module (which ordinary Teacher accounts have zero access to) rather than
    // letting teachers create logins for each other.
    if (pathname.match(/^\/api\/teachers\/\d+\/create-login$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const teacherId = Number(pathname.split('/')[3]);
      const teacher = db.prepare('SELECT * FROM teachers WHERE id=?').get(teacherId);
      if (!teacher) return sendJSON(res, 404, { error: 'Teacher not found.' });
      const body = await readBody(req); // { username, password }
      if (!body.username || !body.username.trim()) return sendJSON(res, 400, { error: 'Choose a username.' });
      const teacherRole = db.prepare("SELECT id FROM roles WHERE name='Teacher'").get();
      if (!teacherRole) return sendJSON(res, 500, { error: 'Teacher role is missing from this installation.' });
      const existing = db.prepare('SELECT * FROM users WHERE linked_teacher_id=?').get(teacherId);
      if (existing) {
        if (body.password) {
          const { hash, salt } = hashPassword(body.password);
          db.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, existing.id);
          logAudit(currentUser, 'Reset teacher login password', 'teachers', { teacherId });
          return sendJSON(res, 200, { username: existing.username, updated: true });
        }
        return sendJSON(res, 200, { username: existing.username, alreadyExists: true });
      }
      if (!body.password || body.password.length < 4) return sendJSON(res, 400, { error: 'Choose a password (at least 4 characters).' });
      const { hash, salt } = hashPassword(body.password);
      try {
        db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, linked_teacher_id) VALUES (?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, teacher.full_name, teacherRole.id, teacherId);
      } catch (e) { return sendJSON(res, 400, { error: 'That username is already taken.' }); }
      logAudit(currentUser, 'Create teacher login', 'teachers', { teacherId, username: body.username });
      return sendJSON(res, 201, { username: body.username, created: true });
    }

    // Same pattern as teacher/student login creation, for a Parent/Guardian — lets them log in
    // to check their own ward(s)' results, fees, attendance, etc.
    // Full student details for every child linked to one parent/guardian — powers the parent's
    // profile page, so clicking a parent's name shows both who they are and which student(s)
    // they're responsible for, not just a name.
    if (pathname.match(/^\/api\/parents_guardians\/\d+\/students$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'parents');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const parentId = Number(pathname.split('/')[3]);
      const rows = db.prepare(`SELECT s.*, c.name as class_name FROM students s
        JOIN student_parents sp ON sp.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id
        WHERE sp.parent_id=? ORDER BY s.first_name`).all(parentId);
      return sendJSON(res, 200, rows);
    }
    // Every class a teacher is connected to — either as the Class Teacher (homeroom) or as a
    // Subject Teacher — powers the teacher's profile page.
    if (pathname.match(/^\/api\/teachers\/\d+\/classes$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'teachers');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const teacherId = Number(pathname.split('/')[3]);
      const asClassTeacher = db.prepare(`SELECT c.*, 'Class Teacher' as role_here,
          (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.status='Active') as student_count
        FROM classes c WHERE c.class_teacher_id=?`).all(teacherId);
      const asSubjectTeacher = db.prepare(`SELECT c.*, 'Subject Teacher' as role_here,
          (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.status='Active') as student_count
        FROM classes c JOIN teacher_classes tc ON tc.class_id=c.id WHERE tc.teacher_id=?`).all(teacherId);
      return sendJSON(res, 200, [...asClassTeacher, ...asSubjectTeacher]);
    }

    if (pathname.match(/^\/api\/parents_guardians\/\d+\/create-login$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'parents');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const parentId = Number(pathname.split('/')[3]);
      const parent = db.prepare('SELECT * FROM parents_guardians WHERE id=?').get(parentId);
      if (!parent) return sendJSON(res, 404, { error: 'Parent/Guardian not found.' });
      const body = await readBody(req); // { username, password }
      if (!body.username || !body.username.trim()) return sendJSON(res, 400, { error: 'Choose a username.' });
      const parentRole = db.prepare("SELECT id FROM roles WHERE name='Parent/Guardian'").get();
      if (!parentRole) return sendJSON(res, 500, { error: 'Parent/Guardian role is missing from this installation.' });
      const existing = db.prepare('SELECT * FROM users WHERE linked_parent_id=?').get(parentId);
      if (existing) {
        if (body.password) {
          const { hash, salt } = hashPassword(body.password);
          db.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, existing.id);
          logAudit(currentUser, 'Reset parent login password', 'parents', { parentId });
          return sendJSON(res, 200, { username: existing.username, updated: true });
        }
        return sendJSON(res, 200, { username: existing.username, alreadyExists: true });
      }
      if (!body.password || body.password.length < 4) return sendJSON(res, 400, { error: 'Choose a password (at least 4 characters).' });
      const { hash, salt } = hashPassword(body.password);
      try {
        db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, linked_parent_id) VALUES (?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, parent.full_name, parentRole.id, parentId);
      } catch (e) { return sendJSON(res, 400, { error: 'That username is already taken.' }); }
      logAudit(currentUser, 'Create parent login', 'parents', { parentId, username: body.username });
      return sendJSON(res, 201, { username: body.username, created: true });
    }
    // Same pattern again, for Non-teaching Staff — previously the only way to give a staff
    // member a login was the generic "Add User" form in Users & Roles, which never actually
    // linked the account back to their staff record, so there was no reliable way to know
    // "this login belongs to this staff member" (needed for the staff profile panel's
    // Send Message button, among other things).
    if (pathname.match(/^\/api\/staff\/\d+\/create-login$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const staffId = Number(pathname.split('/')[3]);
      const staffRow = db.prepare('SELECT * FROM staff WHERE id=?').get(staffId);
      if (!staffRow) return sendJSON(res, 404, { error: 'Staff member not found.' });
      const body = await readBody(req); // { username, password }
      if (!body.username || !body.username.trim()) return sendJSON(res, 400, { error: 'Choose a username.' });
      const staffRole = db.prepare("SELECT id FROM roles WHERE name='Non-teaching Staff'").get();
      if (!staffRole) return sendJSON(res, 500, { error: 'Non-teaching Staff role is missing from this installation.' });
      const existing = db.prepare('SELECT * FROM users WHERE linked_staff_id=?').get(staffId);
      if (existing) {
        if (body.password) {
          const { hash, salt } = hashPassword(body.password);
          db.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, existing.id);
          logAudit(currentUser, 'Reset staff login password', 'staff', { staffId });
          return sendJSON(res, 200, { username: existing.username, updated: true });
        }
        return sendJSON(res, 200, { username: existing.username, alreadyExists: true });
      }
      if (!body.password || body.password.length < 4) return sendJSON(res, 400, { error: 'Choose a password (at least 4 characters).' });
      const { hash, salt } = hashPassword(body.password);
      try {
        db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, linked_staff_id) VALUES (?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, staffRow.full_name, staffRole.id, staffId);
      } catch (e) { return sendJSON(res, 400, { error: 'That username is already taken.' }); }
      logAudit(currentUser, 'Create staff login', 'staff', { staffId, username: body.username });
      return sendJSON(res, 201, { username: body.username, created: true });
    }
    // For the staff profile panel: does this staff member have a login, and if so what user id
    // (needed to actually address a Message to them)?
    if (pathname.match(/^\/api\/staff\/\d+\/linked-user$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const staffId = Number(pathname.split('/')[3]);
      const user = db.prepare('SELECT id, username FROM users WHERE linked_staff_id=?').get(staffId);
      return sendJSON(res, 200, user || null);
    }
    // ---- GES School Selection (SHS placement form) ----
    if (pathname === '/api/school-selection-config' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM school_selection_config WHERE id=1').get());
    }
    if (pathname === '/api/school-selection-config' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      const max = Math.max(1, Math.min(15, Number(body.max_choices) || 8));
      const maxA = Math.max(0, Math.min(max, Number(body.max_category_a) || 2));
      const maxB = Math.max(0, Math.min(max, Number(body.max_category_b) || 3));
      db.prepare('UPDATE school_selection_config SET max_choices=?, max_category_a=?, max_category_b=? WHERE id=1').run(max, maxA, maxB);
      return sendJSON(res, 200, db.prepare('SELECT * FROM school_selection_config WHERE id=1').get());
    }
    // CSV import/export for the GES School Database — the practical way to load the full,
    // authoritative register (900+ schools) since GES republishes it every year.
    if (pathname === '/api/ges_schools/export-csv' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare('SELECT * FROM ges_schools ORDER BY category, school_name').all();
      const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['School Code', 'School Name', 'Category', 'Region', 'District', 'Gender', 'Day/Boarding', 'Type', 'Programmes'];
      const lines = [header.map(csvEscape).join(',')];
      rows.forEach(r => lines.push([r.school_code, r.school_name, r.category, r.region, r.district, r.gender, r.day_boarding, r.sch_type, r.programmes].map(csvEscape).join(',')));
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ges_schools.csv"' });
      return res.end('\uFEFF' + lines.join('\r\n'));
    }
    if (pathname === '/api/ges_schools/import-csv' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { csv_text }
      if (!body.csv_text) return sendJSON(res, 400, { error: 'csv_text is required.' });
      const lines = body.csv_text.split(/\r\n|\r|\n/).filter(l => l.trim());
      const dataLines = lines[0] && lines[0].toLowerCase().includes('school code') ? lines.slice(1) : lines;
      const upsert = db.prepare(`INSERT INTO ges_schools (school_code, school_name, category, region, district, gender, day_boarding, sch_type, programmes) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(school_code) DO UPDATE SET school_name=excluded.school_name, category=excluded.category, region=excluded.region, district=excluded.district, gender=excluded.gender, day_boarding=excluded.day_boarding, sch_type=excluded.sch_type, programmes=excluded.programmes`);
      let created = 0, skipped = 0;
      for (const line of dataLines) {
        const cells = line.split(',').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        const [code, name, category, region, district, gender, dayBoarding, schType, programmes] = cells;
        if (!code || !name) { skipped++; continue; }
        upsert.run(code, name, category || 'C', region || null, district || null, gender || 'Mixed', dayBoarding || null, schType || null, programmes || null);
        created++;
      }
      logAudit(currentUser, 'Import GES schools CSV', 'students', { created, skipped });
      return sendJSON(res, 200, { created, skipped });
    }

    if (pathname === '/api/system-lock-config' && req.method === 'GET') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const lock = db.prepare('SELECT expiry_date, lock_message FROM system_lock WHERE id=1').get();
      return sendJSON(res, 200, lock);
    }
    if (pathname === '/api/system-lock-config' && req.method === 'PUT') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { expiry_date, lock_message }
      const cols = ['expiry_date', 'lock_message'].filter(c => body[c] !== undefined);
      if (cols.length) db.prepare(`UPDATE system_lock SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=1`).run(...cols.map(c => body[c]));
      return sendJSON(res, 200, db.prepare('SELECT expiry_date, lock_message FROM system_lock WHERE id=1').get());
    }
    if (pathname === '/api/system-lock-generate-token' && req.method === 'POST') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Not authenticated' });
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const token = generateUnlockToken();
      db.prepare('UPDATE system_lock SET token=? WHERE id=1').run(token);
      logAudit(currentUser, 'Generate new system unlock token', 'settings', {});
      return sendJSON(res, 200, { token }); // shown once — admin must save it
    }

    if (pathname === '/api/school-selections' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { student_id } = parsed.query;
      let studentId = student_id;
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, null);
        studentId = currentUser.linked_student_id;
      }
      if (!studentId) return sendJSON(res, 400, { error: 'student_id is required.' });
      const row = db.prepare('SELECT * FROM school_selections WHERE student_id=?').get(studentId);
      if (!row) return sendJSON(res, 200, null);
      try { row.choices = JSON.parse(row.choices || '[]'); } catch (e) { row.choices = []; }
      try { row.programme_preferences = JSON.parse(row.programme_preferences || '[]'); } catch (e) { row.programme_preferences = []; }
      return sendJSON(res, 200, row);
    }
    if (pathname === '/api/school-selections' && req.method === 'POST') {
      const body = await readBody(req); // { student_id, choices, programme_preferences, other_programme, parent_name, parent_phone }
      let studentId = body.student_id;
      if (currentUser.role_name === 'Student') {
        // A student saving their OWN selection is always allowed — this is self-service, and
        // deliberately doesn't require the broader can_add/can_edit on 'students' (which
        // Student accounts don't have, and shouldn't, since that would let them create or
        // modify arbitrary student records elsewhere in the system).
        if (!currentUser.linked_student_id) return sendJSON(res, 403, { error: 'Your account is not linked to a student record.' });
        studentId = currentUser.linked_student_id; // ignore any student_id in the body — always their own
      } else {
        const perms = getPermissions(currentUser.role_id, 'students');
        if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      }
      if (!studentId) return sendJSON(res, 400, { error: 'student_id is required.' });
      const existing = db.prepare('SELECT id FROM school_selections WHERE student_id=?').get(studentId);
      const choicesJson = JSON.stringify(body.choices || []);
      const prefsJson = JSON.stringify(body.programme_preferences || []);
      const signedOff = body.parent_signed_off ? 1 : 0;
      if (existing) {
        db.prepare(`UPDATE school_selections SET choices=?, programme_preferences=?, other_programme=?, parent_name=?, parent_phone=?, index_number=?, residential_location=?, parent_signed_off=?, updated_at=datetime('now') WHERE student_id=?`)
          .run(choicesJson, prefsJson, body.other_programme || null, body.parent_name || null, body.parent_phone || null, body.index_number || null, body.residential_location || null, signedOff, studentId);
      } else {
        db.prepare(`INSERT INTO school_selections (student_id, choices, programme_preferences, other_programme, parent_name, parent_phone, index_number, residential_location, parent_signed_off) VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(studentId, choicesJson, prefsJson, body.other_programme || null, body.parent_name || null, body.parent_phone || null, body.index_number || null, body.residential_location || null, signedOff);
      }
      logAudit(currentUser, 'Save school selection', 'students', { studentId });
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname === '/api/school-selections/export-csv' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id } = parsed.query;
      let students = class_id
        ? db.prepare('SELECT * FROM students WHERE class_id=?').all(class_id)
        : db.prepare('SELECT * FROM students').all();
      const config = db.prepare('SELECT * FROM school_selection_config WHERE id=1').get();
      const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Student ID', 'Name', 'Class', 'Index Number', 'Residential Location'];
      for (let i = 1; i <= config.max_choices; i++) header.push(`Choice ${i} Code`, `Choice ${i} School`, `Choice ${i} Category`, `Choice ${i} Programme Code`, `Choice ${i} Programme`, `Choice ${i} Day/Boarding`);
      header.push('Programme Preferences', 'Other Programme', 'Parent/Guardian Name', 'Parent Phone', 'Parent Signed Off');
      const classNames = {}; db.prepare('SELECT id, name FROM classes').all().forEach(c => classNames[c.id] = c.name);
      const lines = [header.map(csvEscape).join(',')];
      for (const s of students) {
        const sel = db.prepare('SELECT * FROM school_selections WHERE student_id=?').get(s.id);
        let choices = []; let prefs = [];
        if (sel) {
          try { choices = JSON.parse(sel.choices || '[]'); } catch (e) { choices = []; }
          try { prefs = JSON.parse(sel.programme_preferences || '[]'); } catch (e) { prefs = []; }
        }
        const row = [s.student_id, `${s.first_name} ${s.last_name}`, classNames[s.class_id] || '', sel ? sel.index_number || '' : '', sel ? sel.residential_location || '' : ''];
        for (let i = 0; i < config.max_choices; i++) {
          const c = choices[i] || {};
          row.push(c.school_code || '', c.school_name || '', c.category || '', c.programme_code || '', c.programme_name || '', c.day_boarding || '');
        }
        row.push(prefs.join('; '), sel ? sel.other_programme || '' : '', sel ? sel.parent_name || '' : '', sel ? sel.parent_phone || '' : '', sel && sel.parent_signed_off ? 'Yes' : 'No');
        lines.push(row.map(csvEscape).join(','));
      }
      const csv = lines.join('\r\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="school_selections.csv"` });
      return res.end('\uFEFF' + csv);
    }

    // Promotes a batch of students from one class to another — a single class-level bulk
    // update rather than editing each student record by hand at the end of the academic year.
    if (pathname === '/api/students/promote' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { student_ids: [...], to_class_id }
      if (!body.to_class_id) return sendJSON(res, 400, { error: 'Choose the class to promote them into.' });
      const toClass = db.prepare('SELECT id, name FROM classes WHERE id=?').get(body.to_class_id);
      if (!toClass) return sendJSON(res, 404, { error: 'Target class not found.' });
      const ids = (body.student_ids || []).filter(Boolean);
      if (!ids.length) return sendJSON(res, 400, { error: 'Select at least one student to promote.' });
      const update = db.prepare('UPDATE students SET class_id=? WHERE id=?');
      let count = 0;
      for (const id of ids) { update.run(body.to_class_id, id); count++; }
      logAudit(currentUser, `Promoted ${count} student(s) to ${toClass.name}`, 'students', { to_class_id: body.to_class_id, count });
      return sendJSON(res, 200, { ok: true, count });
    }

    if (pathname === '/api/students/csv-template' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      // A genuinely blank starting point — header row plus one clearly-marked example row —
      // for adding brand-new students (as opposed to "Download Names", which exports a class's
      // CURRENT students for editing/re-import).
      const csv = 'Student ID,First Name,Middle Name,Last Name\r\n'
        + ',"Kwame (example — delete this row)","","Mensah"\r\n';
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="student_import_template.csv"' });
      return res.end('\uFEFF' + csv);
    }
    if (pathname === '/api/students/export-csv' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_export && !perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id } = parsed.query;
      if (!class_id) return sendJSON(res, 400, { error: 'A class is required.' });
      const cls = db.prepare('SELECT * FROM classes WHERE id=?').get(class_id);
      if (!cls) return sendJSON(res, 404, { error: 'That class no longer exists.' });
      const rows = db.prepare("SELECT student_id, first_name, middle_name, last_name FROM students WHERE class_id=? AND status='Active' ORDER BY first_name ASC").all(class_id);
      const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      const lines = ['Student ID,First Name,Middle Name,Last Name'];
      rows.forEach(r => lines.push([r.student_id, r.first_name, r.middle_name, r.last_name].map(csvEscape).join(',')));
      const csv = lines.join('\r\n');
      const filename = `${(cls ? cls.name : 'class').replace(/[^a-z0-9]/gi, '_')}_students.csv`;
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.end('\uFEFF' + csv); // BOM so Excel opens UTF-8 names correctly
    }

// A correct CSV-field parser — handles quoted fields that contain commas (e.g. a name typed as
// "Mary, Jane" in Excel), which a plain .split(',') gets wrong and silently misaligns every
// column after it. This is the standard state-machine approach: track whether we're inside a
// quoted field, and only split on commas that are actually outside quotes.
function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}
// ---- Import/update student names from a CSV for one class (Student ID column optional: blank = new student) ----
    if (pathname === '/api/students/import-csv' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id, csv_text }
      const { class_id, csv_text } = body;
      if (!class_id || !csv_text) return sendJSON(res, 400, { error: 'class_id and csv_text are required.' });
      const lines = csv_text.split(/\r\n|\r|\n/).filter(l => l.trim());
      if (!lines.length) return sendJSON(res, 400, { error: 'That file appears to be empty.' });
      // Previously this assumed a fixed column ORDER (Student ID, First, Middle, Last) and just
      // read cells by position — which silently misreads every row into the wrong fields the
      // moment a real school's own spreadsheet has columns in a different order, extra columns,
      // or a single combined "Name" column, exactly the kind of file people actually have lying
      // around already. This now reads the header row and matches column NAMES (flexibly,
      // covering common variations) to the fields needed, rather than assuming their position.
      const headerCells = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
      const findCol = (...names) => headerCells.findIndex(h => names.some(n => h === n || h.includes(n)));
      const idxStudentId = findCol('student id', 'admission no', 'adm no', 'admission number');
      const idxFirst = findCol('first name', 'firstname', 'given name');
      const idxMiddle = findCol('middle name', 'middlename', 'other name', 'othername');
      const idxLast = findCol('last name', 'lastname', 'surname', 'family name');
      const idxFullName = findCol('full name', 'fullname', 'student name', 'name');
      const looksLikeHeader = idxFirst > -1 || idxLast > -1 || idxFullName > -1 || idxStudentId > -1;
      if (!looksLikeHeader) {
        return sendJSON(res, 400, { error: `Could not find name columns in the first row. Found columns: "${headerCells.join('", "')}". Expected at least a "First Name"/"Last Name" pair, or a single "Full Name"/"Name" column — download the template for the exact format, or rename your header row to match.` });
      }
      const dataLines = lines.slice(1);
      const idSettings = db.prepare('SELECT student_id_prefix, id_seq_digits FROM school_settings WHERE id=1').get();
      const digits = (idSettings && idSettings.id_seq_digits) || 3;
      let created = 0, updated = 0, skipped = 0;
      const issues = []; // { row, reason } — surfaced to the admin so a spreadsheet mistake is fixable, not just silently dropped
      dataLines.forEach((line, i) => {
        const rowNum = i + 2; // matches the row an admin would see if they opened this in Excel (row 1 is the header)
        const cells = parseCsvLine(line);
        const studentIdCell = idxStudentId > -1 ? (cells[idxStudentId] || '').trim() : '';
        let firstName = idxFirst > -1 ? (cells[idxFirst] || '').trim() : '';
        let lastName = idxLast > -1 ? (cells[idxLast] || '').trim() : '';
        const middleName = idxMiddle > -1 ? (cells[idxMiddle] || '').trim() : '';
        // No separate First/Last columns, but there IS a single Full Name column — split it on
        // the first space, since that's the best a machine can do without a person to ask.
        if ((!firstName || !lastName) && idxFullName > -1 && (cells[idxFullName] || '').trim()) {
          const parts = cells[idxFullName].trim().split(/\s+/);
          firstName = firstName || parts[0] || '';
          lastName = lastName || (parts.length > 1 ? parts.slice(1).join(' ') : '') || '';
        }
        if (!firstName || !lastName) {
          skipped++;
          issues.push({ row: rowNum, reason: !firstName && !lastName ? 'First Name and Last Name are both blank.' : !firstName ? 'First Name is blank.' : 'Last Name is blank.' });
          return;
        }
        if (studentIdCell) {
          const existing = db.prepare('SELECT id FROM students WHERE student_id=?').get(studentIdCell);
          if (existing) {
            db.prepare('UPDATE students SET first_name=?, middle_name=?, last_name=?, class_id=? WHERE id=?').run(firstName, middleName || null, lastName, class_id, existing.id);
            updated++; return;
          }
          // A Student ID was given but doesn't match anyone — likely a typo rather than a
          // genuinely new student, so this creates the record (so the row isn't silently lost)
          // but flags it, rather than pretending it was an ordinary intentional new admission.
          issues.push({ row: rowNum, reason: `Student ID "${studentIdCell}" was not found — added as a new student instead of updating. Check this ID wasn't mistyped.` });
        }
        const year = new Date().getFullYear();
        const newId = generateSequentialId((idSettings && idSettings.student_id_prefix) || 'NIB', 'student', year, digits);
        db.prepare('INSERT INTO students (student_id, admission_number, first_name, middle_name, last_name, class_id, status) VALUES (?,?,?,?,?,?,?)')
          .run(newId, newId, firstName, middleName || null, lastName, class_id, 'Active');
        created++;
      });
      logAudit(currentUser, 'Import students CSV', 'students', { class_id, created, updated, skipped });
      return sendJSON(res, 200, { created, updated, skipped, issues });
    }

    // ---- Staff Check-in: admin endpoints ----
    if (pathname === '/api/checkin-credential' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { person_type, person_id } = parsed.query;
      if (!person_type || !person_id) return sendJSON(res, 400, { error: 'person_type and person_id are required.' });
      const cred = getOrCreateCheckinCredential(person_type, Number(person_id));
      return sendJSON(res, 200, { token: cred.token, pin: cred.pin, checkin_url: `${req.headers.origin || ''}/checkin/${cred.token}` });
    }
    if (pathname === '/api/staff-checkin-config' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM staff_checkin_config WHERE id=1').get());
    }
    if (pathname === '/api/staff-checkin-config' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      const cols = ['standard_start_time', 'standard_end_time'].filter(c => body[c] !== undefined);
      if (cols.length) db.prepare(`UPDATE staff_checkin_config SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=1`).run(...cols.map(c => body[c]));
      return sendJSON(res, 200, db.prepare('SELECT * FROM staff_checkin_config WHERE id=1').get());
    }
    // Automated attendance log + overtime summary. Overtime = minutes worked past the
    // configured standard end time (0 if they left on time or early, or never checked out).
    if (pathname === '/api/staff-attendance-report' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'staff');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { from, to, person_type, person_id } = parsed.query;
      let sql = 'SELECT * FROM staff_attendance WHERE 1=1';
      const params = [];
      if (from) { sql += ' AND date >= ?'; params.push(from); }
      if (to) { sql += ' AND date <= ?'; params.push(to); }
      if (person_type) { sql += ' AND person_type = ?'; params.push(person_type); }
      if (person_id) { sql += ' AND person_id = ?'; params.push(Number(person_id)); }
      sql += ' ORDER BY date DESC, check_in_time DESC';
      const rows = db.prepare(sql).all(...params);
      const config = db.prepare('SELECT * FROM staff_checkin_config WHERE id=1').get();
      const teacherNames = {}; db.prepare('SELECT id, full_name FROM teachers').all().forEach(t => teacherNames[t.id] = t.full_name);
      const staffNames = {}; db.prepare('SELECT id, full_name FROM staff').all().forEach(s => staffNames[s.id] = s.full_name);
      const toMinutes = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const standardEndMinutes = toMinutes(config.standard_end_time);
      const enriched = rows.map(r => {
        const name = (r.person_type === 'teacher' ? teacherNames : staffNames)[r.person_id] || 'Unknown';
        const outMinutes = toMinutes(r.check_out_time);
        const overtimeMinutes = outMinutes != null && standardEndMinutes != null && outMinutes > standardEndMinutes ? outMinutes - standardEndMinutes : 0;
        return { ...r, name, overtime_minutes: overtimeMinutes };
      });
      const totalOvertimeMinutes = enriched.reduce((sum, r) => sum + r.overtime_minutes, 0);
      return sendJSON(res, 200, { rows: enriched, total_overtime_minutes: totalOvertimeMinutes, config });
    }

    // ---- Assignments / Group Work / Quizzes / Examinations ----
    if (pathname === '/api/assignments' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      let sql = `SELECT a.*, c.name as class_name, sub.name as subject_name,
        (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id=a.id) as question_count,
        (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id=a.id) as submission_count
        FROM assignments a LEFT JOIN classes c ON c.id=a.class_id LEFT JOIN subjects sub ON sub.id=a.subject_id`;
      const params = [];
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, []);
        const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
        // An assignment with no class picked applies to everyone, same convention as the
        // Discussion Forum's "no class = visible to all" — not "visible to no one," which is
        // what a strict equality check against NULL would otherwise silently produce.
        sql += ' WHERE (a.class_id IS NULL OR a.class_id = ?)';
        params.push(student ? student.class_id : -1);
      }
      sql += ' ORDER BY a.created_at DESC';
      const rows = db.prepare(sql).all(...params);
      if (currentUser.role_name === 'Student' && currentUser.linked_student_id) {
        const submittedIds = new Set(db.prepare('SELECT assignment_id FROM assignment_submissions WHERE student_id=?').all(currentUser.linked_student_id).map(r => r.assignment_id));
        rows.forEach(r => r.already_submitted = submittedIds.has(r.id));
      }
      return sendJSON(res, 200, rows);
    }
    if (pathname === '/api/assignments' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { title, type, class_id, subject_id, instructions, due_date, questions: [...] }
      if (!body.title || !body.questions || !body.questions.length) return sendJSON(res, 400, { error: 'A title and at least one question are required.' });
      const info = db.prepare('INSERT INTO assignments (title, type, class_id, subject_id, instructions, due_date, created_by, created_by_name) VALUES (?,?,?,?,?,?,?,?)')
        .run(body.title, body.type || 'Assignment', body.class_id || null, body.subject_id || null, body.instructions || null, body.due_date || null, currentUser.id, currentUser.full_name);
      const assignmentId = Number(info.lastInsertRowid);
      const insQ = db.prepare('INSERT INTO assignment_questions (assignment_id, question_number, question_text, question_type, options, correct_option, marks) VALUES (?,?,?,?,?,?,?)');
      body.questions.forEach((q, i) => {
        insQ.run(assignmentId, i + 1, q.question_text, q.question_type || 'text',
          q.question_type === 'mcq' ? JSON.stringify(q.options || []) : null,
          q.question_type === 'mcq' ? (q.correct_option ?? null) : null, q.marks || 1);
      });
      logAudit(currentUser, 'Create assignment', 'assignments', { assignmentId, title: body.title });
      return sendJSON(res, 201, { id: assignmentId });
    }
    if (pathname.match(/^\/api\/assignments\/\d+$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const id = Number(pathname.split('/')[3]);
      const assignment = db.prepare(`SELECT a.*, c.name as class_name, sub.name as subject_name FROM assignments a
        LEFT JOIN classes c ON c.id=a.class_id LEFT JOIN subjects sub ON sub.id=a.subject_id WHERE a.id=?`).get(id);
      if (!assignment) return sendJSON(res, 404, { error: 'Not found' });
      if (currentUser.role_name === 'Student') {
        const student = currentUser.linked_student_id ? db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id) : null;
        if (!student || student.class_id !== assignment.class_id) return sendJSON(res, 403, { error: 'This assignment is for a different class.' });
      }
      const questions = db.prepare('SELECT * FROM assignment_questions WHERE assignment_id=? ORDER BY question_number ASC').all(id);
      questions.forEach(q => { if (q.options) { try { q.options = JSON.parse(q.options); } catch (e) { q.options = []; } } });
      let mySubmission = null;
      if (currentUser.role_name === 'Student' && currentUser.linked_student_id) {
        const sub = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id=? AND student_id=?').get(id, currentUser.linked_student_id);
        if (sub) {
          const answers = db.prepare('SELECT * FROM assignment_answers WHERE submission_id=?').all(sub.id);
          mySubmission = { ...sub, answers };
        }
      }
      return sendJSON(res, 200, { assignment, questions, mySubmission });
    }
    if (pathname.match(/^\/api\/assignments\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const id = Number(pathname.split('/')[3]);
      const subIds = db.prepare('SELECT id FROM assignment_submissions WHERE assignment_id=?').all(id).map(r => r.id);
      subIds.forEach(sid => db.prepare('DELETE FROM assignment_answers WHERE submission_id=?').run(sid));
      db.prepare('DELETE FROM assignment_submissions WHERE assignment_id=?').run(id);
      db.prepare('DELETE FROM assignment_questions WHERE assignment_id=?').run(id);
      db.prepare('DELETE FROM assignments WHERE id=?').run(id);
      logAudit(currentUser, 'Delete assignment', 'assignments', { id });
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/assignments\/\d+\/export-word$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const id = Number(pathname.split('/')[3]);
      const assignment = db.prepare(`SELECT a.*, c.name as class_name, sub.name as subject_name FROM assignments a
        LEFT JOIN classes c ON c.id=a.class_id LEFT JOIN subjects sub ON sub.id=a.subject_id WHERE a.id=?`).get(id);
      if (!assignment) return sendJSON(res, 404, { error: 'Not found' });
      const questions = db.prepare('SELECT * FROM assignment_questions WHERE assignment_id=? ORDER BY question_number ASC').all(id);
      const school = db.prepare('SELECT school_name, motto FROM school_settings WHERE id=1').get();
      const rtf = generateAssignmentRtf(assignment, questions, school);
      const filename = `${assignment.title.replace(/[^a-z0-9]/gi, '_')}.rtf`;
      res.writeHead(200, { 'Content-Type': 'application/rtf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.end(rtf);
    }
    if (pathname.match(/^\/api\/assignments\/\d+\/submit$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      if (currentUser.role_name !== 'Student' || !currentUser.linked_student_id) return sendJSON(res, 403, { error: 'Only students can submit answers.' });
      const id = Number(pathname.split('/')[3]);
      const assignment = db.prepare('SELECT * FROM assignments WHERE id=?').get(id);
      if (!assignment) return sendJSON(res, 404, { error: 'Not found' });
      const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
      if (!student || student.class_id !== assignment.class_id) return sendJSON(res, 403, { error: 'This assignment is for a different class.' });
      const body = await readBody(req); // { answers: [{ question_id, answer_text }] }
      let submission = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id=? AND student_id=?').get(id, currentUser.linked_student_id);
      if (!submission) {
        const info = db.prepare('INSERT INTO assignment_submissions (assignment_id, student_id) VALUES (?,?)').run(id, currentUser.linked_student_id);
        submission = { id: Number(info.lastInsertRowid) };
      } else {
        db.prepare('UPDATE assignment_submissions SET submitted_at=datetime("now") WHERE id=?').run(submission.id);
      }
      const upsertAnswer = db.prepare(`INSERT INTO assignment_answers (submission_id, question_id, answer_text) VALUES (?,?,?)
        ON CONFLICT(submission_id, question_id) DO UPDATE SET answer_text=excluded.answer_text`);
      (body.answers || []).forEach(a => upsertAnswer.run(submission.id, a.question_id, a.answer_text || ''));
      logAudit(currentUser, 'Submit assignment answers', 'assignments', { assignmentId: id });
      return sendJSON(res, 200, { ok: true });
    }
    // A teacher assigning/updating the mark for one student's answer to one question —
    // separate from the generic assignment_answers route, since grading needs its own
    // permission story (a Teacher grading isn't the same action as a Student submitting).
    if (pathname.match(/^\/api\/assignment_answers\/\d+\/grade$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const answerId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { marks_awarded, teacher_feedback }
      const answer = db.prepare('SELECT * FROM assignment_answers WHERE id=?').get(answerId);
      if (!answer) return sendJSON(res, 404, { error: 'Answer not found.' });
      const question = db.prepare('SELECT * FROM assignment_questions WHERE id=?').get(answer.question_id);
      let marks = body.marks_awarded === '' || body.marks_awarded == null ? null : Number(body.marks_awarded);
      if (marks != null && question && marks > question.marks) {
        return sendJSON(res, 400, { error: `Marks can't exceed the question's maximum of ${question.marks}.` });
      }
      db.prepare('UPDATE assignment_answers SET marks_awarded=?, teacher_feedback=? WHERE id=?').run(marks, body.teacher_feedback || null, answerId);
      logAudit(currentUser, 'Grade assignment answer', 'assignments', { answerId, marks });
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname.match(/^\/api\/assignments\/\d+\/submissions$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'assignments');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const id = Number(pathname.split('/')[3]);
      const submissions = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id=? ORDER BY submitted_at DESC').all(id);
      const studentNames = {}; db.prepare('SELECT id, student_id, first_name, last_name FROM students').all().forEach(s => studentNames[s.id] = `${s.first_name} ${s.last_name} (${s.student_id})`);
      const enriched = submissions.map(s => {
        const answers = db.prepare('SELECT * FROM assignment_answers WHERE submission_id=?').all(s.id);
        return { ...s, student_name: studentNames[s.student_id] || 'Unknown', answers };
      });
      return sendJSON(res, 200, enriched);
    }

    // ---- Class Group membership (which students belong to a teacher's group) ----
    if (pathname.match(/^\/api\/class_groups\/\d+\/members$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'class_groups');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const groupId = Number(pathname.split('/')[3]);
      const members = db.prepare(`SELECT s.id, s.student_id, s.first_name, s.last_name FROM class_group_members m
        JOIN students s ON s.id=m.student_id WHERE m.group_id=? ORDER BY s.first_name ASC`).all(groupId);
      return sendJSON(res, 200, members);
    }
    if (pathname.match(/^\/api\/class_groups\/\d+\/members$/) && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'class_groups');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const groupId = Number(pathname.split('/')[3]);
      const body = await readBody(req); // { student_id }
      db.prepare('INSERT OR IGNORE INTO class_group_members (group_id, student_id) VALUES (?,?)').run(groupId, body.student_id);
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname.match(/^\/api\/class_groups\/\d+\/members\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'class_groups');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const segs2 = pathname.split('/');
      db.prepare('DELETE FROM class_group_members WHERE group_id=? AND student_id=?').run(Number(segs2[3]), Number(segs2[5]));
      return sendJSON(res, 200, { ok: true });
    }
    // Every task assigned to any group the logged-in student belongs to, across all their groups.
    if (pathname === '/api/my-group-tasks' && req.method === 'GET') {
      if (currentUser.role_name !== 'Student' || !currentUser.linked_student_id) return sendJSON(res, 200, { group_tasks: [], individual_tasks: [] });
      const groupTasks = db.prepare(`SELECT gt.*, cg.name as group_name FROM group_tasks gt
        JOIN class_groups cg ON cg.id=gt.group_id
        JOIN class_group_members m ON m.group_id=gt.group_id
        WHERE m.student_id=? ORDER BY gt.created_at DESC`).all(currentUser.linked_student_id);
      const individualTasks = db.prepare('SELECT * FROM student_tasks WHERE student_id=? ORDER BY created_at DESC').all(currentUser.linked_student_id);
      return sendJSON(res, 200, { group_tasks: groupTasks, individual_tasks: individualTasks });
    }
    // A student marking one of their own individually-assigned tasks as done — separate from
    // the generic student_tasks resource route below, which a Teacher uses to create/manage them.
    if (pathname.match(/^\/api\/student_tasks\/\d+\/complete$/) && req.method === 'POST') {
      if (currentUser.role_name !== 'Student' || !currentUser.linked_student_id) return sendJSON(res, 403, { error: 'No permission' });
      const taskId = Number(pathname.split('/')[3]);
      const task = db.prepare('SELECT * FROM student_tasks WHERE id=?').get(taskId);
      if (!task || task.student_id !== currentUser.linked_student_id) return sendJSON(res, 403, { error: 'Not your task.' });
      db.prepare("UPDATE student_tasks SET status='Done' WHERE id=?").run(taskId);
      return sendJSON(res, 200, { ok: true });
    }

    // Assigns the same fee (type, term, amount) to a whole list of students at once — the
    // single-student "Assign" form still exists for a one-off, but re-typing the same fee
    // type/term/amount one student at a time for a whole class was the actual pain point.
    // Registered here, BEFORE the generic /api/<resource>/<id> dispatcher below, since
    // "/api/fees/bulk-assign" would otherwise be misread as resource "fees" with a malformed
    // numeric id ("bulk-assign" -> NaN) and silently mishandled by the generic route instead of
    // ever reaching this one — caught by testing the actual button, not by code review.
    if (pathname === '/api/fees/bulk-assign' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { student_ids: [...], fee_type_id, term_id, amount_due }
      if (!Array.isArray(body.student_ids) || !body.student_ids.length) return sendJSON(res, 400, { error: 'Select at least one student.' });
      if (!body.fee_type_id || !body.amount_due) return sendJSON(res, 400, { error: 'A fee type and amount are required.' });
      const insert = db.prepare('INSERT INTO fees (student_id, fee_type_id, term_id, amount_due) VALUES (?,?,?,?)');
      let created = 0;
      // Node's built-in node:sqlite doesn't have better-sqlite3's db.transaction() helper —
      // caught this the same way the routing-order bug above was caught, by actually running
      // the button rather than assuming the API. A plain loop is fine here: each insert is
      // independent, so there's no real need for all-or-nothing atomicity across students.
      for (const sid of body.student_ids) {
        const student = db.prepare('SELECT id FROM students WHERE id=?').get(sid);
        if (!student) continue;
        insert.run(sid, body.fee_type_id, body.term_id || null, body.amount_due);
        created++;
      }
      logAudit(currentUser, 'Bulk-assign fees', 'fees', { count: created, fee_type_id: body.fee_type_id, term_id: body.term_id, amount_due: body.amount_due });
      return sendJSON(res, 200, { created });
    }

    // Bulk-clear every Fee Type at once — refuses if any are actually in use (a real fee has
    // been assigned against them), since silently deleting those would orphan real payment
    // records rather than just tidy up an unused list.
    if (pathname === '/api/fee_types/clear-all' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const inUse = db.prepare(`SELECT COUNT(*) c FROM fees`).get().c;
      if (inUse > 0) return sendJSON(res, 400, { error: `${inUse} fee record(s) already reference a fee type — clear/reassign those first, or delete fee types individually instead.` });
      const count = db.prepare('SELECT COUNT(*) c FROM fee_types').get().c;
      db.prepare('DELETE FROM fee_types').run();
      logAudit(currentUser, 'Clear all fee types', 'fees', { count });
      return sendJSON(res, 200, { cleared: count });
    }
    // A single Fee Type delete refuses the same way, individually, so removing one that's
    // actually in use gives a clear reason instead of a generic database error or (worse) an
    // orphaned reference silently left behind on the fee records that used it.
    if (pathname.match(/^\/api\/fee_types\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const feeTypeId = Number(pathname.split('/')[3]);
      const inUse = db.prepare('SELECT COUNT(*) c FROM fees WHERE fee_type_id=?').get(feeTypeId).c;
      if (inUse > 0) return sendJSON(res, 400, { error: `This fee type is used by ${inUse} fee record(s) and can't be deleted while in use.` });
      db.prepare('DELETE FROM fee_types WHERE id=?').run(feeTypeId);
      logAudit(currentUser, 'Delete fee type', 'fees', { feeTypeId });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Income & Expenditure (under Fees) ----
    // Income is never stored directly — it's computed live from two real sources so it can
    // never drift out of sync with what actually happened: fee_payments (cash/bank/etc. and
    // MTN MoMo payments that already turned into a fee_payments row once confirmed) plus any
    // momo_transactions still PENDING isn't counted as income until it actually succeeds.
    if (pathname === '/api/income-summary' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const period = parsed.query.period || 'weekly'; // weekly | monthly | termly
      const now = new Date();
      let sinceDate;
      if (period === 'weekly') {
        const day = now.getDay(); // 0=Sun
        const mondayOffset = day === 0 ? 6 : day - 1;
        sinceDate = new Date(now); sinceDate.setDate(now.getDate() - mondayOffset); sinceDate.setHours(0, 0, 0, 0);
      } else if (period === 'monthly') {
        sinceDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else { // termly — since the currently active term's start; fall back to 90 days if no active term is set
        const activeTerm = db.prepare(`SELECT t.* FROM terms t WHERE date('now') BETWEEN COALESCE(t.start_date,'0000-01-01') AND COALESCE(t.end_date,'9999-12-31') ORDER BY t.id DESC LIMIT 1`).get();
        sinceDate = activeTerm && activeTerm.start_date ? new Date(activeTerm.start_date) : new Date(Date.now() - 90 * 24 * 3600 * 1000);
      }
      const sinceIso = sinceDate.toISOString().slice(0, 10);
      // Income now genuinely combines every real money-in source, not just fee payments: school
      // fees (including MTN MoMo, since a successful MoMo payment already lands here once
      // confirmed) plus canteen payments, which previously lived in their own table and were
      // never actually counted toward income at all.
      const feesIncome = db.prepare(`SELECT COALESCE(SUM(amount_paid),0) t FROM fee_payments WHERE date(payment_date) >= date(?)`).get(sinceIso).t;
      const canteenIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) t FROM canteen_payments WHERE status='Paid' AND date(date) >= date(?)`).get(sinceIso).t;
      const income = feesIncome + canteenIncome;
      const expenditure = db.prepare(`SELECT COALESCE(SUM(amount),0) t FROM expenditures WHERE date(expense_date) >= date(?)`).get(sinceIso).t;
      // How many distinct students actually paid something, in each category, this period —
      // gives real texture to a target rather than just one lump income figure.
      const payerCounts = {
        feesPayers: db.prepare(`SELECT COUNT(DISTINCT f.student_id) c FROM fee_payments fp JOIN fees f ON f.id=fp.fee_id WHERE date(fp.payment_date) >= date(?)`).get(sinceIso).c,
        canteenPayers: db.prepare(`SELECT COUNT(DISTINCT student_id) c FROM canteen_payments WHERE status='Paid' AND date(date) >= date(?)`).get(sinceIso).c,
        busUsers: db.prepare(`SELECT COUNT(*) c FROM students WHERE uses_bus=1 AND status='Active'`).get().c,
        totalActiveStudents: db.prepare(`SELECT COUNT(*) c FROM students WHERE status='Active'`).get().c,
      };
      let targetAmount = 0, weeklyTargetInfo = null;
      if (period === 'weekly') {
        // A specific target set for THIS week (by its start date) takes priority over the
        // generic recurring weekly figure, for a school that wants a different goal for a
        // particular week — e.g. a fundraising week — rather than the same number every time.
        const specificWeekly = db.prepare('SELECT * FROM weekly_targets WHERE date(week_start_date) = date(?)').get(sinceIso);
        if (specificWeekly) { targetAmount = specificWeekly.target_amount; weeklyTargetInfo = specificWeekly; }
      }
      if (!weeklyTargetInfo) {
        const target = db.prepare('SELECT target_amount FROM income_targets WHERE period_type=?').get(period);
        targetAmount = (target && target.target_amount) || 0;
      }
      const byCategory = db.prepare(`SELECT category, SUM(amount) total FROM expenditures WHERE date(expense_date) >= date(?) GROUP BY category ORDER BY total DESC`).all(sinceIso);
      return sendJSON(res, 200, {
        period, since: sinceIso, income, feesIncome, canteenIncome, expenditure, profit: income - expenditure,
        target: targetAmount, weeklyTargetInfo, expenditureByCategory: byCategory, payerCounts,
      });
    }
    if (pathname === '/api/income-targets' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare('SELECT * FROM income_targets').all();
      const byType = { weekly: 0, monthly: 0, termly: 0 };
      rows.forEach(r => { byType[r.period_type] = r.target_amount; });
      return sendJSON(res, 200, byType);
    }
    if (pathname === '/api/income-targets' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { period_type, target_amount }
      if (!['weekly', 'monthly', 'termly'].includes(body.period_type)) return sendJSON(res, 400, { error: 'period_type must be weekly, monthly, or termly.' });
      db.prepare(`INSERT INTO income_targets (period_type, target_amount, updated_at) VALUES (?,?,datetime('now'))
        ON CONFLICT(period_type) DO UPDATE SET target_amount=excluded.target_amount, updated_at=datetime('now')`).run(body.period_type, body.target_amount || 0);
      logAudit(currentUser, 'Set income target', 'fees', { period_type: body.period_type, target_amount: body.target_amount });
      return sendJSON(res, 200, { ok: true });
    }
    // Resets Income & Expenditure back to a blank slate — clears every logged expense and every
    // target. Deliberately does NOT touch fee_payments/momo_transactions (income itself), since
    // those are real financial records belonging to the Fees feature, not something a "reset"
    // on this page should ever be able to erase.
    if (pathname === '/api/income-expenditure/reset' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const expenseCount = db.prepare('SELECT COUNT(*) c FROM expenditures').get().c;
      db.prepare('DELETE FROM expenditures').run();
      db.prepare('DELETE FROM income_targets').run();
      logAudit(currentUser, 'Reset Income & Expenditure (expenses and targets cleared)', 'fees', { expenseCount });
      return sendJSON(res, 200, { ok: true, expenseCount });
    }
    // ---- Salaries — Teachers, Non-teaching Staff, paid as a logged expense, feeding straight
    // into the same Income & Expenditure numbers as everything else. ----
    // Resets ALL fee records and payments school-wide — a much bigger, more destructive action
    // than the Income & Expenditure reset above (which only touches logged expenses/targets).
    // This wipes every student's fee assignments and payment history, for a school that wants a
    // genuinely clean slate (e.g. starting a new academic year's fee tracking from scratch).
    if (pathname === '/api/fees/reset-all' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const feeCount = db.prepare('SELECT COUNT(*) c FROM fees').get().c;
      const paymentCount = db.prepare('SELECT COUNT(*) c FROM fee_payments').get().c;
      db.prepare('DELETE FROM fee_payments').run();
      db.prepare('DELETE FROM momo_transactions').run();
      db.prepare('DELETE FROM fees').run();
      logAudit(currentUser, 'Reset ALL fees and clearance (destructive)', 'fees', { feeCount, paymentCount });
      return sendJSON(res, 200, { ok: true, feeCount, paymentCount });
    }
    if (pathname === '/api/salaries-status' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const payPeriod = parsed.query.pay_period || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const teachers = db.prepare('SELECT id, full_name, salary FROM teachers WHERE salary IS NOT NULL AND salary > 0').all()
        .map(t => ({ ...t, person_type: 'teacher' }));
      const staffRows = db.prepare('SELECT id, full_name, salary FROM staff WHERE salary IS NOT NULL AND salary > 0').all()
        .map(s => ({ ...s, person_type: 'staff' }));
      const paidThisPeriod = db.prepare(`SELECT paid_to_type, paid_to_id, amount FROM expenditures WHERE category='Salaries' AND pay_period=?`).all(payPeriod);
      const isPaid = (type, id) => paidThisPeriod.find(p => p.paid_to_type === type && p.paid_to_id === id);
      const rows = [...teachers, ...staffRows].map(p => {
        const paid = isPaid(p.person_type, p.id);
        return { ...p, paid: !!paid, paid_amount: paid ? paid.amount : null };
      });
      return sendJSON(res, 200, { pay_period: payPeriod, rows });
    }
    if (pathname === '/api/pay-salary' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { person_type, person_id, amount, pay_period }
      if (!['teacher', 'staff'].includes(body.person_type) || !body.person_id || !body.amount) {
        return sendJSON(res, 400, { error: 'person_type, person_id, and amount are required.' });
      }
      const payPeriod = body.pay_period || new Date().toISOString().slice(0, 7);
      const already = db.prepare(`SELECT id FROM expenditures WHERE category='Salaries' AND paid_to_type=? AND paid_to_id=? AND pay_period=?`).get(body.person_type, body.person_id, payPeriod);
      if (already) return sendJSON(res, 400, { error: `Already marked as paid for ${payPeriod} — delete that record first if this needs correcting.` });
      const person = db.prepare(`SELECT full_name FROM ${body.person_type === 'teacher' ? 'teachers' : 'staff'} WHERE id=?`).get(body.person_id);
      db.prepare(`INSERT INTO expenditures (category, description, amount, expense_date, recorded_by, paid_to_type, paid_to_id, pay_period)
        VALUES ('Salaries', ?, ?, date('now'), ?, ?, ?, ?)`)
        .run(`Salary — ${person ? person.full_name : body.person_type} (${payPeriod})`, body.amount, currentUser.id, body.person_type, body.person_id, payPeriod);
      logAudit(currentUser, 'Pay salary', 'fees', { person_type: body.person_type, person_id: body.person_id, amount: body.amount, pay_period: payPeriod });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Student Documents — any file kept on record for a student (birth certificate,
    // medical note, transfer letter, etc.) ----
    if (pathname.match(/^\/api\/students\/\d+\/documents$/) && req.method === 'GET') {
      const studentId = Number(pathname.split('/')[3]);
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view && !isAuthorizedForStudent(currentUser, studentId)) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare('SELECT * FROM student_documents WHERE student_id=? ORDER BY uploaded_at DESC').all(studentId);
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/students\/\d+\/documents$/) && req.method === 'POST') {
      const studentId = Number(pathname.split('/')[3]);
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { file_data (data URL), original_name, description }
      if (!body.file_data) return sendJSON(res, 400, { error: 'Choose a file to upload.' });
      let filename;
      try { filename = saveAttachmentFromDataUrl(body.file_data, body.original_name || ''); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
      db.prepare('INSERT INTO student_documents (student_id, filename, original_name, description, uploaded_by) VALUES (?,?,?,?,?)')
        .run(studentId, filename, body.original_name || filename, body.description || null, currentUser.id);
      logAudit(currentUser, 'Upload student document', 'students', { studentId, filename: body.original_name });
      return sendJSON(res, 201, { ok: true });
    }
    if (pathname.match(/^\/api\/student-documents\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const docId = Number(pathname.split('/')[3]);
      const doc = db.prepare('SELECT filename FROM student_documents WHERE id=?').get(docId);
      if (doc) deletePhotoFile(doc.filename);
      db.prepare('DELETE FROM student_documents WHERE id=?').run(docId);
      return sendJSON(res, 200, { ok: true });
    }
    // ---- Class Shared Files — a teacher shares a file with an entire class at once (handouts,
    // worksheets, reading lists), visible to every student/parent linked to that class. ----
    if (pathname.match(/^\/api\/classes\/\d+\/shared-files$/) && req.method === 'GET') {
      const classId = Number(pathname.split('/')[3]);
      // A student/parent may only see files for THEIR OWN class — checked the same way other
      // student-private data is scoped, rather than trusting the class_id in the URL blindly.
      if (currentUser.role_name === 'Student') {
        const me = db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
        if (!me || me.class_id !== classId) return sendJSON(res, 403, { error: 'Not your class.' });
      } else if (currentUser.role_name === 'Parent/Guardian') {
        const ward = db.prepare(`SELECT s.class_id FROM students s JOIN student_parents sp ON sp.student_id=s.id WHERE sp.parent_id=? AND s.class_id=?`).get(currentUser.linked_parent_id, classId);
        if (!ward) return sendJSON(res, 403, { error: 'Not your ward\'s class.' });
      } else {
        const perms = getPermissions(currentUser.role_id, 'classes');
        if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      }
      const rows = db.prepare(`SELECT f.*, t.full_name as shared_by_name FROM class_shared_files f LEFT JOIN teachers t ON t.id=f.shared_by WHERE f.class_id=? ORDER BY f.shared_at DESC`).all(classId);
      return sendJSON(res, 200, rows);
    }
    if (pathname.match(/^\/api\/classes\/\d+\/shared-files$/) && req.method === 'POST') {
      const classId = Number(pathname.split('/')[3]);
      // A Teacher may only share files to a class they actually teach — either as Class Teacher
      // or as a Subject Teacher there — checked server-side rather than trusting the client.
      if (currentUser.role_name === 'Teacher') {
        const cls = db.prepare('SELECT class_teacher_id FROM classes WHERE id=?').get(classId);
        const teachesHere = db.prepare(`SELECT 1 FROM timetable_entries WHERE class_id=? AND teacher_id=? LIMIT 1`).get(classId, currentUser.linked_teacher_id);
        if (!cls || (cls.class_teacher_id !== currentUser.linked_teacher_id && !teachesHere)) return sendJSON(res, 403, { error: 'You do not teach this class.' });
      } else {
        const perms = getPermissions(currentUser.role_id, 'classes');
        if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      }
      const body = await readBody(req); // { file_data, original_name, description }
      if (!body.file_data) return sendJSON(res, 400, { error: 'Choose a file to share.' });
      let filename;
      try { filename = saveAttachmentFromDataUrl(body.file_data, body.original_name || ''); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
      db.prepare('INSERT INTO class_shared_files (class_id, filename, original_name, description, shared_by) VALUES (?,?,?,?,?)')
        .run(classId, filename, body.original_name || filename, body.description || null, currentUser.linked_teacher_id || null);
      logAudit(currentUser, 'Share file with class', 'classes', { classId, filename: body.original_name });
      return sendJSON(res, 201, { ok: true });
    }
    if (pathname.match(/^\/api\/class-shared-files\/\d+$/) && req.method === 'DELETE') {
      const fileId = Number(pathname.split('/')[3]);
      const file = db.prepare('SELECT * FROM class_shared_files WHERE id=?').get(fileId);
      if (!file) return sendJSON(res, 404, { error: 'Not found' });
      if (currentUser.role_name === 'Teacher' && file.shared_by !== currentUser.linked_teacher_id) {
        return sendJSON(res, 403, { error: 'You can only remove files you shared yourself.' });
      } else if (currentUser.role_name !== 'Teacher') {
        const perms = getPermissions(currentUser.role_id, 'classes');
        if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      }
      deletePhotoFile(file.filename);
      db.prepare('DELETE FROM class_shared_files WHERE id=?').run(fileId);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Custom Fonts — an admin can upload a .ttf/.otf file so the school can use its own
    // fonts (e.g. a specific Arabic calligraphy style) beyond the small fixed set built into the
    // app. Gated by the 'settings' permission — the same tier as everything else that changes
    // how the system looks and behaves for everyone, not just the uploader. ----
    if (pathname === '/api/custom-fonts' && req.method === 'GET') {
      // Deliberately no permission gate on the read here beyond being logged in — every role
      // that can print an Arabic report needs to see which fonts are available to pick from.
      const rows = db.prepare('SELECT id, display_name, font_key, family_name, filename FROM custom_fonts ORDER BY display_name').all();
      return sendJSON(res, 200, rows);
    }
    if (pathname === '/api/custom-fonts' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { display_name, original_name, font_data }
      const displayName = (body.display_name || '').trim();
      if (!displayName) return sendJSON(res, 400, { error: 'Give the font a name.' });
      if (!body.font_data) return sendJSON(res, 400, { error: 'Choose a .ttf or .otf file to upload.' });
      const ext = (body.original_name || '').split('.').pop().toLowerCase();
      if (!['ttf', 'otf'].includes(ext)) return sendJSON(res, 400, { error: 'Only .ttf and .otf font files are supported.' });
      let filename;
      try { filename = saveAttachmentFromDataUrl(body.font_data, body.original_name || ''); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
      // font_key and family_name both need to be safe to embed directly in CSS (as a
      // font-family value and as part of a settings option value) — derived from the display
      // name but stripped down to something that can't break out of either context.
      const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'font';
      let fontKey = 'custom-' + slug, n = 1;
      while (db.prepare('SELECT 1 FROM custom_fonts WHERE font_key=?').get(fontKey)) { fontKey = `custom-${slug}-${++n}`; }
      const familyName = 'Custom ' + displayName.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
      db.prepare('INSERT INTO custom_fonts (display_name, font_key, family_name, filename, uploaded_by) VALUES (?,?,?,?,?)')
        .run(displayName, fontKey, familyName, filename, currentUser.id);
      logAudit(currentUser, 'Upload custom font', 'settings', { display_name: displayName });
      return sendJSON(res, 201, { ok: true, font_key: fontKey });
    }
    if (pathname.match(/^\/api\/custom-fonts\/\d+$/) && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const fontId = Number(pathname.split('/')[3]);
      const font = db.prepare('SELECT * FROM custom_fonts WHERE id=?').get(fontId);
      if (!font) return sendJSON(res, 404, { error: 'Not found' });
      // If this font is currently selected as the school's Arabic report font, fall back to the
      // built-in default rather than leaving a dangling reference to a font that no longer exists.
      db.prepare(`UPDATE school_settings SET arabic_report_font='default' WHERE arabic_report_font=?`).run(font.font_key);
      deletePhotoFile(font.filename);
      db.prepare('DELETE FROM custom_fonts WHERE id=?').run(fontId);
      logAudit(currentUser, 'Delete custom font', 'settings', { display_name: font.display_name });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Generic resource routes: /api/<resource>[/<id>] ----
    const segs = pathname.split('/').filter(Boolean); // ['api','students','5']
    const resourceName = segs[1];
    if (resources[resourceName]) {
      const schoolId = USE_POSTGRES ? currentUser.school_id : null;
      const perms = USE_POSTGRES
        ? await getPermissionsPg(schoolId, currentUser.role_id, MODULE_FOR_RESOURCE[resourceName] || resourceName)
        : getPermissions(currentUser.role_id, MODULE_FOR_RESOURCE[resourceName] || resourceName);
      const id = segs[2] ? Number(segs[2]) : null;

      if (req.method === 'GET' && !perms.can_view) return sendJSON(res, 403, { error: 'No view permission' });
      if (req.method === 'POST' && !perms.can_add) return sendJSON(res, 403, { error: 'No add permission' });
      if (req.method === 'PUT' && !perms.can_edit) return sendJSON(res, 403, { error: 'No edit permission' });
      if (req.method === 'DELETE' && !perms.can_delete) return sendJSON(res, 403, { error: 'No delete permission' });

      // A logged-in Student may only ever see THEIR OWN student record, and their own fees/results
      // rows — never another student's, and never a broad list of everyone's. This is enforced here
      // centrally (rather than trusting the frontend to only ask for the right thing) because the
      // module-level "can_view" flag above only says Students may see attendance/results/fees AT ALL,
      // not that every row within those tables belongs to them.
      if (currentUser.role_name === 'Student' && req.method === 'GET') {
        if (resourceName === 'students') {
          if (id && id !== currentUser.linked_student_id) return sendJSON(res, 403, { error: 'You can only view your own student record.' });
          if (!id) return sendJSON(res, 403, { error: 'Students cannot browse the full student list.' });
        }
        if (resourceName === 'fees' && !id) {
          if (!currentUser.linked_student_id) return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
          parsed.query.student_id = String(currentUser.linked_student_id); // force-scope the list query to only their own fees
        }
      }

      // A Parent/Guardian only ever sees their own linked ward(s) — never the full student
      // list, and never another family's child, even by guessing an id in the URL.
      if (currentUser.role_name === 'Parent/Guardian' && currentUser.linked_parent_id) {
        const myChildIds = USE_POSTGRES
          ? (await dbpg.query('SELECT student_id FROM student_parents WHERE parent_id=$1 AND school_id=$2', [currentUser.linked_parent_id, schoolId])).rows.map(r => r.student_id)
          : db.prepare('SELECT student_id FROM student_parents WHERE parent_id=?').all(currentUser.linked_parent_id).map(r => r.student_id);
        if (resourceName === 'students') {
          if (id) {
            if (!myChildIds.includes(id)) return sendJSON(res, 403, { error: 'You can only view your own ward\'s record.' });
          } else if (req.method === 'GET') {
            if (!myChildIds.length) return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
            const rows = USE_POSTGRES
              ? (await dbpg.query('SELECT * FROM students WHERE id = ANY($1) AND school_id=$2 ORDER BY id DESC', [myChildIds, schoolId])).rows
              : db.prepare(`SELECT * FROM students WHERE id IN (${myChildIds.map(() => '?').join(',')}) ORDER BY id DESC`).all(...myChildIds);
            return sendJSON(res, 200, { rows, total: rows.length, page: 1, pageSize: rows.length });
          }
        }
        if (resourceName === 'fees' && !id && req.method === 'GET') {
          if (!myChildIds.length || !parsed.query.student_id || !myChildIds.includes(Number(parsed.query.student_id))) {
            return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
          }
        }
        if (resourceName === 'attendance' && !id && req.method === 'GET') {
          if (!myChildIds.length || !parsed.query.student_id || !myChildIds.includes(Number(parsed.query.student_id))) {
            return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
          }
        }
      }

      // An Arabic Head Teacher only ever sees the Arabic-designated teachers at their own
      // assigned level (Primary/JHS/Nursery) — "the staff under them" — never the full staff list.
      if (currentUser.role_name === 'Arabic Head Teacher' && resourceName === 'teachers' && req.method === 'GET' && !id) {
        if (!currentUser.assigned_level) return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
        parsed.query.teacher_level = currentUser.assigned_level;
        // Only Arabic-teaching staff — filtered after the query since 'teaching_language' can be
        // 'Arabic' or 'Both', which a single-value equality filter can't express on its own.
      }

      // A Teacher only ever sees the classes they're assigned as class teacher for, and only
      // the students within those classes — never the whole school's roster. This is the
      // server-side half of what the Class Termly Report page already assumed was true.
      if (currentUser.role_name === 'Teacher' && currentUser.linked_teacher_id) {
        if (resourceName === 'classes' && req.method === 'GET' && !id) {
          parsed.query.class_teacher_id = String(currentUser.linked_teacher_id);
        }
        if (resourceName === 'students' && req.method === 'GET' && !id) {
          const myClassIds = USE_POSTGRES
            ? (await dbpg.query('SELECT id FROM classes WHERE class_teacher_id=$1 AND school_id=$2', [currentUser.linked_teacher_id, schoolId])).rows.map(c => c.id)
            : db.prepare('SELECT id FROM classes WHERE class_teacher_id=?').all(currentUser.linked_teacher_id).map(c => c.id);
          if (!myClassIds.length) return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
          // A specific class_id in the query is only honored if it's actually one of theirs —
          // otherwise this falls back to listing every student across all of their classes.
          if (parsed.query.class_id && !myClassIds.includes(Number(parsed.query.class_id))) {
            return sendJSON(res, 200, { rows: [], total: 0, page: 1, pageSize: 0 });
          }
          if (!parsed.query.class_id) {
            const rows = USE_POSTGRES
              ? (await dbpg.query('SELECT * FROM students WHERE class_id = ANY($1) AND school_id=$2 ORDER BY id DESC', [myClassIds, schoolId])).rows
              : db.prepare(`SELECT * FROM students WHERE class_id IN (${myClassIds.map(() => '?').join(',')}) ORDER BY id DESC`).all(...myClassIds);
            return sendJSON(res, 200, { rows, total: rows.length, page: 1, pageSize: rows.length });
          }
        }
      }

      if (req.method === 'GET' && id) {
        const row = await resources[resourceName].get(id, schoolId);
        if (!row) return sendJSON(res, 404, { error: 'Not found' });
        // attach relations for students
        if (resourceName === 'students') {
          if (USE_POSTGRES) {
            row.parents = (await dbpg.query(`SELECT pg.* FROM parents_guardians pg JOIN student_parents sp ON sp.parent_id=pg.id WHERE sp.student_id=$1 AND sp.school_id=$2`, [id, schoolId])).rows;
            row.attendance = (await dbpg.query('SELECT * FROM attendance WHERE student_id=$1 AND school_id=$2 ORDER BY date DESC LIMIT 60', [id, schoolId])).rows;
            const caRows = (await dbpg.query('SELECT ca.*, s.name as subject_name FROM continuous_assessment ca JOIN subjects s ON s.id=ca.subject_id WHERE ca.student_id=$1 AND ca.school_id=$2 ORDER BY ca.id DESC', [id, schoolId])).rows;
            const gradingRows = (await dbpg.query('SELECT * FROM grading_system WHERE school_id=$1 ORDER BY min_score DESC', [schoolId])).rows;
            row.results = caRows.map(r => { const c = computeCA(r); const g = gradingRows.find(gr => c.final_score >= gr.min_score && c.final_score <= gr.max_score); return { ...r, ...c, grade: g ? g.grade : '-' }; });
            row.fees = (await dbpg.query(`SELECT f.*, ft.name as fee_type_name, t.name as term_name,
                COALESCE((SELECT SUM(amount_paid) FROM fee_payments WHERE fee_id=f.id AND school_id=$2), 0) as amount_paid
              FROM fees f JOIN fee_types ft ON ft.id=f.fee_type_id LEFT JOIN terms t ON t.id=f.term_id WHERE f.student_id=$1 AND f.school_id=$2`, [id, schoolId])).rows;
            if (currentUser.role_name !== 'Student') {
              const userRows = (await dbpg.query('SELECT username, status FROM users WHERE linked_student_id=$1 AND school_id=$2', [id, schoolId])).rows;
              row.login = userRows[0] ? { username: userRows[0].username, status: userRows[0].status } : null;
            }
          } else {
            row.parents = db.prepare(`SELECT pg.* FROM parents_guardians pg JOIN student_parents sp ON sp.parent_id=pg.id WHERE sp.student_id=?`).all(id);
            row.attendance = db.prepare('SELECT * FROM attendance WHERE student_id=? ORDER BY date DESC LIMIT 60').all(id);
            row.results = db.prepare('SELECT ca.*, s.name as subject_name FROM continuous_assessment ca JOIN subjects s ON s.id=ca.subject_id WHERE ca.student_id=? ORDER BY ca.id DESC').all(id)
              .map(r => { const c = computeCA(r); const g = gradeFor(c.final_score); return { ...r, ...c, grade: g ? g.grade : '-' }; });
            row.fees = db.prepare(`SELECT f.*, ft.name as fee_type_name, t.name as term_name,
                COALESCE((SELECT SUM(amount_paid) FROM fee_payments WHERE fee_id=f.id), 0) as amount_paid
              FROM fees f JOIN fee_types ft ON ft.id=f.fee_type_id LEFT JOIN terms t ON t.id=f.term_id WHERE f.student_id=?`).all(id);
            // Login info is only meaningful for staff-level roles — a student viewing their own
            // record doesn't need their own username surfaced back at them here.
            if (currentUser.role_name !== 'Student') {
              const user = db.prepare('SELECT username, status FROM users WHERE linked_student_id=?').get(id);
              row.login = user ? { username: user.username, status: user.status } : null;
            }
          }
        }
        if (resourceName === 'classes' && row.class_teacher_id) {
          const t = USE_POSTGRES
            ? (await dbpg.query('SELECT full_name FROM teachers WHERE id=$1 AND school_id=$2', [row.class_teacher_id, schoolId])).rows[0]
            : db.prepare('SELECT full_name FROM teachers WHERE id=?').get(row.class_teacher_id);
          row.class_teacher_name = t ? t.full_name : null;
        }
        return sendJSON(res, 200, row);
      }
      if (req.method === 'GET') {
        const listResult = await resources[resourceName].list(parsed.query, schoolId);
        if (currentUser.role_name === 'Arabic Head Teacher' && resourceName === 'teachers' && !id) {
          listResult.rows = listResult.rows.filter(t => t.teaching_language === 'Arabic' || t.teaching_language === 'Both');
        }
        if (resourceName === 'classes' && listResult.rows.length) {
          const teacherIds = [...new Set(listResult.rows.map(c => c.class_teacher_id).filter(Boolean))];
          if (teacherIds.length) {
            const teacherNames = {};
            const trows = USE_POSTGRES
              ? (await dbpg.query(`SELECT id, full_name FROM teachers WHERE id = ANY($1) AND school_id=$2`, [teacherIds, schoolId])).rows
              : db.prepare(`SELECT id, full_name FROM teachers WHERE id IN (${teacherIds.map(() => '?').join(',')})`).all(...teacherIds);
            trows.forEach(t => { teacherNames[t.id] = t.full_name; });
            listResult.rows.forEach(c => { c.class_teacher_name = c.class_teacher_id ? (teacherNames[c.class_teacher_id] || null) : null; });
          }
        }
        if (resourceName === 'exam_schedule') {
          // A Student only ever sees their own class's exam schedule, regardless of what
          // class_id (if any) was passed in the query string.
          if (currentUser.role_name === 'Student') {
            if (!currentUser.linked_student_id) { listResult.rows = []; }
            else {
              const student = USE_POSTGRES
                ? (await dbpg.query('SELECT class_id FROM students WHERE id=$1 AND school_id=$2', [currentUser.linked_student_id, schoolId])).rows[0]
                : db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
              listResult.rows = listResult.rows.filter(r => r.class_id === (student ? student.class_id : -1));
            }
          }
          if (USE_POSTGRES) {
            for (const r of listResult.rows) {
              const c = (await dbpg.query('SELECT name FROM classes WHERE id=$1 AND school_id=$2', [r.class_id, schoolId])).rows[0];
              const s = (await dbpg.query('SELECT name FROM subjects WHERE id=$1 AND school_id=$2', [r.subject_id, schoolId])).rows[0];
              const t = r.term_id ? (await dbpg.query('SELECT name FROM terms WHERE id=$1 AND school_id=$2', [r.term_id, schoolId])).rows[0] : null;
              r.class_name = c ? c.name : null; r.subject_name = s ? s.name : null; r.term_name = t ? t.name : null;
            }
          } else {
            listResult.rows.forEach(r => {
              const c = db.prepare('SELECT name FROM classes WHERE id=?').get(r.class_id);
              const s = db.prepare('SELECT name FROM subjects WHERE id=?').get(r.subject_id);
              const t = r.term_id ? db.prepare('SELECT name FROM terms WHERE id=?').get(r.term_id) : null;
              r.class_name = c ? c.name : null; r.subject_name = s ? s.name : null; r.term_name = t ? t.name : null;
            });
          }
        }
        if (resourceName === 'live_class_rooms') {
          // A Student only ever sees rooms for their own class; a Teacher sees only rooms they
          // themselves are hosting (their own room history), unless they're an admin.
          if (currentUser.role_name === 'Student') {
            if (!currentUser.linked_student_id) { listResult.rows = []; }
            else {
              const student = USE_POSTGRES
                ? (await dbpg.query('SELECT class_id FROM students WHERE id=$1 AND school_id=$2', [currentUser.linked_student_id, schoolId])).rows[0]
                : db.prepare('SELECT class_id FROM students WHERE id=?').get(currentUser.linked_student_id);
              listResult.rows = listResult.rows.filter(r => r.class_id === (student ? student.class_id : -1));
            }
          } else if (currentUser.role_name === 'Teacher' && currentUser.linked_teacher_id) {
            listResult.rows = listResult.rows.filter(r => r.teacher_id === currentUser.linked_teacher_id);
          }
          if (USE_POSTGRES) {
            for (const r of listResult.rows) {
              const c = (await dbpg.query('SELECT name FROM classes WHERE id=$1 AND school_id=$2', [r.class_id, schoolId])).rows[0];
              const sub = r.subject_id ? (await dbpg.query('SELECT name FROM subjects WHERE id=$1 AND school_id=$2', [r.subject_id, schoolId])).rows[0] : null;
              const t = (await dbpg.query('SELECT full_name FROM teachers WHERE id=$1 AND school_id=$2', [r.teacher_id, schoolId])).rows[0];
              r.class_name = c ? c.name : null; r.subject_name = sub ? sub.name : null; r.teacher_name = t ? t.full_name : null;
            }
          } else {
            listResult.rows.forEach(r => {
              const c = db.prepare('SELECT name FROM classes WHERE id=?').get(r.class_id);
              const sub = r.subject_id ? db.prepare('SELECT name FROM subjects WHERE id=?').get(r.subject_id) : null;
              const t = db.prepare('SELECT full_name FROM teachers WHERE id=?').get(r.teacher_id);
              r.class_name = c ? c.name : null; r.subject_name = sub ? sub.name : null; r.teacher_name = t ? t.full_name : null;
            });
          }
        }
        return sendJSON(res, 200, listResult);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const parentIds = body._parent_ids; delete body._parent_ids;
        if (body.photo_data) {
          try { body.photo = savePhotoFromDataUrl(body.photo_data, resourceName); }
          catch (e) { return sendJSON(res, 400, { error: e.message }); }
          delete body.photo_data;
        }
        if (body.attachment_data) {
          try { body.attachment = saveAttachmentFromDataUrl(body.attachment_data, body.attachment_name); }
          catch (e) { return sendJSON(res, 400, { error: e.message }); }
          delete body.attachment_data;
        }
        if (resourceName === 'class_groups' || resourceName === 'group_tasks') {
          body.created_by = currentUser.id;
        }
        // Auto-generate human-readable IDs so staff never have to invent or type them.
        // The prefix and digit-padding are configurable in Settings > ID Format.
        if (resourceName === 'students' || resourceName === 'teachers' || resourceName === 'staff') {
          const idSettings = USE_POSTGRES
            ? (await dbpg.query('SELECT student_id_prefix, staff_id_prefix, id_seq_digits FROM school_settings WHERE school_id=$1', [schoolId])).rows[0]
            : db.prepare('SELECT student_id_prefix, staff_id_prefix, id_seq_digits FROM school_settings WHERE id=1').get();
          const digits = (idSettings && idSettings.id_seq_digits) || 3;
          if (resourceName === 'students') {
            const year = (body.admission_date && new Date(body.admission_date).getFullYear()) || new Date().getFullYear();
            const newId = USE_POSTGRES
              ? await dbpg.generateSequentialId(schoolId, (idSettings && idSettings.student_id_prefix) || 'NIB', 'student', year, digits)
              : generateSequentialId((idSettings && idSettings.student_id_prefix) || 'NIB', 'student', year, digits);
            body.student_id = newId;
            body.admission_number = newId; // Admission Number mirrors the Student ID, as requested.
          } else {
            const year = (body.employment_date && new Date(body.employment_date).getFullYear()) || new Date().getFullYear();
            body.staff_id = USE_POSTGRES
              ? await dbpg.generateSequentialId(schoolId, (idSettings && idSettings.staff_id_prefix) || 'ST', 'staff', year, digits)
              : generateSequentialId((idSettings && idSettings.staff_id_prefix) || 'ST', 'staff', year, digits); // shared counter so teacher & staff IDs never collide
          }
        }
        const row = await resources[resourceName].create(body, schoolId);
        if (resourceName === 'students' && Array.isArray(parentIds)) {
          if (USE_POSTGRES) {
            for (const pid of parentIds) await dbpg.query('INSERT INTO student_parents (school_id, student_id, parent_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [schoolId, row.id, pid]);
          } else {
            const ins = db.prepare('INSERT OR IGNORE INTO student_parents (student_id, parent_id) VALUES (?,?)');
            parentIds.forEach(pid => ins.run(row.id, pid));
          }
        }
        if (USE_POSTGRES) await dbpg.logAudit(schoolId, currentUser, 'Create', resourceName, { id: row.id });
        else logAudit(currentUser, 'Create', resourceName, { id: row.id });
        return sendJSON(res, 201, row);
      }
      if (req.method === 'PUT' && id) {
        const body = await readBody(req);
        const parentIds = body._parent_ids; delete body._parent_ids;
        // Auto-generated IDs are permanent once assigned — never let an edit change them.
        delete body.student_id; delete body.admission_number; delete body.staff_id;
        if (body.photo_data) {
          const existingForPhoto = await resources[resourceName].get(id, schoolId);
          try { body.photo = savePhotoFromDataUrl(body.photo_data, resourceName); }
          catch (e) { return sendJSON(res, 400, { error: e.message }); }
          delete body.photo_data;
          if (existingForPhoto && existingForPhoto.photo) deletePhotoFile(existingForPhoto.photo);
        }
        if (body.attachment_data) {
          const existingForAttachment = await resources[resourceName].get(id, schoolId);
          try { body.attachment = saveAttachmentFromDataUrl(body.attachment_data, body.attachment_name); }
          catch (e) { return sendJSON(res, 400, { error: e.message }); }
          delete body.attachment_data;
          if (existingForAttachment && existingForAttachment.attachment) deletePhotoFile(existingForAttachment.attachment);
        }
        const row = await resources[resourceName].update(id, body, schoolId);
        if (resourceName === 'students' && Array.isArray(parentIds)) {
          if (USE_POSTGRES) {
            await dbpg.query('DELETE FROM student_parents WHERE student_id=$1 AND school_id=$2', [id, schoolId]);
            for (const pid of parentIds) await dbpg.query('INSERT INTO student_parents (school_id, student_id, parent_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [schoolId, id, pid]);
          } else {
            db.prepare('DELETE FROM student_parents WHERE student_id=?').run(id);
            const ins = db.prepare('INSERT OR IGNORE INTO student_parents (student_id, parent_id) VALUES (?,?)');
            parentIds.forEach(pid => ins.run(id, pid));
          }
        }
        if (USE_POSTGRES) await dbpg.logAudit(schoolId, currentUser, 'Update', resourceName, { id });
        else logAudit(currentUser, 'Update', resourceName, { id });
        return sendJSON(res, 200, row);
      }
      if (req.method === 'DELETE' && id) {
        await resources[resourceName].delete(id, schoolId);
        if (USE_POSTGRES) await dbpg.logAudit(schoolId, currentUser, 'Delete', resourceName, { id });
        else logAudit(currentUser, 'Delete', resourceName, { id });
        return sendJSON(res, 200, { deleted: true });
      }
    }

    // ---- Attendance ----
    // ---- Canteen: daily paid/not-paid tracking, same shape as Attendance ----
    if (pathname === '/api/canteen-config' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM canteen_config WHERE id=1').get());
    }
    if (pathname === '/api/canteen-config' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'canteen');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { daily_amount, weekdays }
      const cols = ['daily_amount', 'weekdays'].filter(c => body[c] !== undefined);
      if (cols.length) db.prepare(`UPDATE canteen_config SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=1`).run(...cols.map(c => body[c]));
      return sendJSON(res, 200, db.prepare('SELECT * FROM canteen_config WHERE id=1').get());
    }
    if (pathname === '/api/canteen-payments/bulk' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'canteen');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { date, class_id, records: [{student_id, status, amount}] }
      // A Canteen Collector may only ever mark payments for the one class they're assigned to —
      // ignore whatever class_id was sent and force it to their real assignment.
      let classId = body.class_id;
      if (currentUser.role_name === 'Canteen Collector') {
        if (!currentUser.assigned_class_id) return sendJSON(res, 403, { error: 'Your account is not assigned to a class yet.' });
        classId = currentUser.assigned_class_id;
      }
      const stmt = db.prepare(`INSERT INTO canteen_payments (student_id, class_id, date, status, amount, marked_by)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(student_id, date) DO UPDATE SET status=excluded.status, amount=excluded.amount, class_id=excluded.class_id, marked_by=excluded.marked_by`);
      let markedCount = 0;
      for (const r of (body.records || [])) {
        // Belt-and-braces: also verify each student actually belongs to the collector's class,
        // not just trust the class_id override above.
        if (currentUser.role_name === 'Canteen Collector') {
          const student = db.prepare('SELECT class_id FROM students WHERE id=?').get(r.student_id);
          if (!student || student.class_id !== classId) continue;
        }
        stmt.run(r.student_id, classId, body.date, r.status, r.amount != null ? r.amount : null, currentUser.id);
        markedCount++;
      }
      logAudit(currentUser, 'Mark canteen payments', 'canteen', { date: body.date, class_id: classId, count: markedCount });
      return sendJSON(res, 200, { ok: true, count: markedCount });
    }
    if (pathname === '/api/canteen-payments' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'canteen');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      let { date, class_id, student_id, from, to } = parsed.query;
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, []);
        student_id = String(currentUser.linked_student_id); // force-scope: a student only ever sees their own canteen history
      }
      if (currentUser.role_name === 'Canteen Collector') {
        if (!currentUser.assigned_class_id) return sendJSON(res, 200, []);
        class_id = String(currentUser.assigned_class_id); // force-scope: a collector only ever sees their own assigned class
      }
      let sql = `SELECT cp.*, s.first_name, s.last_name, s.student_id as sid FROM canteen_payments cp JOIN students s ON s.id=cp.student_id WHERE 1=1`;
      const params = [];
      if (date) { sql += ' AND cp.date=?'; params.push(date); }
      if (class_id) { sql += ' AND cp.class_id=?'; params.push(class_id); }
      if (student_id) { sql += ' AND cp.student_id=?'; params.push(student_id); }
      if (from) { sql += ' AND cp.date>=?'; params.push(from); }
      if (to) { sql += ' AND cp.date<=?'; params.push(to); }
      sql += ' ORDER BY cp.date DESC';
      return sendJSON(res, 200, db.prepare(sql).all(...params));
    }

    if (pathname === '/api/attendance/bulk' && req.method === 'POST') {
      const schoolIdAtt = USE_POSTGRES ? currentUser.school_id : null;
      const perms = USE_POSTGRES
        ? await getPermissionsPg(schoolIdAtt, currentUser.role_id, 'attendance')
        : getPermissions(currentUser.role_id, 'attendance');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { date, class_id, records: [{student_id, status, remarks}] }
      if (USE_POSTGRES) {
        for (const r of (body.records || [])) {
          await dbpg.query(
            `INSERT INTO attendance (school_id, student_id, class_id, date, status, remarks, marked_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (student_id, date) DO UPDATE SET status=excluded.status, remarks=excluded.remarks, class_id=excluded.class_id, marked_by=excluded.marked_by`,
            [schoolIdAtt, r.student_id, body.class_id, body.date, r.status, r.remarks || null, currentUser.id]
          );
        }
        await dbpg.logAudit(schoolIdAtt, currentUser, 'Mark attendance', 'attendance', { date: body.date, class_id: body.class_id, count: (body.records || []).length });
      } else {
        const stmt = db.prepare(`INSERT INTO attendance (student_id, class_id, date, status, remarks, marked_by)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(student_id, date) DO UPDATE SET status=excluded.status, remarks=excluded.remarks, class_id=excluded.class_id, marked_by=excluded.marked_by`);
        for (const r of (body.records || [])) stmt.run(r.student_id, body.class_id, body.date, r.status, r.remarks || null, currentUser.id);
        logAudit(currentUser, 'Mark attendance', 'attendance', { date: body.date, class_id: body.class_id, count: (body.records || []).length });
      }
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname === '/api/attendance' && req.method === 'GET') {
      const schoolIdAtt = USE_POSTGRES ? currentUser.school_id : null;
      const perms = USE_POSTGRES
        ? await getPermissionsPg(schoolIdAtt, currentUser.role_id, 'attendance')
        : getPermissions(currentUser.role_id, 'attendance');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      let { date, class_id, student_id } = parsed.query;
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, []);
        student_id = String(currentUser.linked_student_id); // force-scope: a student only ever sees their own attendance
      }
      if (USE_POSTGRES) {
        let sql = `SELECT a.*, s.first_name, s.last_name, s.student_id as sid FROM attendance a JOIN students s ON s.id=a.student_id WHERE a.school_id=$1`;
        const params = [schoolIdAtt];
        if (date) { params.push(date); sql += ` AND a.date=$${params.length}`; }
        if (class_id) { params.push(class_id); sql += ` AND a.class_id=$${params.length}`; }
        if (student_id) { params.push(student_id); sql += ` AND a.student_id=$${params.length}`; }
        sql += ' ORDER BY a.date DESC';
        return sendJSON(res, 200, (await dbpg.query(sql, params)).rows);
      }
      let sql = `SELECT a.*, s.first_name, s.last_name, s.student_id as sid FROM attendance a JOIN students s ON s.id=a.student_id WHERE 1=1`;
      const params = [];
      if (date) { sql += ' AND a.date=?'; params.push(date); }
      if (class_id) { sql += ' AND a.class_id=?'; params.push(class_id); }
      if (student_id) { sql += ' AND a.student_id=?'; params.push(student_id); }
      sql += ' ORDER BY a.date DESC';
      return sendJSON(res, 200, db.prepare(sql).all(...params));
    }

    // ---- Continuous Assessment (Class Exercise/Test/Group/Project /15 each -> 50%, Exam /100 -> 50%) ----
    // A downloadable spreadsheet-friendly template for entering Continuous Assessment scores —
    // this is the practical shape "link to a Google Sheet" takes for a genuinely offline
    // system: no live internet connection to Google is possible here, but the same real
    // workflow works fine — download this, open it in Excel or upload it to Google Sheets
    // yourself if you want to enter it there or share it with others, then export/save as CSV
    // and upload it back below. Pre-fills any scores already entered, so re-downloading to
    // make a correction doesn't mean starting from a blank sheet.
    if (pathname === '/api/continuous-assessment/template' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id, subject_id, term_id } = parsed.query;
      if (!class_id || !subject_id || !term_id) return sendJSON(res, 400, { error: 'class_id, subject_id, and term_id are required.' });
      const cls = db.prepare('SELECT * FROM classes WHERE id=?').get(class_id);
      if (!cls) return sendJSON(res, 404, { error: 'That class no longer exists.' });
      const students = db.prepare('SELECT * FROM students WHERE class_id=? ORDER BY first_name, last_name').all(class_id);
      const existing = db.prepare('SELECT * FROM continuous_assessment WHERE subject_id=? AND term_id=?').all(subject_id, term_id);
      const findExisting = sid => existing.find(e => e.student_id === sid);
      const csvRow = cells => cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
      const lines = [csvRow(['Student ID', 'Name', 'Class Exercise', 'Class Test', 'Group Work', 'Project Work', 'Exam Score', 'Comment'])];
      for (const s of students) {
        const ex = findExisting(s.id);
        lines.push(csvRow([s.student_id, `${s.first_name} ${s.last_name}`, ex?.class_exercise ?? '', ex?.class_test ?? '', ex?.group_work ?? '', ex?.project_work ?? '', ex?.exam_score ?? '', ex?.teacher_comment ?? '']));
      }
      const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${cls.name.replace(/[^a-z0-9]/gi, '_')}_CA_template.csv"` });
      return res.end(csv);
    }
    if (pathname === '/api/continuous-assessment/import' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id, subject_id, term_id, csv_text }
      const { class_id, subject_id, term_id, csv_text } = body;
      if (!class_id || !subject_id || !term_id || !csv_text) return sendJSON(res, 400, { error: 'class_id, subject_id, term_id, and csv_text are required.' });
      if (currentUser.role_name === 'Teacher') {
        if (!currentUser.linked_teacher_id) return sendJSON(res, 403, { error: 'Your account is not linked to a teacher record.' });
        const isMyClass = db.prepare('SELECT 1 FROM classes WHERE id=? AND class_teacher_id=?').get(class_id, currentUser.linked_teacher_id);
        if (!isMyClass) return sendJSON(res, 403, { error: 'You can only import results for a class you are the class teacher for.' });
      }
      const lines = csv_text.split(/\r\n|\r|\n/).filter(l => l.trim());
      if (!lines.length) return sendJSON(res, 400, { error: 'That file appears to be empty.' });
      const headerCells = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
      const findCol = (...names) => headerCells.findIndex(h => names.some(n => h === n || h.includes(n)));
      const idxStudentId = findCol('student id');
      const idxCE = findCol('class exercise'), idxCT = findCol('class test'), idxGW = findCol('group work'), idxPW = findCol('project work'), idxExam = findCol('exam score', 'exam');
      const idxComment = findCol('comment');
      if (idxStudentId === -1) return sendJSON(res, 400, { error: `Could not find a "Student ID" column. Found: "${headerCells.join('", "')}". Download the template for the exact format.` });
      const stmt = db.prepare(`INSERT INTO continuous_assessment
        (student_id, subject_id, class_id, term_id, class_exercise, class_test, group_work, project_work, exam_score, teacher_comment, entered_by, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
        ON CONFLICT(student_id, subject_id, term_id) DO UPDATE SET
          class_exercise=excluded.class_exercise, class_test=excluded.class_test, group_work=excluded.group_work,
          project_work=excluded.project_work, exam_score=excluded.exam_score, teacher_comment=excluded.teacher_comment,
          updated_at=datetime('now')`);
      let updated = 0, skipped = 0;
      const issues = [];
      lines.slice(1).forEach((line, i) => {
        const cells = parseCsvLine(line);
        const studentIdCell = (cells[idxStudentId] || '').trim();
        const student = studentIdCell ? db.prepare('SELECT id FROM students WHERE student_id=?').get(studentIdCell) : null;
        if (!student) { skipped++; issues.push({ row: i + 2, reason: `Student ID "${studentIdCell}" was not found.` }); return; }
        const num = idx => idx > -1 && cells[idx] !== '' ? Number(cells[idx]) || 0 : 0;
        stmt.run(student.id, subject_id, class_id, term_id, num(idxCE), num(idxCT), num(idxGW), num(idxPW), num(idxExam), idxComment > -1 ? (cells[idxComment] || null) : null, currentUser.id);
        updated++;
      });
      logAudit(currentUser, 'Import Continuous Assessment CSV', 'results', { class_id, subject_id, term_id, updated, skipped });
      return sendJSON(res, 200, { updated, skipped, issues });
    }

    if (pathname === '/api/continuous-assessment/bulk' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { subject_id, class_id, academic_year_id, term_id, records:[{student_id, class_exercise, class_test, group_work, project_work, exam_score, teacher_comment}] }
      if (!body.subject_id || !body.term_id) return sendJSON(res, 400, { error: 'Subject and term are required' });
      // A Teacher can only enter results for a class they're actually assigned as class teacher
      // for — never any class in the school, even though the 'results' permission itself is
      // granted broadly (the module-level flag says Teachers may use Results AT ALL, not that
      // every class's data is theirs to touch).
      if (currentUser.role_name === 'Teacher') {
        if (!currentUser.linked_teacher_id) return sendJSON(res, 403, { error: 'Your account is not linked to a teacher record — ask an admin to fix this under Users & Roles.' });
        const isMyClass = body.class_id && db.prepare('SELECT 1 FROM classes WHERE id=? AND class_teacher_id=?').get(body.class_id, currentUser.linked_teacher_id);
        if (!isMyClass) return sendJSON(res, 403, { error: 'You can only enter results for a class you are assigned as class teacher for.' });
      }
      const cfg = getCAConfig();
      const stmt = db.prepare(`INSERT INTO continuous_assessment
        (student_id, subject_id, class_id, academic_year_id, term_id, class_exercise, class_test, group_work, project_work, exam_score, teacher_comment, entered_by, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
        ON CONFLICT(student_id, subject_id, term_id) DO UPDATE SET
          class_exercise=excluded.class_exercise, class_test=excluded.class_test, group_work=excluded.group_work,
          project_work=excluded.project_work, exam_score=excluded.exam_score, teacher_comment=excluded.teacher_comment,
          entered_by=excluded.entered_by, class_id=excluded.class_id, academic_year_id=excluded.academic_year_id,
          updated_at=datetime('now')`);
      let count = 0;
      for (const r of (body.records || [])) {
        if (!r.student_id) continue;
        stmt.run(
          r.student_id, body.subject_id, body.class_id || null, body.academic_year_id || null, body.term_id,
          clampCA(r.class_exercise, cfg.c1.max), clampCA(r.class_test, cfg.c2.max),
          clampCA(r.group_work, cfg.c3.max), clampCA(r.project_work, cfg.c4.max),
          clampCA(r.exam_score, cfg.examMax), r.teacher_comment || null, currentUser.id
        );
        count++;
      }
      logAudit(currentUser, 'Enter continuous assessment', 'results', { subject_id: body.subject_id, class_id: body.class_id, term_id: body.term_id, count });
      return sendJSON(res, 200, { ok: true, count });
    }

    if (pathname === '/api/continuous-assessment' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id, subject_id, term_id, student_id } = parsed.query;
      let sql = `SELECT ca.*, s.first_name, s.last_name, s.student_id as sid FROM continuous_assessment ca JOIN students s ON s.id = ca.student_id WHERE 1=1`;
      const params = [];
      if (class_id) { sql += ' AND ca.class_id=?'; params.push(class_id); }
      if (subject_id) { sql += ' AND ca.subject_id=?'; params.push(subject_id); }
      if (term_id) { sql += ' AND ca.term_id=?'; params.push(term_id); }
      if (student_id) { sql += ' AND ca.student_id=?'; params.push(student_id); }
      const rows = db.prepare(sql).all(...params).map(r => ({ ...r, ...computeCA(r) }));
      return sendJSON(res, 200, rows);
    }

    // ---- Arabic Terminal Report (Islamic/Arabic curriculum subjects — Qur'an, Tajweed, Fiqh,
    // Nahw/Sarf, etc.) Score entry is restricted to teachers marked as teaching in Arabic (or
    // Both), plus Admin-level roles — an English-only teacher shouldn't be entering these.
    function canEnterArabicScores(user) {
      if (user.role_name !== 'Teacher') return true; // Admin/Headteacher etc. covered by the normal 'results' permission check already
      if (!user.linked_teacher_id) return false; // an unlinked Teacher account has no way to prove which subjects they teach
      const teacherRow = db.prepare('SELECT teaching_language FROM teachers WHERE id=?').get(user.linked_teacher_id);
      const lang = teacherRow ? teacherRow.teaching_language : null;
      return lang === 'Arabic' || lang === 'Both';
    }
    if (pathname === '/api/arabic-results/bulk' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      if (!canEnterArabicScores(currentUser)) return sendJSON(res, 403, { error: 'Only teachers marked as teaching in Arabic can enter Arabic Terminal Report scores.' });
      const body = await readBody(req); // { term_id, academic_year_id, records: [{student_id, arabic_subject_id, score_obtained, remarks}] }
      if (!body.term_id) return sendJSON(res, 400, { error: 'Term is required.' });
      const stmt = db.prepare(`INSERT INTO arabic_results (student_id, arabic_subject_id, term_id, academic_year_id, score_obtained, remarks, entered_by)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(student_id, arabic_subject_id, term_id) DO UPDATE SET score_obtained=excluded.score_obtained, remarks=excluded.remarks, entered_by=excluded.entered_by, academic_year_id=excluded.academic_year_id`);
      let count = 0;
      for (const r of (body.records || [])) {
        if (!r.student_id || !r.arabic_subject_id) continue;
        stmt.run(r.student_id, r.arabic_subject_id, body.term_id, body.academic_year_id || null, r.score_obtained != null ? Number(r.score_obtained) : null, r.remarks || null, currentUser.id);
        count++;
      }
      logAudit(currentUser, 'Enter Arabic Terminal Report scores', 'results', { term_id: body.term_id, count });
      return sendJSON(res, 200, { ok: true, count });
    }
    if (pathname === '/api/arabic-results' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      let { student_id, term_id, class_id } = parsed.query;
      if (currentUser.role_name === 'Student') {
        if (!currentUser.linked_student_id) return sendJSON(res, 200, []);
        student_id = String(currentUser.linked_student_id); // a student only ever sees their own Arabic results
      }
      let sql = `SELECT ar.* FROM arabic_results ar WHERE 1=1`;
      const params = [];
      if (student_id) { sql += ' AND ar.student_id=?'; params.push(student_id); }
      if (term_id) { sql += ' AND ar.term_id=?'; params.push(term_id); }
      if (class_id) { sql += ' AND ar.student_id IN (SELECT id FROM students WHERE class_id=?)'; params.push(class_id); }
      return sendJSON(res, 200, db.prepare(sql).all(...params));
    }
    // Class position: every student's total Arabic score for the term, ranked — used to show
    // "position X out of Y" on the printed report. Ties share the same rank (standard competition
    // ranking: 1,1,3 rather than 1,1,2), which is the fairer, more expected convention for this.
    if (pathname === '/api/arabic-class-ranking' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id, term_id } = parsed.query;
      if (!class_id || !term_id) return sendJSON(res, 400, { error: 'class_id and term_id are required.' });
      const students = db.prepare('SELECT id FROM students WHERE class_id=?').all(class_id);
      const totals = students.map(s => {
        const rows = db.prepare('SELECT SUM(score_obtained) total FROM arabic_results WHERE student_id=? AND term_id=? AND score_obtained IS NOT NULL').get(s.id, term_id);
        return { student_id: s.id, total: rows.total || 0 };
      }).sort((a, b) => b.total - a.total);
      let rank = 0, lastTotal = null, seen = 0;
      const ranked = totals.map(t => {
        seen++;
        if (t.total !== lastTotal) { rank = seen; lastTotal = t.total; }
        return { ...t, rank };
      });
      return sendJSON(res, 200, { total_students: students.length, ranking: ranked });
    }

    // ---- Class Termly Report: a narrative report the class teacher writes about their own
    // class for a term. Writing is restricted to that class's assigned teacher (matched via
    // linked_teacher_id, the same reliable link used for the Arabic permission check) or an
    // admin-level role — not just anyone with 'results' access.
    function isClassTeacherOrAdmin(user, classId) {
      if (user.role_name !== 'Teacher') return true; // Admin/Headteacher etc. covered by the normal 'results' permission check already
      if (!user.linked_teacher_id) return false;
      const cls = db.prepare('SELECT class_teacher_id FROM classes WHERE id=?').get(classId);
      return !!cls && cls.class_teacher_id === user.linked_teacher_id;
    }
    if (pathname === '/api/class-termly-report' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id, term_id } = parsed.query;
      if (!class_id || !term_id) return sendJSON(res, 400, { error: 'class_id and term_id are required.' });
      const row = db.prepare('SELECT * FROM class_termly_reports WHERE class_id=? AND term_id=?').get(class_id, term_id);
      return sendJSON(res, 200, row || null);
    }
    if (pathname === '/api/class-termly-report' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id, term_id, academic_year_id, report_text }
      if (!body.class_id || !body.term_id) return sendJSON(res, 400, { error: 'class_id and term_id are required.' });
      if (!isClassTeacherOrAdmin(currentUser, body.class_id)) {
        return sendJSON(res, 403, { error: 'Only this class\'s own teacher (or an admin) can write its termly report.' });
      }
      const existing = db.prepare('SELECT id FROM class_termly_reports WHERE class_id=? AND term_id=?').get(body.class_id, body.term_id);
      if (existing) {
        db.prepare(`UPDATE class_termly_reports SET report_text=?, academic_year_id=?, written_by=?, updated_at=datetime('now') WHERE id=?`)
          .run(body.report_text || null, body.academic_year_id || null, currentUser.id, existing.id);
      } else {
        db.prepare(`INSERT INTO class_termly_reports (class_id, term_id, academic_year_id, report_text, written_by) VALUES (?,?,?,?,?)`)
          .run(body.class_id, body.term_id, body.academic_year_id || null, body.report_text || null, currentUser.id);
      }
      logAudit(currentUser, 'Write class termly report', 'results', { classId: body.class_id, termId: body.term_id });
      return sendJSON(res, 200, { ok: true });
    }

// Shared authorization check for anything student-specific (report cards, etc.): a Student may
// only ever access their own record, and a Parent/Guardian only their own linked ward(s) —
// checked the same way regardless of which specific endpoint is asking, so this can't drift
// out of sync between the JSON/Word/PDF versions of the same report card.
function isAuthorizedForStudent(currentUser, studentId) {
  if (currentUser.role_name === 'Student') return currentUser.linked_student_id === studentId;
  if (currentUser.role_name === 'Parent/Guardian') {
    if (!currentUser.linked_parent_id) return false;
    const link = db.prepare('SELECT 1 FROM student_parents WHERE parent_id=? AND student_id=?').get(currentUser.linked_parent_id, studentId);
    return !!link;
  }
  return true; // staff/admin roles rely on their module permission check elsewhere, not this
}

function computeReportCardData(student, term_id) {
      const caRows = db.prepare(`SELECT ca.*, sub.name as subject_name FROM continuous_assessment ca JOIN subjects sub ON sub.id=ca.subject_id WHERE ca.student_id=? AND ca.term_id=?`).all(student.id, term_id);
      const results = caRows.map(r => {
        const computed = computeCA(r);
        const g = gradeFor(computed.final_score);
        return {
          subject_name: r.subject_name,
          class_exercise: computed.class_exercise, class_test: computed.class_test,
          group_work: computed.group_work, project_work: computed.project_work,
          ca_total: Math.round(computed.ca_total * 100) / 100,
          ca_scaled: Math.round(computed.ca_scaled * 100) / 100,
          exam_score: computed.exam_score,
          exam_scaled: Math.round(computed.exam_scaled * 100) / 100,
          final_score: Math.round(computed.final_score * 100) / 100,
          grade: g ? g.grade : '-', grade_description: g ? g.description : '',
          teacher_comment: r.teacher_comment,
        };
      });
      const average = results.length ? Math.round(results.reduce((s, r) => s + r.final_score, 0) / results.length) : 0;
      const overallGrade = results.length ? gradeFor(average) : null;

      // Class rank: compare this student's average final score against classmates with any CA data this term.
      let classRank = null, classSize = null;
      if (student.class_id) {
        const classmates = db.prepare('SELECT id FROM students WHERE class_id=? AND status=?').all(student.class_id, 'Active');
        const averages = classmates.map(c => {
          const rows = db.prepare('SELECT * FROM continuous_assessment WHERE student_id=? AND term_id=?').all(c.id, term_id);
          if (!rows.length) return null;
          const avg = rows.reduce((s, r) => s + computeCA(r).final_score, 0) / rows.length;
          return { id: c.id, avg };
        }).filter(Boolean);
        averages.sort((a, b) => b.avg - a.avg);
        classSize = averages.length;
        const idx = averages.findIndex(a => a.id === student.id);
        // Standard competition ranking: tied averages share the same position (1st, 1st, 3rd).
        if (idx === -1) {
          classRank = null;
        } else {
          let tiedStart = idx;
          while (tiedStart > 0 && averages[tiedStart - 1].avg === averages[idx].avg) tiedStart--;
          classRank = tiedStart + 1;
        }
      }

      // Attendance summary for the term's date range.
      const term = db.prepare('SELECT * FROM terms WHERE id=?').get(term_id);
      const academicYear = term ? db.prepare('SELECT * FROM academic_years WHERE id=?').get(term.academic_year_id) : null;
      let attendanceSummary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      if (term && term.start_date && term.end_date) {
        const rows = db.prepare('SELECT status, COUNT(*) c FROM attendance WHERE student_id=? AND date BETWEEN ? AND ? GROUP BY status').all(student.id, term.start_date, term.end_date);
        rows.forEach(r => { attendanceSummary[r.status.toLowerCase()] = r.c; attendanceSummary.total += r.c; });
      }
      const studentClass = student.class_id ? db.prepare('SELECT * FROM classes WHERE id=?').get(student.class_id) : null;
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();

      return {
        student, results, average, overall_grade: overallGrade ? overallGrade.grade : '-',
        overall_grade_description: overallGrade ? overallGrade.description : '',
        class_rank: classRank, class_size: classSize,
        attendance: attendanceSummary,
        term: term ? term.name : '', academic_year: academicYear ? academicYear.name : '',
        class_name: studentClass ? studentClass.name : '', school: settings,
        pass_mark: term ? term.pass_mark : null,
        overall_result: (term && term.pass_mark != null && results.length) ? (average >= term.pass_mark ? 'Pass' : 'Fail') : null,
      };
}

    if (pathname === '/api/report-card' && req.method === 'GET') {
      const { student_id, term_id } = parsed.query;
      const student = /^\d+$/.test(String(student_id))
        ? db.prepare('SELECT * FROM students WHERE id=?').get(student_id)
        : db.prepare('SELECT * FROM students WHERE student_id=?').get(student_id);
      if (!student) return sendJSON(res, 404, { error: 'Student not found. Check the Student ID (e.g. NIB/2026/001).' });
      // A logged-in Student may only ever see their OWN report card, and a Parent only their
      // own ward's — never another family's child, no matter what id is passed in the query.
      if (!isAuthorizedForStudent(currentUser, student.id)) {
        return sendJSON(res, 403, { error: 'You can only view your own report card.' });
      }
      return sendJSON(res, 200, computeReportCardData(student, term_id));
    }

    // Same data as /api/report-card above, delivered as a Word-compatible .rtf download instead
    // of JSON — reuses the exact same computation so the two are never at risk of disagreeing.
    if (pathname === '/api/report-card/export-word' && req.method === 'GET') {
      const { student_id, term_id } = parsed.query;
      const student = /^\d+$/.test(String(student_id))
        ? db.prepare('SELECT * FROM students WHERE id=?').get(student_id)
        : db.prepare('SELECT * FROM students WHERE student_id=?').get(student_id);
      if (!student) return sendJSON(res, 404, { error: 'Student not found.' });
      if (!isAuthorizedForStudent(currentUser, student.id)) {
        return sendJSON(res, 403, { error: 'You can only download your own report card.' });
      }
      const rc = computeReportCardData(student, term_id);
      const grading = db.prepare('SELECT * FROM grading_system ORDER BY min_score DESC').all();
      const rtf = generateReportCardRtf(rc, grading);
      const filename = `Report_Card_${student.student_id.replace(/[^a-z0-9]/gi, '_')}.rtf`;
      res.writeHead(200, { 'Content-Type': 'application/rtf', 'Content-Disposition': `attachment; filename="${filename}"` });
      return res.end(rtf);
    }

    if (pathname === '/api/report-card/export-pdf' && req.method === 'GET') {
      const { student_id, term_id } = parsed.query;
      const student = /^\d+$/.test(String(student_id))
        ? db.prepare('SELECT * FROM students WHERE id=?').get(student_id)
        : db.prepare('SELECT * FROM students WHERE student_id=?').get(student_id);
      if (!student) return sendJSON(res, 404, { error: 'Student not found.' });
      if (!isAuthorizedForStudent(currentUser, student.id)) {
        return sendJSON(res, 403, { error: 'You can only download your own report card.' });
      }
      const rc = computeReportCardData(student, term_id);
      const pdfBuffer = generateReportCardPdf(rc);
      const filename = `Report_Card_${student.student_id.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': pdfBuffer.length });
      return res.end(pdfBuffer);
    }

    // ---- School / class performance report: every student ranked by average final score ----
    if (pathname === '/api/performance-report' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      if (currentUser.role_name === 'Student') return sendJSON(res, 403, { error: 'This class-wide ranking is not available to student accounts — see your own Report Card instead.' });
      const { term_id, class_id } = parsed.query;
      if (!term_id) return sendJSON(res, 400, { error: 'A term is required.' });
      let students = db.prepare("SELECT * FROM students WHERE status='Active'" + (class_id ? ' AND class_id=?' : '')).all(...(class_id ? [class_id] : []));
      const classesById = {}; db.prepare('SELECT * FROM classes').all().forEach(c => classesById[c.id] = c.name);
      const cfg = getCAConfig();
      const rows = students.map(s => {
        const caRows = db.prepare('SELECT * FROM continuous_assessment WHERE student_id=? AND term_id=?').all(s.id, term_id);
        if (!caRows.length) return null;
        const avg = caRows.reduce((sum, r) => sum + computeCA(r, cfg).final_score, 0) / caRows.length;
        return {
          student_id: s.student_id, name: `${s.first_name} ${s.last_name}`, class_name: classesById[s.class_id] || '—',
          subjects_count: caRows.length, average: Math.round(avg),
        };
      }).filter(Boolean);
      rows.sort((a, b) => b.average - a.average);
      // Standard competition ranking: students with the exact same average share the same
      // position, and the next distinct score picks up at the count so far (1st, 1st, 3rd —
      // not 1st, 2nd, 3rd, which would misleadingly treat a tie as one student outperforming another).
      rows.forEach((r, i) => {
        r.position = (i > 0 && rows[i - 1].average === r.average) ? rows[i - 1].position : i + 1;
        r.grade = (gradeFor(r.average) || {}).grade || '-';
      });
      const term = db.prepare('SELECT * FROM terms WHERE id=?').get(term_id);
      const academicYear = term ? db.prepare('SELECT * FROM academic_years WHERE id=?').get(term.academic_year_id) : null;
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, {
        rows, term: term ? term.name : '', academic_year: academicYear ? academicYear.name : '',
        class_name: class_id ? (classesById[class_id] || '') : 'All Classes', school: settings,
      });
    }

    // One student's average score across every term in an academic year — for the "Student
    // Analysis" term-over-term comparison chart on the Performance Report page.
    if (pathname === '/api/performance-report/student-trend' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'results');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { student_id, academic_year_id } = parsed.query;
      const student = /^\d+$/.test(String(student_id))
        ? db.prepare('SELECT * FROM students WHERE id=?').get(student_id)
        : db.prepare('SELECT * FROM students WHERE student_id=?').get(student_id);
      if (!student) return sendJSON(res, 404, { error: 'Student not found. Check the Student ID (e.g. NIB/2026/001).' });
      if (currentUser.role_name === 'Student' && (!currentUser.linked_student_id || currentUser.linked_student_id !== student.id)) {
        return sendJSON(res, 403, { error: 'You can only view your own performance trend.' });
      }
      const yearId = academic_year_id || (db.prepare('SELECT current_academic_year_id FROM school_settings WHERE id=1').get() || {}).current_academic_year_id;
      const terms = db.prepare('SELECT * FROM terms WHERE academic_year_id=? ORDER BY id ASC').all(yearId);
      const cfg = getCAConfig();
      const points = terms.map(term => {
        const caRows = db.prepare('SELECT * FROM continuous_assessment WHERE student_id=? AND term_id=?').all(student.id, term.id);
        const average = caRows.length ? Math.round(caRows.reduce((s, r) => s + computeCA(r, cfg).final_score, 0) / caRows.length) : null;
        return { term_id: term.id, term_name: term.name, average, subjects_count: caRows.length };
      });
      return sendJSON(res, 200, { student: { name: `${student.first_name} ${student.last_name}`, student_id: student.student_id }, points });
    }

    // ---- Parent/Guardian contact list (with linked students) — for the printable contact sheet ----
    if (pathname === '/api/parent-contacts' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'parents');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { pta_member } = parsed.query;
      let sql = 'SELECT * FROM parents_guardians WHERE 1=1';
      const params = [];
      if (pta_member !== undefined && pta_member !== '') { sql += ' AND pta_member=?'; params.push(pta_member); }
      sql += ' ORDER BY full_name ASC';
      const parents = db.prepare(sql).all(...params);
      const linkStmt = db.prepare(`SELECT s.student_id, s.first_name, s.last_name FROM students s JOIN student_parents sp ON sp.student_id=s.id WHERE sp.parent_id=?`);
      const rows = parents.map(p => ({ ...p, students: linkStmt.all(p.id) }));
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, { rows, school: settings });
    }

    // ---- New Admissions report: students admitted within a term's date range ----
    if (pathname === '/api/admissions-report' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'students');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { term_id, date, month, year } = parsed.query; // exactly one of these filter modes is expected
      const classesById = {}; db.prepare('SELECT * FROM classes').all().forEach(c => classesById[c.id] = c.name);
      let rows = [], label = '';
      if (term_id) {
        const term = db.prepare('SELECT * FROM terms WHERE id=?').get(term_id);
        if (!term) return sendJSON(res, 404, { error: 'Term not found' });
        if (term.start_date && term.end_date) {
          rows = db.prepare('SELECT * FROM students WHERE admission_date BETWEEN ? AND ? ORDER BY admission_date ASC').all(term.start_date, term.end_date);
        } else {
          rows = db.prepare('SELECT * FROM students WHERE academic_year_id=? ORDER BY admission_date ASC').all(term.academic_year_id);
        }
        const academicYear = db.prepare('SELECT * FROM academic_years WHERE id=?').get(term.academic_year_id);
        label = `${academicYear ? academicYear.name : ''} ${term.name}`.trim();
      } else if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJSON(res, 400, { error: 'Invalid date.' });
        rows = db.prepare('SELECT * FROM students WHERE admission_date = ? ORDER BY admission_date ASC').all(date);
        label = `Date: ${date}`;
      } else if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) return sendJSON(res, 400, { error: 'Invalid month.' });
        rows = db.prepare("SELECT * FROM students WHERE strftime('%Y-%m', admission_date) = ? ORDER BY admission_date ASC").all(month);
        const [y, m] = month.split('-');
        label = `${['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m) - 1]} ${y}`;
      } else if (year) {
        if (!/^\d{4}$/.test(year)) return sendJSON(res, 400, { error: 'Invalid year.' });
        rows = db.prepare("SELECT * FROM students WHERE strftime('%Y', admission_date) = ? ORDER BY admission_date ASC").all(year);
        label = `Year: ${year}`;
      } else {
        return sendJSON(res, 400, { error: 'Choose a term, date, month, or year to filter by.' });
      }
      rows = rows.map(s => ({ ...s, class_name: classesById[s.class_id] || '—' }));
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, { rows, term: label, academic_year: '', school: settings });
    }

    // Totals grouped by fee category (Academic, Transport, Feeding, etc.) — how much has been
    // billed vs. actually collected per category, giving a category-level view alongside the
    // existing per-student report below.
    if (pathname === '/api/fees-by-category' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare(`
        SELECT COALESCE(ft.category, 'General') as category,
          COALESCE(SUM(f.amount_due), 0) as billed,
          COALESCE((SELECT SUM(fp.amount_paid) FROM fee_payments fp WHERE fp.fee_id IN (SELECT id FROM fees f2 WHERE f2.fee_type_id = ft.id)), 0) as collected
        FROM fee_types ft LEFT JOIN fees f ON f.fee_type_id = ft.id
        GROUP BY ft.id ORDER BY billed DESC`).all();
      return sendJSON(res, 200, rows);
    }
    // ---- Fees report: who has paid, partially paid, or not paid, with running balances ----
    if (pathname === '/api/fees-report' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      if (currentUser.role_name === 'Student') return sendJSON(res, 403, { error: 'This report is not available to student accounts.' });
      const { term_id, class_id, status } = parsed.query; // status: paid | partial | unpaid | all
      let sql = `SELECT f.*, s.student_id as sid, s.first_name, s.last_name, s.class_id, ft.name as fee_type_name
                 FROM fees f JOIN students s ON s.id=f.student_id JOIN fee_types ft ON ft.id=f.fee_type_id WHERE 1=1`;
      const params = [];
      if (term_id) { sql += ' AND f.term_id=?'; params.push(term_id); }
      if (class_id) { sql += ' AND s.class_id=?'; params.push(class_id); }
      const feeRows = db.prepare(sql).all(...params);
      const paidStmt = db.prepare('SELECT COALESCE(SUM(amount_paid),0) t FROM fee_payments WHERE fee_id=?');
      let rows = feeRows.map(f => {
        const paid = paidStmt.get(f.id).t;
        const balance = f.amount_due - paid;
        const payStatus = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
        return { ...f, amount_paid: paid, balance, pay_status: payStatus };
      });
      if (status && status !== 'all') rows = rows.filter(r => r.pay_status === status);
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      const term = term_id ? db.prepare('SELECT * FROM terms WHERE id=?').get(term_id) : null;
      return sendJSON(res, 200, { rows, term: term ? term.name : 'All Terms', school: settings });
    }

    if (pathname === '/api/fee-payments' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      const receipt = 'RCPT-' + Date.now();
      const info = db.prepare('INSERT INTO fee_payments (fee_id, amount_paid, payment_method, receipt_number, recorded_by) VALUES (?,?,?,?,?)')
        .run(body.fee_id, body.amount_paid, body.payment_method || 'Cash', receipt, currentUser.id);
      logAudit(currentUser, 'Record fee payment', 'fees', { fee_id: body.fee_id, amount: body.amount_paid });
      return sendJSON(res, 201, { id: Number(info.lastInsertRowid), receipt_number: receipt });
    }

    // Initiates an MTN Mobile Money "Request to Pay" — the customer approves it on their own
    // phone (a prompt from MTN, not this app), so this only ever starts the request; the actual
    // outcome is picked up later via the status-check endpoint below.
    if (pathname === '/api/momo/request-payment' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      const body = await readBody(req); // { fee_id, student_id, amount, phone }
      if (!body.fee_id || !body.student_id || !body.amount || !body.phone) {
        return sendJSON(res, 400, { error: 'Fee, student, amount, and phone number are all required.' });
      }
      // Staff with real "add" rights on Fees can pay for anyone; a Student or Parent may only
      // ever pay their own/their ward's fee — paying isn't the same action as a staff member
      // creating fee records, so it isn't gated by the same permission flag.
      const isSelfPay = (currentUser.role_name === 'Student' || currentUser.role_name === 'Parent/Guardian') && isAuthorizedForStudent(currentUser, Number(body.student_id));
      if (!perms.can_add && !isSelfPay) return sendJSON(res, 403, { error: 'No permission' });
      const cfg = await getMomoSettings();
      if (!momoConfigured(cfg)) {
        return sendJSON(res, 400, { error: 'MTN MoMo is not set up yet — enter the Subscription Key, API User, and API Key under Settings first.' });
      }
      const fee = db.prepare('SELECT * FROM fees WHERE id=?').get(body.fee_id);
      if (!fee) return sendJSON(res, 404, { error: 'Fee record not found.' });
      const student = db.prepare('SELECT * FROM students WHERE id=?').get(body.student_id);
      try {
        const referenceId = await momoRequestToPay(cfg, {
          amount: body.amount, phone: body.phone, externalId: fee.id,
          note: `School fees — ${student ? student.student_id : ''}`,
        });
        db.prepare(`INSERT INTO momo_transactions (fee_id, student_id, amount, phone, reference_id, status, initiated_by) VALUES (?,?,?,?,?,'PENDING',?)`)
          .run(body.fee_id, body.student_id, body.amount, body.phone, referenceId, currentUser.id);
        logAudit(currentUser, 'Initiate MTN MoMo payment', 'fees', { fee_id: body.fee_id, amount: body.amount, referenceId });
        return sendJSON(res, 200, { reference_id: referenceId, status: 'PENDING' });
      } catch (e) {
        return sendJSON(res, 502, { error: e.message });
      }
    }
    // Checks a pending MoMo transaction's real status with MTN, and — the moment it turns
    // SUCCESSFUL — records it as a normal fee_payments row, so a MoMo payment looks exactly
    // like any other payment everywhere else in the app from that point on.
    // Full MTN MoMo transaction history — for the Finance team to see every payment attempt
    // (pending, successful, or failed) with the student it was for, not just the ones that
    // succeeded and turned into a fee_payments row.
    if (pathname === '/api/momo/transactions' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const rows = db.prepare(`SELECT mt.*, s.student_id as student_number, s.first_name, s.last_name, ft.name as fee_type_name
        FROM momo_transactions mt
        JOIN students s ON s.id=mt.student_id
        JOIN fees f ON f.id=mt.fee_id
        JOIN fee_types ft ON ft.id=f.fee_type_id
        ORDER BY mt.id DESC LIMIT 200`).all();
      return sendJSON(res, 200, rows);
    }

    if (pathname.match(/^\/api\/momo\/status\/[\w-]+$/) && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const referenceId = decodeURIComponent(pathname.split('/').pop());
      const txn = db.prepare('SELECT * FROM momo_transactions WHERE reference_id=?').get(referenceId);
      if (!txn) return sendJSON(res, 404, { error: 'Transaction not found.' });
      if (txn.status !== 'PENDING') return sendJSON(res, 200, { status: txn.status, financial_transaction_id: txn.momo_financial_transaction_id, failure_reason: txn.failure_reason });
      const cfg = await getMomoSettings();
      try {
        const momoResult = await momoCheckStatus(cfg, referenceId);
        if (momoResult.status === 'SUCCESSFUL') {
          const receipt = 'MOMO-' + Date.now();
          db.prepare('INSERT INTO fee_payments (fee_id, amount_paid, payment_method, receipt_number, recorded_by) VALUES (?,?,?,?,?)')
            .run(txn.fee_id, txn.amount, 'MTN MoMo', receipt, txn.initiated_by);
          db.prepare(`UPDATE momo_transactions SET status='SUCCESSFUL', momo_financial_transaction_id=?, updated_at=datetime('now') WHERE id=?`)
            .run(momoResult.financialTransactionId || null, txn.id);
          logAudit(currentUser, 'MTN MoMo payment confirmed', 'fees', { fee_id: txn.fee_id, amount: txn.amount, referenceId });
        } else if (momoResult.status === 'FAILED') {
          db.prepare(`UPDATE momo_transactions SET status='FAILED', failure_reason=?, updated_at=datetime('now') WHERE id=?`)
            .run(momoResult.reason || 'Payment failed', txn.id);
        }
        return sendJSON(res, 200, { status: momoResult.status, failure_reason: momoResult.reason || null });
      } catch (e) {
        return sendJSON(res, 502, { error: e.message });
      }
    }
    if (pathname === '/api/fee-payments' && req.method === 'GET') {
      const { fee_id, student_id } = parsed.query;
      let sql = `SELECT fp.*, f.student_id as sid, f.amount_due FROM fee_payments fp JOIN fees f ON f.id=fp.fee_id WHERE 1=1`;
      const params = [];
      if (fee_id) { sql += ' AND fp.fee_id=?'; params.push(fee_id); }
      if (student_id) { sql += ' AND f.student_id=?'; params.push(student_id); }
      sql += ' ORDER BY fp.id DESC';
      return sendJSON(res, 200, db.prepare(sql).all(...params));
    }
    // A searchable/filterable receipt history — every payment ever recorded, independent of
    // which specific fee record or student page you're on, so an admin can find and reprint an
    // old receipt without needing to already know which student or fee it was against.
    if (pathname === '/api/receipts' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'fees');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { search, from, to, method } = parsed.query;
      let sql = `SELECT fp.id, fp.amount_paid, fp.payment_date, fp.payment_method, fp.receipt_number,
        s.id as student_db_id, s.student_id, s.first_name, s.last_name, ft.name as fee_type_name
        FROM fee_payments fp
        JOIN fees f ON f.id = fp.fee_id
        JOIN students s ON s.id = f.student_id
        LEFT JOIN fee_types ft ON ft.id = f.fee_type_id
        WHERE 1=1`;
      const params = [];
      if (search) { sql += ` AND (s.student_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR fp.receipt_number LIKE ?)`; const like = `%${search}%`; params.push(like, like, like, like); }
      if (from) { sql += ` AND date(fp.payment_date) >= date(?)`; params.push(from); }
      if (to) { sql += ` AND date(fp.payment_date) <= date(?)`; params.push(to); }
      if (method) { sql += ` AND fp.payment_method = ?`; params.push(method); }
      sql += ' ORDER BY fp.id DESC LIMIT 300';
      const rows = db.prepare(sql).all(...params);
      const total = db.prepare('SELECT COALESCE(SUM(amount_paid),0) t FROM fee_payments').get().t;
      return sendJSON(res, 200, { rows, total_all_time: total });
    }
    // Full detail for one payment, formatted for a printable receipt (student, fee type, school branding).
    if (pathname.startsWith('/api/receipt/') && req.method === 'GET') {
      const paymentId = Number(pathname.replace('/api/receipt/', ''));
      const payment = db.prepare(`
        SELECT fp.*, f.student_id AS student_db_id, f.amount_due, f.fee_type_id, f.academic_year_id, f.term_id
        FROM fee_payments fp JOIN fees f ON f.id = fp.fee_id WHERE fp.id = ?`).get(paymentId);
      if (!payment) return sendJSON(res, 404, { error: 'Receipt not found' });
      const student = db.prepare('SELECT * FROM students WHERE id=?').get(payment.student_db_id);
      const feeType = db.prepare('SELECT * FROM fee_types WHERE id=?').get(payment.fee_type_id);
      const term = payment.term_id ? db.prepare('SELECT * FROM terms WHERE id=?').get(payment.term_id) : null;
      const year = payment.academic_year_id ? db.prepare('SELECT * FROM academic_years WHERE id=?').get(payment.academic_year_id) : null;
      const totalPaidForFee = db.prepare('SELECT COALESCE(SUM(amount_paid),0) t FROM fee_payments WHERE fee_id=?').get(payment.fee_id).t;
      const recordedBy = payment.recorded_by ? db.prepare('SELECT full_name FROM users WHERE id=?').get(payment.recorded_by) : null;
      const school = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, {
        payment, student, fee_type_name: feeType ? feeType.name : 'Fee',
        amount_due: payment.amount_due, balance: Math.max(0, payment.amount_due - totalPaidForFee),
        term: term ? term.name : '', academic_year: year ? year.name : '',
        recorded_by: recordedBy ? recordedBy.full_name : '', school,
      });
    }

    // ---- Timetable: global schedule config (periods, weekdays, break/lunch/prayer/closing times) ----
    // Resolves how many periods a given weekday has: per-day override if set, else the school-wide default.
    function periodsForWeekday(config, weekday) {
      if (config.periods_per_day_json) {
        try {
          const map = JSON.parse(config.periods_per_day_json);
          if (map[weekday] != null) return Number(map[weekday]);
        } catch (e) { /* fall through to default */ }
      }
      return config.periods_per_day;
    }

    if (pathname === '/api/timetable-config' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM timetable_config WHERE id=1').get());
    }
    if (pathname === '/api/timetable-config' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      const cols = Object.keys(body);
      if (cols.length) db.prepare(`UPDATE timetable_config SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=1`).run(...cols.map(c => body[c]));
      logAudit(currentUser, 'Update timetable settings', 'classes', body);
      return sendJSON(res, 200, db.prepare('SELECT * FROM timetable_config WHERE id=1').get());
    }

    // ---- Timetable: one class's full weekly grid, with subject/teacher names resolved ----
    if (pathname === '/api/timetable' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      const { class_id } = parsed.query;
      if (!class_id) return sendJSON(res, 400, { error: 'A class is required.' });
      const config = db.prepare('SELECT * FROM timetable_config WHERE id=1').get();
      const entries = db.prepare(`SELECT te.*, sub.name as subject_name, t.full_name as teacher_name
        FROM timetable_entries te LEFT JOIN subjects sub ON sub.id=te.subject_id LEFT JOIN teachers t ON t.id=te.teacher_id
        WHERE te.class_id=?`).all(class_id);
      const cls = db.prepare('SELECT * FROM classes WHERE id=?').get(class_id);
      const weekdaysList = config.weekdays.split(',').map(s => s.trim()).filter(Boolean);
      const periodsByWeekday = {};
      weekdaysList.forEach(w => periodsByWeekday[w] = periodsForWeekday(config, w));
      const school = db.prepare('SELECT school_name, logo_photo, current_academic_year_id FROM school_settings WHERE id=1').get();
      const activeYear = school.current_academic_year_id ? db.prepare('SELECT name FROM academic_years WHERE id=?').get(school.current_academic_year_id) : null;
      return sendJSON(res, 200, { config, entries, class_name: cls ? cls.name : '', periods_by_weekday: periodsByWeekday, school, academic_year: activeYear ? activeYear.name : '' });
    }

    // ---- Timetable: set or clear a single period's subject/teacher, with conflict warning ----
    if (pathname === '/api/timetable/entry' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id, weekday, period_number, subject_id, teacher_id }
      let conflict = null;
      if (body.teacher_id) {
        const clash = db.prepare(`SELECT te.*, c.name as class_name FROM timetable_entries te JOIN classes c ON c.id=te.class_id
          WHERE te.teacher_id=? AND te.weekday=? AND te.period_number=? AND te.class_id!=?`)
          .get(body.teacher_id, body.weekday, body.period_number, body.class_id);
        if (clash) {
          const teacher = db.prepare('SELECT full_name FROM teachers WHERE id=?').get(body.teacher_id);
          conflict = `${teacher ? teacher.full_name : 'This teacher'} is already teaching ${clash.class_name} at this same time.`;
        }
      }
      db.prepare(`INSERT INTO timetable_entries (class_id, weekday, period_number, subject_id, teacher_id) VALUES (?,?,?,?,?)
        ON CONFLICT(class_id, weekday, period_number) DO UPDATE SET subject_id=excluded.subject_id, teacher_id=excluded.teacher_id`)
        .run(body.class_id, body.weekday, body.period_number, body.subject_id || null, body.teacher_id || null);
      logAudit(currentUser, 'Update timetable entry', 'classes', body);
      return sendJSON(res, 200, { ok: true, conflict });
    }

    // ---- Timetable: auto-fill every empty period for a class by rotating through chosen subjects ----
    // This is the "automation" — instead of clicking into all 40 cells by hand, pick the subjects
    // this class takes and let the system distribute them evenly, skipping cells already filled in
    // and flagging any teacher double-bookings it creates along the way so nothing is silently wrong.
    if (pathname === '/api/timetable/auto-generate' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id, subject_ids: [1,2,3], reshuffle: bool }
      if (!body.class_id || !Array.isArray(body.subject_ids) || !body.subject_ids.length) {
        return sendJSON(res, 400, { error: 'Choose at least one subject to rotate through.' });
      }
      // Reshuffle = start over: clear this class's whole timetable first, then generate again
      // with the subjects in a randomized order, so re-running it gives a genuinely different
      // arrangement to look at before printing rather than reproducing the exact same one.
      if (body.reshuffle) {
        db.prepare('DELETE FROM timetable_entries WHERE class_id=?').run(body.class_id);
      }
      const subjectIds = body.reshuffle ? [...body.subject_ids].sort(() => Math.random() - 0.5) : body.subject_ids;
      const config = db.prepare('SELECT * FROM timetable_config WHERE id=1').get();
      const weekdays = config.weekdays.split(',').map(s => s.trim()).filter(Boolean);
      const existing = db.prepare('SELECT weekday, period_number FROM timetable_entries WHERE class_id=?').all(body.class_id);
      const filled = new Set(existing.map(e => `${e.weekday}|${e.period_number}`));
      // Default teacher per subject: whoever teaches it, if unambiguous — otherwise left blank for a human to assign.
      const teacherForSubject = {};
      for (const sid of subjectIds) {
        const teachers = db.prepare('SELECT DISTINCT teacher_id FROM teacher_subjects WHERE subject_id=?').all(sid);
        teacherForSubject[sid] = teachers.length === 1 ? teachers[0].teacher_id : null;
      }
      const insertStmt = db.prepare('INSERT INTO timetable_entries (class_id, weekday, period_number, subject_id, teacher_id) VALUES (?,?,?,?,?)');
      let subjectIdx = 0, filledCount = 0;
      const conflicts = [];
      for (const weekday of weekdays) {
        const periodsThisDay = periodsForWeekday(config, weekday);
        for (let period = 1; period <= periodsThisDay; period++) {
          const key = `${weekday}|${period}`;
          if (filled.has(key)) continue;
          const subjectId = subjectIds[subjectIdx % subjectIds.length];
          subjectIdx++;
          let teacherId = teacherForSubject[subjectId];
          // The whole point of "without conflicting the timing" is that this never actually
          // double-books a teacher — if their only teacher for this subject is already booked
          // elsewhere at this exact slot (in another class), the slot is filled with just the
          // subject and left without a teacher, rather than silently creating a clash and only
          // mentioning it afterward in a message easy to miss.
          if (teacherId) {
            const clash = db.prepare(`SELECT c.name as class_name FROM timetable_entries te JOIN classes c ON c.id=te.class_id
              WHERE te.teacher_id=? AND te.weekday=? AND te.period_number=? AND te.class_id!=?`).get(teacherId, weekday, period, body.class_id);
            if (clash) {
              const subjectRow = db.prepare('SELECT name FROM subjects WHERE id=?').get(subjectId);
              conflicts.push(`${weekday} period ${period}: ${subjectRow ? subjectRow.name : 'subject'}'s teacher was already booked for ${clash.class_name} at this time — left without a teacher here, assign one by hand.`);
              teacherId = null;
            }
          }
          insertStmt.run(body.class_id, weekday, period, subjectId, teacherId);
          filledCount++;
        }
      }
      logAudit(currentUser, 'Auto-generate timetable', 'classes', { class_id: body.class_id, filledCount });
      return sendJSON(res, 200, { filledCount, conflicts });
    }

    if (pathname === '/api/timetable/clear' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'classes');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { class_id }
      db.prepare('DELETE FROM timetable_entries WHERE class_id=?').run(body.class_id);
      logAudit(currentUser, 'Clear timetable', 'classes', { class_id: body.class_id });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Settings ----
    // Everything needed to help someone connect a phone or another computer on the same
    // network: every LAN address this server is actually reachable on (a computer can have
    // more than one — Wi-Fi and Ethernet, for instance), the port, and any custom URL the
    // admin has set (for setups auto-detection won't get right, like port-forwarding or a
    // fixed router hostname).
    if (pathname === '/api/network-info' && req.method === 'GET') {
      const addresses = getLanAddresses();
      const settings = db.prepare('SELECT custom_connect_url FROM school_settings WHERE id=1').get();
      return sendJSON(res, 200, {
        addresses, port: PORT, httpsPort: HTTPS_PORT,
        urls: addresses.map(a => `http://${a}:${PORT}`),
        httpsUrls: addresses.map(a => `https://${a}:${HTTPS_PORT}`),
        customUrl: (settings && settings.custom_connect_url) || null,
      });
    }
    if (pathname === '/api/settings' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM school_settings WHERE id=1').get());
    }
    if (pathname === '/api/settings' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'settings');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      if (body.logo_photo_data) {
        const existingLogo = db.prepare('SELECT logo_photo FROM school_settings WHERE id=1').get();
        try { body.logo_photo = savePhotoFromDataUrl(body.logo_photo_data, 'school_logo'); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
        delete body.logo_photo_data;
        if (existingLogo && existingLogo.logo_photo) deletePhotoFile(existingLogo.logo_photo);
      }
      if (body.dashboard_background_photo_data) {
        const existingBg = db.prepare('SELECT dashboard_background_photo FROM school_settings WHERE id=1').get();
        try { body.dashboard_background_photo = savePhotoFromDataUrl(body.dashboard_background_photo_data, 'dashboard_bg'); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
        delete body.dashboard_background_photo_data;
        if (existingBg && existingBg.dashboard_background_photo) deletePhotoFile(existingBg.dashboard_background_photo);
      }
      if (body.remove_dashboard_background) {
        const existingBg = db.prepare('SELECT dashboard_background_photo FROM school_settings WHERE id=1').get();
        if (existingBg && existingBg.dashboard_background_photo) deletePhotoFile(existingBg.dashboard_background_photo);
        body.dashboard_background_photo = null;
        delete body.remove_dashboard_background;
      }
      if (body.login_background_data) {
        const existingLoginBg = db.prepare('SELECT login_background FROM school_settings WHERE id=1').get();
        try { body.login_background = savePhotoFromDataUrl(body.login_background_data, 'login_bg'); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
        delete body.login_background_data;
        if (existingLoginBg && existingLoginBg.login_background) deletePhotoFile(existingLoginBg.login_background);
      }
      if (body.remove_login_background) {
        const existingLoginBg = db.prepare('SELECT login_background FROM school_settings WHERE id=1').get();
        if (existingLoginBg && existingLoginBg.login_background) deletePhotoFile(existingLoginBg.login_background);
        body.login_background = null;
        delete body.remove_login_background;
      }
      // A "lock the screen" PIN — separate from the admin's actual login password, so stepping
      // away for a moment doesn't require typing the full password to come back. Hashed the
      // same way passwords are, never stored or returned in plain text.
      if (body.lock_pin) {
        if (!/^\d{4,8}$/.test(body.lock_pin)) return sendJSON(res, 400, { error: 'PIN must be 4-8 digits.' });
        const { hash, salt } = hashPassword(body.lock_pin);
        body.lock_pin_hash = hash; body.lock_pin_salt = salt;
        delete body.lock_pin;
      }
      // Keep the CA weight split sane: the two halves must add to 100 so grades stay meaningful.
      if (body.ca_weight_percent != null && body.exam_weight_percent != null) {
        const total = Number(body.ca_weight_percent) + Number(body.exam_weight_percent);
        if (Math.round(total) !== 100) return sendJSON(res, 400, { error: 'CA weight and Exam weight must add up to 100%.' });
      }
      const cols = Object.keys(body);
      if (cols.length) db.prepare(`UPDATE school_settings SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=1`).run(...cols.map(c => body[c]));
      logAudit(currentUser, 'Update settings', 'settings', body);
      return sendJSON(res, 200, db.prepare('SELECT * FROM school_settings WHERE id=1').get());
    }
    if (pathname === '/api/ca-config' && req.method === 'GET') {
      return sendJSON(res, 200, getCAConfig());
    }

    // ---- Users management ----
    if (pathname === '/api/users' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'users');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      return sendJSON(res, 200, db.prepare(`SELECT u.id, u.username, u.full_name, u.status, u.photo, u.linked_student_id, u.assigned_class_id, u.assigned_level, r.name as role,
        (SELECT student_id FROM students WHERE id=u.linked_student_id) as linked_student_display
        FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id DESC`).all());
    }
    if (pathname === '/api/users' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'users');
      if (!perms.can_add) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req);
      if (!body.username || !body.password || !body.full_name || !body.role_id) return sendJSON(res, 400, { error: 'Missing fields' });
      const { hash, salt } = hashPassword(body.password);
      let photo = null;
      if (body.photo_data) {
        try { photo = savePhotoFromDataUrl(body.photo_data, 'users'); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
      }
      try {
        const info = db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id, photo, linked_student_id, assigned_class_id, assigned_level) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(body.username.trim(), hash, salt, body.full_name, body.role_id, photo, body.linked_student_id || null, body.assigned_class_id || null, body.assigned_level || null);
        logAudit(currentUser, 'Create user', 'users', { username: body.username });
        return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
      } catch (e) { return sendJSON(res, 400, { error: 'Username already exists' }); }
    }
    if (pathname.startsWith('/api/users/') && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'users');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const id = Number(segs[2]);
      const body = await readBody(req);
      if (body.password) {
        const { hash, salt } = hashPassword(body.password);
        db.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').run(hash, salt, id);
      }
      const fields = {};
      ['full_name', 'role_id', 'status', 'linked_student_id', 'assigned_class_id', 'assigned_level'].forEach(f => { if (body[f] !== undefined) fields[f] = body[f]; });
      if (body.photo_data) {
        const existingUser = db.prepare('SELECT photo FROM users WHERE id=?').get(id);
        try { fields.photo = savePhotoFromDataUrl(body.photo_data, 'users'); }
        catch (e) { return sendJSON(res, 400, { error: e.message }); }
        if (existingUser && existingUser.photo) deletePhotoFile(existingUser.photo);
      }
      const cols = Object.keys(fields);
      if (cols.length) db.prepare(`UPDATE users SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`).run(...cols.map(c => fields[c]), id);
      logAudit(currentUser, 'Update user', 'users', { id });
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname === '/api/roles' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM roles ORDER BY id').all());
    }
    if (pathname === '/api/role-permissions' && req.method === 'GET') {
      const roleId = parsed.query.role_id;
      return sendJSON(res, 200, db.prepare('SELECT * FROM role_permissions WHERE role_id=?').all(roleId));
    }
    if (pathname === '/api/role-permissions' && req.method === 'PUT') {
      const perms = getPermissions(currentUser.role_id, 'users');
      if (!perms.can_edit) return sendJSON(res, 403, { error: 'No permission' });
      const body = await readBody(req); // { role_id, module, can_view, can_add, can_edit, can_delete, can_export }
      db.prepare(`INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(role_id, module) DO UPDATE SET can_view=excluded.can_view, can_add=excluded.can_add, can_edit=excluded.can_edit, can_delete=excluded.can_delete, can_export=excluded.can_export`)
        .run(body.role_id, body.module, body.can_view ? 1 : 0, body.can_add ? 1 : 0, body.can_edit ? 1 : 0, body.can_delete ? 1 : 0, body.can_export ? 1 : 0);
      logAudit(currentUser, 'Update role permissions', 'users', body);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Audit logs ----
    if (pathname === '/api/audit-logs' && req.method === 'GET') {
      const perms = getPermissions(currentUser.role_id, 'audit_logs');
      if (!perms.can_view) return sendJSON(res, 403, { error: 'No permission' });
      return sendJSON(res, 200, db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all());
    }
    if (pathname === '/api/audit-logs' && req.method === 'DELETE') {
      const perms = getPermissions(currentUser.role_id, 'audit_logs');
      if (!perms.can_delete) return sendJSON(res, 403, { error: 'No permission' });
      db.exec('DELETE FROM audit_logs');
      logAudit(currentUser, 'Clear audit logs', 'audit_logs', {});
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Backup / Restore ----
    if (pathname === '/api/backup' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'backup');
      if (!perms.can_add && currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'No permission' });
      const filename = createBackupFile(currentUser.id);
      logAudit(currentUser, 'Create backup', 'backup', { filename });
      return sendJSON(res, 201, { filename });
    }
    if (pathname === '/api/backup' && req.method === 'GET') {
      return sendJSON(res, 200, db.prepare('SELECT * FROM backups ORDER BY id DESC').all());
    }
    // Shows the admin exactly where backups actually go right now, and whether a custom folder
    // they set is genuinely working (as opposed to silently falling back to the default because
    // it's unavailable — e.g. a USB drive that's been unplugged).
    if (pathname === '/api/backup-location' && req.method === 'GET') {
      const settings = db.prepare('SELECT custom_backup_folder FROM school_settings WHERE id=1').get();
      const effective = getBackupDir();
      const customConfigured = !!(settings && settings.custom_backup_folder);
      return sendJSON(res, 200, {
        defaultPath: DEFAULT_BACKUP_DIR, customPath: (settings && settings.custom_backup_folder) || null,
        effectivePath: effective, customConfigured,
        customCurrentlyWorking: customConfigured ? effective === settings.custom_backup_folder : null,
      });
    }
    // Wipes every actual data record — students, staff, results, messages, everything a school
    // enters day-to-day — while preserving the system's own configuration (roles, permissions,
    // grading scale, ID formats, theme, the GES reference school list) and the account currently
    // performing the reset, so the system stays usable immediately afterward rather than locking
    // everyone out. Super Administrator only — this is the most destructive action in the system.
    if (pathname === '/api/system-reset' && req.method === 'POST') {
      if (currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'Only a Super Administrator can reset the system.' });
      const tablesToClear = [
        'academic_years', 'announcements', 'arabic_results', 'assignment_answers', 'assignment_questions',
        'assignment_submissions', 'assignments', 'attendance', 'audit_logs', 'backups', 'buses',
        'canteen_payments', 'class_group_members', 'class_groups', 'class_termly_reports', 'classes',
        'continuous_assessment', 'direct_messages', 'duty_roster', 'fee_payments', 'fee_types', 'fees',
        'forum_messages', 'forum_topics', 'group_tasks', 'parents_guardians', 'school_selections',
        'staff', 'staff_attendance', 'student_parents', 'student_tasks', 'students', 'subjects',
        'teacher_classes', 'teacher_subjects', 'teachers', 'terms', 'timetable_entries', 'visitor_checkins',
      ];
      const txn = () => {
        db.exec('BEGIN');
        try {
          for (const table of tablesToClear) {
            try { db.prepare(`DELETE FROM ${table}`).run(); } catch (e) { /* table may not exist in older DBs — skip it */ }
          }
          db.prepare('DELETE FROM users WHERE id != ?').run(currentUser.id);
          db.prepare("UPDATE school_settings SET current_academic_year_id=NULL, current_term_id=NULL WHERE id=1").run();
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      };
      txn();
      logAudit(currentUser, 'RESET ENTIRE SYSTEM', 'settings', {});
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/backup/email' && req.method === 'POST') {
      const perms = getPermissions(currentUser.role_id, 'backup');
      if (!perms.can_add && currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'No permission' });
      const settings = db.prepare('SELECT * FROM school_settings WHERE id=1').get();
      const filename = createBackupFile(currentUser.id);
      try {
        await sendBackupEmail({
          host: settings.smtp_host, port: settings.smtp_port, secure: !!settings.smtp_secure,
          username: settings.smtp_username, password: settings.smtp_password,
          to: settings.backup_email, attachmentPath: path.join(getBackupDir(), filename),
        });
        db.prepare('UPDATE school_settings SET last_auto_backup_sent_date=?, last_auto_backup_status=? WHERE id=1')
          .run(new Date().toISOString().slice(0, 10), 'Sent successfully (manual)');
        logAudit(currentUser, 'Email backup', 'backup', { filename, to: settings.backup_email });
        return sendJSON(res, 200, { ok: true, filename, sent_to: settings.backup_email });
      } catch (e) {
        db.prepare('UPDATE school_settings SET last_auto_backup_status=? WHERE id=1').run('Failed: ' + e.message);
        logAudit(currentUser, 'Email backup failed', 'backup', { filename, error: e.message });
        return sendJSON(res, 500, { error: e.message });
      }
    }
    if (pathname.startsWith('/api/backup/download/') && req.method === 'GET') {
      const filename = path.basename(decodeURIComponent(pathname.replace('/api/backup/download/', '')));
      const filePath = path.join(getBackupDir(), filename);
      if (!fs.existsSync(filePath)) return sendJSON(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${filename}"` });
      return fs.createReadStream(filePath).pipe(res);
    }
    if (pathname === '/api/restore-warning' && req.method === 'GET') {
      return sendJSON(res, 200, { warning: 'Restoring will REPLACE all current data with the selected backup. This cannot be undone. Make sure you have a current backup before proceeding.' });
    }
    if (pathname === '/api/restore' && req.method === 'POST') {
      if (currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'Only Super Administrator can restore backups' });
      const body = await readBody(req);
      if (!body.confirm) return sendJSON(res, 400, { error: 'Confirmation required' });
      const filePath = path.join(getBackupDir(), path.basename(body.filename || ''));
      if (!fs.existsSync(filePath)) return sendJSON(res, 404, { error: 'Backup file not found' });
      // Safety backup of current state before overwrite (full zip, images included — same as
      // any other backup) rather than just the database, so a bad restore is itself recoverable.
      const safetyOriginalName = createBackupFile(currentUser.id);
      const safetyName = safetyOriginalName.replace('Nibras_Backup_', 'PreRestore_Safety_');
      fs.renameSync(path.join(getBackupDir(), safetyOriginalName), path.join(getBackupDir(), safetyName));
      db.prepare('UPDATE backups SET filename=? WHERE filename=?').run(safetyName, safetyOriginalName);
      logAudit(currentUser, 'Restore backup (server restarting)', 'backup', { filename: body.filename });
      sendJSON(res, 200, { ok: true, message: 'Restore staged. The server will now restart to apply it.' });
      // Perform the swap and restart process shortly after responding
      setTimeout(() => {
        const fileBuf = fs.readFileSync(filePath);
        if (isZipFile(fileBuf)) applyZipBackup(fileBuf);
        else fs.copyFileSync(filePath, DB_PATH); // legacy raw .db backup from before images were bundled in
        process.exit(0); // Expect process manager / .bat loop to restart it. Documented in README.
      }, 300);
      return;
    }

    // ---- Restore from an uploaded backup file (not one already sitting in the backups folder) ----
    if (pathname === '/api/restore-upload' && req.method === 'POST') {
      if (currentUser.role_id !== 1) return sendJSON(res, 403, { error: 'Only Super Administrator can restore backups' });
      const body = await readBody(req); // { file_data: "data:application/octet-stream;base64,...", confirm: true }
      if (!body.confirm) return sendJSON(res, 400, { error: 'Confirmation required' });
      if (!body.file_data) return sendJSON(res, 400, { error: 'No file was uploaded.' });
      const match = /^data:.*?;base64,(.*)$/s.exec(body.file_data);
      if (!match) return sendJSON(res, 400, { error: 'Could not read that file.' });
      const buffer = Buffer.from(match[1], 'base64');
      // Accept either a full Nibras backup (.zip, database + images) or a legacy raw .db file
      // from before backups bundled images in — reject anything that's neither up front rather
      // than silently corrupting the live database with an unrelated file.
      const isZip = isZipFile(buffer);
      const isRawDb = buffer.slice(0, 16).toString('utf8').startsWith('SQLite format 3');
      if (!isZip && !isRawDb) {
        return sendJSON(res, 400, { error: 'That file does not look like a valid Nibras backup (.zip or .db).' });
      }
      const uploadedName = `Uploaded_Restore_${Date.now()}.${isZip ? 'zip' : 'db'}`;
      const uploadedPath = path.join(getBackupDir(), uploadedName);
      fs.writeFileSync(uploadedPath, buffer);
      const safetyOriginalName = createBackupFile(currentUser.id);
      const safetyName = safetyOriginalName.replace('Nibras_Backup_', 'PreRestore_Safety_');
      fs.renameSync(path.join(getBackupDir(), safetyOriginalName), path.join(getBackupDir(), safetyName));
      db.prepare('UPDATE backups SET filename=? WHERE filename=?').run(safetyName, safetyOriginalName);
      logAudit(currentUser, 'Restore backup from uploaded file (server restarting)', 'backup', { uploadedName });
      sendJSON(res, 200, { ok: true, message: 'Restore staged. The server will now restart to apply it.' });
      setTimeout(() => {
        if (isZip) applyZipBackup(fs.readFileSync(uploadedPath));
        else fs.copyFileSync(uploadedPath, DB_PATH);
        process.exit(0);
      }, 300);
      return;
    }

    // ---- Announcements feed already covered by generic resource ----

    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
});

// ---------- Self-signed TLS certificate, generated from scratch ----------
// Needed so phones can use their camera when connecting over the LAN — getUserMedia requires
// a "secure context" (HTTPS) in virtually every modern mobile browser, and Node has no built-in
// way to generate a certificate. This hand-implements the ASN.1 DER encoding for a minimal
// X.509v3 certificate (self-signed, RSA-2048/SHA-256), verified independently against openssl
// during development: correct structure, valid self-signature, and a real end-to-end TLS
// handshake all confirmed working before this was wired into the live server.
function derLen(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function derTLV(tag, content) { return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]); }
function derSeq(...parts) { return derTLV(0x30, Buffer.concat(parts)); }
function derSet(...parts) { return derTLV(0x31, Buffer.concat(parts)); }
function derInt(buf) { if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]); return derTLV(0x02, buf); }
function derIntFromNumber(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(n));
  let b = buf;
  while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.subarray(1);
  return derInt(b);
}
function derOID(dotted) {
  const parts = dotted.split('.').map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const chunk = [v & 0x7f];
    v >>= 7;
    while (v > 0) { chunk.unshift((v & 0x7f) | 0x80); v >>= 7; }
    bytes.push(...chunk);
  }
  return derTLV(0x06, Buffer.from(bytes));
}
function derNull() { return Buffer.from([0x05, 0x00]); }
function derUTF8(str) { return derTLV(0x0c, Buffer.from(str, 'utf8')); }
function derBool(v) { return derTLV(0x01, Buffer.from([v ? 0xff : 0x00])); }
function derBitString(buf, unused = 0) { return derTLV(0x03, Buffer.concat([Buffer.from([unused]), buf])); }
function derOctet(buf) { return derTLV(0x04, buf); }
function derCtx(num, content) { return derTLV(0xa0 | num, content); }
function derUTCTime(date) {
  const p = n => String(n).padStart(2, '0');
  const s = `${p(date.getUTCFullYear() % 100)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
  return derTLV(0x17, Buffer.from(s, 'ascii'));
}
function ipToOctets(ip) { return Buffer.from(ip.split('.').map(Number)); }

function generateSelfSignedCert(ipAddresses) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const sigAlgId = derSeq(derOID('1.2.840.113549.1.1.11'), derNull()); // sha256WithRSAEncryption
  const name = derSeq(derSet(derSeq(derOID('2.5.4.3'), derUTF8('Nibras School System'))));
  const notBefore = new Date(Date.now() - 24 * 3600 * 1000);
  const notAfter = new Date(Date.now() + 3650 * 24 * 3600 * 1000); // 10 years — this is regenerated at every startup anyway if the LAN IP changes
  const validity = derSeq(derUTCTime(notBefore), derUTCTime(notAfter));
  const sanEntries = Buffer.concat([
    derTLV(0x82, Buffer.from('localhost', 'ascii')), // [2] dNSName
    ...ipAddresses.map(ip => derTLV(0x87, ipToOctets(ip))), // [7] iPAddress
  ]);
  const sanExt = derSeq(derOID('2.5.29.17'), derOctet(derSeq(sanEntries)));
  const basicConstraints = derSeq(derOID('2.5.29.19'), derBool(true), derOctet(derSeq(derBool(false))));
  const keyUsage = derSeq(derOID('2.5.29.15'), derBool(true), derOctet(derBitString(Buffer.from([0xa0]), 3)));
  const tbs = derSeq(
    derCtx(0, derIntFromNumber(2)), // version v3
    derIntFromNumber(Date.now()), // serial number
    sigAlgId,
    name, // issuer
    validity,
    name, // subject (self-signed: issuer === subject)
    publicKey, // already DER SubjectPublicKeyInfo from Node
    derCtx(3, derSeq(basicConstraints, keyUsage, sanExt)) // extensions
  );
  const signature = crypto.sign('sha256', tbs, privateKey);
  const cert = derSeq(tbs, sigAlgId, derBitString(signature, 0));
  const certPem = `-----BEGIN CERTIFICATE-----\n${cert.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  return { cert: certPem, key: privateKey };
}
// Cached to disk and only regenerated when the detected LAN IPs actually change (DHCP can
// reassign one between restarts) — regenerating is cheap, but there's no reason to churn
// certificates a device has already been told to trust if nothing changed.
function getOrCreateTlsCert(lanAddresses) {
  const certDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
  const certPath = path.join(certDir, 'server.crt');
  const keyPath = path.join(certDir, 'server.key');
  const ipsPath = path.join(certDir, 'server.ips.json');
  const currentIps = JSON.stringify([...lanAddresses].sort());
  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(ipsPath)) {
    try {
      if (fs.readFileSync(ipsPath, 'utf8') === currentIps) {
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
      }
    } catch (e) { /* fall through and regenerate on any read error */ }
  }
  const { cert, key } = generateSelfSignedCert(lanAddresses);
  fs.writeFileSync(certPath, cert);
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  fs.writeFileSync(ipsPath, currentIps);
  return { cert, key };
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

server.listen(PORT, '0.0.0.0', () => {
  const lanAddresses = getLanAddresses();
  console.log('==================================================');
  console.log('  NIBRAS EDUCATIONAL COMPLEX — School Management System');
  console.log('  "Knowledge is Light"');
  console.log('==================================================');
  console.log(`  On THIS computer, open:   http://localhost:${PORT}`);

  // A second, HTTPS server — sharing the exact same request handler as the HTTP server above
  // — exists specifically so phone cameras work when connecting over the LAN (getUserMedia
  // requires a secure/HTTPS connection in virtually every modern mobile browser; plain HTTP
  // over a LAN IP does not qualify, even though it's the same private network). The browser
  // will show a one-time "not private" warning to accept, since this is a self-signed
  // certificate rather than one from a public certificate authority — that's expected and
  // normal for a school's own private network; tap "Advanced" / "Proceed" once per device.
  try {
    const { cert, key } = getOrCreateTlsCert(lanAddresses);
    const httpsServer = https.createServer({ cert, key }, (req, res) => { server.emit('request', req, res); });
    // .listen() failures (e.g. the port is already in use) surface asynchronously via this
    // 'error' event, NOT as a thrown exception — a try/catch around .listen() alone does not
    // catch this. Missing this handler previously meant a blocked HTTPS port would crash the
    // entire process, taking the already-working HTTP server down with it. Caught by
    // deliberately testing this exact failure mode, not by inspection.
    httpsServer.on('error', (e) => {
      console.log('  Could not start the secure (HTTPS) server — camera features on phones will');
      console.log('  be unavailable, but the regular (HTTP) address above still works. Error: ' + e.message);
    });
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`  Secure version (needed for phone camera features): https://localhost:${HTTPS_PORT}`);
    });
  } catch (e) {
    console.log('  Could not start the secure (HTTPS) server — camera features on phones will');
    console.log('  be unavailable, but the regular (HTTP) address above still works. Error: ' + e.message);
  }

  if (lanAddresses.length) {
    console.log('  On a PHONE or another computer on the same Wi-Fi, open:');
    lanAddresses.forEach(addr => console.log(`      http://${addr}:${PORT}  (or, for camera features: https://${addr}:${HTTPS_PORT})`));
  } else {
    console.log('  No network connection detected — phones/other computers on the');
    console.log('  network won\'t be able to reach this until this computer is on Wi-Fi/LAN.');
  }
  console.log(`  Database file:     ${DB_PATH}`);
  console.log('  Default login ->   username: admin   password: Admin@123');
  console.log('  (Please change this password after first login.)');
  console.log('==================================================');
  // Check once at startup, then once an hour — catches the Friday window whenever the
  // school computer happens to be on, without needing the OS's own task scheduler.
  checkWeeklyBackupEmail();
  setInterval(checkWeeklyBackupEmail, 60 * 60 * 1000);
});
