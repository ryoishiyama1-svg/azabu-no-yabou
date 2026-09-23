// 画面の表示と操作
const SAVE_KEY = 'azabu-save-v1';
const PLAYER = 'azabu';
const SVGNS = 'http://www.w3.org/2000/svg';
const SEASON_WORDS = ['桜 舞 う', '青 葉 茂 る', '紅 葉 燃 ゆ', '雪 降 り 積 む'];

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
let CELLS = null;

// ---------- 保存 ----------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const clanChip = (k) => `<span class="chip" style="--c:${CLANS[k].color}">${crestBadge(k, 18)}${CLANS[k].name}</span>`;

function openModal(html) { modalBody.innerHTML = html; modal.hidden = false; modalBody.scrollTop = 0; }
function closeModal() { modal.hidden = true; }

// ---------- 舞い散るもの ----------
function petals(el, season, count) {
  el.className = `petals s${season}`;
  el.innerHTML = Array.from({ length: count }, () => {
    const left = Math.random() * 100, dur = 7 + Math.random() * 7, delay = -Math.random() * 14;
    const size = 0.7 + Math.random() * 0.6;
    return `<i style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;transform:scale(${size})"></i>`;
  }).join('');
}

// ---------- タイトル ----------
$('title-art').innerHTML = titleArt();
$('title-crest').innerHTML = crestBadge(PLAYER, 84);
petals($('title-petals'), 0, 18);

function showTitle() {
  $('game').hidden = true;
  $('title').hidden = false;
  const saved = load();
  const canResume = saved && !saved.result;
  $('btn-resume').hidden = !canResume;
  $('btn-resume').className = 'btn fuda red';
  $('btn-new').className = canResume ? 'btn fuda' : 'btn fuda red';
}

$('btn-new').onclick = () => {
  Sound.unlock();
  const saved = load();
  if (saved && !saved.result && !confirm('今の戦いを捨てて、最初からはじめますか？')) return;
  S = newGame();
  save();
  startGame(true);
};
$('btn-resume').onclick = () => { Sound.unlock(); Sound.tap(); S = load(); startGame(false); };
$('btn-help').onclick = () => { Sound.unlock(); Sound.tap(); showHelp(); };

function startGame(isNew) {
  $('title').hidden = true;
  $('game').hidden = false;
  selected = null;
  mode = null;
  drawMap();
  render();
  centerOn(PLAYER);
  if (isNew) {
    Sound.horagai();
    openModal(`<h2>天下統一への第一歩</h2>
      <p style="text-align:center">${crestBadge(PLAYER, 64)}</p>
      <p>時は${dateLabel(0)}。<b>麻布家</b>は元麻布の地に旗を揚げた。</p>
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
    <h3>操作</h3>
    <p>地図は指でスクロール、2本指でつまんで拡大・縮小できます。</p>
    <p class="hint">※実在の学校名を使ったフィクションです。能力値や家紋はすべて架空です。</p>
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
  CELLS = CELLS || buildCells();
  svg.setAttribute('viewBox', `0 0 ${MAP.width} ${MAP.height}`);
  svg.innerHTML = `<defs>
      <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a4a52" stop-opacity="0.55"/><stop offset="1" stop-color="#4a4a52" stop-opacity="0"/>
      </linearGradient>
      <pattern id="waves" width="36" height="18" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#e8f1f6" stroke-opacity="0.55" stroke-width="1.2">
          <path d="M0,18 A18,18 0 0,1 36,18 M6,18 A12,12 0 0,1 30,18 M12,18 A6,6 0 0,1 24,18"/>
          <path d="M-18,9 A18,18 0 0,1 18,9 M18,9 A18,18 0 0,1 54,9" stroke-opacity="0.3"/>
        </g>
      </pattern>
    </defs>
    <g>${sceneryMarkup()}</g>
    <g id="territory">${MAP.nodes.map((n) => `<path class="cell" data-id="${n.id}" d="${CELLS[n.id]}"/>`).join('')}</g>
    <g id="roads"></g>
    <g id="castles"></g>`;
  applyScale();

  const roads = $('roads');
  MAP.edges.forEach(([a, b]) => {
    const A = MAP.byId[a], B = MAP.byId[b];
    el('line', { class: 'road', x1: A.x, y1: A.y + 8, x2: B.x, y2: B.y + 8, 'data-a': a, 'data-b': b }, roads);
  });

  const layer = $('castles');
  MAP.nodes
    .slice()
    .sort((a, b) => a.y - b.y) // 手前の城を上に重ねる
    .forEach((n) => {
      const g = el('g', { class: 'castle', 'data-id': n.id, transform: `translate(${n.x},${n.y})` }, layer);
      const w = n.short.length * 12 + 12;
      g.innerHTML = `
        <circle class="hit" r="34" cy="8"/>
        <ellipse class="ring" cx="0" cy="14" rx="27" ry="10"/>
        <g class="keep">${castleMarkup(n.clan !== 'none')}</g>
        <g class="plate" transform="translate(0,27)">
          <rect x="${-w / 2}" y="-8.5" width="${w}" height="17" rx="3"/>
          <text>${n.short}</text>
        </g>
        <text class="troops" y="48"></text>`;
      g.addEventListener('click', () => onCastleTap(n.id));
    });
}

function applyScale() {
  svg.setAttribute('width', Math.round(MAP.width * scale));
  svg.setAttribute('height', Math.round(MAP.height * scale));
}

function zoomAt(newScale, cxScreen, cyScreen) {
  const rect = mapwrap.getBoundingClientRect();
  const sx = cxScreen === undefined ? mapwrap.clientWidth / 2 : cxScreen - rect.left;
  const sy = cyScreen === undefined ? mapwrap.clientHeight / 2 : cyScreen - rect.top;
  const mx = (mapwrap.scrollLeft + sx) / scale;
  const my = (mapwrap.scrollTop + sy) / scale;
  scale = Math.min(1.8, Math.max(0.4, newScale));
  applyScale();
  mapwrap.scrollLeft = mx * scale - sx;
  mapwrap.scrollTop = my * scale - sy;
}

function centerOn(id) {
  const n = MAP.byId[id];
  mapwrap.scrollLeft = n.x * scale - mapwrap.clientWidth / 2;
  mapwrap.scrollTop = n.y * scale - mapwrap.clientHeight / 2;
}

$('zoom-in').onclick = () => { Sound.tap(); zoomAt(scale * 1.25); };
$('zoom-out').onclick = () => { Sound.tap(); zoomAt(scale * 0.8); };
$('zoom-home').onclick = () => {
  Sound.tap();
  const mine = castlesOf(S, PLAYER);
  centerOn(selected && S.castles[selected].owner === PLAYER ? selected : mine.includes('azabu') ? 'azabu' : mine[0]);
};

// 2本指でつまんで拡大・縮小
(() => {
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  mapwrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches), s: scale };
  }, { passive: true });
  mapwrap.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [cx, cy] = mid(e.touches);
    zoomAt(pinch.s * (dist(e.touches) / pinch.d), cx, cy);
  }, { passive: false });
  mapwrap.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });
  // Safari のページ全体の拡大を止める
  ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
})();

// ---------- 表示の更新 ----------
function render() {
  const mine = castlesOf(S, PLAYER);
  $('hud-crest').innerHTML = crestBadge(PLAYER, 30);
  $('hud-date').textContent = dateLabel(S.turn);
  $('hud-gold').textContent = fmt(S.gold[PLAYER]);
  $('hud-castles').textContent = `${mine.length}/${MAP.nodes.length}`;
  $('btn-sound').textContent = Sound.on ? '♪' : '✕';
  petals($('map-petals'), S.turn % 4, 12);

  document.querySelectorAll('#territory .cell').forEach((p) => {
    const owner = S.castles[p.dataset.id].owner;
    p.setAttribute('fill', owner === 'none' ? 'transparent' : CLANS[owner].color);
  });

  const targets = modeTargets();
  document.querySelectorAll('#map .castle').forEach((g) => {
    const id = g.dataset.id;
    const c = S.castles[id];
    g.style.setProperty('--c', CLANS[c.owner].color);
    g.querySelector('.troops').textContent = fmt(c.troops);
    g.classList.toggle('acted', c.owner === PLAYER && !!S.acted[id]);
    g.classList.toggle('selected', id === selected);
    const ring = g.querySelector('.ring');
    ring.setAttribute('class', 'ring ' + (targets.includes(id) ? (mode.kind === 'attack' ? 'target' : 'friend') : id === selected ? 'sel' : ''));
  });

  document.querySelectorAll('#map .road').forEach((l) => {
    const a = l.dataset.a, b = l.dataset.b;
    const hot = mode && ((a === mode.from && targets.includes(b)) || (b === mode.from && targets.includes(a)));
    const lit = !mode && selected && (a === selected || b === selected);
    l.setAttribute('class', 'road' + (hot ? ' hot' : lit ? ' lit' : ''));
  });

  const banner = $('mode-banner');
  if (mode) {
    banner.hidden = false;
    banner.innerHTML = `<span>${mode.kind === 'attack' ? '⚔ 攻める城を選べ' : '🐎 兵を送る城を選べ'}</span><button id="mode-cancel">やめる</button>`;
    $('mode-cancel').onclick = () => { Sound.tap(); mode = null; render(); };
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
  if (!selected) {
    const counts = Object.keys(CLANS)
      .map((k) => [k, castlesOf(S, k).length])
      .filter(([, n]) => n > 0)
      .sort((a, b) => (a[0] === PLAYER ? -1 : b[0] === PLAYER ? 1 : b[1] - a[1]));
    const idle = castlesOf(S, PLAYER).filter((id) => !S.acted[id]).length;
    panel.innerHTML = `<div class="council">
      <h2>軍議</h2>
      <p class="hint">城をタップして命令を出しましょう。まだ命令していない城：<b>${idle}</b></p>
      <div class="clan-list">${counts.map(([k, n]) => `<span class="chip" style="--c:${CLANS[k].color}">${crestBadge(k, 18)}${CLANS[k].name} ${n}</span>`).join('')}</div>
      <button class="btn red end-btn" id="btn-end">ターン終了</button></div>`;
    $('btn-end').onclick = onEndTurn;
    return;
  }
  const n = MAP.byId[selected];
  const c = S.castles[selected];
  const own = c.owner === PLAYER;
  const head = `<div class="p-head">${crestBadge(c.owner, 30)}<h2>${n.name}</h2><span class="p-sub">${n.ward}</span></div>
    <div class="stats">
      <div class="stat"><span class="n">${fmt(c.troops)}</span><span class="l">兵 力</span></div>
      <div class="stat"><span class="n">${c.def.toFixed(1)}</span><span class="l">防 御</span></div>
      <div class="stat"><span class="n">${c.eco}</span><span class="l">経 済</span></div>
    </div>`;
  let body;
  if (own) {
    const done = !!S.acted[selected];
    const dis = (ok) => (done || !ok ? 'disabled' : '');
    body = `${done ? '<p class="hint">この城は今季、命令ずみです。</p>' : ''}
      <div class="cmds">
        <button class="btn red" id="c-attack" ${dis(enemyNeighbors(S, selected).length && c.troops > 0)}><span class="k">攻</span>出陣<small>敵城を攻める</small></button>
        <button class="btn" id="c-move" ${dis(ownNeighbors(S, selected).length && c.troops > 0)}><span class="k">送</span>輸送<small>兵を送る</small></button>
        <button class="btn" id="c-recruit" ${dis(canRecruit(S, selected))}><span class="k">兵</span>徴兵<small>金${RULES.recruitCost}</small></button>
        <button class="btn" id="c-develop" ${dis(canDevelop(S, selected))}><span class="k">商</span>開発<small>金${RULES.developCost}</small></button>
        <button class="btn" id="c-fortify" ${dis(canFortify(S, selected))}><span class="k">城</span>築城<small>金${RULES.fortifyCost}</small></button>
        <button class="btn plain" id="c-close">閉じる<small>&nbsp;</small></button>
      </div>`;
  } else {
    const srcs = attackSources(selected);
    body = `<div class="p-head" style="margin:-2px 0 8px">${clanChip(c.owner)}</div>
      <div class="cmds">
        <button class="btn red wide" id="c-strike" ${srcs.length ? '' : 'disabled'}><span class="k">攻</span>この城を攻める<small>${srcs.length ? 'となりの城から出陣できます' : 'となりに命令できる麻布家の城がありません'}</small></button>
        <button class="btn plain wide" id="c-close">閉じる</button>
      </div>`;
  }
  panel.innerHTML = head + body;
  bindPanel();
}

function act(fn) {
  Sound.tap();
  fn(S, selected);
  S.acted[selected] = true;
  save();
  render();
}

function bindPanel() {
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('c-close', () => { Sound.tap(); selected = null; render(); });
  on('c-attack', () => { Sound.taiko(0, 0.6); mode = { kind: 'attack', from: selected }; render(); });
  on('c-move', () => { Sound.tap(); mode = { kind: 'move', from: selected }; render(); });
  on('c-recruit', () => act(recruit));
  on('c-develop', () => act(develop));
  on('c-fortify', () => act(fortify));
  on('c-strike', () => { Sound.tap(); openAttack(null, selected); });
}

// ---------- タップ ----------
function onCastleTap(id) {
  Sound.unlock();
  Sound.tap();
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
    const odds = ratio >= 1.3 ? ['勝算大', '#2e7d32'] : ratio >= 1.1 ? ['勝算あり', '#8a6d00'] : ratio >= 0.9 ? ['五分五分', '#b35c00'] : ['勝ち目うすし', '#b8262f'];
    $('amt-v').textContent = fmt(amount);
    $('odds').textContent = odds[0];
    $('odds').style.color = odds[1];
  }

  function draw() {
    const max = S.castles[src].troops;
    amount = Math.min(max, Math.round((max * 0.8) / 10) * 10 || max);
    openModal(`<h2>${MAP.byId[to].name} 攻め</h2>
      <p style="text-align:center;margin:0 0 8px">${clanChip(t.owner)}<br>守備 <b>${fmt(t.troops)}</b> 兵 × 防御 <b>${t.def.toFixed(1)}</b></p>
      <h3>出陣する城</h3>
      <div class="src-list">${srcs.map((id) =>
        `<button data-src="${id}" class="${id === src ? 'on' : ''}"><span>${MAP.byId[id].name}</span><span>兵 ${fmt(S.castles[id].troops)}</span></button>`).join('')}</div>
      <h3>出陣する兵</h3>
      <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v"></b></div>
      <p class="odds" id="odds"></p>
      <button class="btn red" id="go">出 陣 ！</button>
      <button class="btn plain" data-close>やめる</button>`);
    document.querySelectorAll('[data-src]').forEach((b) => { b.onclick = () => { Sound.tap(); src = b.dataset.src; draw(); }; });
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
      closeModal();
      render();
      playBattle(r);
    };
  }
  draw();
}

function noboriFlags(clan, n) {
  const c = CLANS[clan];
  const ch = c.name.replace('家', '').slice(0, 3);
  return Array.from({ length: n }, () =>
    `<div class="nobori" style="--c:${c.color}">${crestBadge(clan, 26)}<span>${ch}</span></div>`).join('');
}

function playBattle(r) {
  const box = $('battle');
  const a0 = r.rounds[0].a, d0 = r.rounds[0].d;
  const atkN = a0 > 2000 ? 3 : a0 > 800 ? 2 : 1;
  const defN = d0 > 2000 ? 2 : 1;
  box.innerHTML = `
    <div class="b-head"><div class="b-title">合 戦</div><div class="b-sub">${MAP.byId[r.to].name}の戦い</div></div>
    <div class="b-field">
      <div class="army left" id="army-a">${noboriFlags(r.attacker, atkN)}</div>
      <div class="spark" id="spark"></div>
      <div class="army right" id="army-d">
        <div class="b-castle" style="--c:${CLANS[r.defender].color}"><svg viewBox="-30 -30 60 50">${castleMarkup(false)}</svg></div>
        ${noboriFlags(r.defender, defN)}
      </div>
      <div class="stamp" id="stamp"></div>
    </div>
    <div class="b-bars">
      <div class="b-side left" style="--c:${CLANS[r.attacker].color}">
        <div class="who">${crestBadge(r.attacker, 20)}${MAP.byId[r.from].short}</div>
        <div class="bar"><i id="bar-a" style="width:100%"></i></div>
        <span class="num" id="num-a">${fmt(a0)}</span>
      </div>
      <div class="b-side right" style="--c:${CLANS[r.defender].color}">
        <div class="who">${MAP.byId[r.to].short}${crestBadge(r.defender, 20)}</div>
        <div class="bar"><i id="bar-d" style="width:100%"></i></div>
        <span class="num" id="num-d">${fmt(d0)}</span>
      </div>
    </div>
    <p class="b-round" id="round">いざ、尋常に勝負！</p>
    <p class="b-msg" id="bmsg"></p>
    <button class="btn plain" id="skip">結果を見る</button>`;
  box.hidden = false;
  Sound.horagai();

  const show = (i) => {
    const { a, d } = r.rounds[i];
    $('bar-a').style.width = `${(a / a0) * 100}%`;
    $('bar-d').style.width = `${(d / Math.max(1, d0)) * 100}%`;
    $('num-a').textContent = fmt(a);
    $('num-d').textContent = fmt(d);
  };

  let i = 0;
  let timer;
  const step = () => {
    i++;
    if (i >= r.rounds.length) return finish();
    const A = $('army-a'), D = $('army-d'), sp = $('spark');
    [A, D].forEach((x) => x.classList.add('lunge'));
    sp.classList.remove('go'); void sp.offsetWidth; sp.classList.add('go');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    Sound.taiko(0, 0.9);
    Sound.clash(0.05);
    setTimeout(() => [A, D].forEach((x) => x.classList.remove('lunge')), 200);
    show(i);
    $('round').textContent = `第 ${'一二三四五六'[i - 1]} 合`;
    timer = setTimeout(step, 750);
  };
  timer = setTimeout(step, 1300);

  function finish() {
    clearTimeout(timer);
    show(r.rounds.length - 1);
    const stamp = $('stamp');
    stamp.textContent = r.won ? '落城' : '撤退';
    stamp.className = 'stamp go ' + (r.won ? 'win' : 'lose');
    $(r.won ? 'army-d' : 'army-a').classList.add('fallen');
    $('round').textContent = r.won ? `${MAP.byId[r.to].short}、落城！` : '攻略ならず…';
    let msg = r.won ? `残った ${fmt(r.left)} 兵が入城した` : `残った ${fmt(r.left)} 兵は ${MAP.byId[r.from].short} へ退いた`;
    if (r.won && r.defender !== 'none' && castlesOf(S, r.defender).length === 0) msg += `。${CLANS[r.defender].name}は滅亡した！`;
    $('bmsg').textContent = msg;
    if (r.won) Sound.win(); else Sound.lose();
    const btn = $('skip');
    btn.textContent = '閉じる';
    btn.className = 'btn red';
    btn.onclick = () => { Sound.tap(); box.hidden = true; if (S.result) showEnding(); };
  }
  $('skip').onclick = finish;
}

// ---------- 輸送 ----------
function openMove(from, to) {
  const max = S.castles[from].troops;
  let amount = Math.round(max / 2 / 10) * 10 || max;
  openModal(`<h2>輸 送</h2>
    <p style="text-align:center">${MAP.byId[from].name} → ${MAP.byId[to].name}</p>
    <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v">${fmt(amount)}</b></div>
    <button class="btn red" id="go">送 る</button>
    <button class="btn plain" data-close>やめる</button>`);
  $('amt').oninput = (e) => { amount = +e.target.value; $('amt-v').textContent = fmt(amount); };
  $('go').onclick = () => {
    Sound.tap();
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
function showSeason(turn, then) {
  const box = $('season');
  box.className = `s${turn % 4}`;
  $('season-year').textContent = `${2026 + Math.floor(turn / 4)}年`;
  $('season-kanji').textContent = SEASONS[turn % 4];
  $('season-word').textContent = SEASON_WORDS[turn % 4];
  box.hidden = false;
  // アニメーションをやり直す
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  const k = $('season-kanji');
  k.style.animation = 'none'; void k.offsetWidth; k.style.animation = '';
  Sound.season();
  setTimeout(() => { box.hidden = true; then(); }, 1900);
}

function onEndTurn() {
  Sound.unlock();
  selected = null;
  mode = null;
  const before = S.gold[PLAYER];
  const log = endTurn(S);
  save();
  render();
  const gain = S.gold[PLAYER] - before;
  showSeason(S.turn, () => {
    openModal(`<h2 data-lock>諸国の動き</h2>
      <ul class="log">${log.length ? log.map((l) => `<li>${l}</li>`).join('') : '<li>諸国に大きな動きはなかった。</li>'}</ul>
      <p>💰 麻布家の収入：<b>+${fmt(gain)}</b></p>
      <button class="btn red" id="ok">承 知</button>`);
    $('ok').onclick = () => { Sound.tap(); closeModal(); if (S.result) showEnding(); };
  });
}

function showEnding() {
  const win = S.result === 'win';
  if (win) Sound.win(); else Sound.lose();
  openModal(`<div class="ending ${win ? 'win' : 'lose'}" data-lock>
      ${crestBadge(PLAYER, 72)}
      <div class="big">${win ? '天下統一' : '落 日'}</div>
      <p>${win
        ? `${dateLabel(S.turn)}、麻布家は都内${MAP.nodes.length}校をすべて制覇した！`
        : `${dateLabel(S.turn)}、麻布家の城はすべて奪われた…`}</p>
    </div>
    <button class="btn red" id="again">もう一度</button>
    <button class="btn plain" id="to-title">タイトルへ</button>`);
  $('again').onclick = () => { clearSave(); S = newGame(); save(); closeModal(); startGame(true); };
  $('to-title').onclick = () => { clearSave(); closeModal(); showTitle(); };
}

// ---------- メニュー・音 ----------
$('btn-menu').onclick = () => {
  Sound.tap();
  openModal(`<h2>目 録</h2>
    <button class="btn plain" id="m-help">遊び方</button>
    <button class="btn plain" id="m-title">タイトルへ（自動で保存されます）</button>
    <button class="btn plain" data-close>閉じる</button>`);
  $('m-help').onclick = showHelp;
  $('m-title').onclick = () => { closeModal(); showTitle(); };
};
$('btn-sound').onclick = () => { Sound.toggle(); $('btn-sound').textContent = Sound.on ? '♪' : '✕'; };

modal.addEventListener('click', (e) => {
  const locked = !!modalBody.querySelector('[data-lock]');
  if ((e.target === modal && !locked) || e.target.closest('[data-close]')) {
    if (e.target.closest('[data-close]')) Sound.tap();
    closeModal();
  }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showTitle();
