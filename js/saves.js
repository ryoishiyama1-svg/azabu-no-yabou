// セーブ枠（3つ）と、セーブの書き出し・読み込み
const SLOT_COUNT = 3;
const OLD_SAVE_KEY = 'azabu-save-v2';
const slotKey = (n) => `azabu-slot-${n}`;
let currentSlot = 1;

function readSlot(n) {
  try { return JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { return null; }
}
function writeSlot(n, s) {
  try { localStorage.setItem(slotKey(n), JSON.stringify(s)); return true; } catch (e) { return false; }
}
function deleteSlot(n) {
  try { localStorage.removeItem(slotKey(n)); } catch (e) {}
}

// 以前の1つだけのセーブを、枠1に移す
function migrateOldSave() {
  try {
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (!old) return;
    if (!localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), old);
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch (e) {}
}

// 一覧に出す要約（地図を作り直さずに、保存データだけから読む）
function slotSummary(n) {
  const s = readSlot(n);
  if (!s || !s.castles) return null;
  const clan = s.player || 'azabu';
  const total = Object.keys(s.castles).length;
  const owned = Object.values(s.castles).filter((c) => c.owner === clan).length;
  const lord = Object.values(s.gens || {}).find((g) => g.lord && g.clan === clan);
  return {
    clan, total, owned, turn: s.turn, result: s.result,
    scenario: (SCENARIOS[s.scenario] || SCENARIOS.tokyo).name,
    diff: (DIFFICULTY[s.diff] || DIFFICULTY.normal).name,
    lord: lord ? lord.name : '',
    generation: (s.lords || []).length || 1,
  };
}

// ---------- 書き出し・読み込み ----------
// セーブ（と実績）を1行の文字列にする。対応していれば gzip で縮める
const CODE_HEAD = { gzip: 'AZABU1:', plain: 'AZABU0:' };

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encodeBundle(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    return CODE_HEAD.gzip + bytesToB64(buf);
  }
  return CODE_HEAD.plain + bytesToB64(bytes);
}

async function decodeBundle(code) {
  const text = String(code || '').replace(/\s+/g, '');
  let bytes;
  if (text.startsWith(CODE_HEAD.gzip)) {
    if (!window.DecompressionStream) throw new Error('この端末では読み込めない形式です（iOS 16.4以降が必要）');
    const stream = new Blob([b64ToBytes(text.slice(CODE_HEAD.gzip.length))]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if (text.startsWith(CODE_HEAD.plain)) {
    bytes = b64ToBytes(text.slice(CODE_HEAD.plain.length));
  } else {
    throw new Error('「麻布の野望」のセーブコードではありません');
  }
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || obj.app !== 'azabu-no-yabou') throw new Error('「麻布の野望」のセーブコードではありません');
  return obj;
}

function exportBundle(n) {
  return {
    app: 'azabu-no-yabou', v: 1, at: Date.now(),
    save: n ? readSlot(n) : null,
    records: loadRecords(),
  };
}

// 読み込んだ実績は、今ある実績と合わせる（どちらかで取ったものは残す）
function mergeRecords(inc) {
  if (!inc) return;
  const r = loadRecords();
  r.plays = Math.max(r.plays, inc.plays || 0);
  r.wins = Math.max(r.wins, inc.wins || 0);
  Object.entries(inc.best || {}).forEach(([k, t]) => { if (!r.best[k] || t < r.best[k]) r.best[k] = t; });
  Object.entries(inc.clanWins || {}).forEach(([k, w]) => { r.clanWins[k] = Math.max(r.clanWins[k] || 0, w); });
  r.unlocked = [...new Set([...r.unlocked, ...(inc.unlocked || [])])];
  Object.entries(inc.ach || {}).forEach(([k, t]) => { if (!r.ach[k]) r.ach[k] = t; });
  saveRecords(r);
}
