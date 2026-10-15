// ---------- 天下分け目の大合戦：画面 ----------
// 三つの翼が横一列ではなく、奥（左翼）・中（中央）・手前（右翼）の三段に並ぶ大きな戦場
const SEKI_Y = [118, 160, 204];
function sekiField(B) {
  const ca = CLANS[PLAYER].color, cd = CLANS[B.rival].color;
  const lane = (i) => {
    const y = SEKI_Y[i], sc = 0.8 + i * 0.12;
    const corps = (c, side) => {
      if (!c) return '';
      const n = clamp(Math.round(c.n / 300), 2, 8);
      const color = CLANS[c.clan].color;
      const x0 = side === 'a' ? 110 : 290, dir = side === 'a' ? -1 : 1;
      const sols = Array.from({ length: n }, (_, k) => `<g transform="translate(${x0 + dir * ((k % 4) * 13 + Math.floor(k / 4) * 6)},${(Math.floor(k / 4) * 9).toFixed(0)})"><g class="sol">${soldier(color, side === 'd')}</g></g>`).join('');
      const flag = `<g transform="translate(${x0 + dir * 62},-4)"><line y2="-34" stroke="#1c1a17" stroke-width="1.6"/><rect x="${side === 'a' ? 0 : -10}" y="-34" width="10" height="22" fill="${color}" stroke="#1c1a17" stroke-width="1"/></g>`;
      return `<g class="sk-corps ${side} ${c.broken ? 'broken' : ''}" id="sk-${side}${i}">${flag}${sols}</g>`;
    };
    return `<g class="sk-lane" transform="translate(0,${y}) scale(1,${sc.toFixed(2)})"><path d="M10,6 H390" stroke="#8d7550" stroke-width="1" opacity="0.5"/>
      ${corps(B.me[i], 'a')}${corps(B.foe[i], 'd')}<text class="sk-lname" x="8" y="-6">${SEKI_LANES[i]}</text></g>`;
  };
  return `<svg class="bf sk-field" viewBox="0 0 400 230" aria-hidden="true">
    <defs><pattern id="bf-kin" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#e3b94e"/><rect width="5" height="5" fill="#ecc660"/><rect x="5" y="5" width="5" height="5" fill="#d9ad3f"/></pattern>
      <linearGradient id="sk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa6b8"/><stop offset="1" stop-color="#e9dfc6"/></linearGradient></defs>
    <rect width="400" height="230" fill="url(#sk-sky)"/>
    <path d="M0,80 L50,52 L90,66 L140,40 L190,62 L240,44 L290,64 L340,46 L400,66 L400,96 L0,96Z" fill="#6f7a86" opacity="0.6"/>
    ${bfKinun('M-10,30 Q-4,14 16,18 Q26,4 48,10 Q64,0 84,10 Q104,4 116,16 Q132,14 130,28 Q110,38 84,32 Q60,40 36,32 Q14,38 -10,36 Z')}
    ${bfKinun('M260,40 Q262,26 282,28 Q292,16 312,22 Q330,12 348,22 Q372,18 372,32 Q356,44 330,38 Q306,46 284,40 Q266,46 260,40 Z')}
    <rect y="92" width="400" height="138" fill="#b9a273"/>
    <path d="M0,130 Q200,122 400,128 M0,176 Q200,168 400,174" stroke="#9c845a" stroke-width="1.4" fill="none"/>
    ${[0, 1, 2].map(lane).join('')}
    <g id="sk-fx"></g>
    <rect x="1.5" y="1.5" width="397" height="227" fill="none" stroke="#1c1a17" stroke-width="3"/>
  </svg>`;
}
function sekiLaneCards(s, B) {
  const card = (c) => {
    if (!c) return '<div class="sk-c empty">― 空き ―</div>';
    const g = c.gid && s.gens[c.gid];
    return `<div class="sk-c ${c.broken ? 'broken' : ''} ${c.turned ? 'turned' : ''}" style="--c:${CLANS[c.clan].color}">
      <b>${g ? esc(g.name) : '城兵'}</b><small>${MAP.byId[c.castle].short}${c.turned ? '・寝返り' : ''}</small>
      <div class="bar"><i style="width:${clamp((c.n / c.start) * 100, 0, 100)}%"></i></div><span>${c.broken ? '崩れた' : fmt(c.n)}</span></div>`;
  };
  return [0, 1, 2].map((i) => `<div class="sk-row"><em>${SEKI_LANES[i]}</em>${card(B.me[i])}<i>対</i>${card(B.foe[i])}</div>`).join('');
}

function showSeki(plan) {
  const B = sekiStart(S, plan);
  let box = $('seki');
  if (!box) { box = document.createElement('div'); box.id = 'seki'; box.className = 'seki'; document.body.appendChild(box); }
  let focus = 1, busy = false;
  const fieldName = `${MAP.byId[plan.field].short}の戦い`;
  box.innerHTML = `<div class="sk-wrap">
    <div class="sk-head"><div class="sk-title">天下分け目</div><div class="sk-sub">${esc(fieldName)}・${pName()} 対 ${CLANS[B.rival].name}</div></div>
    <div class="sk-fieldbox" id="sk-fieldbox">${sekiField(B)}</div>
    <div class="sk-morale"><span>${pShort()} 士気</span><div class="bar"><i id="sk-mm"></i></div><div class="bar foe"><i id="sk-mf"></i></div><span>${shortName(B.rival)} 士気</span></div>
    <div class="sk-lanes" id="sk-lanes"></div>
    <p class="sk-round" id="sk-round">両軍、布陣を終えた</p>
    <div class="b-report sk-report" id="sk-report"></div>
    <div class="sk-ctl" id="sk-ctl"></div>
  </div>`;
  box.hidden = false;
  Sound.horagai(); setTimeout(() => Sound.horagai(), 800);
  Sound.bgmStart('battle');
  const lord = lordOf(S);
  inkCut('天下分け目', fieldName, lord, lord ? '天下の行方、この一戦にあり！' : '');
  const paint = () => {
    $('sk-lanes').innerHTML = sekiLaneCards(S, B);
    $('sk-mm').style.width = `${B.morale.me}%`;
    $('sk-mf').style.width = `${B.morale.foe}%`;
  };
  const ctl = () => {
    if (B.over) return;
    const pc = sekiPlotChance(S, B, focus, 'me');
    $('sk-ctl').innerHTML = `<p class="sk-lbl">本陣の後詰めを送る翼</p>
      <div class="sk-focus">${[0, 1, 2].map((i) => `<button class="${i === focus ? 'on' : ''}" data-focus="${i}" ${B.me[i] && !B.me[i].broken ? '' : 'disabled'}>${SEKI_LANES[i]}</button>`).join('')}</div>
      <div class="sk-cmds">${Object.entries(SEKI_CMDS).map(([k, c]) => `<button class="btn ${k === 'sougakari' ? 'red' : ''}" data-sk="${k}"><b>${c.name}</b><small>${c.desc}</small></button>`).join('')}</div>
      <button class="btn plain" id="sk-plot" ${B.plotUsed.me || !pc ? 'disabled' : ''}>調略：敵の${SEKI_LANES[focus]}を寝返らせる<small class="sub">${B.plotUsed.me ? 'もう使った' : pc ? `見込み ${Math.round(pc * 100)}%（一度だけ）` : 'その翼に寝返る将はいない'}</small></button>`;
    $('sk-ctl').querySelectorAll('[data-focus]').forEach((b) => { b.onclick = () => { Sound.tap(); focus = +b.dataset.focus; ctl(); }; });
    $('sk-ctl').querySelectorAll('[data-sk]').forEach((b) => { b.onclick = () => { if (!busy) { Sound.tap(); round(b.dataset.sk); } }; });
    $('sk-plot').onclick = () => {
      if (busy) return;
      Sound.tap();
      const r = sekiPlot(S, B, focus, 'me');
      if (r.ok) {
        Sound.kiai();
        const cut = document.createElement('div'); cut.className = 'sk-cut'; cut.textContent = '寝 返 り'; $('sk-fieldbox').appendChild(cut);
        setTimeout(() => cut.remove(), 1600);
      }
      report([r.ok ? `🔥 敵の${SEKI_LANES[focus]}・${r.c.gid ? S.gens[r.c.gid].name : '軍勢'}が、わが方に寝返った！` : `調略は失敗した。${r.c && r.c.gid ? S.gens[r.c.gid].name : '敵将'}は首を縦に振らない`]);
      $('sk-fieldbox').innerHTML = sekiField(B);
      paint(); ctl();
    };
  };
  const report = (lines) => { $('sk-report').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join(''); };
  function round(cmd) {
    busy = true;
    $('sk-ctl').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const before = { me: B.me.map((c) => c && c.n), foe: B.foe.map((c) => c && c.n) };
    const r = sekiStep(S, B, cmd, focus);
    $('sk-round').textContent = `第 ${'一二三四五六七'[B.round - 1] || B.round} 合`;
    // 三つの翼で同時にぶつかる
    [0, 1, 2].forEach((i) => ['a', 'd'].forEach((sd) => { const el = document.getElementById(`sk-${sd}${i}`); if (el) { el.classList.remove('clash'); void el.getBoundingClientRect(); el.classList.add('clash'); } }));
    setTimeout(() => {
      const fx = $('sk-fx');
      if (fx) fx.innerHTML = [0, 1, 2].map((i) => `<g transform="translate(0,${SEKI_Y[i] - 182})">${meleeMarkup(200, r.dmg[i].toA, r.dmg[i].toD, 120, 280)}</g>`).join('');
      Sound.clash(0.02); setTimeout(() => Sound.clash(0), 140);
      replayShake();
      report(r.lines);
      $('sk-fieldbox').querySelectorAll('.sk-corps').forEach((el) => el.classList.remove('clash'));
      setTimeout(() => {
        $('sk-fieldbox').innerHTML = sekiField(B);
        paint();
        busy = false;
        if (B.over) finish(); else ctl();
      }, 900);
    }, 420);
    void before;
  }
  const replayShake = () => { box.classList.remove('shake'); void box.getBoundingClientRect(); box.classList.add('shake'); };
  function finish() {
    const log = sekiEnd(S, B);
    S.sekiPending = null;
    checkWin(S);
    save();
    Sound.bgmStop(0.5);
    const won = B.over === 'win';
    const stamp = document.createElement('div');
    stamp.className = `stamp go ${won ? 'win' : 'lose'}`;
    stamp.textContent = won ? '大勝' : '敗北';
    $('sk-fieldbox').appendChild(stamp);
    Sound.stamp(0.3);
    setTimeout(() => (won ? Sound.win() : Sound.lose()), 350);
    $('sk-round').textContent = won ? '天下分け目の戦い、わが方の大勝！' : '天下分け目の戦い、敗れる……';
    report([won ? `${CLANS[B.rival].name}の${(B.taken || []).length}城が${pName()}に降った！` : `${pShort()}の軍勢は退いた。だが、まだ終わりではない`, ...log]);
    $('sk-ctl').innerHTML = '<button class="btn red" id="sk-close">閉じる</button>';
    $('sk-close').onclick = () => {
      Sound.tap();
      box.hidden = true;
      Sound.bgmStart('map');
      render();
      if (won && lord) showKime(lord, '天下分け目、制す', `${CLANS[B.rival].name}、恐るるに足らず！ 天下はもう目の前だ`, null, 'laugh');
      if (S.result) showEnding();
    };
  }
  paint();
  ctl();
}

// 天下分け目を受けて立ったら、出来事が終わったあとで大合戦を始める
let sekiRunning = null;
const _skRender = render;
render = function (...a) {
  const r = _skRender.apply(this, a);
  if (S && S.sekiPending && sekiRunning !== S) {
    const tryStart = () => {
      if (!S || !S.sekiPending || sekiRunning === S) return;
      const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden || (S.pending && S.pending.length);
      if (busy) { setTimeout(tryStart, 1000); return; }
      sekiRunning = S; // 保存はしない（途中で閉じたら、次に開いたときにやり直す）
      const plan = S.sekiPending;
      showSeki(plan);
    };
    setTimeout(tryStart, 800);
  }
  return r;
};
