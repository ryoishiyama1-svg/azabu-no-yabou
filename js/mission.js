// ---------- 密命と勢い ----------
// 密命：家臣が期限つきの小さな目標を持ってくる（同時に二つまで）。果たせば褒美。期限が過ぎれば消える
// 勢い：攻めで勝ち続けると溜まり（最大5）、一段ごとに攻めの力+3%。攻めで負けると途切れる
const MISSION = { max: 2, every: 2 };
const MOMENTUM = { max: 5, per: 0.02 };

function missionCands(s) {
  const out = [];
  const mine = castlesOf(s, PLAYER);
  const front = [...new Set(mine.flatMap((id) => MAP.adj[id]).filter((n) => s.castles[n].owner !== PLAYER && !atPeace(s, PLAYER, s.castles[n].owner)))];
  const taken = new Set((s.missions || []).map((m) => m.to || m.clan || m.kind));
  // 攻め：となりの、落とせそうな城
  front.filter((id) => !taken.has(id)).sort((a, b) => s.castles[a].troops - s.castles[b].troops).slice(0, 2).forEach((id) => {
    out.push({ kind: 'cap', to: id, turns: 3, w: 3, reward: { gold: 300 } });
  });
  // 守り：敵にとなり合う、狙われそうな城
  const threatened = mine.filter((id) => !isCapital(id, PLAYER) && MAP.adj[id].some((n) => s.castles[n].owner !== 'none' && s.castles[n].owner !== PLAYER && !atPeace(s, PLAYER, s.castles[n].owner)));
  if (threatened.length) { const id = pick(threatened); if (!taken.has(id)) out.push({ kind: 'hold', to: id, turns: 3, w: 2, reward: { troops: 500 } }); }
  // 家を削る：となりの他家
  const houses = [...new Set(front.map((id) => s.castles[id].owner).filter((o) => o !== 'none'))];
  if (houses.length) { const k = pick(houses); if (!taken.has(k) && castlesOf(s, k).length >= 2) out.push({ kind: 'cut', clan: k, need: 2, start: castlesOf(s, k).length, turns: 4, w: 2, reward: { gold: 500 } }); }
  // 町を育てる
  if (!taken.has('dev')) { const eco = mine.reduce((a, id) => a + s.castles[id].eco, 0); out.push({ kind: 'dev', start: eco, need: Math.max(20, mine.length * 8), turns: 3, w: 1.5, reward: { loyal: 5 } }); }
  // 和を結ぶ
  const hostile = aiClans().filter((k) => castlesOf(s, k).length && s.rel[k] && !atPeace(s, PLAYER, k) && s.rel[k].friend >= 30);
  if (hostile.length && !taken.has('peace') && !hasCh(s, 'nodiplo')) { const k = pick(hostile); out.push({ kind: 'peace', clan: k, turns: 3, w: 1, reward: { gold: 200 } }); }
  // 一騎打ち
  if (!taken.has('duel')) out.push({ kind: 'duel', start: s.stats.duelWins || 0, turns: 4, w: 1, reward: { loyal: 3, gold: 200 } });
  return out;
}
function missionText(s, m) {
  const name = (id) => (MAP.byId[id] ? MAP.byId[id].short : '');
  const house = () => (CLANS[m.clan] ? CLANS[m.clan].name : '');
  // その種類の文だけを作る（ほかの種類の欄は持っていないので）
  const T = {
    cap: () => `${name(m.to)}を攻め落とせ`,
    hold: () => `${name(m.to)}を${m.until - s.turn > 0 ? 'あと' + (m.until - s.turn) + '季' : ''}守り抜け`,
    cut: () => `${house()}の城を${m.need}つ奪え（${Math.max(0, m.start - castlesOf(s, m.clan).length)}/${m.need}）`,
    dev: () => `町を育てよ（経済 +${Math.max(0, castlesOf(s, PLAYER).reduce((a, id) => a + s.castles[id].eco, 0) - m.start)}/${m.need}）`,
    peace: () => `${house()}と停戦か同盟を結べ`,
    duel: () => '一騎打ちに勝て',
  };
  return T[m.kind] ? T[m.kind]() : '';
}
const rewardText = (r) => [r.gold ? `金${r.gold}` : '', r.troops ? `兵${r.troops}` : '', r.loyal ? `全家臣の忠誠+${r.loyal}` : ''].filter(Boolean).join('・');
function missionDone(s, m) {
  switch (m.kind) {
    case 'cap': return s.castles[m.to].owner === PLAYER;
    case 'hold': return s.turn >= m.until && s.castles[m.to].owner === PLAYER;
    case 'cut': return m.start - castlesOf(s, m.clan).length >= m.need;
    case 'dev': return castlesOf(s, PLAYER).reduce((a, id) => a + s.castles[id].eco, 0) - m.start >= m.need;
    case 'peace': return atPeace(s, PLAYER, m.clan);
    case 'duel': return (s.stats.duelWins || 0) > m.start;
  }
  return false;
}
function missionFailed(s, m) {
  if (m.kind === 'hold' && s.castles[m.to].owner !== PLAYER) return true;
  if ((m.kind === 'cut' || m.kind === 'peace') && !castlesOf(s, m.clan).length) return m.kind === 'peace';
  return s.turn > m.until;
}
// 果たした密命の褒美
function missionPay(s, m) {
  const r = m.reward;
  if (r.gold) s.gold[PLAYER] += r.gold;
  if (r.troops) { const home = m.to && s.castles[m.to].owner === PLAYER ? m.to : homeCastle(s); if (home) s.castles[home].troops = Math.min(RULES.troopCap, s.castles[home].troops + r.troops); }
  if (r.loyal) gensOf(s, PLAYER).forEach((g) => changeLoyal(g, r.loyal));
  const g = s.gens[m.gid];
  if (g && g.clan === PLAYER) changeLoyal(g, 5);
  s.stats.missions = (s.stats.missions || 0) + 1;
}
// 季の終わり：期限切れを片付け、二季に一度、新しい密命を（空きがあれば）
function missionTick(s) {
  s.missions = (s.missions || []).filter((m) => !(m.done || missionFailed(s, m)));
  if (s.turn < 2 || s.turn % MISSION.every || s.missions.length >= MISSION.max || s.result) return;
  const cands = missionCands(s);
  if (!cands.length) return;
  let x = Math.random() * cands.reduce((a, c) => a + c.w, 0);
  const c = cands.find((it) => (x -= it.w) <= 0) || cands[0];
  const giver = bestBy(gensOf(s, PLAYER).filter((g) => !g.lord && g.loc), (g) => g.int + g.cha + Math.random() * 40);
  s.missions.push({ ...c, w: undefined, since: s.turn, until: s.turn + c.turns, gid: giver ? giver.id : null, fresh: true });
}
// 果たしたかどうかを調べる（画面を描くたびに）。戻り値：いま果たした密命
function missionCheck(s) {
  const got = [];
  (s.missions || []).forEach((m) => { if (!m.done && missionDone(s, m)) { m.done = true; missionPay(s, m); got.push(m); } });
  return got;
}
const _msEndTurn = endTurn;
endTurn = function (s, ...a) { const r = _msEndTurn(s, ...a); missionTick(s); return r; };

// ---------- 勢い ----------
const _msRecord = recordBattle;
recordBattle = function (s, r) {
  _msRecord(s, r);
  if (r.attacker !== PLAYER) return;
  const before = s.momentum || 0;
  s.momentum = r.won ? Math.min(MOMENTUM.max, before + 1) : 0;
  if (!r.won && before >= 2) s.momentumLost = before;
};
const momentumMult = (s, clan) => (clan === PLAYER ? 1 + (s.momentum || 0) * MOMENTUM.per : 1);

// 勢いは、攻めて勝たない季が続くと冷める（一季に一段）
const _msMomEnd = endTurn;
endTurn = function (s, ...a) {
  const won = (s.momWins || 0) > 0; // この季（ターン終了までの自分の番）に攻めて勝ったか
  s.momWins = 0;
  const r = _msMomEnd(s, ...a);
  if (!won && s.momentum) s.momentum = Math.max(0, s.momentum - 1);
  s.momWins = 0;
  return r;
};
const _msMomRec = recordBattle;
recordBattle = function (s, r) { _msMomRec(s, r); if (r.attacker === PLAYER && r.won) s.momWins = (s.momWins || 0) + 1; };
