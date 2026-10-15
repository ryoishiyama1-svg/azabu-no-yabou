// ---------- 腕比べ（友だちと同じ条件で競う） ----------
// 腕比べのコード（例：UDE-3-0-1-K7Q2P）に、戦い・家・難易度・乱数のたねを詰める。
// 同じコードで始めれば、地図も武将も能力も同じ。何季で天下を取れるか（届かなければ何城まで取れたか）を友だちと競う
const UDE_KEY = 'azabu-ude';
const udeLoad = () => { try { return JSON.parse(localStorage.getItem(UDE_KEY)) || {}; } catch (e) { return {}; } };
const udeSave = (d) => { try { localStorage.setItem(UDE_KEY, JSON.stringify(d)); } catch (e) {} };

function udeEncode({ scenario, clan, diff, seed }) {
  return ['UDE', Object.keys(SCENARIOS).indexOf(scenario), Object.keys(CLANS).indexOf(clan), Object.keys(DIFFICULTY).indexOf(diff), seed.toString(36).toUpperCase()].map(String).join('-');
}
function udeDecode(code) {
  const m = String(code || '').trim().toUpperCase().match(/^UDE-(\d+)-(\d+)-(\d+)-([0-9A-Z]{1,8})$/);
  if (!m) return null;
  const scenario = Object.keys(SCENARIOS)[+m[1]], clan = Object.keys(CLANS)[+m[2]], diff = Object.keys(DIFFICULTY)[+m[3]];
  if (!scenario || !clan || !diff || !scenarioClans(scenario).includes(clan)) return null;
  return { scenario, clan, diff, seed: parseInt(m[4], 36), code: m[0] };
}
// 乱数のたねを決めて新しいゲームを作る：始まりの盤面だけを同じにする（遊び始めてからの運は人それぞれ）
function udeNewGame(p, lordName) {
  const orig = Math.random;
  let a = p.seed >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { S = newGame({ lordName, diff: p.diff, scenario: p.scenario, clan: p.clan, tutorial: false }); } finally { Math.random = orig; }
  S.ude = { code: udeEncode(p) };
  return S;
}
const udeUrl = (code) => `${location.origin}${location.pathname}#ude=${code}`;
const udeLabel = (p) => `${SCENARIOS[p.scenario].name}・${CLANS[p.clan].name}・${DIFFICULTY[p.diff].name}`;
const udeScore = (r) => (r.win ? `天下統一まで${r.turns}季` : `${r.castles}城まで`);
// よいほう：統一した早さ、統一していなければ城の数
const udeBetter = (a, b) => (!b ? true : a.win !== b.win ? a.win : a.win ? a.turns < b.turns : a.castles > b.castles);

function udeStart(p) {
  const name = `${CLANS[p.clan].name.replace('家', '').replace('・', '')} 一郎`;
  udeNewGame(p, name);
  save();
  closeModal();
  startGame(true);
  toast(`⚔️ 腕比べ ${S.ude.code}`);
}

function showUde(prefill = '') {
  const d = udeLoad();
  const rows = Object.entries(d).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 8).map(([code, v]) => {
    const p = udeDecode(code);
    return p ? `<li><b>${code}</b><small>${udeLabel(p)}</small><span>${v.best ? udeScore(v.best) : '挑戦中'}・${v.tries || 1}回</span><button class="btn plain" data-again="${code}">もう一度</button></li>` : '';
  }).join('');
  const scs = Object.keys(SCENARIOS);
  openModal(`<h2>腕 比 べ</h2>
    <p class="hint">同じコードなら、地図も武将も同じ条件。友だちとコードを送り合って、<b>何季で天下を取れるか</b>を競おう。統一できなければ、取った城の数で勝負。</p>
    <h3 class="setup-h"><span>一</span>コードで受けて立つ</h3>
    <input class="name-input" id="ude-code" placeholder="UDE-0-0-1-XXXXX" value="${esc(prefill)}" autocomplete="off" autocapitalize="characters">
    <p class="hint" id="ude-info"></p>
    <button class="btn red" id="ude-accept">受けて立つ</button>
    <h3 class="setup-h"><span>二</span>新しく腕比べを作る</h3>
    <div class="ude-make">
      <select id="ude-sc">${scs.map((k) => `<option value="${k}">${EDITIONS[SCENARIOS[k].ed] ? EDITIONS[SCENARIOS[k].ed].name + '・' : ''}${SCENARIOS[k].name}</option>`).join('')}</select>
      <select id="ude-clan"></select>
      <select id="ude-diff">${Object.keys(DIFFICULTY).map((k) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${DIFFICULTY[k].name}</option>`).join('')}</select>
    </div>
    <button class="btn" id="ude-make">この条件で始める</button>
    ${rows ? `<h3 class="setup-h"><span>三</span>これまでの腕比べ</h3><ol class="ude-list">${rows}</ol>` : ''}
    <button class="btn plain" data-close>もどる</button>`);
  const fillClans = () => {
    const sc = $('ude-sc').value, lead = EDITIONS[SCENARIOS[sc].ed] ? EDITIONS[SCENARIOS[sc].ed].lead : null;
    // 自分で作るときは、旗揚げと同じく解放した家だけ（友だちのコードで受けるときは、どの家でも）
    const rec = loadRecords();
    $('ude-clan').innerHTML = scenarioClans(sc).map((k) => {
      const locked = k !== lead && !rec.unlocked.includes(k) && rec.unlocked.length <= 1;
      return `<option value="${k}" ${k === lead ? 'selected' : ''} ${locked ? 'disabled' : ''}>${CLANS[k].name}${locked ? '（🔒）' : ''}</option>`;
    }).join('');
  };
  const showInfo = () => {
    const p = udeDecode($('ude-code').value);
    $('ude-info').textContent = $('ude-code').value.trim() ? (p ? `📜 ${udeLabel(p)}` : 'コードが正しくないようです') : '';
    $('ude-accept').disabled = !p;
  };
  $('ude-sc').onchange = fillClans;
  fillClans();
  $('ude-code').oninput = showInfo;
  showInfo();
  $('ude-accept').onclick = () => { const p = udeDecode($('ude-code').value); if (p) { Sound.tap(); udeStart(p); } };
  $('ude-make').onclick = () => {
    Sound.tap();
    udeStart({ scenario: $('ude-sc').value, clan: $('ude-clan').value, diff: $('ude-diff').value, seed: Math.floor(Math.random() * 36 ** 5) });
  };
  modalBody.querySelectorAll('[data-again]').forEach((b) => { b.onclick = () => { Sound.tap(); udeStart(udeDecode(b.dataset.again)); }; });
}

// 結果を記録し、終わりの画面に腕比べの札を差し込む
function udeRecord() {
  if (!S || !S.ude || S.ude.recorded || !S.result) return null;
  S.ude.recorded = true;
  const r = { win: S.result === 'win', turns: S.turn, castles: Math.max(S.ude.peak || 0, castlesOf(S, PLAYER).length) };
  const d = udeLoad(), cur = d[S.ude.code] || { tries: 0 };
  cur.tries = (cur.tries || 0) + 1;
  cur.at = Date.now();
  const best = udeBetter(r, cur.best);
  if (best) cur.best = r;
  d[S.ude.code] = cur;
  udeSave(d);
  S.ude.last = r; S.ude.best = cur.best; S.ude.newBest = best;
  return r;
}
function udeCard() {
  const p = udeDecode(S.ude.code), r = S.ude.last;
  if (!p || !r) return '';
  return `<div class="ude-card">
    <div class="ude-head"><span>腕比べ</span><b>${S.ude.code}</b></div>
    <p class="ude-score">${udeScore(r)}${S.ude.newBest ? '<i>自己ベスト</i>' : ''}</p>
    <small>${udeLabel(p)}${!S.ude.newBest && S.ude.best ? `・ベスト：${udeScore(S.ude.best)}` : ''}</small>
    <button class="btn red" id="ude-share">友だちに挑戦状を送る</button></div>`;
}
function udeShareText() {
  const p = udeDecode(S.ude.code), r = S.ude.last;
  return `【${gameTitle()} 腕比べ】${CLANS[p.clan].name}で${udeScore(r)}！ 同じ条件で勝負だ。コード ${S.ude.code}\n${udeUrl(S.ude.code)}`;
}

const _udeShowEnding = showEnding;
showEnding = function () {
  if (S && S.ude && S.result) udeRecord();
  _udeShowEnding();
  if (!S || !S.ude || !S.ude.last || !modalBody.querySelector('.ending')) return;
  modalBody.querySelector('.ending').insertAdjacentHTML('afterend', udeCard());
  const b = $('ude-share');
  if (b) b.onclick = async () => {
    Sound.tap();
    const text = udeShareText();
    if (navigator.share) { try { await navigator.share({ title: gameTitle(), text }); return; } catch (e) { return; } }
    try { await navigator.clipboard.writeText(text); toast('📋 挑戦状をコピーした'); } catch (e) { prompt('この文を友だちに送ろう', text); }
  };
};

// 取った城のいちばん多かった数を覚えておく（負けても「何城まで」で競えるように）
const _udeRender = render;
render = function (...a) {
  if (S && S.ude) S.ude.peak = Math.max(S.ude.peak || 0, castlesOf(S, PLAYER).length);
  return _udeRender.apply(this, a);
};

$('btn-ude').onclick = () => { Sound.unlock(); Sound.tap(); showUde(); };
// 共有された挑戦状のリンク（#ude=コード）から開いたら、受けて立つ画面へ
(function udeFromLink() {
  const m = location.hash.match(/ude=([0-9A-Za-z-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => { if (!$('title').hidden) showUde(m[1].toUpperCase()); }, 1200);
})();
