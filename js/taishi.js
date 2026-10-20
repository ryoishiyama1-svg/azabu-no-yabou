// ---------- 家の志（大志） ----------
// どの家にも、天下への志がひとつある。志にかなう行いを重ねると志が高まり（三段）、その家ならではの力が増す
// 他家の志は性格から決まり、自分の家の志は旗揚げのときに選ぶ。s.taishi[clan] = { k, pts }
const TAISHI = {
  hado: { name: '覇道', motto: '天下布武', desc: '力で天下を取る。城を攻め取るほど志が高まる', bonus: '攻めの力', step: '攻めの力 +4%' },
  odo: { name: '王道', motto: '仁義礼智', desc: '徳で人を従える。停戦・同盟・無血開城で志が高まる', bonus: '停戦・同盟が通りやすい', step: '停戦・同盟の成功 +12%' },
  fukoku: { name: '富国', motto: '富国強兵', desc: '国を富ませて強くなる。開発と施設で志が高まる', bonus: '収入', step: '収入 +6%' },
  boryaku: { name: '謀略', motto: '深謀遠慮', desc: '知恵で勝つ。計略と舌戦の成功で志が高まる', bonus: '計略の成功率', step: '計略の成功 +5%' },
  shusei: { name: '守成', motto: '金城鉄壁', desc: '守りを固めて時を待つ。城を守り抜くと志が高まる', bonus: '守りの力', step: '守りの力 +5%' },
  bunbu: { name: '文武', motto: '文武両道', desc: '攻めも内政もほどほどに。何をしても少しずつ志が高まる', bonus: '徴兵と開発', step: '徴兵・開発 +5%' },
};
const PERSONA_TAISHI = { aggressive: 'hado', diplomatic: 'odo', expansive: 'fukoku', cunning: 'boryaku', cautious: 'shusei', balanced: 'bunbu' };
const KAKUN_TAISHI = { str: 'hado', pol: 'fukoku', cha: 'odo', int: 'boryaku' };
const TAISHI_STEPS = [50, 130, 260]; // 志の一段・二段・三段に要る志
// 行いごとに高まる志（志の種類 → 量）。挙げていない志は、その行いでは高まらない
const TAISHI_GAIN = {
  cap: { hado: 7, bunbu: 3, fukoku: 1, odo: 1, boryaku: 1, shusei: 1 },
  def: { shusei: 14, bunbu: 4, hado: 2 },
  dev: { fukoku: 4, bunbu: 1 },
  build: { fukoku: 12, bunbu: 3, shusei: 3 },
  peace: { odo: 14, bunbu: 3 },
  bloodless: { odo: 10, boryaku: 8, bunbu: 2 },
  scheme: { boryaku: 9, bunbu: 2 },
};

function taishiOf(s, clan) {
  if (!s || !clan || clan === 'none' || clan === 'ronin' || !CLANS[clan]) return null;
  if (clan !== PLAYER && !(s.taishi && s.taishi[clan]) && !scenarioClans(s.scenario).includes(clan)) return null; // この地図にいない家
  s.taishi = s.taishi || {};
  if (!s.taishi[clan]) {
    const k = clan === PLAYER ? s.playerTaishi || KAKUN_TAISHI[s.kakun] || 'bunbu' : PERSONA_TAISHI[CLAN_PERSONA[clan]] || 'bunbu';
    s.taishi[clan] = { k, pts: 0 };
  }
  return s.taishi[clan];
}
const taishiLv = (t) => (t ? TAISHI_STEPS.filter((x) => t.pts >= x).length : 0);
// その家の志の段（志の種類が合うときだけ）
function taishiPower(s, clan, k) {
  const t = taishiOf(s, clan);
  return t && t.k === k ? taishiLv(t) : 0;
}
// 志を高める。段が上がったら知らせる
function taishiGain(s, clan, kind, mult = 1) {
  const t = taishiOf(s, clan);
  if (!t) return;
  const add = ((TAISHI_GAIN[kind] || {})[t.k] || 0) * mult;
  if (!add) return;
  const before = taishiLv(t);
  t.pts = Math.min(TAISHI_STEPS[2] + 60, t.pts + add);
  const after = taishiLv(t);
  if (after > before) {
    const T = TAISHI[t.k];
    if (clan === PLAYER) { s.taishiUp = { lv: after, k: t.k }; }
    addNews(s, `${CLANS[clan].name}の志、${'一二三'[after - 1]}段に`, `「${T.motto}」——${T.name}の道を突き進む`, clan === PLAYER ? 60 : after === 3 ? 45 : 25);
  }
}

// ---------- 志の行いを拾う（もとの関数を包む） ----------
const _tsRecordBattle = recordBattle;
recordBattle = function (s, r) {
  _tsRecordBattle(s, r);
  if (r.won) taishiGain(s, r.attacker, 'cap', r.defender === 'none' ? 0.6 : 1.4); // 他家の城を奪うほうが志は高まる
  else if (r.defender !== 'none') taishiGain(s, r.defender, 'def');
};
const _tsDevelop = develop;
develop = function (s, id, g) { const owner = s.castles[id].owner; const r = _tsDevelop(s, id, g); taishiGain(s, owner, 'dev'); return r; };
const _tsBuild = build;
build = function (s, id, f, g) { const owner = s.castles[id].owner; _tsBuild(s, id, f, g); taishiGain(s, owner, 'build'); };
const _tsTruce = diploTruce;
diploTruce = function (s, clan, g) { const r = _tsTruce(s, clan, g); if (r.ok) { taishiGain(s, PLAYER, 'peace'); taishiGain(s, clan, 'peace', 0.5); } return r; };
const _tsAlly = diploAlly;
diploAlly = function (s, clan, g) { const r = _tsAlly(s, clan, g); if (r.ok) { taishiGain(s, PLAYER, 'peace'); taishiGain(s, clan, 'peace', 0.5); } return r; };
const _tsEndDebate = endDebate;
endDebate = function (s, Dt) { const win = Dt.done === 'win'; const r = _tsEndDebate(s, Dt); if (win) taishiGain(s, PLAYER, 'scheme'); return r; }; // 勧告がうまくいけば、謀略の志が高まる
const _tsRunScheme = runScheme;
runScheme = function (s, kind, g, to, target) {
  const r = _tsRunScheme(s, kind, g, to, target);
  if (r && r.ok) taishiGain(s, g.clan, 'scheme');
  return r;
};
// 他家どうしの停戦・同盟は、季ごとに王道の家の志を少しずつ高める
function taishiTick(s) {
  aiClans().filter((k) => castlesOf(s, k).length).forEach((k) => {
    const peace = aiClans().filter((o) => o !== k && castlesOf(s, o).length && (() => { const r = aiRel(s, k, o); return r.truce > 0 || r.ally > 0; })()).length;
    if (peace) taishiGain(s, k, 'peace', Math.min(0.5, peace * 0.25));
  });
}
const _tsEndTurn = endTurn;
endTurn = function (s, ...a) { const r = _tsEndTurn(s, ...a); taishiTick(s); return r; };

// ---------- 志の力（もとの数字に掛ける） ----------
const _tsIncome = income;
income = function (s, clan) { return Math.round(_tsIncome(s, clan) * (1 + 0.06 * taishiPower(s, clan, 'fukoku'))); };
const _tsTruceChance = truceChance;
truceChance = function (s, clan, g) { return clamp(_tsTruceChance(s, clan, g) * (1 + 0.12 * taishiPower(s, PLAYER, 'odo')) * (1 + 0.08 * taishiPower(s, clan, 'odo')), 0.03, 0.95); };
const _tsAllyChance = allyChance;
allyChance = function (s, clan, g) { return clamp(_tsAllyChance(s, clan, g) * (1 + 0.12 * taishiPower(s, PLAYER, 'odo')) * (1 + 0.08 * taishiPower(s, clan, 'odo')), 0, 0.92); };
const _tsSchemeChance = schemeChance;
schemeChance = function (s, kind, g, to, target) { const p = _tsSchemeChance(s, kind, g, to, target); return p > 0 ? Math.min(0.95, p + 0.05 * taishiPower(s, g.clan, 'boryaku')) : p; };
const _tsRecruitAmount = recruitAmount;
recruitAmount = function (g) { const n = _tsRecruitAmount(g); const lv = g && typeof S !== 'undefined' && S ? taishiPower(S, g.clan, 'bunbu') : 0; return lv ? Math.round((n * (1 + 0.05 * lv)) / 10) * 10 : n; };
const _tsDevelopAmount = developAmount;
developAmount = function (g) { const n = _tsDevelopAmount(g); const lv = g && typeof S !== 'undefined' && S ? taishiPower(S, g.clan, 'bunbu') : 0; return lv ? Math.max(1, Math.round(n * (1 + 0.05 * lv))) : n; };
// 攻めと守りの力（atkKakun / defKakun から呼ばれる）
const taishiAtk = (s, clan) => 1 + 0.04 * taishiPower(s, clan, 'hado');
const taishiDef = (s, clan) => 1 + 0.05 * taishiPower(s, clan, 'shusei');

// ---------- 画面：志の札（軍議の頭・外交の欄） ----------
function taishiLine(s, clan) {
  const t = taishiOf(s, clan);
  if (!t) return '';
  const T = TAISHI[t.k], lv = taishiLv(t);
  const next = TAISHI_STEPS[lv], prev = lv ? TAISHI_STEPS[lv - 1] : 0;
  const pct = next ? Math.round(((t.pts - prev) / (next - prev)) * 100) : 100;
  return `<p class="ts-line" title="${T.desc}"><span class="ts-motto">${T.motto}</span><b>${T.name}</b>
    <i class="ts-lv">${[0, 1, 2].map((i) => `<em class="${i < lv ? 'on' : ''}"></em>`).join('')}</i>
    <span class="ts-gauge"><u style="width:${clamp(pct, 0, 100)}%"></u></span>
    <small>${lv ? `${T.bonus}・${'一二三'[lv - 1]}段` : T.desc}</small></p>`;
}
