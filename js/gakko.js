// ---------- 学校の行事：体育祭・部活の全国大会・修学旅行・生徒会選挙 ----------
// 季節の行事のあとに、ときどき一つ。選び方で家臣の育ちや絆、他家の評判が変わる
const GAKKO = { chance: 0.55 };
const g2 = (s) => gensOf(s, PLAYER).filter((g) => g.grade === 2 && g.loc);
const growStat = (g, k, n) => { g[k] = Math.min(100, g[k] + n); };
// 全国大会に出す三人：統率・知略・魅力それぞれのいちばん
function taikaiCands(s) {
  const gs = gensOf(s, PLAYER).filter((g) => g.loc && !g.lord);
  const pickBest = (k, used) => bestBy(gs.filter((g) => !used.has(g.id)), k);
  const used = new Set(), out = [];
  [['str', '運動部'], ['int', '文化部'], ['cha', '吹奏楽・演劇']].forEach(([k, lab]) => { const g = pickBest(k, used); if (g) { used.add(g.id); out.push({ id: g.id, k, lab }); } });
  return out;
}
function senkyoCands(s) {
  return gensOf(s, PLAYER).filter((g) => !g.lord && g.loc && g.grade <= 2).sort((a, b) => b.cha - a.cha).slice(0, 2).map((g) => g.id);
}
Object.assign(EVENTS, {
  taiikusai: {
    icon: '体', title: '体育祭', art: 'spring',
    text: (s) => `新緑の校庭に、紅白の鉢巻がひるがえる。${pName()}の体育祭だ。\n家臣たちは朝からそわそわしている。どこに力を入れる？`,
    choices: () => [{ label: '紅白対抗で全力', sub: '家臣の統率が伸びることがある・忠誠+3' }, { label: '応援合戦', sub: '家臣の魅力が伸びることがある・忠誠+3' }, { label: '裏方に徹する', sub: '金+150（来賓からの寄付）' }],
    apply(s, p, ci) {
      const gs = gensOf(s, PLAYER);
      if (ci === 2) { s.gold[PLAYER] += 150; return '裏方の働きぶりに、来賓のOBが感心して寄付をくれた。（金+150）'; }
      const k = ci === 0 ? 'str' : 'cha';
      let n = 0;
      gs.forEach((g) => { changeLoyal(g, 3); if (Math.random() < 0.4) { growStat(g, k, 1); n++; } });
      return ci === 0 ? `綱引きもリレーも大接戦！ 声をからして走り抜いた。（${n}人の統率+1・忠誠+3）` : `応援団の舞が校庭を沸かせた。（${n}人の魅力+1・忠誠+3）`;
    },
  },
  taikai: {
    icon: '杯', title: '部活の全国大会', art: 'summer',
    cond: (s) => taikaiCands(s).length >= 2,
    init: (s) => ({ cands: taikaiCands(s) }),
    text: (s) => `夏の全国大会の季節。各地の強豪が集う大舞台に、${pName()}からも一人を送り出せる。\n勝てば、${pShort()}の名は天下にとどろくだろう。`,
    choiceGens: (s, p) => p.cands.map((c) => c.id),
    choices: (s, p) => p.cands.map((c) => { const g = s.gens[c.id]; return { label: g.name, sub: `${c.lab}で出場（${STAT_NAMES[c.k]}${g[c.k]}・勝ち目 ${Math.round(clamp((g[c.k] - 40) / 60, 0.1, 0.9) * 100)}%）` }; }),
    apply(s, p, ci) {
      const c = p.cands[ci] || p.cands[0], g = s.gens[c.id];
      if (!g || g.clan !== PLAYER) return '';
      const win = Math.random() < clamp((g[c.k] - 40) / 60, 0.1, 0.9);
      if (win) {
        growStat(g, c.k, 3); changeLoyal(g, 10);
        s.gold[PLAYER] += 200;
        aiClans().forEach((k) => { if (s.rel[k]) changeFriend(s, k, 4); });
        if (typeof sagaAdd === 'function') sagaAdd(s, g, `夏の全国大会で優勝`);
        addNews(s, `${pName()}の${g.name}、全国大会で優勝`, '天下に名がとどろく', 55);
        return `${g.name}が全国大会で優勝した！ ${pShort()}の名は天下にとどろいた。（${STAT_NAMES[c.k]}+3・金+200・諸家の友好度+4）`;
      }
      changeLoyal(g, 4); growStat(g, c.k, 1);
      return `${g.name}は惜しくも準決勝で敗れた。悔し涙の夏だったが、得たものは大きい。（${STAT_NAMES[c.k]}+1・忠誠+4）`;
    },
  },
  shugaku: {
    icon: '旅', title: '修学旅行', art: 'autumn',
    cond: (s) => g2(s).length >= 1,
    text: (s) => `二年生の修学旅行。${g2(s).map((g) => g.name).slice(0, 4).join('・')}${g2(s).length > 4 ? 'ら' : ''}が、行き先の決定を待っている。`,
    choices: (s) => [
      { label: '京都・奈良（金300）', sub: '二年生の知略+2', disabled: s.gold[PLAYER] < 300 },
      { label: '沖縄（金350）', sub: '二年生の忠誠+8・二年生どうしの絆が深まる', disabled: s.gold[PLAYER] < 350 },
      { label: '北海道（金300）', sub: '二年生の統率+2', disabled: s.gold[PLAYER] < 300 },
      { label: '今年は見送る', sub: '二年生の忠誠-3' },
    ],
    apply(s, p, ci) {
      const gs = g2(s);
      if (ci === 3) { gs.forEach((g) => changeLoyal(g, -3)); return '修学旅行は見送りに。二年生たちはがっかりしている。'; }
      s.gold[PLAYER] -= [300, 350, 300][ci];
      if (ci === 0) { gs.forEach((g) => growStat(g, 'int', 2)); return '古都の寺社をめぐり、歴史に学んだ。（二年生の知略+2）'; }
      if (ci === 2) { gs.forEach((g) => growStat(g, 'str', 2)); return '雪原を駆け、たくましくなって帰ってきた。（二年生の統率+2）'; }
      gs.forEach((g) => changeLoyal(g, 8));
      if (gs.length >= 2 && typeof bondKey === 'function') { s.bondPts = s.bondPts || {}; for (let i = 0; i + 1 < gs.length; i++) { const k = bondKey(gs[i].id, gs[i + 1].id); s.bondPts[k] = (s.bondPts[k] || 0) + 3; } }
      return '青い海と白い砂浜。夜は消灯後もおしゃべりが止まらなかった。（二年生の忠誠+8・絆が深まる）';
    },
  },
  senkyo: {
    icon: '票', title: '生徒会選挙', art: 'winter',
    cond: (s) => senkyoCands(s).length === 2,
    init: (s) => ({ cands: senkyoCands(s) }),
    text: (s, p) => `${pName()}の生徒会選挙。二人の候補が名乗りを上げた。\n当主として、どちらを推す？ 選ばれた者は張り切り、敗れた者は少し肩を落とすだろう。`,
    choiceGens: (s, p) => p.cands,
    choices: (s, p) => p.cands.map((id) => { const g = s.gens[id]; return { label: `${g.name}を推す`, sub: `魅力${g.cha}・忠誠${g.loyal}` }; }),
    apply(s, p, ci) {
      const win = s.gens[p.cands[ci]], lose = s.gens[p.cands[1 - ci]];
      if (!win) return '';
      changeLoyal(win, 10); growStat(win, 'cha', 2);
      if (lose) changeLoyal(lose, -4);
      if (typeof sagaAdd === 'function') sagaAdd(s, win, '生徒会選挙に当選');
      return `${win.name}が当選した！「この家を、もっと強くしてみせます」（魅力+2・忠誠+10${lose ? `／${lose.name}は忠誠-4` : ''}）`;
    },
  },
});
const GAKKO_BY_SEASON = ['taiikusai', 'taikai', 'shugaku', 'senkyo'];
const _gkRoll = rollEvents;
rollEvents = function (s) {
  const list = _gkRoll(s);
  const id = GAKKO_BY_SEASON[s.turn % 4];
  const e = EVENTS[id];
  if (s.turn >= 1 && Math.random() < GAKKO.chance && (!e.cond || e.cond(s))) {
    const at = list.findIndex((x) => ['spring', 'summer', 'autumn', 'winter'].includes(x.id));
    list.splice(at >= 0 ? at + 1 : 0, 0, { id, p: e.init ? e.init(s) : {} });
  }
  return list;
};
