const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../");
const DATA_DIR = path.join(ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function withStore(mutator) {
  const current = readStore();
  const next = mutator(current);
  writeStore(next);
  return next;
}

module.exports = {
  STORE_PATH,
  readStore,
  writeStore,
  withStore
};
