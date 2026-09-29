// mailer.js — a small, dependency-free SMTP client used only to email the database backup file.
// Supports STARTTLS (typical for port 587) and implicit TLS (typical for port 465), with AUTH LOGIN.
// Built on Node's built-in net/tls modules only — no npm packages required.
//
// IMPORTANT: this was written and syntax-tested in an offline sandbox with no internet access,
// so the SMTP conversation logic has been reasoned through carefully but not verified against a
// real mail server. If sending fails, the error message returned should say exactly which SMTP
// step failed (connect, STARTTLS, AUTH, MAIL FROM, RCPT TO, or DATA) to make debugging fast.

const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');

function readLine(socket, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      // An SMTP multi-line reply ends when a line has a space (not a dash) after the 3-digit code.
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (err) => { cleanup(); reject(err); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for the mail server to respond.')); }, timeoutMs);
    function cleanup() { clearTimeout(timer); socket.removeListener('data', onData); socket.removeListener('error', onError); }
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function writeCommand(socket, command) {
  return new Promise((resolve, reject) => socket.write(command + '\r\n', (err) => err ? reject(err) : resolve()));
}

function checkCode(reply, expectedCodes, step) {
  const code = parseInt((reply || '').slice(0, 3), 10);
  if (!expectedCodes.includes(code)) {
    throw new Error(`Mail server rejected the ${step} step (response: ${(reply || 'no response').trim().slice(0, 200)})`);
  }
  return reply;
}

function base64Encode(str) { return Buffer.from(str, 'utf8').toString('base64'); }

function buildMimeMessage({ from, to, subject, text, attachmentPath, attachmentName }) {
  const boundary = '----NibrasBackup' + Date.now().toString(36);
  const fileData = fs.readFileSync(attachmentPath);
  const fileBase64 = fileData.toString('base64').replace(/(.{76})/g, '$1\r\n');
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    `Content-Type: application/octet-stream; name="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    '',
    fileBase64,
    '',
    `--${boundary}--`,
    '',
  ];
  // SMTP DATA requires lines starting with "." to be escaped by doubling it.
  return lines.join('\r\n').replace(/\r\n\./g, '\r\n..');
}

async function sendBackupEmail({ host, port, secure, username, password, to, attachmentPath }) {
  if (!host || !port) throw new Error('SMTP host and port are not configured. Set them in Settings first.');
  if (!to) throw new Error('No backup email address is configured. Set one in Settings first.');
  if (!fs.existsSync(attachmentPath)) throw new Error('Backup file was not created — cannot attach it to the email.');

  let socket;
  try {
    socket = secure
      ? await new Promise((resolve, reject) => {
          const s = tls.connect({ host, port, timeout: 15000 }, () => resolve(s));
          s.on('error', reject);
        })
      : await new Promise((resolve, reject) => {
          const s = net.connect({ host, port, timeout: 15000 }, () => resolve(s));
          s.on('error', reject);
        });
  } catch (e) {
    throw new Error(`Could not connect to ${host}:${port} — check the SMTP host/port and that this computer has internet access. (${e.message})`);
  }

  try {
    checkCode(await readLine(socket), [220], 'connect');
    await writeCommand(socket, `EHLO nibras-school-system`);
    checkCode(await readLine(socket), [250], 'EHLO');

    if (!secure) {
      await writeCommand(socket, 'STARTTLS');
      checkCode(await readLine(socket), [220], 'STARTTLS');
      socket = await new Promise((resolve, reject) => {
        const upgraded = tls.connect({ socket, host }, () => resolve(upgraded));
        upgraded.on('error', reject);
      });
      await writeCommand(socket, `EHLO nibras-school-system`);
      checkCode(await readLine(socket), [250], 'EHLO after STARTTLS');
    }

    if (username && password) {
      await writeCommand(socket, 'AUTH LOGIN');
      checkCode(await readLine(socket), [334], 'AUTH LOGIN');
      await writeCommand(socket, base64Encode(username));
      checkCode(await readLine(socket), [334], 'username');
      await writeCommand(socket, base64Encode(password));
      checkCode(await readLine(socket), [235], 'password (check your SMTP username/password, or app password if using Gmail/Outlook)');
    }

    const from = username || to;
    await writeCommand(socket, `MAIL FROM:<${from}>`);
    checkCode(await readLine(socket), [250], 'MAIL FROM');
    await writeCommand(socket, `RCPT TO:<${to}>`);
    checkCode(await readLine(socket), [250, 251], 'RCPT TO');
    await writeCommand(socket, 'DATA');
    checkCode(await readLine(socket), [354], 'DATA');

    const stamp = new Date().toISOString().slice(0, 10);
    const message = buildMimeMessage({
      from, to, subject: `Nibras School System — Weekly Backup (${stamp})`,
      text: `Attached is the school database backup generated on ${stamp}.\n\nThis is an automated message from the Nibras Educational Complex school management system.`,
      attachmentPath, attachmentName: path.basename(attachmentPath),
    });
    await writeCommand(socket, message + '\r\n.');
    checkCode(await readLine(socket, 30000), [250], 'sending the message');

    await writeCommand(socket, 'QUIT');
    socket.end();
  } catch (e) {
    try { socket.end(); } catch (_) {}
    throw e;
  }
}

module.exports = { sendBackupEmail };
