// 画面の表示と操作
const SAVE_KEY = 'azabu-save-v1';
const PLAYER = 'azabu';
const SVGNS = 'http://www.w3.org/2000/svg';

const $ = (id) => document.getElementById(id);
const mapwrap = $('mapwrap');
const svg = $('map');
const panel = $('panel');
const modal = $('modal');
const modalBody = $('modal-body');

let S = null;          // ゲームの状態
let selected = null;   // 選んでいる城
let mode = null;       // null | { kind: 'attack' | 'move', from }
let scale = 1;

// ---------- 保存 ----------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const clanChip = (k) => `<span class="chip" style="background:${CLANS[k].color}">${CLANS[k].name}</span>`;

function openModal(html) { modalBody.innerHTML = html; modal.hidden = false; }
function closeModal() { modal.hidden = true; }

// ---------- タイトル ----------
function showTitle() {
  $('game').hidden = true;
  $('title').hidden = false;
  const saved = load();
  $('btn-resume').hidden = !(saved && !saved.result);
  $('btn-new').className = saved && !saved.result ? 'btn ghost' : 'btn gold';
}

$('btn-new').onclick = () => {
  const saved = load();
  if (saved && !saved.result && !confirm('今の戦いを捨てて、最初からはじめますか？')) return;
  S = newGame();
  save();
  startGame(true);
};
$('btn-resume').onclick = () => { S = load(); startGame(false); };
$('btn-help').onclick = showHelp;

function startGame(isNew) {
  $('title').hidden = true;
  $('game').hidden = false;
  selected = null;
  mode = null;
  drawMap();
  render();
  centerOn(PLAYER);
  if (isNew) {
    openModal(`<h2>天下統一への第一歩</h2>
      <p>時は${dateLabel(0)}。<b>麻布</b>は元麻布の地で旗を揚げた。</p>
      <p>都内には <b>${MAP.nodes.length}校</b> がひしめき、<b>開成・筑駒・日比谷・早稲田・西</b> の各家も勢力拡大をねらっている。</p>
      <p>すべての学校を制覇し、天下を統一せよ！</p>
      <button class="btn red" data-close>出陣じゃ！</button>`);
  }
}

function showHelp() {
  openModal(`<h2>遊び方</h2>
    <h3>目的</h3>
    <p>麻布家を率いて、都内${MAP.nodes.length}校すべてを制覇すれば天下統一（クリア）。麻布家の城がすべて奪われると敗北です。</p>
    <h3>1ターン（季節）の流れ</h3>
    <ul>
      <li>自分の城をタップして命令を出す（<b>各城1ターンに1回</b>）</li>
      <li>「ターン終了」で他の勢力が動き、城の経済力に応じて金が入る</li>
    </ul>
    <h3>命令</h3>
    <ul>
      <li><b>出陣</b>：道でつながった敵の城を攻める</li>
      <li><b>輸送</b>：となりの自分の城へ兵を送る</li>
      <li><b>徴兵</b>：金${RULES.recruitCost}で兵+${RULES.recruitAmount}</li>
      <li><b>開発</b>：金${RULES.developCost}で経済+${RULES.developAmount}（毎ターンの収入が増える）</li>
      <li><b>築城</b>：金${RULES.fortifyCost}で防御+${RULES.fortifyAmount}（守りが固くなる）</li>
    </ul>
    <h3>合戦のコツ</h3>
    <p>守る側は「兵力×防御」の強さで戦います。攻めるときは <b>相手の1.3倍以上</b> の兵を用意しましょう。その日の士気で結果が変わることもあります。</p>
    <p class="hint">※実在の学校名を使ったフィクションです。能力値はすべて架空です。</p>
    <button class="btn plain" data-close>閉じる</button>`);
}

// ---------- 地図 ----------
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function drawMap() {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${MAP.width} ${MAP.height}`);
  applyScale();

  // 地域名
  const tama = MAP.nodes.filter((n) => n.ward.endsWith('市'));
  const ku = MAP.nodes.filter((n) => n.ward.endsWith('区'));
  const avg = (arr, k) => arr.reduce((a, n) => a + n[k], 0) / arr.length;
  el('text', { class: 'ward', x: avg(tama, 'x'), y: Math.min(...tama.map((n) => n.y)) - 40, 'text-anchor': 'middle' }, svg).textContent = '多 摩';
  el('text', { class: 'ward', x: avg(ku, 'x'), y: 34, 'text-anchor': 'middle' }, svg).textContent = '二 十 三 区';

  const roads = el('g', {}, svg);
  MAP.edges.forEach(([a, b]) => {
    const A = MAP.byId[a], B = MAP.byId[b];
    el('line', { class: 'road', x1: A.x, y1: A.y, x2: B.x, y2: B.y, 'data-a': a, 'data-b': b }, roads);
  });

  const layer = el('g', {}, svg);
  MAP.nodes.forEach((n) => {
    const g = el('g', { class: 'castle', 'data-id': n.id, transform: `translate(${n.x},${n.y})` }, layer);
    el('circle', { r: 30, fill: 'transparent' }, g); // タップしやすくする
    el('circle', { class: 'ring', r: 27, fill: 'none' }, g);
    el('circle', { class: 'body', r: 21 }, g);
    const size = n.short.length <= 2 ? 14 : n.short.length === 3 ? 11 : 9;
    el('text', { class: 'name', 'font-size': size }, g).textContent = n.short;
    el('text', { class: 'troops', y: 36 }, g);
    g.addEventListener('click', () => onCastleTap(n.id));
  });
}

function applyScale() {
  svg.setAttribute('width', Math.round(MAP.width * scale));
  svg.setAttribute('height', Math.round(MAP.height * scale));
}

function zoom(f) {
  const cx = (mapwrap.scrollLeft + mapwrap.clientWidth / 2) / scale;
  const cy = (mapwrap.scrollTop + mapwrap.clientHeight / 2) / scale;
  scale = Math.min(1.6, Math.max(0.45, scale * f));
  applyScale();
  mapwrap.scrollLeft = cx * scale - mapwrap.clientWidth / 2;
  mapwrap.scrollTop = cy * scale - mapwrap.clientHeight / 2;
}

function centerOn(id) {
  const n = MAP.byId[id];
  mapwrap.scrollLeft = n.x * scale - mapwrap.clientWidth / 2;
  mapwrap.scrollTop = n.y * scale - mapwrap.clientHeight / 2;
}

$('zoom-in').onclick = () => zoom(1.25);
$('zoom-out').onclick = () => zoom(0.8);
$('zoom-home').onclick = () => {
  const mine = castlesOf(S, PLAYER);
  centerOn(selected && S.castles[selected].owner === PLAYER ? selected : mine.includes('azabu') ? 'azabu' : mine[0]);
};

// ---------- 表示の更新 ----------
function render() {
  const mine = castlesOf(S, PLAYER);
  $('hud-date').textContent = dateLabel(S.turn);
  $('hud-gold').textContent = `${fmt(S.gold[PLAYER])}`;
  $('hud-castles').textContent = `${mine.length}/${MAP.nodes.length}`;

  const targets = modeTargets();
  document.querySelectorAll('#map .castle').forEach((g) => {
    const id = g.dataset.id;
    const c = S.castles[id];
    g.querySelector('.body').setAttribute('fill', CLANS[c.owner].color);
    g.querySelector('.troops').textContent = fmt(c.troops);
    g.classList.toggle('acted', c.owner === PLAYER && !!S.acted[id]);
    const ring = g.querySelector('.ring');
    ring.setAttribute('class', 'ring ' + (targets.includes(id) ? (mode.kind === 'attack' ? 'target' : 'friend') : id === selected ? 'sel' : ''));
  });
  document.querySelectorAll('#map .road').forEach((l) => {
    const hot = mode && ((l.dataset.a === mode.from && targets.includes(l.dataset.b)) ||
      (l.dataset.b === mode.from && targets.includes(l.dataset.a)));
    l.classList.toggle('hot', !!hot);
  });

  const banner = $('mode-banner');
  if (mode) {
    banner.hidden = false;
    banner.innerHTML = `<span>${mode.kind === 'attack' ? '⚔️ 攻める城を選んでください' : '🐎 兵を送る城を選んでください'}</span><button id="mode-cancel">やめる</button>`;
    $('mode-cancel').onclick = () => { mode = null; render(); };
  } else {
    banner.hidden = true;
  }
  renderPanel();
}

function modeTargets() {
  if (!mode) return [];
  return mode.kind === 'attack' ? enemyNeighbors(S, mode.from) : ownNeighbors(S, mode.from);
}

// 敵の城を攻められる自分の城
function attackSources(target) {
  return MAP.adj[target].filter((id) => S.castles[id].owner === PLAYER && !S.acted[id] && S.castles[id].troops > 0);
}

function renderPanel() {
  const endBtn = `<div class="end-row"><button class="btn red" id="btn-end">ターン終了</button></div>`;
  if (!selected) {
    const counts = Object.keys(CLANS)
      .map((k) => [k, castlesOf(S, k).length])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    const idle = castlesOf(S, PLAYER).filter((id) => !S.acted[id]).length;
    panel.innerHTML = `
      <p class="hint">城をタップして命令を出しましょう。まだ命令していない城：<b>${idle}</b></p>
      <div class="clan-list">${counts.map(([k, n]) => `<span style="background:${CLANS[k].color}">${CLANS[k].name} ${n}</span>`).join('')}</div>
      ${endBtn}`;
  } else {
    const n = MAP.byId[selected];
    const c = S.castles[selected];
    const own = c.owner === PLAYER;
    const head = `<div class="p-head"><h2>${n.name}</h2>${clanChip(c.owner)}<span class="p-sub">${n.ward}</span></div>
      <div class="stats">
        <div class="stat"><span class="n">${fmt(c.troops)}</span><span class="l">兵力</span></div>
        <div class="stat"><span class="n">${c.def.toFixed(1)}</span><span class="l">防御</span></div>
        <div class="stat"><span class="n">${c.eco}</span><span class="l">経済</span></div>
      </div>`;
    let body;
    if (own) {
      const done = !!S.acted[selected];
      const dis = (ok) => (done || !ok ? 'disabled' : '');
      body = `${done ? '<p class="hint">この城は今ターン、命令ずみです。</p>' : ''}
        <div class="cmds">
          <button class="btn red" id="c-attack" ${dis(enemyNeighbors(S, selected).length && c.troops > 0)}>出陣<small>敵の城を攻める</small></button>
          <button class="btn plain" id="c-move" ${dis(ownNeighbors(S, selected).length && c.troops > 0)}>輸送<small>兵を送る</small></button>
          <button class="btn plain" id="c-recruit" ${dis(canRecruit(S, selected))}>徴兵<small>金${RULES.recruitCost}</small></button>
          <button class="btn plain" id="c-develop" ${dis(canDevelop(S, selected))}>開発<small>金${RULES.developCost}</small></button>
          <button class="btn plain" id="c-fortify" ${dis(canFortify(S, selected))}>築城<small>金${RULES.fortifyCost}</small></button>
          <button class="btn plain" id="c-close">閉じる<small>&nbsp;</small></button>
        </div>`;
    } else {
      const srcs = attackSources(selected);
      body = `<div class="cmds">
          <button class="btn red wide" id="c-strike" ${srcs.length ? '' : 'disabled'}>この城を攻める<small>${srcs.length ? `となりの城から出陣できます` : 'となりに命令できる麻布家の城がありません'}</small></button>
        </div>
        <button class="btn plain" id="c-close">閉じる</button>`;
    }
    panel.innerHTML = head + body;
    bindPanel();
  }
  const end = $('btn-end');
  if (end) end.onclick = onEndTurn;
}

function bindPanel() {
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('c-close', () => { selected = null; render(); });
  on('c-attack', () => { mode = { kind: 'attack', from: selected }; render(); });
  on('c-move', () => { mode = { kind: 'move', from: selected }; render(); });
  on('c-recruit', () => { recruit(S, selected); S.acted[selected] = true; save(); render(); });
  on('c-develop', () => { develop(S, selected); S.acted[selected] = true; save(); render(); });
  on('c-fortify', () => { fortify(S, selected); S.acted[selected] = true; save(); render(); });
  on('c-strike', () => openAttack(null, selected));
}

// ---------- タップ ----------
function onCastleTap(id) {
  if (mode) {
    if (modeTargets().includes(id)) {
      if (mode.kind === 'attack') openAttack(mode.from, id);
      else openMove(mode.from, id);
    } else {
      mode = null;
      selected = id;
      render();
    }
    return;
  }
  selected = selected === id ? null : id;
  render();
}

// ---------- 出陣 ----------
function openAttack(from, to) {
  const srcs = from ? [from] : attackSources(to);
  let src = srcs.reduce((a, b) => (S.castles[a].troops >= S.castles[b].troops ? a : b));
  const t = S.castles[to];
  let amount = 0;

  function update() {
    const ratio = amount / Math.max(1, t.troops * t.def);
    const odds = ratio >= 1.3 ? ['勝算大', '#2e7d32'] : ratio >= 1.1 ? ['勝算あり', '#8a6d00'] : ratio >= 0.9 ? ['五分五分', '#b35c00'] : ['勝ち目うすい', '#c8323c'];
    $('amt-v').textContent = fmt(amount);
    $('odds').textContent = odds[0];
    $('odds').style.color = odds[1];
  }

  function draw() {
    const max = S.castles[src].troops;
    amount = Math.min(max, Math.round((max * 0.8) / 10) * 10 || max);
    openModal(`<h2>⚔️ ${MAP.byId[to].name} 攻め</h2>
      <p style="text-align:center;margin:0 0 8px">守備 <b>${fmt(t.troops)}</b> 兵 × 防御 <b>${t.def.toFixed(1)}</b> ${clanChip(t.owner)}</p>
      <h3>出陣する城</h3>
      <div class="src-list">${srcs.map((id) =>
        `<button data-src="${id}" class="${id === src ? 'on' : ''}"><span>${MAP.byId[id].name}</span><span>兵 ${fmt(S.castles[id].troops)}</span></button>`).join('')}</div>
      <h3>出陣する兵</h3>
      <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v">${fmt(amount)}</b></div>
      <p class="odds" id="odds"></p>
      <button class="btn red" id="go">出陣！</button>
      <button class="btn plain" data-close>やめる</button>`);
    document.querySelectorAll('[data-src]').forEach((b) => { b.onclick = () => { src = b.dataset.src; draw(); }; });
    $('amt').oninput = (e) => { amount = +e.target.value; update(); };
    update();
    $('go').onclick = () => {
      const r = attack(S, src, to, amount);
      S.acted[src] = true;
      if (r.won) S.acted[to] = true;
      mode = null;
      selected = r.won ? to : src;
      checkWin(S);
      save();
      render();
      playBattle(r);
    };
  }
  draw();
}

function playBattle(r) {
  const atk = CLANS[r.attacker], def = CLANS[r.defender];
  const a0 = r.rounds[0].a, d0 = r.rounds[0].d;
  openModal(`<h2 data-lock>合戦</h2>
    <div class="vs">
      <div class="side"><b>${MAP.byId[r.from].short}</b>${clanChip(r.attacker)}</div>
      <div class="x">対</div>
      <div class="side"><b>${MAP.byId[r.to].short}</b>${clanChip(r.defender)}</div>
    </div>
    <div class="bar"><i id="bar-a" style="width:100%;background:${atk.color}"></i></div>
    <div style="display:flex;justify-content:space-between"><span>攻 <span class="num" id="num-a">${fmt(a0)}</span></span><span>守 <span class="num" id="num-d">${fmt(d0)}</span></span></div>
    <div class="bar"><i id="bar-d" style="width:100%;background:${def.color};margin-left:auto"></i></div>
    <p class="round" id="round">いざ、尋常に勝負！</p>
    <p class="verdict" id="verdict"></p>
    <button class="btn plain" id="skip">結果を見る</button>`);

  let i = 0;
  const step = () => {
    i++;
    if (i >= r.rounds.length) return finish();
    const { a, d } = r.rounds[i];
    $('bar-a').style.width = `${(a / a0) * 100}%`;
    $('bar-d').style.width = `${(d / Math.max(1, d0)) * 100}%`;
    $('num-a').textContent = fmt(a);
    $('num-d').textContent = fmt(d);
    $('round').textContent = `第${i}合`;
    timer = setTimeout(step, 550);
  };
  let timer = setTimeout(step, 500);

  function finish() {
    clearTimeout(timer);
    const last = r.rounds[r.rounds.length - 1];
    $('bar-a').style.width = `${(last.a / a0) * 100}%`;
    $('bar-d').style.width = `${(last.d / Math.max(1, d0)) * 100}%`;
    $('num-a').textContent = fmt(last.a);
    $('num-d').textContent = fmt(last.d);
    const v = $('verdict');
    v.textContent = r.won ? `${MAP.byId[r.to].short}、落城！` : '攻略失敗…';
    v.className = 'verdict ' + (r.won ? 'win' : 'lose');
    $('round').textContent = r.won ? `残った ${fmt(r.left)} 兵が入城した` : `残った ${fmt(r.left)} 兵は ${MAP.byId[r.from].short} へ退却した`;
    const btn = $('skip');
    btn.textContent = '閉じる';
    btn.className = 'btn red';
    btn.onclick = () => { closeModal(); if (S.result) showEnding(); };
    if (r.won && r.defender !== 'none' && castlesOf(S, r.defender).length === 0) {
      $('round').textContent += `。${CLANS[r.defender].name}は滅亡した！`;
    }
  }
  $('skip').onclick = finish;
}

// ---------- 輸送 ----------
function openMove(from, to) {
  const max = S.castles[from].troops;
  let amount = Math.round(max / 2 / 10) * 10 || max;
  openModal(`<h2>🐎 輸送</h2>
    <p style="text-align:center">${MAP.byId[from].name} → ${MAP.byId[to].name}</p>
    <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v">${fmt(amount)}</b></div>
    <button class="btn red" id="go">送る</button>
    <button class="btn plain" data-close>やめる</button>`);
  $('amt').oninput = (e) => { amount = +e.target.value; $('amt-v').textContent = fmt(amount); };
  $('go').onclick = () => {
    moveTroops(S, from, to, amount);
    S.acted[from] = true;
    mode = null;
    selected = to;
    save();
    closeModal();
    render();
  };
}

// ---------- ターン終了 ----------
function onEndTurn() {
  const idle = castlesOf(S, PLAYER).filter((id) => !S.acted[id]).length;
  if (idle > 0 && !confirm(`まだ命令していない城が ${idle} あります。ターンを終了しますか？`)) return;
  selected = null;
  mode = null;
  const before = S.gold[PLAYER];
  const log = endTurn(S);
  save();
  render();
  const gain = S.gold[PLAYER] - before;
  openModal(`<h2 data-lock>${dateLabel(S.turn)}</h2>
    <h3>諸国の動き</h3>
    <ul class="log">${log.length ? log.map((l) => `<li>${l}</li>`).join('') : '<li>諸国に大きな動きはなかった。</li>'}</ul>
    <p>💰 麻布家の収入：<b>+${fmt(gain)}</b></p>
    <button class="btn red" id="ok">承知</button>`);
  $('ok').onclick = () => { closeModal(); if (S.result) showEnding(); };
}

function showEnding() {
  const win = S.result === 'win';
  openModal(`<h2 data-lock>${win ? '🏯 天下統一！' : '落日…'}</h2>
    <p style="text-align:center">${win
      ? `${dateLabel(S.turn)}、麻布家は都内${MAP.nodes.length}校をすべて制覇した！`
      : `${dateLabel(S.turn)}、麻布家の城はすべて奪われた。`}</p>
    <button class="btn red" id="again">もう一度</button>
    <button class="btn plain" id="to-title">タイトルへ</button>`);
  $('again').onclick = () => { clearSave(); S = newGame(); save(); closeModal(); startGame(true); };
  $('to-title').onclick = () => { clearSave(); closeModal(); showTitle(); };
}

// ---------- メニュー ----------
$('btn-menu').onclick = () => {
  openModal(`<h2>メニュー</h2>
    <button class="btn plain" id="m-help">遊び方</button>
    <button class="btn plain" id="m-title">タイトルへ（自動で保存されます）</button>
    <button class="btn plain" data-close>閉じる</button>`);
  $('m-help').onclick = showHelp;
  $('m-title').onclick = () => { closeModal(); showTitle(); };
};

modal.addEventListener('click', (e) => {
  const locked = !!modalBody.querySelector('[data-lock]');
  if ((e.target === modal && !locked) || e.target.closest('[data-close]')) closeModal();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showTitle();
