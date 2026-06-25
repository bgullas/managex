/* Simple JSON-file-backed store of payment intents. Sandbox only — a real deployment would
   use a real database. */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'payments.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(intents) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(intents, null, 2));
}

function create(intent) {
  const intents = readAll();
  intents.push(intent);
  writeAll(intents);
  return intent;
}

function getById(id) {
  return readAll().find(i => i.id === id) || null;
}

function getByTransactionId(transactionId) {
  return readAll().find(i => i.transactionId === transactionId) || null;
}

function getByReference(reference) {
  return readAll().find(i => i.reference === reference) || null;
}

function update(id, patch) {
  const intents = readAll();
  const idx = intents.findIndex(i => i.id === id);
  if (idx === -1) return null;
  intents[idx] = { ...intents[idx], ...patch };
  writeAll(intents);
  return intents[idx];
}

module.exports = { create, getById, getByTransactionId, getByReference, update, readAll };
