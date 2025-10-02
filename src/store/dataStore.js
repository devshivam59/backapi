const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

const defaultState = {
  users: [],
  sessions: [],
  passwordResets: [],
  instruments: [],
  instrumentImports: [],
  instrumentSources: [],
  instrumentImportRuns: [],
  watchlists: [],
  watchlistItems: [],
  orders: [],
  trades: [],
  positions: [],
  holdings: [],
  walletAccounts: {},
  walletTransactions: [],
  ledgerEntries: [],
  notifications: [],
  auditLogs: [],
  idempotency: {},
  marketSnapshots: {},
  automationJobs: [],
  zerodha: {
    accessToken: null,
    validTill: null,
    profile: null,
    source: null,
    updatedAt: null
  }
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2));
  }
}

function loadState() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch (error) {
    console.error('Failed to load state file, using defaults:', error.message);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

let state = loadState();
let saveTimeout = null;

function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to persist state:', error.message);
    }
  }, 50);
}

function withState(mutator) {
  mutator(state);
  scheduleSave();
}

function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function getState() {
  return state;
}

function resetState(newState = null) {
  state = newState ? { ...defaultState, ...newState } : JSON.parse(JSON.stringify(defaultState));
  scheduleSave();
}

module.exports = {
  getState,
  withState,
  createId,
  resetState
};
