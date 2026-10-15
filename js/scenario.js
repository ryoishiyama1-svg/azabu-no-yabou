// ---------- 群雄の構図と戦局の節目 ----------
// 旗揚げのときから、天下には構図がある：自分の家の宿敵、睨み合う二家、手を結ぶ二家
// そして戦局は動く：三年目に「三強の時代」、どこかの家が天下の三割を握れば「覇者の台頭」と包囲網
const NEMESIS = { morale: 8, gold: 1000, loyal: 10 };
const HASHA = { share: 0.3, turns: 10, from: 16 };

const capOf = (s, k) => (MAP.byId[k] && s.castles[k] && s.castles[k].owner === k ? k : castlesOf(s, k)[0]);
const nodeDist = (a, b) => (MAP.byId[a] && MAP.byId[b] ? Math.hypot(MAP.byId[a].x - MAP.byId[b].x, MAP.byId[a].y - MAP.byId[b].y) : 1e9);

// 構図を決める（乱数は使わない：腕比べでも同じ構図になる）
function setupRivalry(s) {
  const ai = aiClans().filter((k) => castlesOf(s, k).length);
  if (!ai.length) return;
  const me = capOf(s, PLAYER);
  s.nemesis = ai.reduce((a, b) => (nodeDist(me, capOf(s, a)) <= nodeDist(me, capOf(s, b)) ? a : b));
  if (s.rel[s.nemesis]) s.rel[s.nemesis].friend = Math.min(s.rel[s.nemesis].friend, 25);
  const others = ai.filter((k) => k !== s.nemesis);
  if (others.length < 3) return;
  // 睨み合う二家：いちばん近くにいる大きな二家
  const pairs = [];
  others.forEach((a, i) => others.slice(i + 1).forEach((b) => pairs.push([a, b, nodeDist(capOf(s, a), capOf(s, b))])));
  pairs.sort((x, y) => x[2] - y[2]);
  const [ra, rb] = pairs[0];
  aiRel(s, ra, rb).friend = 5;
  // 手を結ぶ二家：残りのうち、近い二家
  const ally = pairs.find(([a, b]) => ![ra, rb].includes(a) && ![ra, rb].includes(b));
  if (ally) { const r = aiRel(s, ally[0], ally[1]); r.friend = 80; r.ally = 8; }
  s.rivalry = { feud: [ra, rb], pact: ally ? [ally[0], ally[1]] : null };
}
const _scNewGame = newGame;
newGame = function (...a) { const s = _scNewGame(...a); setupRivalry(s); return s; };

// 宿敵との合戦は、士気が上がる
const _scStartBattle = startBattle;
startBattle = function (s, o) {
  const B = _scStartBattle(s, o);
  if (s.nemesis) {
    if (B.attacker === PLAYER && B.defender === s.nemesis) B.a.morale = clamp(B.a.morale + NEMESIS.morale, 15, 100);
    if (B.defender === PLAYER && B.attacker === s.nemesis) B.d.morale = clamp(B.d.morale + NEMESIS.morale, 15, 100);
  }
  return B;
};

// ---------- 戦局の節目（時代の出来事と同じ、墨の一閃から） ----------
function topHouses(s, n) {
  return aiClans().filter((k) => castlesOf(s, k).length).sort((a, b) => castlesOf(s, b).length - castlesOf(s, a).length).slice(0, n);
}
Object.assign(EVENTS, {
  sankyo: {
    icon: '鼎', title: '三強の時代', era: true, weight: 0,
    init: (s) => ({ top: topHouses(s, 3) }),
    text: (s, p) => `群雄割拠の世も三年。いま天下を窺うのは、この三家だ。\n${p.top.map((k, i) => `${'一二三'[i]}、${CLANS[k].name}（${castlesOf(s, k).length}城）${typeof taishiOf === 'function' && taishiOf(s, k) ? `志「${TAISHI[taishiOf(s, k).k].motto}」` : ''}`).join('\n')}\n${pName()}は${castlesOf(s, PLAYER).length}城。${p.top.includes(PLAYER) ? '' : 'まだ三強には数えられていない。'}`,
    choices: () => [{ label: 'いずれ、すべて倒す' }],
    apply: (s) => { addNews(s, '三強の時代', topHouses(s, 3).map((k) => CLANS[k].name).join('・'), 70); return ''; },
  },
  hasha: {
    icon: '覇', title: '覇者の台頭', era: true, weight: 0,
    init: (s) => ({ top: topHouses(s, 1)[0] }),
    text: (s, p) => `${CLANS[p.top].name}が天下の三割を握った！\n「このままでは、すべて呑まれる」——諸家は手を結び、${CLANS[p.top].name}包囲網を敷いた。\n${pName()}も誘われている。`,
    choices: (s, p) => [{ label: '包囲網に加わる', sub: `諸家と停戦し友好が上がる・${CLANS[p.top].name}とは敵対` }, { label: '漁夫の利を狙う', sub: '加わらず、両者が疲れるのを待つ' }],
    apply(s, p, ci) {
      const others = aiClans().filter((k) => k !== p.top && castlesOf(s, k).length);
      others.forEach((a, i) => others.slice(i + 1).forEach((b) => { const r = aiRel(s, a, b); r.ally = Math.max(r.ally, HASHA.turns); r.truce = 0; r.friend = Math.max(r.friend, 70); }));
      others.forEach((k) => { const r = aiRel(s, k, p.top); r.ally = 0; r.truce = 0; r.friend = Math.min(r.friend, 10); });
      s.hasha = { top: p.top, until: s.turn + HASHA.turns };
      addNews(s, `${CLANS[p.top].name}包囲網`, '諸家が手を結ぶ', 85);
      if (ci === 0) {
        others.forEach((k) => { if (s.rel[k]) { changeFriend(s, k, 15); s.rel[k].truce = Math.max(s.rel[k].truce, DIPLO.truceTurns); } });
        if (s.rel[p.top]) { changeFriend(s, p.top, -20); s.rel[p.top].truce = 0; s.rel[p.top].ally = 0; }
        return `${pName()}は包囲網に加わった。諸家と停戦し、矛先は${CLANS[p.top].name}へ。`;
      }
      return `${pName()}は静観を決めた。${CLANS[p.top].name}と諸家の潰し合いを、高みから見るとしよう。`;
    },
  },
});
const _scRoll = rollEvents;
rollEvents = function (s) {
  const list = _scRoll(s);
  if (!s.sankyoDone && s.turn >= 12 && topHouses(s, 3).length === 3) {
    s.sankyoDone = true;
    list.splice(1, 0, { id: 'sankyo', p: EVENTS.sankyo.init(s) });
  }
  const top = topHouses(s, 1)[0];
  if (!s.hashaDone && top && s.turn >= HASHA.from && castlesOf(s, top).length >= 6 && castlesOf(s, top).length / MAP.nodes.length >= HASHA.share && topHouses(s, 3).length >= 3) {
    s.hashaDone = true;
    list.splice(1, 0, { id: 'hasha', p: { top } });
  }
  return list;
};

// ---------- 画面：宿敵の札と、宿敵を討ったときの決め絵 ----------
function nemesisChip(s) {
  if (!s.nemesis || !CLANS[s.nemesis]) return '';
  const alive = castlesOf(s, s.nemesis).length;
  return `<p class="nemesis-chip ${alive ? '' : 'done'}"><span>宿敵の家</span>${CLANS[s.nemesis].name}${alive ? `（${alive}城）` : '──討ち果たした'}</p>`;
}
function checkNemesis(s) {
  if (!s.nemesis || s.nemesisDone || castlesOf(s, s.nemesis).length) return null;
  s.nemesisDone = true;
  const mine = MAP.byId[s.nemesis] && s.castles[s.nemesis].owner === PLAYER;
  if (!mine) { addNews(s, `${pName()}の宿敵・${CLANS[s.nemesis].name}、他家に滅ぼさる`, '因縁は思わぬ形で幕を閉じた', 60); return null; }
  s.gold[PLAYER] += NEMESIS.gold;
  gensOf(s, PLAYER).forEach((g) => changeLoyal(g, NEMESIS.loyal));
  addNews(s, `${pName()}、宿敵${CLANS[s.nemesis].name}を討ち果たす`, '長き因縁に決着', 90);
  return s.nemesis;
}

// 古いセーブ（宿敵のなかった頃）を開いたら、宿敵だけを決める（他家どうしの構図は変えない）
const _scMigrate = migrate;
migrate = function (data) {
  const s = _scMigrate(data);
  if (s && !s.nemesis && !s.result) {
    const ai = aiClans().filter((k) => castlesOf(s, k).length);
    const me = capOf(s, PLAYER);
    if (ai.length && me) s.nemesis = ai.reduce((a, b) => (nodeDist(me, capOf(s, a)) <= nodeDist(me, capOf(s, b)) ? a : b));
  }
  return s;
};
