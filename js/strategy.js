// ---------- 戦略：孤立・挟み撃ち・伏兵 ----------
// 孤立：同じ家の城と一つもつながっていない城（家の城が一つだけのときは除く）。兵糧が届かず、季ごとに兵が減る。攻められれば士気が下がる
// 挟み撃ち：違う方角の城からも兵を出して攻めると、攻め手の士気が上がり、守り手が浮き足立つ
// 伏兵：自分の城に武将を伏せておくと、攻めてきた敵が待ち伏せに遭って兵を失い、士気が下がる
const ISOLATE = { drain: 0.05, morale: 12 };
const PINCER = { angle: 100, morale: 10, foe: 6 };
const FUKU = { turns: 2, loss: 0.15, morale: 12 };

function isolated(s, id) {
  const o = s.castles[id].owner;
  if (o === 'none' || !CLANS[o]) return false;
  if (castlesOf(s, o).length <= 1) return false;
  return !MAP.adj[id].some((n) => s.castles[n].owner === o);
}
// 二つ以上の方角から攻めているか（攻める城から見た向きの開き）
function pincerOf(s, to, froms) {
  const t = MAP.byId[to];
  const dirs = [...new Set(froms)].map((f) => Math.atan2(MAP.byId[f].y - t.y, MAP.byId[f].x - t.x));
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) {
    let d = Math.abs(dirs[i] - dirs[j]) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    if (d >= PINCER.angle) return true;
  }
  return false;
}
const fukuAt = (s, id) => (s.fuku && s.fuku[id] && s.fuku[id].until >= s.turn ? s.fuku[id] : null);
function setFuku(s, id, gid) {
  s.fuku = s.fuku || {};
  s.fuku[id] = { gid, until: s.turn + FUKU.turns };
  s.acted[gid] = true;
}
// 待ち伏せが起きる：攻め手の兵を削る（戻り値：削った兵）
function springFuku(s, to, n) {
  const f = fukuAt(s, to);
  if (!f) return 0;
  delete s.fuku[to];
  const g = s.gens[f.gid];
  const loss = Math.round((n * FUKU.loss) / 10) * 10;
  addNews(s, `${MAP.byId[to].short}で伏兵`, `${g ? g.name : '伏兵'}が攻め手を襲う`, s.castles[to].owner === PLAYER ? 45 : 20);
  return loss;
}

// プレイヤーの合戦：孤立・挟み撃ち・伏兵を士気と兵に映す
const _stgStart = startBattle;
startBattle = function (s, o) {
  const B = _stgStart(s, o);
  if (isolated(s, B.to)) { B.d.morale = clamp(B.d.morale - ISOLATE.morale, 15, 100); B.isolated = true; }
  if (pincerOf(s, B.to, [B.from, ...(B.support || []).map((p) => p.from)])) {
    B.a.morale = clamp(B.a.morale + PINCER.morale, 15, 100);
    B.d.morale = clamp(B.d.morale - PINCER.foe, 15, 100);
    B.pincer = true;
  }
  if (B.defender === PLAYER) {
    const loss = springFuku(s, B.to, B.a.troops);
    if (loss) { B.a.troops -= loss; B.a.start = Math.max(1, B.a.troops); B.a.morale = clamp(B.a.morale - FUKU.morale, 15, 100); B.fukuHit = loss; }
  }
  return B;
};
// 他家の攻め（すぐ決着する攻め）にも、伏兵と孤立が効く
const _stgAttack = attack;
attack = function (s, from, to, n, gid, log, support = [], tactic = null) {
  if (s.castles[to].owner === PLAYER) {
    const loss = springFuku(s, to, n);
    if (loss) {
      s.castles[from].troops = Math.max(0, s.castles[from].troops - loss);
      n = Math.max(10, n - loss);
      if (log) log.push(`🌿 ${MAP.byId[to].short}の伏兵が${CLANS[s.castles[from].owner].name}の軍を襲った！（敵兵-${loss}）`);
    }
  }
  return _stgAttack(s, from, to, n, gid, log, support, tactic);
};
// 季の終わり：孤立した城は兵糧が届かず、兵が減る
function isolateTick(s, log) {
  MAP.nodes.forEach((nd) => {
    if (!isolated(s, nd.id)) return;
    const c = s.castles[nd.id];
    const lost = Math.round((c.troops * ISOLATE.drain) / 10) * 10;
    c.troops -= lost;
    if (c.owner === PLAYER && lost && log) log.push(`🍂 孤立した${MAP.byId[nd.id].short}は兵糧が届かず、兵が${lost}減った`);
  });
}
const _stgEnd = endTurn;
endTurn = function (s, ...a) {
  const r = _stgEnd(s, ...a);
  isolateTick(s, Array.isArray(r) ? r : (r && r.log) || null);
  return r;
};
