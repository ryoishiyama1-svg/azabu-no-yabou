// ---------- 策の札：合戦の前に一枚使う ----------
// S.hand = [札のキー]（最大4枚）。季ごとにときどき一枚引き、家の志が上がったときや他家の本拠を落としたときにも手に入る
const SAKU = {
  hiya: { name: '火矢', k: '火', desc: 'はじめの2合、攻めの力+25%', w: 3 },
  hyoro: { name: '兵糧焼き', k: '糧', desc: '敵は2合のあいだ兵糧不足（士気が下がる）', w: 3 },
  yodo: { name: '揺動', k: '揺', desc: '敵は1合のあいだ混乱して動けない', w: 2 },
  toki: { name: '鬨の声', k: '鬨', desc: '味方の士気+15', w: 3 },
  sandan: { name: '鉄砲三段', k: '砲', desc: '1合目の攻めの力+40%', w: 2 },
  yashu: { name: '夜襲', k: '夜', desc: '敵の城の守りを2割崩す（攻めのとき）', w: 2, atk: true },
  haya: { name: '早馬の援軍', k: '馬', desc: '味方の兵+15%', w: 1.5 },
  rojo: { name: '籠城の備え', k: '籠', desc: '3合のあいだ受ける損害-30%（守りのとき）', w: 2, def: true },
};
const HAND_MAX = 4;
const DRAW_CHANCE = 0.4;
function drawSaku(s, n = 1) {
  s.hand = s.hand || [];
  const got = [];
  for (let i = 0; i < n && s.hand.length < HAND_MAX; i++) {
    const keys = Object.keys(SAKU);
    let x = Math.random() * keys.reduce((a, k) => a + SAKU[k].w, 0);
    const k = keys.find((it) => (x -= SAKU[it].w) <= 0) || 'toki';
    s.hand.push(k); got.push(k);
  }
  return got;
}
// その合戦で使える札（攻め／守りで使えないものを除く）
const usableSaku = (s, B, side) => (s.hand || []).map((k, i) => ({ k, i })).filter(({ k }) => !(SAKU[k].atk && side !== 'a') && !(SAKU[k].def && side !== 'd'));
function useSaku(s, B, side, idx) {
  const k = s.hand[idx];
  if (!k) return null;
  s.hand.splice(idx, 1);
  const me = B[side], foe = B[side === 'a' ? 'd' : 'a'];
  B.saku = { k, side };
  if (k === 'hiya') B.sakuOut = { side, mult: 1.25, until: 2 };
  if (k === 'sandan') B.sakuOut = { side, mult: 1.4, until: 1 };
  if (k === 'hyoro') foe.starve = Math.max(foe.starve || 0, 2);
  if (k === 'yodo') foe.confused = Math.max(foe.confused || 0, 1);
  if (k === 'toki') me.morale = clamp(me.morale + 15, 0, 100);
  if (k === 'yashu') B.def = Math.max(0.6, Math.round(B.def * 0.8 * 100) / 100);
  if (k === 'haya') { const add = Math.round((me.troops * 0.15) / 10) * 10; me.troops += add; me.start += add; }
  if (k === 'rojo') { me.wall = Math.max(me.wall || 0, 3); me.wallRate = Math.min(me.wallRate || 1, 0.7); }
  return k;
}
// 合戦の一合ごと：火矢・鉄砲三段の攻めの力
const _skJinkei = jinkeiEffect;
jinkeiEffect = function (s, B, eff, baseCmd, act, lines, name) {
  _skJinkei(s, B, eff, baseCmd, act, lines, name);
  const o = B.sakuOut;
  if (o && B.round <= o.until && act[o.side] !== 'confused') eff[o.side].out *= o.mult;
};
// 札の手に入り方
const _skEnd = endTurn;
endTurn = function (s, ...a) {
  const r = _skEnd(s, ...a);
  if (Math.random() < DRAW_CHANCE) { const g = drawSaku(s); if (g.length && Array.isArray(r)) r.push(`🎴 策の札「${SAKU[g[0]].name}」を手に入れた`); }
  return r;
};
const _skTaishi = typeof taishiGain === 'function' ? taishiGain : null;
if (_skTaishi) {
  taishiGain = function (s, clan, kind, mult) {
    const before = s.taishiUp;
    _skTaishi(s, clan, kind, mult);
    if (clan === PLAYER && s.taishiUp && s.taishiUp !== before) drawSaku(s); // 志が高まれば一枚
  };
}
const _skRecord = recordBattle;
recordBattle = function (s, r) {
  _skRecord(s, r);
  if (r.won && r.attacker === PLAYER && isCapital(r.to, r.defender)) drawSaku(s); // 他家の本拠を落とせば一枚
};
