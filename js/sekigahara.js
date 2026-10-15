// ---------- 天下分け目の大合戦 ----------
// 終盤、天下の四割を握ったとき、最大の他家と国境で向き合えば、天下分け目の決断を迫られる
// 両家が国境の城から三つの軍勢（左翼・中央・右翼）を出してぶつかる。二つの翼が崩れた側の負け
// 毎合、全軍への命令と、本陣の後詰めを送る翼を選ぶ。一度だけ、敵の軍勢を寝返らせる調略ができる
const SEKI = { share: 0.4, rivalShare: 0.2, from: 20, cooldown: 4, rounds: 7, rate: 0.12, take: 0.6, focus: 1.35, surrender: 0.3 };
const SEKI_LANES = ['左翼', '中央', '右翼'];
const SEKI_CMDS = {
  sougakari: { name: '総攻め', desc: '全軍で押し寄せる。損害も大きい', out: 1.3, in: 1.2, morale: 0 },
  oshidashi: { name: '押し出す', desc: '陣を保ったまま前へ', out: 1, in: 1, morale: 0 },
  mamori: { name: '守り', desc: '踏みとどまり、士気を立て直す', out: 0.6, in: 0.6, morale: 6 },
};

function sekiRival(s) {
  return aiClans().filter((k) => castlesOf(s, k).length).sort((a, b) => castlesOf(s, b).length - castlesOf(s, a).length)[0];
}
// 国境の城から、兵の多い順に三つまで軍勢を出す
function sekiCorps(s, clan, foe) {
  const front = castlesOf(s, clan).filter((id) => MAP.adj[id].some((n) => s.castles[n].owner === foe) && s.castles[id].troops >= 300);
  return front.sort((a, b) => s.castles[b].troops - s.castles[a].troops).slice(0, 3).map((id) => {
    const g = bestBy(gensAt(s, id).filter((x) => x.clan === clan), 'str');
    const n = Math.floor((s.castles[id].troops * SEKI.take) / 10) * 10;
    return { castle: id, gid: g ? g.id : null, n, start: n, clan, broken: false };
  });
}
function sekiPlan(s) {
  if (s.sekiDone || s.turn < SEKI.from || (s.sekiCool || 0) > s.turn) return null;
  const rival = sekiRival(s);
  if (!rival) return null;
  const all = MAP.nodes.length;
  if (castlesOf(s, PLAYER).length / all < SEKI.share || castlesOf(s, rival).length / all < SEKI.rivalShare) return null;
  const mine = sekiCorps(s, PLAYER, rival), theirs = sekiCorps(s, rival, PLAYER);
  if (mine.length < 2 || theirs.length < 2) return null;
  // 戦場の名：両軍の中ほどにある城
  const ids = [...mine, ...theirs].map((c) => c.castle);
  const cx = ids.reduce((a, id) => a + MAP.byId[id].x, 0) / ids.length, cy = ids.reduce((a, id) => a + MAP.byId[id].y, 0) / ids.length;
  const field = MAP.nodes.reduce((a, n) => (Math.hypot(n.x - cx, n.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? n : a)).id;
  return { rival, field };
}
// 中央に最大の軍勢を置く
function sekiArrange(corps) {
  const c = corps.slice().sort((a, b) => b.n - a.n);
  return c.length === 3 ? [c[1], c[0], c[2]] : c.length === 2 ? [c[1], c[0], null] : [null, c[0], null];
}
function sekiStart(s, plan) {
  const me = sekiArrange(sekiCorps(s, PLAYER, plan.rival)), foe = sekiArrange(sekiCorps(s, plan.rival, PLAYER));
  [...me, ...foe].filter(Boolean).forEach((c) => { s.castles[c.castle].troops -= c.n; if (c.gid) s.acted[c.gid] = true; });
  return { rival: plan.rival, field: plan.field, me, foe, round: 0, morale: { me: 70, foe: 70 }, plotUsed: { me: false, foe: false }, over: null, log: [] };
}
const sekiAlive = (side) => side.filter((c) => c && !c.broken);
const sekiTotal = (side) => side.reduce((a, c) => a + (c && !c.broken ? c.n : 0), 0);
// 調略：忠誠の低い敵の軍勢を寝返らせる（当主の魅力と知略しだい）
function sekiPlotChance(s, B, lane, by) {
  const target = (by === 'me' ? B.foe : B.me)[lane];
  if (!target || target.broken || !target.gid) return 0;
  const g = s.gens[target.gid];
  const lord = by === 'me' ? lordOf(s) : aiLordOf(s, B.rival);
  const wit = lord ? (lord.cha + lord.int) / 2 : 50;
  if (g.lord) return 0;
  return clamp(0.08 + (wit - 50) / 150 + (70 - (g.loyal ?? 70)) / 60, 0.03, 0.75);
}
function sekiPlot(s, B, lane, by) {
  B.plotUsed[by] = true;
  const p = sekiPlotChance(s, B, lane, by);
  const from = by === 'me' ? B.foe : B.me, to = by === 'me' ? B.me : B.foe;
  const c = from[lane];
  if (!c || Math.random() >= p) return { ok: false, c };
  // 寝返った軍勢は、寝返った先の同じ翼へ加わる
  from[lane] = null;
  c.turned = true;
  c.clan = by === 'me' ? PLAYER : B.rival;
  if (to[lane] && !to[lane].broken) { to[lane].n += c.n; to[lane].start += c.n; } else to[lane] = c;
  const g = c.gid && s.gens[c.gid];
  if (g) { g.clan = c.clan; g.loyal = randInt(45, 60); }
  B.morale[by] = clamp(B.morale[by] + 12, 0, 100);
  B.morale[by === 'me' ? 'foe' : 'me'] = clamp(B.morale[by === 'me' ? 'foe' : 'me'] - 15, 0, 100);
  return { ok: true, c };
}
function sekiAiCmd(B) {
  const ratio = sekiTotal(B.foe) / Math.max(1, sekiTotal(B.me));
  if (B.morale.foe < 35) return 'mamori';
  if (ratio > 1.2 || Math.random() < 0.3) return 'sougakari';
  return Math.random() < 0.25 ? 'mamori' : 'oshidashi';
}
// 一合すすめる
function sekiStep(s, B, cmd, focus) {
  B.round++;
  const lines = [];
  const fcmd = sekiAiCmd(B);
  const ffocus = [0, 1, 2].filter((i) => B.foe[i] && !B.foe[i].broken).sort((a, b) => (B.me[a] && !B.me[a].broken ? B.me[a].n : 0) - (B.me[b] && !B.me[b].broken ? B.me[b].n : 0))[0];
  // 敵の調略（一度だけ、四合目までに）
  if (!B.plotUsed.foe && B.round >= 2 && Math.random() < 0.3) {
    const lane = [0, 1, 2].filter((i) => B.me[i] && !B.me[i].broken && B.me[i].gid).sort((a, b) => sekiPlotChance(s, B, b, 'foe') - sekiPlotChance(s, B, a, 'foe'))[0];
    if (lane !== undefined) {
      const r = sekiPlot(s, B, lane, 'foe');
      lines.push(r.ok ? `😱 ${SEKI_LANES[lane]}の${r.c.gid ? s.gens[r.c.gid].name : '軍勢'}が寝返った！` : `${CLANS[B.rival].name}の調略は、${SEKI_LANES[lane]}の将に退けられた`);
    }
  }
  const C = SEKI_CMDS[cmd], F = SEKI_CMDS[fcmd];
  const mf = (m) => 0.6 + m / 125;
  const dmg = [];
  [0, 1, 2].forEach((i) => {
    const a = B.me[i], d = B.foe[i];
    const aOn = a && !a.broken, dOn = d && !d.broken;
    // 向かいの敵がいない翼は、中央を横から突く
    const aT = dOn ? d : B.foe[1] && !B.foe[1].broken ? B.foe[1] : sekiAlive(B.foe)[0];
    const dT = aOn ? a : B.me[1] && !B.me[1].broken ? B.me[1] : sekiAlive(B.me)[0];
    let toD = 0, toA = 0;
    if (aOn && aT) toD = a.n * SEKI.rate * (a.gid ? atkMult(s.gens[a.gid]) : 0.85) * C.out * F.in * mf(B.morale.me) * (focus === i ? SEKI.focus : 1) * rand(0.85, 1.15);
    if (dOn && dT) toA = d.n * SEKI.rate * (d.gid ? atkMult(s.gens[d.gid]) : 0.85) * F.out * C.in * mf(B.morale.foe) * (ffocus === i ? SEKI.focus : 1) * rand(0.85, 1.15);
    if (aT) aT.n = Math.max(0, Math.round(aT.n - toD));
    if (dT) dT.n = Math.max(0, Math.round(dT.n - toA));
    dmg.push({ toD: Math.round(toD), toA: Math.round(toA) });
  });
  ['me', 'foe'].forEach((sd) => B[sd].forEach((c, i) => {
    if (c && !c.broken && c.n < c.start * 0.15) { c.broken = true; lines.push(`${sd === 'me' ? 'わが' : '敵の'}${SEKI_LANES[i]}が崩れた！`); B.morale[sd] = clamp(B.morale[sd] - 12, 0, 100); }
  }));
  const lossMe = dmg.reduce((a, d) => a + d.toA, 0), lossFoe = dmg.reduce((a, d) => a + d.toD, 0);
  B.morale.me = clamp(Math.round(B.morale.me - (lossMe / Math.max(1, sekiTotal(B.me) + lossMe)) * 40 + C.morale), 0, 100);
  B.morale.foe = clamp(Math.round(B.morale.foe - (lossFoe / Math.max(1, sekiTotal(B.foe) + lossFoe)) * 40 + F.morale), 0, 100);
  lines.push(`${CLANS[B.rival].name}は「${F.name}」。敵に ${fmtN(lossFoe)}、味方に ${fmtN(lossMe)} の損害`);
  const brokenMe = B.me.filter((c) => c && c.broken).length + B.me.filter((c) => !c).length;
  const brokenFoe = B.foe.filter((c) => c && c.broken).length + B.foe.filter((c) => !c).length;
  if (brokenFoe >= 2 || B.morale.foe <= 0 || !sekiAlive(B.foe).length) B.over = 'win';
  else if (brokenMe >= 2 || B.morale.me <= 0 || !sekiAlive(B.me).length) B.over = 'lose';
  else if (B.round >= SEKI.rounds) B.over = sekiTotal(B.me) >= sekiTotal(B.foe) ? 'win' : 'lose';
  return { lines, dmg, fcmd, ffocus };
}
// 決着を盤面に反映する
function sekiEnd(s, B) {
  const log = [];
  const home = (c) => { if (!c) return; const cs = s.castles[c.castle]; if (cs.owner === c.clan) cs.troops = Math.min(RULES.troopCap, cs.troops + c.n); };
  s.sekiDone = true;
  if (B.over === 'win') {
    B.me.forEach(home);
    // 敵の軍勢を出した城は、まとめて降る
    const taken = [];
    B.foe.filter(Boolean).forEach((c) => {
      const cs = s.castles[c.castle];
      if (cs.owner !== B.rival) return;
      cs.owner = PLAYER;
      cs.troops = Math.max(200, Math.round((c.n * 0.5) / 10) * 10);
      scatterGenerals(s, c.castle, B.rival, PLAYER, log);
      taken.push(c.castle);
    });
    // 残る城も動揺し、いくつかは降る
    castlesOf(s, B.rival).filter((id) => !isCapital(id, B.rival)).forEach((id) => {
      if (Math.random() < SEKI.surrender) { s.castles[id].owner = PLAYER; scatterGenerals(s, id, B.rival, PLAYER, log); taken.push(id); }
    });
    addNews(s, `天下分け目、${pName()}の大勝`, `${CLANS[B.rival].name}は${taken.length}城を失う`, 100);
    B.taken = taken;
  } else {
    B.foe.forEach(home);
    addNews(s, `天下分け目、${CLANS[B.rival].name}が勝つ`, `${pName()}の天下取りに陰り`, 95);
  }
  return log;
}

// ---------- 天下分け目の決断（時代の出来事として） ----------
EVENTS.tenkawakeme = {
  icon: '戦', title: '天下分け目', era: true, weight: 0,
  text: (s, p) => `天下は二つに割れた。${pName()}と${CLANS[p.rival].name}——\n両家の軍勢が${MAP.byId[p.field].name}のあたりで睨み合っている。\nここで雌雄を決すれば、天下の行方は一気に決まる。`,
  choices: (s, p) => [{ label: '受けて立つ', sub: '国境の城から三つの軍勢を出す、天下分け目の大合戦' }, { label: '今は避ける', sub: `${SEKI.cooldown}季ののち、また機は来る` }],
  apply(s, p, ci) {
    if (ci === 0) { s.sekiPending = p; return ''; }
    s.sekiCool = s.turn + SEKI.cooldown;
    return `${pName()}は決戦を避けた。${CLANS[p.rival].name}の陣から、嘲りの声が聞こえる。`;
  },
};
const _sekiRoll = rollEvents;
rollEvents = function (s) {
  const list = _sekiRoll(s);
  const plan = sekiPlan(s);
  if (plan) list.splice(1, 0, { id: 'tenkawakeme', p: plan });
  return list;
};
