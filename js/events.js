// 季節ごとの行事と、ランダムな出来事
// 1件のイベントは { id, p }（p = そのときの詳しい内容）として保存する

function allCastles() { return Object.keys(MAP.byId); }
function scaleTroops(s, ids, f) {
  ids.forEach((id) => {
    const c = s.castles[id];
    c.troops = Math.min(RULES.troopCap, Math.round((c.troops * f) / 10) * 10);
  });
}
// 家臣の能力をまとめて上げて、結果の文を返す
function growAll(s, stat) {
  let n = 0;
  gensOf(s, PLAYER).forEach((g) => {
    if (g[stat] < 100 && Math.random() < 0.6) { g[stat] = Math.min(100, g[stat] + randInt(1, 2)); n++; }
  });
  return n ? `${n}人の${STAT_NAMES[stat]}が上がった！` : `残念ながら、${STAT_NAMES[stat]}が上がった者はいなかった。`;
}
// 新しい武将を置く城（当主のいる城）
function homeCastle(s) {
  const lord = lordOf(s);
  return lord && lord.loc ? lord.loc : castlesOf(s, PLAYER)[0];
}
function borderEnemies(s, clanFilter) {
  const out = new Set();
  castlesOf(s, PLAYER).forEach((id) => MAP.adj[id].forEach((n) => {
    const o = s.castles[n].owner;
    if (clanFilter(o)) out.add(n);
  }));
  return [...out];
}

const EVENTS = {
  // ---------- 季節の行事 ----------
  spring: {
    icon: '桜', title: '卒業式と入学式',
    text: (s) => {
      const g = s.grad || { left: [], joined: [] };
      const left = g.left.length ? `卒業：${g.left.join('、')}` : '卒業した家臣はいない';
      const joined = g.joined.length ? `入学：${g.joined.join('、')}` : '';
      return `桜の季節。三年生が巣立ち、新入生がやってきた。すべての学校で兵が1割増えた。\n${left}\n${joined}`;
    },
    choices: () => [{ label: 'めでたい' }],
    apply(s) { scaleTroops(s, allCastles(), 1.1); return ''; },
  },
  succession: {
    icon: '継', title: '家督相続',
    text: (s, p) => `当主${s.gens[p.old].name}が卒業の日を迎えた。\n「${p.words}」\n${pName()}を継ぐ者を選べ。選ばなかった実力者は、家を去るかもしれない。`,
    gen: (s, p) => p.old,
    choiceGens: (s, p) => p.cands,
    choices: (s, p) => p.cands.map((id) => {
      const g = s.gens[id];
      return { label: `${g.name}（${g.grade}年）`, sub: `家訓「${KAKUN[kakunOf(g)].name}」：${KAKUN[kakunOf(g)].desc}` };
    }),
    apply(s, p, ci) { return succeed(s, p.cands[ci]); },
  },
  summer: {
    icon: '夏', title: '夏合宿',
    text: () => `夏休みに合宿を開けば、家臣たちの統率が鍛えられるだろう。費用は金${300}。`,
    choices: (s) => [{ label: '合宿を開く（金300）', disabled: s.gold[PLAYER] < 300 }, { label: '見送る' }],
    apply(s, p, ci) {
      if (ci !== 0) return '合宿は見送った。';
      s.gold[PLAYER] -= 300;
      return `厳しい合宿を乗りこえた。${growAll(s, 'str')}`;
    },
  },
  autumn: {
    icon: '祭', title: '文化祭',
    text: (s) => `いよいよ文化祭。${pName()}の出し物を決めよう。`,
    choices: (s) => [
      { label: '模擬店', sub: `金 +${150 + 25 * castlesOf(s, PLAYER).length}` },
      { label: '演劇', sub: '家臣の魅力が上がる' },
      { label: '研究発表', sub: '家臣の政治が上がる' },
    ],
    apply(s, p, ci) {
      if (ci === 0) {
        const n = 150 + 25 * castlesOf(s, PLAYER).length;
        s.gold[PLAYER] += n;
        return `模擬店は大繁盛！ 金 +${n}`;
      }
      if (ci === 1) return `演劇は大喝采！ ${growAll(s, 'cha')}`;
      return `研究発表は高い評価を受けた。${growAll(s, 'pol')}`;
    },
  },
  winter: {
    icon: '雪', title: '受験シーズン',
    text: () => '三年生が受験のため部活を引退した…。すべての学校で兵が少し減った。',
    choices: () => [{ label: 'がんばれ受験生' }],
    apply(s) { scaleTroops(s, allCastles(), 0.92); return ''; },
  },

  // ---------- ランダムな出来事 ----------
  donation: {
    icon: '寄', title: 'OB会からの寄付', weight: 3,
    init: () => ({ amount: randInt(4, 10) * 50 }),
    text: (s, p) => `${pName()}のOB会から、活動資金の寄付が届いた。金 +${p.amount}`,
    choices: () => [{ label: 'ありがたい' }],
    apply(s, p) { s.gold[PLAYER] += p.amount; return ''; },
  },
  shop: {
    icon: '購', title: '購買部が大繁盛', weight: 2,
    text: (s) => `新作の焼きそばパンが大ヒット！ 収入の半分（金 +${Math.round(income(s, PLAYER) / 2)}）が臨時に入った。`,
    choices: () => [{ label: '承知' }],
    apply(s) { s.gold[PLAYER] += Math.round(income(s, PLAYER) / 2); return ''; },
  },
  typhoon: {
    icon: '嵐', title: '台風の直撃', weight: 2,
    init: (s) => ({ castle: pick(castlesOf(s, PLAYER)) }),
    text: (s, p) => `台風が${MAP.byId[p.castle].name}を直撃！ 校舎が傷み、経済が下がり兵も減った。`,
    choices: () => [{ label: '復旧を急げ' }],
    apply(s, p) {
      const c = s.castles[p.castle];
      if (c.owner === PLAYER) { c.eco = Math.max(20, c.eco - 8); scaleTroops(s, [p.castle], 0.9); }
      return '';
    },
  },
  flu: {
    icon: '病', title: 'インフルエンザ流行', weight: 2,
    init: (s) => ({ castle: pick(castlesOf(s, PLAYER)) }),
    text: (s, p) => `${MAP.byId[p.castle].name}で学級閉鎖が相次ぎ、兵が2割以上減った…`,
    choices: () => [{ label: '手洗いうがいを徹底せよ' }],
    apply(s, p) { if (s.castles[p.castle].owner === PLAYER) scaleTroops(s, [p.castle], 0.75); return ''; },
  },
  transfer: {
    icon: '転', title: '転校生あらわる', weight: 3,
    init: (s) => {
      const g = makeGeneral(s, pick(allCastles()), 'ronin', {});
      Object.assign(g, { loc: null, origin: 'none', title: '転校生' });
      return { gid: g.id };
    },
    text: (s, p) => `${MAP.byId[s.gens[p.gid].school].name}から転校してきた${s.gens[p.gid].name}が、${pName()}に仕えたいと言っている。`,
    gen: (s, p) => p.gid,
    choices: (s) => [{ label: '迎え入れる（金200）', disabled: s.gold[PLAYER] < 200 }, { label: '断る' }],
    apply(s, p, ci) {
      const g = s.gens[p.gid];
      if (ci !== 0) return `${g.name}は去っていった。`;
      s.gold[PLAYER] -= 200;
      g.clan = PLAYER;
      g.loc = homeCastle(s);
      return `${g.name}が家臣になった！（${MAP.byId[g.loc].short}に配属）`;
    },
  },
  genius: {
    icon: '才', title: '天才転校生', weight: 1,
    cond: (s) => s.turn >= 4,
    init: (s) => {
      const g = makeGeneral(s, pick(allCastles()), 'ronin', { strong: true });
      ['str', 'pol', 'cha', 'int'].forEach((k) => { g[k] = Math.max(g[k], randInt(72, 90)); });
      g.skill = g.skill || pick(Object.keys(SKILLS));
      Object.assign(g, { loc: null, origin: 'none', title: '天才転校生' });
      return { gid: g.id };
    },
    text: (s, p) => `全国模試1位の天才・${s.gens[p.gid].name}が転校してきた！ 支度金を出せば${pName()}に加わるという。`,
    gen: (s, p) => p.gid,
    choices: (s) => [{ label: '迎え入れる（金600）', disabled: s.gold[PLAYER] < 600 }, { label: '断る' }],
    apply(s, p, ci) {
      const g = s.gens[p.gid];
      if (ci !== 0) return `${g.name}は他の学校へ行ってしまった…`;
      s.gold[PLAYER] -= 600;
      g.clan = PLAYER;
      g.loc = homeCastle(s);
      return `天才・${g.name}が家臣になった！`;
    },
  },
  strife: {
    icon: '乱', title: '他家の内紛', weight: 2,
    cond: (s) => aiClans().some((k) => castlesOf(s, k).length),
    init: (s) => ({ clan: pick(aiClans().filter((k) => castlesOf(s, k).length)) }),
    text: (s, p) => `${CLANS[p.clan].name}で生徒会の内紛が起きた！ ${CLANS[p.clan].name}の城の兵が2割減った。`,
    choices: () => [{ label: '好機だ' }],
    apply(s, p) { scaleTroops(s, castlesOf(s, p.clan), 0.8); return ''; },
  },
  election: {
    icon: '選', title: '独立校で生徒会選挙', weight: 2,
    cond: (s) => borderEnemies(s, (o) => o === 'none').length > 0,
    init: (s) => ({ castle: pick(borderEnemies(s, (o) => o === 'none')) }),
    text: (s, p) => `${MAP.byId[p.castle].name}が生徒会選挙で大混乱！ 守りが手薄になっている（兵4割減）。攻めるなら今だ。`,
    choices: () => [{ label: '承知' }],
    apply(s, p) { if (s.castles[p.castle].owner === 'none') scaleTroops(s, [p.castle], 0.6); return ''; },
  },
  defect: {
    icon: '密', title: '寝返りの誘い', weight: 2,
    cond: (s) => defectCandidates(s).length > 0,
    init: (s) => ({ gid: pick(defectCandidates(s)).id }),
    text: (s, p) => {
      const g = s.gens[p.gid];
      return `${CLANS[g.clan].name}の${g.name}（${g.title}）から密書が届いた。「金300をいただければ、${pName()}に寝返りましょう」`;
    },
    gen: (s, p) => p.gid,
    choices: (s) => [{ label: '受け入れる（金300）', disabled: s.gold[PLAYER] < 300 }, { label: '断る' }],
    apply(s, p, ci) {
      const g = s.gens[p.gid];
      if (ci !== 0 || !CLANS[g.clan] || g.clan === PLAYER) return '密書は燃やした。';
      const from = g.clan;
      const dest = MAP.adj[g.loc].find((n) => s.castles[n].owner === PLAYER) || homeCastle(s);
      s.gold[PLAYER] -= 300;
      g.clan = PLAYER;
      g.loc = dest;
      changeFriend(s, from, -10);
      return `${g.name}が寝返った！（${MAP.byId[dest].short}に入った）`;
    },
  },
  offerTruce: {
    icon: '和', title: '停戦の申し出', weight: 0,
    text: (s, p) => `${CLANS[p.clan].name}の使者が来た。「${DIPLO.truceTurns}季のあいだ、停戦しませんか」`,
    choices: () => [{ label: '受ける' }, { label: '断る' }],
    apply(s, p, ci) {
      if (ci === 0) { s.rel[p.clan].truce = DIPLO.truceTurns; return `${CLANS[p.clan].name}と停戦した。`; }
      changeFriend(s, p.clan, -5);
      return '申し出を断った。';
    },
  },
  offerAlly: {
    icon: '盟', title: '同盟の申し出', weight: 0,
    text: (s, p) => `${CLANS[p.clan].name}の使者が来た。「${DIPLO.allyTurns}季のあいだ、同盟を結びませんか」`,
    choices: () => [{ label: '受ける' }, { label: '断る' }],
    apply(s, p, ci) {
      if (ci === 0) { s.rel[p.clan].ally = DIPLO.allyTurns; s.rel[p.clan].truce = 0; return `${CLANS[p.clan].name}と同盟を結んだ！`; }
      changeFriend(s, p.clan, -5);
      return '申し出を断った。';
    },
  },
};

// プレイヤーの家と接している敵城にいる、当主以外の武将
function defectCandidates(s) {
  return borderEnemies(s, (o) => o !== 'none' && CLANS[o] && !atPeace(s, PLAYER, o))
    .flatMap((id) => gensAt(s, id))
    .filter((g) => !g.lord && gensAt(s, g.loc).length > 1);
}

const FAREWELLS = ['あとは頼んだぞ。', '天下統一の夢、お前たちに託す。', 'この学び舎で過ごした日々は忘れぬ。',
  'わが家訓を胸に、前へ進め！', '振り返るな。わが家はまだ強くなる。'];

function rollEvents(s) {
  const list = [];
  // 当主の卒業：後継者選びを最初に
  if (s.grad && s.grad.lordLeft) {
    const cands = successionCandidates(s).map((g) => g.id);
    if (cands.length) list.push({ id: 'succession', p: { old: s.grad.lordLeft, cands, words: pick(FAREWELLS) } });
  }
  const season = ['spring', 'summer', 'autumn', 'winter'][s.turn % 4];
  list.push({ id: season, p: {} });

  // ランダムな出来事（55%）
  if (Math.random() < 0.55) {
    const pool = Object.entries(EVENTS).filter(([, e]) => e.weight && (!e.cond || e.cond(s)));
    let r = Math.random() * pool.reduce((a, [, e]) => a + e.weight, 0);
    for (const [id, e] of pool) {
      r -= e.weight;
      if (r <= 0) { list.push({ id, p: e.init ? e.init(s) : {} }); break; }
    }
  }

  // 外交の申し出
  if (!s.encircle && Math.random() < 0.2) {
    const alive = aiClans().filter((k) => castlesOf(s, k).length && !atPeace(s, PLAYER, k));
    const ally = alive.filter((k) => s.rel[k].friend >= 65);
    const truce = alive.filter((k) => s.rel[k].friend >= 40 || castlesOf(s, k).length * 3 < castlesOf(s, PLAYER).length);
    if (ally.length) list.push({ id: 'offerAlly', p: { clan: pick(ally) } });
    else if (truce.length) list.push({ id: 'offerTruce', p: { clan: pick(truce) } });
  }
  return list;
}

function eventView(s, ev) {
  const e = EVENTS[ev.id];
  return {
    icon: e.icon, title: e.title,
    text: e.text(s, ev.p),
    choices: e.choices(s, ev.p),
    gid: e.gen ? e.gen(s, ev.p) : null,
    choiceGens: e.choiceGens ? e.choiceGens(s, ev.p) : null,
  };
}

function resolveEvent(s, ev, ci) {
  return EVENTS[ev.id].apply(s, ev.p, ci) || '';
}
