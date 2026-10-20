// ---------- 臣従：滅ぼさずに子分にする ----------
// s.vassals[k] = { since, fealty }。臣従した家はこちらを攻めず、毎季収入の一部を献上する
// 忠節（fealty）は季ごとに少し下がり、こちらが攻めで負けるとさらに下がる。低くなると離反することがある
const VASSAL = { tribute: 0.25, decay: 2, rebelBelow: 30, rebelChance: 0.25, giftCost: 150, gift: 15, lossHit: 5, start: 70, unify: 0.6 };

const isVassal = (s, k) => !!(s.vassals && s.vassals[k]);
const vassalsOf = (s) => Object.keys(s.vassals || {}).filter((k) => castlesOf(s, k).length);
// 臣従を迫れる家：こちらの国境に接し、こちらよりずっと小さい家（本拠を持つ家のみ）
function canDemandFealty(s, k) {
  if (isVassal(s, k) || !s.rel[k] || s.encircle || hasCh(s, 'nodiplo')) return false;
  const theirs = castlesOf(s, k).length, mine = castlesOf(s, PLAYER).length;
  return theirs > 0 && theirs <= Math.max(3, Math.floor(mine / 3)) && aiBorder(s, PLAYER, k);
}
function fealtyChance(s, k, g) {
  const troops = (c) => castlesOf(s, c).reduce((a, id) => a + s.castles[id].troops, 0);
  const ratio = troops(PLAYER) / Math.max(1, troops(k));
  const lord = lordOf(s);
  return clamp(-0.02 + (ratio - 2) * 0.11 + (s.rel[k].friend - 40) / 150 + ((lord ? lord.cha : 50) - 50) / 200 + (g ? g.cha / 500 : 0), 0.03, 0.85);
}
function demandFealty(s, k, g) {
  if (g) s.acted[g.id] = true;
  s.stats.diplo++;
  if (Math.random() < fealtyChance(s, k, g)) {
    s.vassals = s.vassals || {};
    s.vassals[k] = { since: s.turn, fealty: VASSAL.start };
    const r = s.rel[k]; r.truce = 0; r.ally = 0;
    addNews(s, `${CLANS[k].name}、${pName()}に臣従`, `${castlesOf(s, k).length}城が${pShort()}の旗のもとに`, 75);
    return { ok: true, text: `${CLANS[k].name}が臣従した！ 毎季、収入の${Math.round(VASSAL.tribute * 100)}%を献上し、もう攻めてこない` };
  }
  changeFriend(s, k, -10);
  return { ok: false, text: `${CLANS[k].name}は臣従を拒んだ。「まだ戦える！」（友好度-10）` };
}
function releaseVassal(s, k) {
  if (!isVassal(s, k)) return;
  delete s.vassals[k];
  changeFriend(s, k, -30);
  addNews(s, `${CLANS[k].name}の臣従、解かれる`, '', 40);
}
function giftVassal(s, k) {
  s.gold[PLAYER] -= VASSAL.giftCost;
  s.vassals[k].fealty = Math.min(100, s.vassals[k].fealty + VASSAL.gift);
}
// 臣従した家とは攻め合わない
const _vsPeace = atPeace;
atPeace = function (s, a, b) {
  if ((a === PLAYER && isVassal(s, b)) || (b === PLAYER && isVassal(s, a))) return true;
  return _vsPeace(s, a, b);
};
// 季の終わり：献上、忠節の移ろい、離反
function vassalTick(s, log) {
  vassalsOf(s).forEach((k) => {
    const v = s.vassals[k];
    const t = Math.round((income(s, k) * VASSAL.tribute) / 10) * 10;
    if (t > 0 && s.gold[k] >= t) { s.gold[k] -= t; s.gold[PLAYER] += t; v.paid = t; }
    const mine = castlesOf(s, PLAYER).length, theirs = castlesOf(s, k).length;
    v.fealty = clamp(v.fealty - VASSAL.decay + (mine >= theirs * 4 ? 1 : 0), 0, 100);
    if (v.fealty < VASSAL.rebelBelow && Math.random() < VASSAL.rebelChance) {
      delete s.vassals[k];
      changeFriend(s, k, -25);
      if (log) log.push(`🔥 臣従していた${CLANS[k].name}が離反した！`);
      addNews(s, `${CLANS[k].name}、${pName()}から離反`, '臣従の誓いを破る', 70);
    }
  });
  // 滅んだ家の臣従は片付ける
  Object.keys(s.vassals || {}).forEach((k) => { if (!castlesOf(s, k).length) delete s.vassals[k]; });
}
const _vsEnd = endTurn;
endTurn = function (s, ...a) { const log = _vsEnd(s, ...a); vassalTick(s, Array.isArray(log) ? log : null); return log; };
// こちらが攻めで負けると、臣従した家の忠節が揺らぐ
const _vsRecord = recordBattle;
recordBattle = function (s, r) {
  _vsRecord(s, r);
  if (r.attacker === PLAYER && !r.won) vassalsOf(s).forEach((k) => { s.vassals[k].fealty = Math.max(0, s.vassals[k].fealty - VASSAL.lossHit); });
};
// 天下統一：残る城がすべて臣従した家のものなら、諸家は城を明け渡す
const _vsWin = checkWin;
checkWin = function (s) {
  if (!s.result && vassalsOf(s).length) {
    const rest = MAP.nodes.filter((n) => s.castles[n.id].owner !== PLAYER);
    if (rest.length && castlesOf(s, PLAYER).length / MAP.nodes.length >= VASSAL.unify && rest.every((n) => isVassal(s, s.castles[n.id].owner))) { // 自分で天下の6割を握っていること
      rest.forEach((n) => { const c = s.castles[n.id]; gensAt(s, n.id).forEach((g) => { if (g.clan === c.owner) { g.clan = PLAYER; g.loyal = Math.max(g.loyal || 60, 60); } }); c.owner = PLAYER; });
      s.vassalUnify = true;
      addNews(s, '臣従の諸家、城を明け渡す', `${pName()}のもと、天下はひとつに`, 100);
    }
  }
  return _vsWin(s);
};
