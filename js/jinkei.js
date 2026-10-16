// ---------- 陣形 ----------
// 合戦のはじめに陣を立てる。六つの陣形は、それぞれ一つに強く一つに弱い（鋒矢→方円→雁行→偃月→魚鱗→鶴翼→鋒矢）
// 有利な陣形どうしなら、攻める力が増し、相手は崩れやすい。陣形ごとの持ち味は命令とも噛み合う
// B.form = { a, d }（陣形のキー）。B.formRead = こちらから見えた相手の陣形
const JINKEI = {
  hoshi: { name: '鋒矢', kana: 'ほうし', beats: 'houen', desc: '矢じりの陣。突撃が鋭いが、受ける損害も増える', out: 1.08, in: 1.06, cmd: { charge: 1.15 } },
  houen: { name: '方円', kana: 'ほうえん', beats: 'gankou', desc: '円く固める陣。守りが堅く、崩れにくい', out: 0.92, in: 0.86, cmd: { guard: 0.85 }, morale: 3 },
  gankou: { name: '雁行', kana: 'がんこう', beats: 'engetsu', desc: '斜めに連なる陣。矢と計略が冴える', out: 1.0, in: 1.0, cmd: { scheme: 1.4, attack: 1.06 } },
  engetsu: { name: '偃月', kana: 'えんげつ', beats: 'gyorin', desc: '大将が先頭に立つ陣。士気が高く、一騎打ちが起きやすい', out: 1.04, in: 1.02, morale: 6, duel: true },
  gyorin: { name: '魚鱗', kana: 'ぎょりん', beats: 'kakuyoku', desc: '鱗の重なる陣。中央を押し破る、攻めの基本', out: 1.06, in: 0.98, cmd: { attack: 1.08 } },
  kakuyoku: { name: '鶴翼', kana: 'かくよく', beats: 'hoshi', desc: '翼を広げて包む陣。数で勝るとき、さらに強い', out: 1.02, in: 1.0, wide: true },
};
const JINKEI_EDGE = { out: 1.11, in: 0.95, morale: 6 }; // 相性で有利なとき

// 相性：1 = a が有利、-1 = d が有利、0 = 互角
const jinkeiEdge = (a, d) => (!a || !d ? 0 : JINKEI[a].beats === d ? 1 : JINKEI[d].beats === a ? -1 : 0);

// 他家（とおまかせ）の陣形：大将の得意と、兵の多さから
function aiJinkei(s, B, side) {
  const g = s.gens[side === 'a' ? B.gid : B.dgid];
  const me = B[side], foe = B[side === 'a' ? 'd' : 'a'];
  const w = { hoshi: 1, houen: 1, gankou: 1, engetsu: 1, gyorin: 1.4, kakuyoku: 1 };
  if (g) {
    if (g.str >= 70) { w.hoshi += 1; w.engetsu += 0.8; }
    if (g.int >= 70) { w.gankou += 1.2; w.kakuyoku += 0.6; }
    if (g.cha >= 70) w.engetsu += 0.6;
  }
  if (side === 'd') w.houen += 1.2;
  if (me.troops > foe.troops * 1.3) w.kakuyoku += 1.5;
  if (me.troops < foe.troops * 0.8) w.houen += 1;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  return Object.keys(w).find((k) => (r -= w[k]) <= 0) || 'gyorin';
}
// 物見：大将の知略しだいで、相手の陣形が見える（'clear' / 'guess'（たまに外れる）/ 'none'）
function jinkeiScout(s, B, side) {
  const me = s.gens[side === 'a' ? B.gid : B.dgid], foe = s.gens[side === 'a' ? B.dgid : B.gid];
  const foeK = B.form[side === 'a' ? 'd' : 'a'];
  const mi = me ? me.int : 40, fi = foe ? foe.int : 40;
  if (mi >= fi + 8 || Math.random() < 0.2) return { level: 'clear', k: foeK };
  if (mi >= fi - 12) return { level: 'guess', k: Math.random() < 0.7 ? foeK : pick(Object.keys(JINKEI).filter((k) => k !== foeK)) };
  return { level: 'none' };
}
// おまかせのときの陣形：見えていれば勝てる陣形、見えなければ魚鱗
function autoJinkei(read) {
  if (read && read.level !== 'none') return Object.keys(JINKEI).find((k) => JINKEI[k].beats === read.k) || 'gyorin';
  return 'gyorin';
}

// stepBattle から：陣形の効き目を eff に掛ける
function jinkeiEffect(s, B, eff, baseCmd, act, lines, name) {
  if (!B.form || !B.form.a || !B.form.d) return;
  const edge = jinkeiEdge(B.form.a, B.form.d);
  ['a', 'd'].forEach((sd) => {
    if (act[sd] === 'confused') return;
    const J = JINKEI[B.form[sd]], e = eff[sd];
    e.out *= J.out; e.in *= J.in;
    const c = baseCmd[sd];
    if (c && J.cmd && J.cmd[c]) {
      if (c === 'guard') e.in *= J.cmd[c]; else e.out *= J.cmd[c];
    }
    if (J.wide && B[sd].troops > B[sd === 'a' ? 'd' : 'a'].troops * 1.2) e.out *= 1.12; // 鶴翼は数で包む
    const mine = (sd === 'a' && edge > 0) || (sd === 'd' && edge < 0);
    if (mine) { e.out *= JINKEI_EDGE.out; eff[sd === 'a' ? 'd' : 'a'].in *= 1 / JINKEI_EDGE.in; }
  });
  if (B.round === 1) {
    ['a', 'd'].forEach((sd) => { const J = JINKEI[B.form[sd]]; if (J.morale) B[sd].morale = clamp(B[sd].morale + J.morale, 0, 100); });
    if (edge) {
      const w = edge > 0 ? 'a' : 'd';
      B[w].morale = clamp(B[w].morale + JINKEI_EDGE.morale, 0, 100);
      lines.unshift(`${name[w]}の「${JINKEI[B.form[w]].name}」が「${JINKEI[B.form[w === 'a' ? 'd' : 'a']].name}」を制した！`);
    }
  }
}
// 偃月の陣は、一騎打ちが起きやすい
const _jkStep = stepBattle;
stepBattle = function (s, B, cmds) {
  const r = _jkStep(s, B, cmds);
  if (!B.over && !B.duelDone && B.round >= 2 && B.form && (JINKEI[B.form.a] || {}).duel && s.gens[B.gid] && B.dgid && s.gens[B.dgid] && Math.random() < 0.18) {
    B.duelDone = true;
    B.duel = { challenger: 'a' };
  }
  return r;
};
// 合戦のはじまり：他家の陣形を先に決めておく（自分の側は陣立ての画面で選ぶ）
const _jkStart = startBattle;
startBattle = function (s, o) {
  const B = _jkStart(s, o);
  B.form = { a: null, d: null };
  ['a', 'd'].forEach((sd) => { if (B.playerSide !== sd) B.form[sd] = aiJinkei(s, B, sd); });
  if (B.playerSide) B.formRead = jinkeiScout(s, B, B.playerSide);
  return B;
};

// ---------- 陣形の絵：兵の並びを陣形の形にする（合戦の舞台 400×220 の座標） ----------
// 前（敵の方）が +x。n 人を形の上に並べ、手前（下）ほど大きく
function jinkeiPoints(k, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), u = t * 2 - 1;
    let fx = 0, fy = 0;
    if (k === 'hoshi') { if (i < Math.ceil(n * 0.35)) { fx = -0.9 + (i / Math.max(1, Math.ceil(n * 0.35) - 1)) * 1.2; fy = 0; } else { const v = ((i - Math.ceil(n * 0.35)) / Math.max(1, n - Math.ceil(n * 0.35) - 1)) * 2 - 1; fx = 0.9 - Math.abs(v) * 0.9; fy = v * 0.85; } }
    else if (k === 'houen') { const a = t * Math.PI * 2 * (n / (n + 1)); fx = Math.cos(a) * 0.65; fy = Math.sin(a) * 0.95; }
    else if (k === 'gankou') { fx = u * 0.75; fy = u; }
    else if (k === 'engetsu') { fx = Math.cos(u * Math.PI * 0.45) * 0.9 - 0.35; fy = u; }
    else if (k === 'kakuyoku') { fx = Math.abs(u) * 1.1 - 0.4; fy = u; }
    else { // 魚鱗：前にとがった、つまった三角
      let row = 0, left = i;
      while (left > row) { left -= row + 1; row++; }
      const rows = Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2);
      fx = 0.8 - (row / Math.max(1, rows - 1)) * 1.6; fy = row ? (left / row) * 2 - 1 : 0; fy *= (row / Math.max(1, rows - 1)) * 0.95;
    }
    pts.push([fx, fy]);
  }
  return pts;
}
function jinkeiArmy(side, n, color, k) {
  const cx = side === 'a' ? 105 : 280, dir = side === 'a' ? 1 : -1;
  const pts = jinkeiPoints(k, n).map(([fx, fy], i) => ({ i, x: cx + fx * 30 * dir, y: 182 + fy * 21 }));
  return pts.sort((p, q) => p.y - q.y).map((p) => {
    const sc = 0.82 + ((p.y - 161) / 42) * 0.3;
    return `<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${sc.toFixed(2)})"><g class="sol" data-i="${p.i}">${soldier(color, side === 'd', unitOf(p.i))}</g></g>`;
  }).join('');
}
// 小さな陣形の図（陣立ての札）
function jinkeiIcon(k, color = '#c8372d') {
  return `<svg viewBox="-34 -26 68 52" class="jk-icon" aria-hidden="true"><path d="M30,-22 L30,22" stroke="#1c1a17" stroke-width="1" stroke-dasharray="2 2" opacity="0.35"/>
    ${jinkeiPoints(k, 12).map(([fx, fy]) => `<rect x="${(fx * 22 - 3).toFixed(1)}" y="${(fy * 19 - 3).toFixed(1)}" width="6" height="6" fill="${color}" stroke="#1c1a17" stroke-width="1"/>`).join('')}
    <path d="M24,0 l6,0 l-3,-3 M30,0 l-3,3" stroke="#1c1a17" stroke-width="1.4" fill="none"/></svg>`;
}
