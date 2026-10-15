// ---------- 家臣の声：季ごとに、家臣が一人、自分から話しかけてくる ----------
// 話の中身は、その家臣の事情（忠誠・いる城・能力・志・宿敵・絆・季節）で変わる。返事は二つ
// 献策を「任せる」と、その場で動く（攻めの献策は、その将の次の攻めに士気が乗る）
const TALK = { boost: 10, boostTurns: 2, reward: 100 };

function talkTopics(s, g) {
  const out = [];
  const c = g.loc && s.castles[g.loc];
  const name = g.name.split(' ')[1] || g.name;
  if (g.loyal < 50) {
    out.push({ w: 6, kind: 'fuman', mood: 'frustrated', line: pick(['手柄を立てても、報われぬ気がいたしまする……', 'このままでは、皆の士気にも障りましょう', '他家からも、誘いの声がかかっておりまして……']),
      a: { label: `褒美を約束する（金${TALK.reward}）`, gold: TALK.reward }, b: { label: '耐えよと諭す' } });
  }
  if (c) {
    const weak = MAP.adj[g.loc].filter((n) => s.castles[n].owner !== PLAYER && !atPeace(s, PLAYER, s.castles[n].owner) && s.castles[n].troops < c.troops * 0.7);
    if (weak.length && g.str >= 55 && !s.acted[g.id]) {
      const t = weak.reduce((a, b) => (s.castles[a].troops <= s.castles[b].troops ? a : b));
      out.push({ w: 4, kind: 'seme', mood: 'angry', to: t, line: `${MAP.byId[t].name}の守り、いまは手薄にございます。この${name}に兵をお預けくだされ！`,
        a: { label: '任せる', sub: `次の攻めで士気+${TALK.boost}` }, b: { label: 'まだ早い' } });
    }
    if (g.pol >= 60 && c.eco < RULES.ecoCap && !s.acted[g.id] && s.gold[PLAYER] >= RULES.developCost) {
      out.push({ w: 3, kind: 'machi', mood: 'smile', line: `${MAP.byId[g.loc].short}の町、もっと大きくできまする。市を広げれば年貢も増えましょう`,
        a: { label: '任せる', sub: `その場で開発（金${RULES.developCost}）` }, b: { label: '今は戦が先だ' } });
    }
  }
  if (g.shi && !g.shi.done && SHI[g.shi.kind]) {
    out.push({ w: 3, kind: 'shi', mood: 'laugh', line: `わが志は「${SHI[g.shi.kind].name}」。${shiText(s, g)}——必ずや果たしてみせまする`,
      a: { label: '応援している', sub: '忠誠+5' }, b: { label: '焦るでないぞ' } });
  }
  if (s.nemesis && castlesOf(s, s.nemesis).length) {
    out.push({ w: 2, kind: 'kataki', mood: 'angry', line: `宿敵${CLANS[s.nemesis].name}……あの者らだけは、許せませぬ`,
      a: { label: '共に討とう', sub: '忠誠+4' }, b: { label: '怒りに呑まれるな', sub: '知略が伸びることも' } });
  }
  const bd = bondsOf(s, g)[0];
  if (bd && s.gens[bd.other] && s.gens[bd.other].clan === PLAYER) {
    const o = s.gens[bd.other];
    out.push({ w: 2, kind: 'kizuna', mood: 'smile', other: o.id, line: `${o.name}とは${BOND_TYPES[bd.type] ? BOND_TYPES[bd.type].name : '仲間'}の間柄。あやつがいれば、どんな戦も怖くありませぬ`,
      a: { label: '良い仲間だ', sub: '二人の忠誠+3' }, b: { label: '馴れ合うな' } });
  }
  const season = s.turn % 4;
  out.push({ w: 1, kind: 'seken', mood: 'smile', line: pick([
    ['桜が見事ですな。新入生たちも、目を輝かせておりまする', '春の陽気に、つい居眠りを……いえ、なんでもございませぬ'],
    ['この暑さ、兵たちも参っております。冷たい麦茶でも振る舞いとうございますな', '夏休みの宿題が……いえ、戦の支度は万全です'],
    ['文化祭の出し物、わが城は焼きそばに決まりましたぞ', '秋の夜長、兵法書を読みふけっております'],
    ['模試の結果が……いえ、戦の話をいたしましょう', '寒さが身にしみまするな。皆に温かい汁を'],
  ][season]), a: { label: '労をねぎらう', sub: '忠誠+2' }, b: { label: '気を抜くな' } });
  return out;
}
// この季に話しかけてくる家臣と話題（季ごとに一度だけ決める）
function talkOfSeason(s) {
  if (s.talk && s.talk.turn === s.turn) return s.talk;
  const gens = gensOf(s, PLAYER).filter((g) => !g.lord && g.loc);
  if (!gens.length) { s.talk = { turn: s.turn, none: true }; return s.talk; }
  // 忠誠の低い者、志のある者、前線の猛将を少し優先
  const cands = gens.map((g) => ({ g, w: 1 + (g.loyal < 50 ? 3 : 0) + (g.shi && !g.shi.done ? 1 : 0) + (g.str >= 70 ? 1 : 0) }));
  let r = Math.random() * cands.reduce((a, x) => a + x.w, 0);
  const g = (cands.find((x) => (r -= x.w) <= 0) || cands[0]).g;
  const ts = talkTopics(s, g);
  let q = Math.random() * ts.reduce((a, t) => a + t.w, 0);
  const t = ts.find((x) => (q -= x.w) <= 0) || ts[0];
  s.talk = { turn: s.turn, gid: g.id, ...t };
  return s.talk;
}
// 返事をする。戻り値：家臣のひとこと
function talkAnswer(s, ci) {
  const t = s.talk, g = t && s.gens[t.gid];
  if (!t || t.done || !g || g.clan !== PLAYER) return '';
  t.done = ci === 0 ? 'a' : 'b';
  const yes = ci === 0;
  switch (t.kind) {
    case 'fuman':
      if (yes && s.gold[PLAYER] >= TALK.reward) { s.gold[PLAYER] -= TALK.reward; changeLoyal(g, 12); return 'ありがたき幸せ！ この身、ふたたびお預けいたしまする（忠誠+12）'; }
      { const lord = lordOf(s); const ok = lord && lord.cha >= 65; changeLoyal(g, ok ? 3 : -4); return ok ? '……お言葉、胸にしみました。いま少し、耐えてみまする（忠誠+3）' : '……左様ですか（忠誠-4）'; }
    case 'seme':
      if (yes) { s.talkBoost = { gid: g.id, until: s.turn + TALK.boostTurns }; changeLoyal(g, 3); return `お任せあれ！ ${MAP.byId[t.to].short}、必ずや落としてみせまする（次の攻めで士気+${TALK.boost}）`; }
      changeLoyal(g, -2); return '……御意。機を待ちまする';
    case 'machi':
      if (yes && s.gold[PLAYER] >= RULES.developCost && g.loc && s.castles[g.loc].owner === PLAYER && !s.acted[g.id]) { const r = develop(s, g.loc, g); s.acted[g.id] = true; changeLoyal(g, 2); return `さっそく取りかかりまする！（${MAP.byId[g.loc].short}：${r.text}）`; }
      return yes ? '金が足りぬようで……またの機会に' : 'さようでございますか。では、戦の支度を';
    case 'shi':
      if (yes) { changeLoyal(g, 5); return 'そのお言葉だけで、百人力にございます！（忠誠+5）'; }
      if (g.int < 100 && Math.random() < 0.5) g.int++;
      return '……肝に銘じまする';
    case 'kataki':
      if (yes) { changeLoyal(g, 4); return '共に！ この怒り、戦場で晴らしましょうぞ（忠誠+4）'; }
      if (g.int < 100 && Math.random() < 0.6) { g.int++; return '……仰せのとおり。冷静さを欠いておりました（知略+1）'; }
      return '……仰せのとおりにございます';
    case 'kizuna':
      if (yes) { changeLoyal(g, 3); const o = s.gens[t.other]; if (o) changeLoyal(o, 3); return 'はっ！ 二人して、天下に名を轟かせまする（二人の忠誠+3）'; }
      return '……は。肝に銘じます';
    default:
      if (yes) { changeLoyal(g, 2); return 'もったいなきお言葉（忠誠+2）'; }
      return 'は、はっ！ 失礼いたしました';
  }
}
// 献策を任された将の、次の攻め
const _tkStart = startBattle;
startBattle = function (s, o) {
  const B = _tkStart(s, o);
  const b = s.talkBoost;
  if (b && B.attacker === PLAYER && B.gid === b.gid && s.turn <= b.until) {
    B.a.morale = clamp(B.a.morale + TALK.boost, 15, 100);
    B.talkBoost = true;
    s.talkBoost = null;
  }
  return B;
};
