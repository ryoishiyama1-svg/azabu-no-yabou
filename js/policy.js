// ---------- 今季の方針：季ごとに三枚の方針から一つ選ぶと、その季のあいだ効く ----------
// S.policy = { turn, k }。季が変わると消え、新しい三枚が出る（季と旗揚げの種で決まるので、選び直しても同じ三枚）
const POLICIES = {
  fukoku: { name: '富国', k: '富', desc: 'この季の収入+20%' },
  kyohei: { name: '強兵', k: '強', desc: '徴兵+40%' },
  kaitaku: { name: '開拓', k: '拓', desc: '開発+50%' },
  shingeki: { name: '進撃', k: '進', desc: '攻めの合戦で士気+8' },
  kenshu: { name: '堅守', k: '守', desc: '守りの合戦で士気+8・他家の攻めが1割弱まる' },
  choryaku: { name: '調略', k: '謀', desc: '計略の成功+15%' },
  kyuyo: { name: '休養', k: '休', desc: '季の終わりに全家臣の忠誠+4・兵+5%' },
};
function policyChoices(s) {
  const keys = Object.keys(POLICIES);
  const r = seeded(s.turn * 131 + (s.genSeq || 7) * 17 + 3);
  const out = [];
  while (out.length < 3) { const k = keys[Math.floor(r() * keys.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
// 季の終わりの処理のあいだ（季の数が一つ進んだあとも）は、その季の方針が効いている
const policyOn = (s, k) => !!(s && s.policy && s.policy.k === k && (s.policy.turn === s.turn || (s.polEnd && s.policy.turn === s.turn - 1)));
function choosePolicy(s, k) { s.policy = { turn: s.turn, k }; }

const _plIncome = income;
income = function (s, clan) { const n = _plIncome(s, clan); return clan === PLAYER && policyOn(s, 'fukoku') ? Math.round(n * 1.2) : n; };
const _plRecruit = recruitAmount;
recruitAmount = function (g) { const n = _plRecruit(g); return g && g.clan === PLAYER && policyOn(S, 'kyohei') ? Math.round((n * 1.4) / 10) * 10 : n; };
const _plDevelop = developAmount;
developAmount = function (g) { const n = _plDevelop(g); return g && g.clan === PLAYER && policyOn(S, 'kaitaku') ? Math.max(1, Math.round(n * 1.5)) : n; };
const _plStart = startBattle;
startBattle = function (s, o) {
  const B = _plStart(s, o);
  if (B.attacker === PLAYER && policyOn(s, 'shingeki')) B.a.morale = clamp(B.a.morale + 8, 15, 100);
  if (B.defender === PLAYER && policyOn(s, 'kenshu')) B.d.morale = clamp(B.d.morale + 8, 15, 100);
  return B;
};
const _plAttack = attack;
attack = function (s, from, to, n, gid, log, support = [], tactic = null) {
  if (s.castles[to].owner === PLAYER && policyOn(s, 'kenshu')) n = Math.max(10, Math.round((n * 0.9) / 10) * 10); // 堅守：攻め手の勢いが鈍る
  return _plAttack(s, from, to, n, gid, log, support, tactic);
};
const _plScheme = schemeChance;
schemeChance = function (s, kind, g, to, target) { const p = _plScheme(s, kind, g, to, target); return p > 0 && g.clan === PLAYER && policyOn(s, 'choryaku') ? Math.min(0.95, p + 0.15) : p; };
// 季の終わり：休養の効き目。他家の攻め（季の終わりに来る）にも堅守が効くよう、方針は季が変わってから消える
const _plEnd = endTurn;
endTurn = function (s, ...a) {
  const rest = policyOn(s, 'kyuyo');
  s.polEnd = true;
  let r;
  try { r = _plEnd(s, ...a); } finally { s.polEnd = false; }
  if (rest) {
    gensOf(s, PLAYER).forEach((g) => changeLoyal(g, 4));
    castlesOf(s, PLAYER).forEach((id) => { const c = s.castles[id]; c.troops = Math.min(RULES.troopCap, Math.round((c.troops * 1.05) / 10) * 10); });
  }
  return r;
};
