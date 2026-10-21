// ---------- 戦国の名場面（追加）：川中島・小田原・墨俣・厳島・三方ヶ原・大坂 ----------
Object.assign(MEIBA, {
  kawanakajima: { name: '川中島の激闘', sub: '宿敵と五度目の激突', desc: '宿敵の家と、五度目の刃を交えた' },
  odawara: { name: '小田原の陣', sub: '大軍で本拠を囲み落とす', desc: 'まわりの城をすべて押さえ、名門の本拠を落とした' },
  sunomata: { name: '墨俣の一夜城', sub: '奪ったその季に城下を整える', desc: '城を奪ったその季のうちに、施設を建てた' },
  itsukushima: { name: '厳島の奇襲', sub: '策をもって大軍を討つ', desc: '策の札を切り、大軍を打ち破った' },
  mikatagahara: { name: '三方ヶ原の教訓', sub: '大敗を胸に刻む', desc: '当主みずから率いた戦で敗れた。この悔しさを忘れまい' },
  osaka: { name: '大坂の陣', sub: '最後の大家、ここに滅ぶ', desc: '最後まで残った家を、ついに滅ぼした' },
});
const MEIBA2_LINES = {
  kawanakajima: (p, g) => `${CLANS[p.foe] ? CLANS[p.foe].name : '宿敵の家'}と五度目の激突。${g ? `${g.name}の統率が3上がった` : '因縁は深まるばかり'}`,
  odawara: (p) => `${MAP.byId[p.to] ? MAP.byId[p.to].name : ''}のまわりの城をすべて押さえ、本拠を落とした。金+300`,
  sunomata: (p) => `${MAP.byId[p.to] ? MAP.byId[p.to].name : ''}を奪ったその季に、城下を整えた。城の守り+0.2`,
  itsukushima: (p, g) => `策「${SAKU[p.k] ? SAKU[p.k].name : ''}」を切り、${fmt(p.d)}の大軍を${fmt(p.a)}の兵で討った。${g ? `${g.name}の知略が3上がった` : ''}`,
  mikatagahara: (p, g) => `${g ? g.name : '当主'}みずから率いた戦で大敗した。「この顔を、忘れるな」——当主の知略が3上がった`,
  osaka: (p) => `${CLANS[p.foe] ? CLANS[p.foe].name : '最後の家'}が滅んだ。天下に、${pName()}に並ぶ家はもうない。全家臣の忠誠+5`,
};

// 名場面を拾う
const _m2Record = recordBattle;
recordBattle = function (s, r) {
  const capBefore = r.won && r.defender !== 'none' && CLANS[r.defender] ? castlesOf(s, r.defender).length : null;
  _m2Record(s, r);
  const g = s.gens[r.gid];
  // 川中島：宿敵の家と五度目の合戦
  if (s.nemesis && ((r.attacker === PLAYER && r.defender === s.nemesis) || (r.defender === PLAYER && r.attacker === s.nemesis))) {
    s.nemClash = (s.nemClash || 0) + 1;
    if (s.nemClash === 5) { const mg = r.attacker === PLAYER ? g : r.dgid && s.gens[r.dgid]; if (meibaHit(s, 'kawanakajima', { gid: mg && mg.id, foe: s.nemesis }) && mg) mg.str = Math.min(99, mg.str + 3); }
  }
  if (r.attacker === PLAYER && r.won) {
    s.capTurn = s.capTurn || {};
    s.capTurn[r.to] = s.turn;
    // 小田原：となりの城を三つ以上押さえて、本拠を落とす
    if (isCapital(r.to, r.defender) && MAP.adj[r.to].filter((n) => s.castles[n].owner === PLAYER).length >= 3) { if (meibaHit(s, 'odawara', { gid: r.gid, to: r.to, foe: r.defender })) s.gold[PLAYER] += 300; }
    // 大坂：最後に残った家を、自分の手で滅ぼす
    if (capBefore && !castlesOf(s, r.defender).length && !aiClans().some((k) => castlesOf(s, k).length)) {
      if (meibaHit(s, 'osaka', { gid: r.gid, foe: r.defender })) gensOf(s, PLAYER).forEach((x) => changeLoyal(x, 5));
    }
  }
  // 三方ヶ原：当主みずから率いて敗れる
  const myCmd = r.attacker === PLAYER ? g : r.defender === PLAYER && r.dgid ? s.gens[r.dgid] : null;
  const lost = (r.attacker === PLAYER && !r.won) || (r.defender === PLAYER && r.won);
  if (myCmd && myCmd.lord && lost && meibaHit(s, 'mikatagahara', { gid: myCmd.id, to: r.to })) myCmd.int = Math.min(99, myCmd.int + 3);
};
// 厳島：策の札を切って、大軍を討つ（札を使った合戦の結末で）
const _m2End = endBattle;
endBattle = function (s, B, log) {
  const res = _m2End(s, B, log);
  if (B.saku && B.saku.side === 'a' && B.attacker === PLAYER && res.won && ['yodo', 'yashu', 'hiya'].includes(B.saku.k) && B.rounds[0].d > B.rounds[0].a) {
    const g = s.gens[B.gid];
    if (meibaHit(s, 'itsukushima', { gid: B.gid, k: B.saku.k, a: B.rounds[0].a, d: B.rounds[0].d }) && g) g.int = Math.min(99, g.int + 3);
  }
  return res;
};
// 墨俣：奪ったその季に、施設を建てる
const _m2Build = build;
build = function (s, id, f, g) {
  _m2Build(s, id, f, g);
  if (s.castles[id].owner === PLAYER && s.capTurn && s.capTurn[id] === s.turn && meibaHit(s, 'sunomata', { gid: g && g.id, to: id })) {
    s.castles[id].def = Math.min(RULES.defCap, Math.round((s.castles[id].def + 0.2) * 10) / 10);
  }
};

// ---------- 名場面の絵と一言（画面） ----------
function meiba2Art(id, p) {
  const K = '#1c1a17', me = CLANS[PLAYER].color, foe = p.foe && CLANS[p.foe] ? CLANS[p.foe].color : '#6f6a60';
  const flags = (n, x0, y, col, dx) => Array.from({ length: n }, (_, i) => { const x = x0 + i * dx, h = 30 + (i % 3) * 6; return `<path d="M${x},${y} V${y - h}" stroke="${K}" stroke-width="2"/><rect x="${x}" y="${y - h}" width="11" height="18" fill="${col}" stroke="${K}" stroke-width="1.2"/>`; }).join('');
  let b = '';
  if (id === 'kawanakajima') {
    b = `<rect width="340" height="200" fill="#c9d3dc"/><rect y="110" width="340" height="90" fill="#7d8a6a"/>
      <path d="M150,110 Q170,150 160,200 L190,200 Q200,150 185,110Z" fill="#6f9fc9" stroke="${K}" stroke-width="2"/>
      ${flags(5, 30, 150, me, 22)}${flags(5, 212, 150, foe, 22)}
      <rect width="340" height="70" fill="#fff" opacity="0.45"/><rect y="70" width="340" height="30" fill="#fff" opacity="0.25"/>`;
  } else if (id === 'odawara') {
    b = `<rect width="340" height="200" fill="#e8c27a"/><rect y="130" width="340" height="70" fill="#9a8a5a"/>
      <g transform="translate(170,120) scale(2.4)" class="zk-castle" style="--c:${foe}">${castleMarkup(true)}</g>
      ${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, x = 170 + Math.cos(a) * 140, y = 150 + Math.sin(a) * 40; return `<path d="M${x.toFixed(0)},${y.toFixed(0)} v-26" stroke="${K}" stroke-width="2"/><rect x="${x.toFixed(0)}" y="${(y - 26).toFixed(0)}" width="10" height="16" fill="${me}" stroke="${K}" stroke-width="1"/>`; }).join('')}`;
  } else if (id === 'sunomata') {
    b = `<rect width="340" height="200" fill="#1f2a44"/><circle cx="280" cy="40" r="18" fill="#f6f1d8"/>
      <rect y="150" width="340" height="50" fill="#2c4a6a"/><path d="M0,160 q40,-8 80,0 t80,0 t80,0 t80,0 t80,0" stroke="#9fc8e8" stroke-width="2" fill="none" opacity="0.6"/>
      <g transform="translate(150,148) scale(2.2)" class="zk-castle" style="--c:${me}">${castleMarkup(false)}</g>
      <g stroke="#c9a26a" stroke-width="2.5">${[100, 120, 180, 200].map((x) => `<line x1="${x}" y1="150" x2="${x}" y2="70"/>`).join('')}<line x1="96" y1="90" x2="204" y2="90"/><line x1="96" y1="120" x2="204" y2="120"/></g>`;
  } else if (id === 'itsukushima') {
    b = `<rect width="340" height="200" fill="#e9e3d0"/><rect y="110" width="340" height="90" fill="#3c6aa3"/>
      <g transform="translate(220,150)"><rect x="-40" y="-60" width="10" height="64" fill="#c8372d" stroke="${K}" stroke-width="2"/><rect x="30" y="-60" width="10" height="64" fill="#c8372d" stroke="${K}" stroke-width="2"/>
        <path d="M-56,-62 Q0,-74 56,-62 L52,-54 Q0,-64 -52,-54Z" fill="#1c1a17"/><rect x="-46" y="-50" width="92" height="6" fill="#c8372d" stroke="${K}" stroke-width="1.5"/></g>
      ${[40, 90, 130].map((x, i) => `<g transform="translate(${x},${150 + i * 8})"><path d="M-22,0 h44 l-6,8 h-32z" fill="#5a3a22" stroke="${K}" stroke-width="1.5"/><path d="M0,0 V-26" stroke="${K}" stroke-width="2"/><rect x="0" y="-26" width="12" height="16" fill="${me}" stroke="${K}" stroke-width="1"/></g>`).join('')}`;
  } else if (id === 'mikatagahara') {
    b = `<rect width="340" height="200" fill="#d9dee5"/><rect y="120" width="340" height="80" fill="#f4f7fa"/>
      ${Array.from({ length: 7 }, (_, i) => `<g transform="translate(${50 + i * 38},${150 + (i % 2) * 10}) rotate(${-70 + i * 12})"><path d="M0,0 v-30" stroke="${K}" stroke-width="2"/><rect y="-30" width="10" height="16" fill="${me}" stroke="${K}" stroke-width="1" opacity="0.7"/></g>`).join('')}
      <g transform="translate(250,110) scale(1.8)">${soldier(me, true, 'kiba')}</g>
      <g fill="#fff">${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 41) % 340}" cy="${(i * 29) % 120}" r="1.6"/>`).join('')}</g>`;
  } else if (id === 'osaka') {
    b = `<rect width="340" height="200" fill="#2a1414"/><rect y="0" width="340" height="40" fill="url(#bf-kin)" opacity="0.6"/>
      <g transform="translate(170,150) scale(3)" class="zk-castle" style="--c:${foe}">${castleMarkup(true)}</g>
      <path d="M130,60 Q140,30 150,50 Q160,20 172,46 Q184,24 192,56 Q204,36 210,62Z" fill="#ff8a2a"/><path d="M146,62 Q156,42 166,58 Q176,38 186,62Z" fill="#ffd34a"/>
      ${flags(6, 20, 196, me, 14)}${flags(6, 250, 196, me, 14)}`;
  }
  return `<svg viewBox="0 0 340 200" class="mb-art" aria-hidden="true"><defs><pattern id="bf-kin" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#e3b94e"/><rect width="5" height="5" fill="#ecc660"/></pattern></defs>${b}<rect x="2" y="2" width="336" height="196" fill="none" stroke="${K}" stroke-width="4"/></svg>`;
}
const _m2Art = meibaArt;
meibaArt = function (id, p) { return MEIBA2_LINES[id] ? meiba2Art(id, p) : _m2Art(id, p); };
const _m2Show = showMeiba;
showMeiba = function (m) {
  _m2Show(m);
  if (MEIBA2_LINES[m.id]) { const el = document.querySelector('#meiba .mb-line'); const p = m.p || {}; if (el) el.textContent = MEIBA2_LINES[m.id](p, p.gid && S.gens[p.gid]); }
};
