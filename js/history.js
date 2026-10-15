// ---------- 時代を動かす出来事（歴史イベント） ----------
// 数年に一度、天下の形を変える大きな出来事が起こる。下剋上・お家再興・共通テスト・大地震
// どれも「時代が動く」の墨の一閃から始まり、自分の家の決断を求められる。EVENTS に era: true で加える
const ERA = { from: 6, gap: 6, chance: 0.4 };

// 下剋上：大きな他家で、力のある家臣が謀反。いる城とそのまわりの城が離反して独立校に
function gekokujoPlan(s) {
  const big = aiClans().filter((k) => castlesOf(s, k).length >= 6).sort((a, b) => castlesOf(s, b).length - castlesOf(s, a).length)[0];
  if (!big) return null;
  const rebel = bestBy(gensOf(s, big).filter((g) => !g.lord && g.loc && !isCapital(g.loc, big)), (g) => g.str + g.cha);
  if (!rebel) return null;
  const towns = [rebel.loc, ...MAP.adj[rebel.loc].filter((n) => s.castles[n].owner === big && !isCapital(n, big))].slice(0, 3);
  return { clan: big, gid: rebel.id, towns };
}
// お家再興：滅んだ家が、本拠の地でよみがえる（本拠がいま自分の城でなければ）
function saikoPlan(s) {
  const gone = scenarioClans(s.scenario).filter((k) => k !== PLAYER && MAP.byId[k] && !castlesOf(s, k).length && s.castles[k].owner !== PLAYER && !(s.revived || []).includes(k));
  if (!gone.length) return null;
  const clan = pick(gone);
  return { clan, from: s.castles[clan].owner };
}
// 大地震：ある地方のまわりの城が、どの家のものでも被災する
function jishinPlan(s) {
  const c = pick(MAP.nodes);
  const R = Math.max(MAP.width, MAP.height) * 0.16;
  const hit = MAP.nodes.filter((n) => Math.hypot(n.x - c.x, n.y - c.y) < R).map((n) => n.id);
  return hit.length >= 3 ? { center: c.id, hit } : null;
}

Object.assign(EVENTS, {
  gekokujo: {
    icon: '叛', title: '下剋上', era: true, weight: 0,
    cond: (s) => !!gekokujoPlan(s),
    init: (s) => gekokujoPlan(s),
    text: (s, p) => {
      const g = s.gens[p.gid];
      return `${CLANS[p.clan].name}の${g.title}・${g.name}が、主家に反旗をひるがえした！\n「もはや当主の器にあらず。この地は、われらが治める」\n${p.towns.map((t) => MAP.byId[t].short).join('・')}が${CLANS[p.clan].name}を離れ、独立した。`;
    },
    gen: (s, p) => p.gid,
    choices: (s) => [{ label: '謀反人を迎え入れる（金400）', sub: 'その将が家臣に加わる', disabled: s.gold[PLAYER] < 400 }, { label: '乱世の常と見守る', sub: '独立した城は攻めどきかもしれない' }],
    apply(s, p, ci) {
      const g = s.gens[p.gid];
      p.towns.forEach((t) => {
        const c = s.castles[t];
        if (c.owner !== p.clan) return;
        c.owner = 'none';
        c.troops = Math.round((c.troops * 0.7) / 10) * 10;
        gensAt(s, t).filter((x) => x.clan === p.clan && x.id !== p.gid).forEach((x) => { x.clan = 'ronin'; x.loc = null; });
      });
      addNews(s, `${CLANS[p.clan].name}で下剋上`, `${g.name}の謀反で${p.towns.length}城が離反`, 85);
      if (ci === 0 && g && s.gold[PLAYER] >= 400) {
        s.gold[PLAYER] -= 400;
        g.clan = PLAYER; g.loc = homeCastle(s); g.loyal = randInt(45, 60);
        sagaAdd(s, g, `${CLANS[p.clan].name}に謀反し、${pName()}に身を寄せる`);
        return `${g.name}が${pName()}に加わった。「この恩、天下で返しましょう」`;
      }
      if (g) { g.clan = 'ronin'; g.loc = null; sagaAdd(s, g, `${CLANS[p.clan].name}に謀反を起こす`); }
      return `${CLANS[p.clan].name}は大きく揺らいでいる。`;
    },
  },
  saiko: {
    icon: '興', title: 'お家再興', era: true, weight: 0,
    cond: (s) => !!saikoPlan(s),
    init: (s) => saikoPlan(s),
    text: (s, p) => `滅んだはずの${CLANS[p.clan].name}の旧臣たちが、${MAP.byId[p.clan].name}に再び旗を掲げた！\n「わが家は、まだ終わってはおらぬ」\n${p.from !== 'none' && CLANS[p.from] ? `${CLANS[p.from].name}の守りを破り、` : ''}本拠の地を取り戻した。`,
    choices: () => [{ label: '再興を祝い、よしみを通じる', sub: `友好度が大きく上がり、しばらく停戦` }, { label: '天下の邪魔と見る', sub: '関係はそのまま' }],
    apply(s, p, ci) {
      const c = s.castles[p.clan];
      if (c.owner === PLAYER) return '……だが旗は、すぐに降ろされた。';
      s.revived = [...(s.revived || []), p.clan];
      c.owner = p.clan;
      c.troops = Math.max(c.troops, 1200);
      gensAt(s, p.clan).filter((x) => x.clan !== p.clan).forEach((x) => { x.loc = null; x.clan = 'ronin'; });
      const lord = makeGeneral(s, p.clan, p.clan, { strong: true, title: '再興の当主', grade: 2 });
      lord.lord = true;
      makeGeneral(s, p.clan, p.clan, { strong: true, grade: 1 });
      sagaAdd(s, lord, `滅んだ${CLANS[p.clan].name}を再興し、当主となる`);
      s.gold[p.clan] = Math.max(s.gold[p.clan] || 0, 600);
      if (s.rel[p.clan]) {
        if (ci === 0) { s.rel[p.clan].friend = Math.max(s.rel[p.clan].friend, 70); s.rel[p.clan].truce = DIPLO.truceTurns; }
      }
      addNews(s, `${CLANS[p.clan].name}、再興`, `旧臣が${MAP.byId[p.clan].short}に旗を掲げる`, 85);
      return ci === 0 ? `${CLANS[p.clan].name}と停戦した。再興の当主・${lord.name}は深く感謝している。` : `${CLANS[p.clan].name}の旗が、再び${MAP.byId[p.clan].short}にひるがえる。`;
    },
  },
  kyotsu: {
    icon: '試', title: '大学入学共通テスト', era: true, weight: 0,
    cond: (s) => s.turn % 4 === 3 && s.turn >= 7,
    text: (s) => `天下の受験生が一斉に机に向かう、共通テストの季節がやってきた。\nどの家も、この季ばかりは戦どころではない。${pName()}はどうする？`,
    choices: (s) => [{ label: '家臣に勉学を命じる（金300）', sub: '全家臣の知略・政治が伸び、忠誠+3', disabled: s.gold[PLAYER] < 300 }, { label: '戦の備えを優先する', sub: '本拠の兵が1割増える' }],
    apply(s, p, ci) {
      aiClans().forEach((k) => gensOf(s, k).forEach((g) => { if (g.int < 100 && Math.random() < 0.5) g.int++; }));
      addNews(s, '共通テスト、天下の受験生が挑む', 'どの家も勉学に励む', 50);
      if (ci === 0 && s.gold[PLAYER] >= 300) {
        s.gold[PLAYER] -= 300;
        gensOf(s, PLAYER).forEach((g) => {
          g.int = Math.min(100, g.int + randInt(1, 3));
          g.pol = Math.min(100, g.pol + randInt(0, 2));
          changeLoyal(g, 3);
        });
        return '家臣そろって机に向かった。夜更けまで灯りの消えぬ城に、皆の知恵が磨かれていく。（知略・政治が伸びた）';
      }
      const home = homeCastle(s);
      if (home) s.castles[home].troops = Math.min(RULES.troopCap, Math.round((s.castles[home].troops * 1.1) / 10) * 10);
      return '他家が机に向かうあいだ、わが家は兵を鍛えた。（本拠の兵+1割）';
    },
  },
  jishin: {
    icon: '震', title: '大地震', era: true, weight: 0,
    cond: (s) => !!jishinPlan(s),
    init: (s) => jishinPlan(s),
    text: (s, p) => {
      const mine = p.hit.filter((id) => s.castles[id].owner === PLAYER);
      const houses = [...new Set(p.hit.map((id) => s.castles[id].owner).filter((o) => o !== 'none' && o !== PLAYER))];
      return `${MAP.byId[p.center].name}のあたりを、大きな地震が襲った！\n${p.hit.length}の城で校舎が傷み、兵が減った。${mine.length ? `わが家の${mine.map((id) => MAP.byId[id].short).join('・')}も被害を受けた。` : ''}${houses.length ? `\n${houses.map((k) => CLANS[k].name).join('・')}の城も被災している。` : ''}`;
    },
    choices: (s) => [{ label: '被災した城すべてに救援を送る（金300）', sub: '自分の城の被害が半分に・被災した家と友好', disabled: s.gold[PLAYER] < 300 }, { label: '自分の城の復旧に専念する' }],
    apply(s, p, ci) {
      const help = ci === 0 && s.gold[PLAYER] >= 300;
      if (help) s.gold[PLAYER] -= 300;
      const houses = new Set();
      p.hit.forEach((id) => {
        const c = s.castles[id];
        const mine = c.owner === PLAYER;
        const f = mine && help ? 0.88 : 0.75;
        c.troops = Math.round((c.troops * f) / 10) * 10;
        c.def = Math.max(1, Math.round((c.def - (mine && help ? 0.1 : 0.25)) * 10) / 10);
        c.eco = Math.max(20, c.eco - (mine && help ? 4 : 10));
        if (c.owner !== 'none' && c.owner !== PLAYER) houses.add(c.owner);
      });
      if (help) houses.forEach((k) => { if (s.rel[k]) changeFriend(s, k, 12); });
      addNews(s, `${MAP.byId[p.center].short}一帯で大地震`, `${p.hit.length}城が被災`, 70);
      return help ? `${pName()}の救援は、敵味方を問わず被災した城に届いた。${houses.size ? `（${[...houses].map((k) => CLANS[k].name).join('・')}の友好度+12）` : ''}` : '城の復旧を急がせた。';
    },
  },
});

// 数年に一度、季節の行事のあとに時代の出来事をひとつ
const _eraRoll = rollEvents;
rollEvents = function (s) {
  const list = _eraRoll(s);
  if (s.turn >= ERA.from && s.turn - (s.lastEra ?? -99) >= ERA.gap && Math.random() < ERA.chance) {
    const pool = ['gekokujo', 'saiko', 'kyotsu', 'jishin'].filter((id) => !(s.eraSeen || []).includes(id) || id === 'jishin' || id === 'kyotsu').filter((id) => EVENTS[id].cond(s));
    if (pool.length) {
      const id = pick(pool);
      s.lastEra = s.turn;
      s.eraSeen = [...new Set([...(s.eraSeen || []), id])];
      list.splice(1, 0, { id, p: EVENTS[id].init ? EVENTS[id].init(s) : {} });
    }
  }
  return list;
};

// ---------- 武将の列伝：その人の歩みを、季と一行で残す ----------
const SAGA_MAX = 14;
function sagaAdd(s, g, text) {
  if (!g) return;
  g.saga = g.saga || [];
  if (g.saga.length && g.saga[g.saga.length - 1].x === text) return;
  g.saga.push({ t: s.turn || 0, x: text });
  if (g.saga.length > SAGA_MAX) g.saga.splice(1, 1); // 最初の一行（入学）は残して、古いものから
}
// 戦いの節目を拾う
const _sagaRecordBattle = recordBattle;
recordBattle = function (s, r) {
  const ga = s.gens[r.gid], gd = r.dgid ? s.gens[r.dgid] : null;
  const firstA = ga && !(ga.rec && (ga.rec.w + ga.rec.l));
  _sagaRecordBattle(s, r);
  const to = MAP.byId[r.to] ? MAP.byId[r.to].short : '';
  if (ga) {
    if (r.won) sagaAdd(s, ga, `${firstA ? '初陣で' : ''}${to}を攻め落とす${r.defender !== 'none' && CLANS[r.defender] ? `（${CLANS[r.defender].name}から）` : ''}`);
    else if (firstA) sagaAdd(s, ga, `初陣、${to}を攻めるも敗れる`);
    if (r.won && isCapital(r.to, r.defender)) sagaAdd(s, ga, `${CLANS[r.defender].name}の本拠を落とす大功`);
  }
  if (gd && !r.won && r.defender !== 'none') sagaAdd(s, gd, `${to}で${CLANS[r.attacker] ? CLANS[r.attacker].name : ''}の攻めを退ける`);
};
const _sagaRecordDuel = recordDuel;
recordDuel = function (s, winner, loser) {
  _sagaRecordDuel(s, winner, loser);
  if (winner && loser) { sagaAdd(s, winner, `一騎打ちで${loser.name}を破る`); sagaAdd(s, loser, `一騎打ちで${winner.name}に敗れる`); }
};
// 列伝の絵巻（日付と一行）
function sagaScroll(g) {
  const rows = [{ t: g.since || 0, x: `${MAP.byId[g.school] ? MAP.byId[g.school].name : ''}に入学${g.title ? `（${g.title}）` : ''}` }, ...(g.saga || [])];
  return `<ol class="saga">${rows.map((r) => `<li><span>${dateLabel(r.t)}</span><p>${esc(r.x)}</p></li>`).join('')}</ol>`;
}

// 当主になった、家臣に加わった
const _sagaSucceed = succeed;
succeed = function (s, gid) { const r = _sagaSucceed(s, gid); const g = s.gens[gid]; if (g) sagaAdd(s, g, `${s.lords.length}代目当主となる`); return r; };
const _sagaCaptive = tryRecruitCaptive;
tryRecruitCaptive = function (s, gid) { const from = s.gens[gid] && s.gens[gid].clan; const ok = _sagaCaptive(s, gid); if (ok && s.gens[gid]) sagaAdd(s, s.gens[gid], `${CLANS[from] ? CLANS[from].name + 'から' : ''}${pName()}に降る`); return ok; };
