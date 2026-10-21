// ---------- 武将の成長：兵法と進路 ----------
// 兵法：合戦を重ねるほど経験（g.exp）がたまり、3戦・7戦で兵法を覚える（一人二つまで）。得意な能力で覚えるものが決まる
// 進路：毎年春、二年生に上がった家臣一人の進路（文官・武官・智将）を面談で決める
const HEIHO = {
  mouko: { name: '猛攻', stat: 'str', desc: '大将のとき攻めの力+6%' },
  ichiban: { name: '一番槍', stat: 'str', desc: '大将のとき1合目の攻め+15%' },
  fukutsu: { name: '不屈', stat: 'str', desc: '大将のとき、はじめの士気+8' },
  kanpa: { name: '看破', stat: 'int', desc: '大将のとき、敵の陣形がいつも見える' },
  fuseji: { name: '伏兵上手', stat: 'int', desc: '伏せると、攻め手の損害が25%に' },
  kobu: { name: '鼓舞の才', stat: 'cha', desc: '大将のとき、味方の士気+6' },
  jinbo: { name: '人望', stat: 'cha', desc: '忠誠が季ごとに少し上がる' },
  heitan: { name: '兵站', stat: 'pol', desc: 'いる城が孤立しても兵が減らない' },
  chikujo: { name: '築城の才', stat: 'pol', desc: '築城が5割増し' },
};
const HEIHO_AT = [3, 7];
const SHINRO = {
  bunkan: { name: '文官', desc: '政治+3・知略+1', up: { pol: 3, int: 1 } },
  bukan: { name: '武官', desc: '統率+3・魅力+1', up: { str: 3, cha: 1 } },
  chisho: { name: '智将', desc: '知略+3・統率+1', up: { int: 3, str: 1 } },
};
const hasHeiho = (g, k) => !!(g && g.heiho && g.heiho.includes(k));
function learnHeiho(s, g) {
  g.heiho = g.heiho || [];
  if (g.heiho.length >= HEIHO_AT.length) return null;
  const order = ['str', 'int', 'cha', 'pol'].sort((a, b) => g[b] - g[a]);
  const pool = Object.keys(HEIHO).filter((k) => !g.heiho.includes(k) && HEIHO[k].stat === order[0]);
  const alt = Object.keys(HEIHO).filter((k) => !g.heiho.includes(k) && HEIHO[k].stat === order[1]);
  const k = pick(pool.length ? pool : alt);
  if (!k) return null;
  g.heiho.push(k);
  if (typeof sagaAdd === 'function') sagaAdd(s, g, `兵法「${HEIHO[k].name}」を会得`);
  if (g.clan === PLAYER) { s.learned = s.learned || []; s.learned.push({ gid: g.id, k }); }
  return k;
}
function gainExp(s, g) {
  if (!g) return;
  g.exp = (g.exp || 0) + 1;
  if (HEIHO_AT.includes(g.exp)) learnHeiho(s, g);
}
const _grRecord = recordBattle;
recordBattle = function (s, r) {
  _grRecord(s, r);
  gainExp(s, s.gens[r.gid]);
  if (r.dgid) gainExp(s, s.gens[r.dgid]);
};
// 合戦：大将の兵法を映す
const _grStart = startBattle;
startBattle = function (s, o) {
  const B = _grStart(s, o);
  const ga = s.gens[B.gid], gd = B.dgid ? s.gens[B.dgid] : null;
  [['a', ga], ['d', gd]].forEach(([sd, g]) => {
    if (!g) return;
    if (hasHeiho(g, 'fukutsu')) B[sd].morale = clamp(B[sd].morale + 8, 15, 100);
    if (hasHeiho(g, 'kobu')) B[sd].morale = clamp(B[sd].morale + 6, 15, 100);
  });
  const mine = B.playerSide === 'a' ? ga : B.playerSide === 'd' ? gd : null;
  if (mine && hasHeiho(mine, 'kanpa') && B.form) B.formRead = { level: 'clear', k: B.form[B.playerSide === 'a' ? 'd' : 'a'] };
  return B;
};
const _grJinkei = jinkeiEffect;
jinkeiEffect = function (s, B, eff, baseCmd, act, lines, name) {
  _grJinkei(s, B, eff, baseCmd, act, lines, name);
  [['a', s.gens[B.gid]], ['d', B.dgid ? s.gens[B.dgid] : null]].forEach(([sd, g]) => {
    if (!g || act[sd] === 'confused') return;
    if (hasHeiho(g, 'mouko')) eff[sd].out *= 1.06;
    if (hasHeiho(g, 'ichiban') && B.round === 1) eff[sd].out *= 1.15;
  });
};
// 伏兵上手：伏せた武将がそうなら、攻め手の損害が増える
const _grSpring = springFuku;
springFuku = function (s, to, n) {
  const f = fukuAt(s, to);
  const skilled = f && hasHeiho(s.gens[f.gid], 'fuseji');
  const loss = _grSpring(s, to, n);
  return skilled && loss ? Math.round((loss * (0.25 / FUKU.loss)) / 10) * 10 : loss;
};
// 兵站：孤立しても兵が減らない（季の終わりの前に、そういう城を覚えておいて戻す）
const _grIso = isolateTick;
isolateTick = function (s, log) {
  const keep = {};
  MAP.nodes.forEach((n) => { if (gensAt(s, n.id).some((g) => hasHeiho(g, 'heitan'))) keep[n.id] = s.castles[n.id].troops; });
  _grIso(s, log);
  Object.entries(keep).forEach(([id, t]) => { s.castles[id].troops = Math.max(s.castles[id].troops, t); });
};
// 築城の才
const _grFort = fortifyAmount;
fortifyAmount = function (g) { const n = _grFort(g); return hasHeiho(g, 'chikujo') ? n * 1.5 : n; };
// 人望：忠誠が季ごとに少し上がる
const _grEnd = endTurn;
endTurn = function (s, ...a) {
  const r = _grEnd(s, ...a);
  gensOf(s, PLAYER).forEach((g) => { if (hasHeiho(g, 'jinbo')) changeLoyal(g, 2); });
  return r;
};

// ---------- 進路面談（春の行事のあとに） ----------
function shinroCand(s) {
  return bestBy(gensOf(s, PLAYER).filter((g) => g.grade === 2 && !g.path && g.loc && !g.lord), (g) => g.str + g.int + g.pol + g.cha);
}
EVENTS.shinro = {
  icon: '進', title: '進路面談',
  cond: (s) => !!shinroCand(s),
  init: (s) => ({ gid: shinroCand(s).id }),
  text: (s, p) => { const g = s.gens[p.gid]; return `二年生になった${g.name}が、進路の相談にやってきた。\n「この家で、どんな役目を果たせばよいでしょうか」\n得意は${STAT_NAMES[['str', 'int', 'pol', 'cha'].sort((a, b) => g[b] - g[a])[0]]}。どの道を勧める？`; },
  gen: (s, p) => p.gid,
  choices: () => Object.values(SHINRO).map((P) => ({ label: `${P.name}の道`, sub: P.desc })),
  apply(s, p, ci) {
    const g = s.gens[p.gid];
    if (!g || g.clan !== PLAYER) return '';
    const key = Object.keys(SHINRO)[ci] || 'bukan', P = SHINRO[key];
    g.path = key;
    Object.entries(P.up).forEach(([k, v]) => { g[k] = Math.min(100, g[k] + v); });
    changeLoyal(g, 4);
    if (typeof sagaAdd === 'function') sagaAdd(s, g, `${P.name}の道を志す`);
    return `${g.name}は${P.name}の道を歩むと決めた。「必ずや、お役に立ってみせます」（${P.desc}・忠誠+4）`;
  },
};
const _grRoll = rollEvents;
rollEvents = function (s) {
  const list = _grRoll(s);
  if (s.turn % 4 === 0 && s.turn > 0 && list.length < GAKKO.maxEvents && EVENTS.shinro.cond(s)) { // 窓が多い季は見送る
    const at = list.findIndex((x) => x.id === 'spring');
    list.splice(at >= 0 ? at + 1 : list.length, 0, { id: 'shinro', p: EVENTS.shinro.init(s) });
  }
  return list;
};
