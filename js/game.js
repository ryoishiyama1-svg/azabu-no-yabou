// 地図の作成・ゲームのルール・武将・合戦・敵の思考
// プレイヤーが率いる家（他家でも遊べるように変えられる）
let PLAYER = 'azabu';
function setPlayer(clan) { PLAYER = CLANS[clan] ? clan : 'azabu'; return PLAYER; }
const pName = () => CLANS[PLAYER].name;              // 例：麻布家
const pShort = () => CLANS[PLAYER].name.replace('家', ''); // 例：麻布
const RULES = {
  aiStartGold: 600,
  recruitCost: 200, recruitAmount: 300, troopCap: 9990,
  developCost: 200, developAmount: 15, ecoCap: 250,
  fortifyCost: 300, fortifyAmount: 0.1, defCap: 1.8,
  neutralCap: 1500,
  delegateRatio: 1.5, delegateReserve: 200,
};

// ---------- 乱数 ----------
function hashStr(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- 地図 ----------
// 緯度経度を画面の座標に変換（密集している23区を広げ、多摩を縮める）
function project(lat, lon) {
  const x = lon >= 139.62 ? 700 + (lon - 139.62) * 3200 : 700 - (139.62 - lon) * 1300;
  return { x, y: (35.80 - lat) * 3200 };
}
// 首都圏版：東京の中は project と同じ。東京の外（神奈川・埼玉・千葉）は縮めて、地図が大きくなりすぎないようにする
function projectWide(lat, lon) {
  const p = project(Math.min(35.80, Math.max(35.55, lat)), Math.min(139.90, Math.max(139.30, lon)));
  const x = p.x + (lon > 139.90 ? (lon - 139.90) * 1100 : lon < 139.30 ? -(139.30 - lon) * 800 : 0);
  const y = p.y + (lat > 35.80 ? -(lat - 35.80) * 1300 : lat < 35.55 ? (35.55 - lat) * 1300 : 0);
  return { x, y };
}

function buildMap(filter = SCENARIOS.tokyo.filter, proj = project) {
  const nodes = SCHOOL_ROWS.filter(filter).map(([id, name, short, ward, lat, lon, clan, pref]) => ({
    id, name, short, ward, pref: pref || null, clan: clan || 'none', ...proj(lat, lon),
  }));

  // 近すぎる城を押し広げる
  const MIN = 76;
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < MIN) {
          const push = (MIN - d) / 2;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }

  const PAD = 70;
  const minX = Math.min(...nodes.map((n) => n.x)), minY = Math.min(...nodes.map((n) => n.y));
  nodes.forEach((n) => { n.x = Math.round(n.x - minX + PAD); n.y = Math.round(n.y - minY + PAD); });
  const width = Math.max(...nodes.map((n) => n.x)) + PAD;
  const height = Math.max(...nodes.map((n) => n.y)) + PAD;
  // 川や湾を描くための「緯度経度 → 地図座標」
  const geo = (lat, lon) => {
    const p = proj(lat, lon);
    return { x: p.x - minX + PAD, y: p.y - minY + PAD };
  };

  // ガブリエルグラフで隣接関係を作る（間に他の城がない2城を道でつなぐ）
  const edges = [];
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = []));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const r2 = ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 4;
      const blocked = nodes.some((c) => c !== a && c !== b && (c.x - mx) ** 2 + (c.y - my) ** 2 < r2);
      if (!blocked) {
        edges.push([a.id, b.id]);
        adj[a.id].push(b.id);
        adj[b.id].push(a.id);
      }
    }
  }

  const byId = {};
  nodes.forEach((n) => (byId[n.id] = n));
  return { nodes, byId, edges, adj, width, height, geo };
}

// 地図はシナリオごとに作り直す
let MAP = buildMap();
let MAP_SCENARIO = 'tokyo';
function setScenario(id) {
  const key = SCENARIOS[id] ? id : 'tokyo';
  if (key !== MAP_SCENARIO) {
    MAP = buildMap(SCENARIOS[key].filter, SCENARIOS[key].wide ? projectWide : project);
    MAP_SCENARIO = key;
  }
  return key;
}

// ---------- 武将の作成 ----------
function makeGeneral(s, school, clan, { strong = false, title, grade } = {}) {
  const female = GIRLS_SCHOOLS.includes(school) ? true : BOYS_SCHOOLS.includes(school) ? false : Math.random() < 0.35;
  let name, tries = 0;
  do {
    name = `${pick(SURNAMES)} ${pick(female ? FEMALE_NAMES : MALE_NAMES)}`;
  } while (s.usedNames[name] && ++tries < 50);
  s.usedNames[name] = true;

  const [lo, hi] = strong ? [55, 85] : [30, 72];
  const g = {
    id: `g${++s.genSeq}`,
    name, female,
    title: title || pick(TITLES),
    school, origin: clan, clan, loc: school,
    grade: grade || randInt(1, 3), // 学年。3年生は春に卒業する
    loyal: randInt(58, 78),        // 忠誠度
    str: randInt(lo, hi), pol: randInt(lo, hi), cha: randInt(lo, hi), int: randInt(lo, hi),
    skill: Math.random() < (strong ? 0.55 : 0.25) ? pick(Object.keys(SKILLS)) : null,
    look: randInt(0, 9999),
    since: s.turn || 0, // 入学（登場）した季
    club: pick(Object.keys(CLUBS)), // 部活（得意な戦い方）
  };
  const best = pick(['str', 'pol', 'cha', 'int']);
  g[best] = Math.min(98, g[best] + randInt(8, 16)); // 得意な能力
  s.gens[g.id] = g;
  return g;
}

// ---------- 学校の特色と施設 ----------
function traitOf(id) {
  const keys = Object.keys(TRAITS);
  return keys[hashStr(`${id}-trait`) % keys.length];
}
function hasFac(s, id, f) {
  return (s.castles[id].fac || []).includes(f);
}
function canBuild(s, id, f) {
  const c = s.castles[id];
  return (c.fac || []).length < FAC_SLOTS && !hasFac(s, id, f) && s.gold[c.owner] >= FACILITIES[f].cost;
}
function build(s, id, f, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= FACILITIES[f].cost;
  c.fac = [...(c.fac || []), f];
  if (g) { s.acted[g.id] = true; grow(g, 'pol'); }
}

// 季節ごとに、城の特色と図書館で武将が少し育つ
function traitTick(s) {
  Object.keys(s.castles).forEach((id) => {
    const stat = TRAITS[traitOf(id)].stat;
    const lib = hasFac(s, id, 'library');
    gensAt(s, id).forEach((g) => {
      if (g[stat] < 100 && Math.random() < 0.2) g[stat]++;
      if (lib && Math.random() < 0.3) { const k = pick(['pol', 'int']); if (g[k] < 100) g[k]++; }
    });
  });
}

// 他家と委任した城の建設：金に余裕があるときに、役に立つ施設を建てる
function autoBuild(s, clan, id, reserve) {
  const c = s.castles[id];
  if ((c.fac || []).length >= FAC_SLOTS) return false;
  const front = hostileNeighbors(s, id).some((n) => s.castles[n].owner !== 'none');
  const order = front ? ['gym', 'tower', 'shop'] : ['shop', 'library', 'gym'];
  const f = order.find((x) => !hasFac(s, id, x));
  if (!f || s.gold[clan] < FACILITIES[f].cost + reserve) return false;
  build(s, id, f, null);
  return true;
}

// ---------- ゲームの状態 ----------
function newGame({ lordName = '麻布 一郎', diff = 'normal', scenario = 'tokyo', tutorial = false, clan = 'azabu' } = {}) {
  scenario = setScenario(scenario);
  setPlayer(MAP.byId[clan] ? clan : 'azabu');
  const D = DIFFICULTY[diff];
  const s = {
    turn: 0, diff, scenario, player: PLAYER, gold: {}, castles: {}, gens: {}, genSeq: 0, usedNames: {},
    acted: {}, delegate: {}, log: [], result: null, tut: tutorial ? 1 : 0,
  };
  MAP.nodes.forEach((n) => {
    const r = seeded(hashStr(n.id));
    const capital = n.clan !== 'none';
    // 乱数を引く順番（兵→防御→経済）は変えないこと。変えると各校の初期値が入れ替わってしまう
    const troops = capital ? 1500 : Math.round((400 + r() * 700) / 10) * 10;
    const baseDef = capital ? 1.5 : Math.round((1 + r() * 0.5) * 10) / 10;
    const eco = capital ? 120 : Math.round(40 + r() * 60);
    s.castles[n.id] = {
      owner: n.clan,
      troops,
      // 伝統校は守りが固い
      def: traitOf(n.id) === 'traditional' ? Math.min(RULES.defCap, Math.round((baseDef + 0.2) * 10) / 10) : baseDef,
      eco,
      fac: [],
    };
    if (n.clan === PLAYER) {
      const lord = makeGeneral(s, n.id, PLAYER, { strong: true, title: '当主', grade: 2 });
      Object.assign(lord, { name: lordName, str: 72, pol: 68, cha: 84, int: 70, skill: 'jinbou', lord: true });
      // 家臣は1・2年生中心（最初の春にいきなり大勢卒業しないように）
      // 麻布家以外は地図の真ん中で四方から攻められやすいので、家臣を1人多くする
      const grades = PLAYER === 'azabu' ? [1, 2, 1, 2] : [1, 2, 1, 2, 1];
      grades.forEach((grade, i) => {
        const g = makeGeneral(s, n.id, PLAYER, { strong: true, grade, title: i === 0 ? '生徒会長' : undefined });
        g.loyal = randInt(80, 92); // 旗揚げからの家臣は忠誠が厚い
      });
      lord.loyal = 100;
    } else if (capital) {
      for (let i = 0; i < 5; i++) makeGeneral(s, n.id, n.clan, { strong: i < 3, title: i === 0 ? '生徒会長' : undefined });
    } else {
      const count = Math.random() < 0.6 ? 2 : 3;
      for (let i = 0; i < count; i++) makeGeneral(s, n.id, 'none', { title: i === 0 ? '生徒会長' : undefined });
    }
  });
  const sc = SCENARIOS[scenario];
  Object.keys(CLANS).forEach((k) => {
    s.gold[k] = k === PLAYER ? D.gold : Math.round(RULES.aiStartGold * D.aiGold * (sc.aiGold || 1));
  });
  if (PLAYER !== 'azabu') {
    s.gold[PLAYER] += 800;                 // 旗揚げの軍資金
    s.castles[PLAYER].troops += 800;
  }
  const lord = lordOf(s);
  s.kakun = kakunOf(lord);
  s.lords = [{ name: lord.name, from: 0, kakun: s.kakun }];
  return migrate(s);
}

// 古いセーブデータに、あとから増えた項目を足す
function migrate(s) {
  s.scenario = setScenario(s.scenario || 'tokyo');
  s.player = setPlayer(s.player || 'azabu');
  s.tut = s.tut || 0;
  Object.values(s.gens).forEach((g) => {
    if (!g.grade) g.grade = g.lord ? 2 : randInt(1, 3);
    if (g.loyal === undefined) g.loyal = g.lord ? 100 : 72;
  });
  s.rewarded = s.rewarded || {};
  Object.values(s.castles).forEach((c) => { if (!c.fac) c.fac = []; });
  if (!s.kakun) { const l = lordOf(s); s.kakun = l ? kakunOf(l) : 'cha'; }
  if (!s.lords) { const l = lordOf(s); s.lords = l ? [{ name: l.name, from: 0, kakun: s.kakun }] : []; }
  s.stats = Object.assign({ battlesWon: 0, tacticWins: 0, recruited: 0, diplo: 0, minCastles: 99 }, s.stats || {});
  s.rel = s.rel || {};
  aiClans().forEach((k) => { s.rel[k] = s.rel[k] || { friend: 30, truce: 0, ally: 0 }; });
  s.encircle = !!s.encircle;
  s.pending = s.pending || [];
  s.pendingDefense = s.pendingDefense || [];
  s.aiRel = s.aiRel || {};
  s.underAttack = s.underAttack || {};
  s.diploLog = s.diploLog || [];
  s.vault = s.vault || [];
  initTreasures(s);
  Object.values(s.gens).forEach((g) => { if (!g.club) g.club = Object.keys(CLUBS)[hashStr(g.id) % 6]; });
  if (!WEATHER[s.weather]) s.weather = s.turn === 0 ? 'sun' : rollWeather(s.turn);
  // 当主が家を離れてしまったセーブ（家督相続の前の合戦で候補が捕らわれた不具合）を直す
  if (castlesOf(s, PLAYER).length && !lordOf(s) && !(s.pending || []).some((ev) => ev.id === 'succession')) {
    Object.values(s.gens).forEach((g) => { if (g.lord && g.clan !== PLAYER) g.lord = false; });
    const heir = successionCandidates(s)[0];
    if (heir) {
      heir.lord = true; heir.title = '当主'; heir.loyal = 100;
      s.lords.push({ name: heir.name, from: s.turn, kakun: s.kakun });
    }
  }
  // 以前の「停戦・同盟の申し出」は、使者の来訪に置きかえる
  (s.pending || []).forEach((ev) => {
    if (ev.id === 'offerTruce' || ev.id === 'offerAlly') {
      ev.p = { clan: ev.p.clan, kind: ev.id === 'offerAlly' ? 'ally' : 'truce', gold: 0, target: null, gid: null };
      ev.id = 'envoy';
    }
  });
  return s;
}

function aiClans() {
  return Object.keys(CLANS).filter((k) => k !== PLAYER && k !== 'none' && MAP.byId[k]);
}

// ---------- 外交 ----------
const DIPLO = {
  giftCost: 300,
  truceTurns: 8,
  allyTurns: 12,
  encircleShare: 0.45,
};

// ---------- 他家の性格と、他家どうしの外交 ----------
function personaOf(clan) {
  return PERSONAS[CLAN_PERSONA[clan]] || PERSONAS.balanced;
}
const aiRelKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function aiRel(s, a, b) {
  s.aiRel = s.aiRel || {};
  const k = aiRelKey(a, b);
  if (!s.aiRel[k]) s.aiRel[k] = { friend: 40, truce: 0, ally: 0 };
  return s.aiRel[k];
}
function aiBorder(s, a, b) {
  return castlesOf(s, a).some((id) => MAP.adj[id].some((n) => s.castles[n].owner === b));
}

// 毎ターン：他家どうしが停戦・同盟を結んだり、破ったりする
function tickAiDiplomacy(s, log) {
  const alive = aiClans().filter((k) => castlesOf(s, k).length);
  const share = castlesOf(s, PLAYER).length / MAP.nodes.length;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const r = aiRel(s, a, b);
      const pa = personaOf(a), pb = personaOf(b);
      const na = CLANS[a].name, nb = CLANS[b].name;
      if (r.truce > 0 && --r.truce === 0) log.push(`🕊️ ${na}と${nb}の停戦が終わった`);
      if (r.ally > 0 && --r.ally === 0) log.push(`🤝 ${na}と${nb}の同盟が期限を迎えた`);
      const border = aiBorder(s, a, b);
      // 国境を接していると仲が悪くなるが、プレイヤーが強くなると共通の敵として手を組みやすい
      const bothFacePlayer = aiBorder(s, a, PLAYER) && aiBorder(s, b, PLAYER);
      let d = r.ally || r.truce ? 1 : border ? -1 : 0;
      if (share >= 0.3 && bothFacePlayer) d += 2;
      r.friend = clamp(r.friend + d, 0, 100);
      if (s.encircle) continue; // 包囲網の間は、すでに手を組んでいる
      // 裏切り：好戦的な家は、弱った同盟相手を攻める
      if (r.ally > 0) {
        [[a, b, pa], [b, a, pb]].forEach(([x, y, px]) => {
          if (r.ally > 0 && castlesOf(s, y).length * 2 < castlesOf(s, x).length && Math.random() < px.betray) {
            r.ally = 0; r.truce = 0; r.friend = clamp(r.friend - 40, 0, 100);
            log.push(`💢 ${CLANS[x].name}が${CLANS[y].name}との同盟を破った！`);
            addDiploLog(s, `${CLANS[x].name}が${CLANS[y].name}との同盟を破った`, 'ai');
          }
        });
        continue;
      }
      if (!border) continue;
      const mood = pa.diplo * pb.diplo;
      if (r.friend >= 60 && Math.random() < 0.025 * mood) {
        r.ally = DIPLO.allyTurns; r.truce = 0;
        log.push(`🤝 ${na}と${nb}が同盟を結んだ`);
        addDiploLog(s, `${na}と${nb}が同盟を結んだ`, 'ai');
      } else if (!r.truce && Math.random() < 0.015 * mood * (r.friend >= 45 ? 2 : 1)) {
        r.truce = DIPLO.truceTurns;
        log.push(`🕊️ ${na}と${nb}が停戦した`);
        addDiploLog(s, `${na}と${nb}が停戦した`, 'ai');
      }
    }
  }
}

// 他家どうしの関係（外交の画面で表示する）
function aiRelations(s, clan) {
  return aiClans().filter((k) => k !== clan && castlesOf(s, k).length).map((k) => {
    const r = aiRel(s, clan, k);
    return { clan: k, ally: r.ally > 0, truce: r.truce > 0, friend: r.friend };
  });
}

// 2つの勢力が戦わない関係か
function atPeace(s, a, b) {
  if (a === b) return true;
  if (a === 'none' || b === 'none') return false;
  if (a === PLAYER || b === PLAYER) {
    const r = s.rel[a === PLAYER ? b : a];
    return !!r && (r.truce > 0 || r.ally > 0 || !!r.sister);
  }
  if (s.encircle) return true; // 包囲網の間、他家どうしは争わない
  const r = s.aiRel && s.aiRel[aiRelKey(a, b)];
  return !!r && (r.truce > 0 || r.ally > 0);
}

function relLabel(s, clan) {
  const r = s.rel[clan];
  if (!r) return '';
  const trade = r.trade > 0 ? `・通商（残り${r.trade}季）` : '';
  if (r.sister) return `姉妹校${trade}`;
  if (r.ally > 0) return `同盟（残り${r.ally}季）${trade}`;
  if (r.truce > 0) return `停戦（残り${r.truce}季）${trade}`;
  return `交戦中${trade}`;
}

// 通商協定で毎季入る金（相手も同じだけ得る）
function tradeIncome(s, clan) {
  return Math.round(30 + income(s, clan) * 0.06);
}

function changeFriend(s, clan, d) {
  const r = s.rel[clan];
  if (r) r.friend = clamp(Math.round(r.friend + d), 0, 100);
}

function envoyOf(s) {
  // 使者：命令できる武将のうち、いちばん魅力が高い人
  return bestBy(gensOf(s, PLAYER).filter((g) => g.loc && !s.acted[g.id] && !s.delegate[g.loc]), 'cha');
}

function truceChance(s, clan, g) {
  const r = s.rel[clan];
  const size = (castlesOf(s, PLAYER).length - castlesOf(s, clan).length) / 60;
  return clamp(((r.friend - 30) / 60 + g.cha / 400 + size) * personaOf(clan).diplo, 0.03, 0.95);
}
function allyChance(s, clan, g) {
  const r = s.rel[clan];
  return clamp(((r.friend - 50) / 45 + g.cha / 300) * personaOf(clan).diplo, 0, 0.9);
}

function diploGift(s, clan, g) {
  s.stats.diplo++;
  s.gold[PLAYER] -= DIPLO.giftCost;
  s.acted[g.id] = true;
  const d = 8 + Math.round(g.cha / 10);
  changeFriend(s, clan, d);
  grow(g, 'cha');
  return `${CLANS[clan].name}に贈り物をした。友好度 +${d}`;
}
function diploTruce(s, clan, g) {
  s.stats.diplo++;
  s.acted[g.id] = true;
  if (Math.random() < truceChance(s, clan, g)) {
    s.rel[clan].truce = DIPLO.truceTurns;
    grow(g, 'cha');
    return { ok: true, text: `${CLANS[clan].name}と停戦した（${DIPLO.truceTurns}季）` };
  }
  changeFriend(s, clan, -5);
  return { ok: false, text: `${CLANS[clan].name}に停戦を断られた…` };
}
function diploAlly(s, clan, g) {
  s.stats.diplo++;
  s.acted[g.id] = true;
  if (Math.random() < allyChance(s, clan, g)) {
    s.rel[clan].ally = DIPLO.allyTurns;
    s.rel[clan].truce = 0;
    grow(g, 'cha');
    return { ok: true, text: `${CLANS[clan].name}と同盟を結んだ（${DIPLO.allyTurns}季）` };
  }
  changeFriend(s, clan, -5);
  return { ok: false, text: `${CLANS[clan].name}に同盟を断られた…` };
}
function diploBreak(s, clan) {
  const r = s.rel[clan];
  const sister = !!r.sister;
  r.ally = 0;
  r.truce = 0;
  r.sister = false;
  r.trade = 0;
  if (s.joint && s.joint.ally === clan) s.joint = null;
  changeFriend(s, clan, sister ? -60 : -40);
  aiClans().forEach((k) => { if (k !== clan) changeFriend(s, k, sister ? -20 : -10); }); // 信用を失う
  addDiploLog(s, `${pName()}が${CLANS[clan].name}との${sister ? '姉妹校提携' : '約束'}を破棄した`, 'bad');
  return `${CLANS[clan].name}との約束を破棄した。諸家の信用を失った…`;
}

// 毎ターンの外交の変化
function tickDiplomacy(s, log) {
  aiClans().forEach((k) => {
    const r = s.rel[k];
    if (!castlesOf(s, k).length) return;
    if (r.truce > 0 && --r.truce === 0) log.push(`🕊️ ${CLANS[k].name}との停戦が終わった`);
    if (r.ally > 0 && --r.ally === 0) log.push(`🤝 ${CLANS[k].name}との同盟が期限を迎えた`);
    if (r.ally > 0 || r.sister) changeFriend(s, k, 1);
    if (r.aidCd > 0) r.aidCd--;
    // 通商協定：おたがいに金が入る
    if (r.trade > 0) {
      const g = tradeIncome(s, k);
      s.gold[PLAYER] += g;
      s.gold[k] += g;
      if (Math.random() < 0.5) changeFriend(s, k, 1);
      if (--r.trade === 0) log.push(`💰 ${CLANS[k].name}との通商協定が期限を迎えた`);
    }
    // 国境を接していると少しずつ緊張が高まる
    const border = castlesOf(s, PLAYER).some((id) => MAP.adj[id].some((n) => s.castles[n].owner === k));
    if (border && !r.ally && !r.truce) changeFriend(s, k, -1);
  });
  // 包囲網（プレイヤーの家が大きくなりすぎると、他家が手を結ぶ）
  const share = castlesOf(s, PLAYER).length / MAP.nodes.length;
  const alive = aiClans().filter((k) => castlesOf(s, k).length);
  if (!s.encircle && share >= DIPLO.encircleShare && alive.length >= 2) {
    s.encircle = true;
    const sisters = alive.filter((k) => s.rel[k].sister);
    alive.filter((k) => !s.rel[k].sister).forEach((k) => {
      s.rel[k].ally = 0; s.rel[k].truce = 0; s.rel[k].trade = 0; changeFriend(s, k, -30);
      s.gold[k] += 600; // 軍資金
    });
    s.joint = null;
    log.push(`🔥 ${pName()}の台頭を恐れた諸家が「${pShort()}包囲網」を結成！ 同盟・停戦はすべて破棄された`);
    if (sisters.length) log.push(`🌸 姉妹校の${sisters.map((k) => CLANS[k].name).join('・')}は包囲網に加わらなかった`);
    addDiploLog(s, `諸家が「${pShort()}包囲網」を結成した`, 'bad');
    addNews(s, `諸家、「${pShort()}包囲網」を結成`, `${pName()}の台頭に危機感`, 92);
  }
  // 共同出兵の期限
  if (s.joint && --s.joint.turns <= 0) {
    log.push(`⚔️ ${CLANS[s.joint.ally].name}との共同出兵が終わった`);
    s.joint = null;
  }
}

// 攻めてよい相手のとなりの城
function hostileNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => !atPeace(s, owner, s.castles[n].owner));
}

// その季節の天気を決める
function rollWeather(turn) {
  const odds = WEATHER_ODDS[turn % 4];
  let r = Math.random() * Object.values(odds).reduce((a, b) => a + b, 0);
  return Object.keys(odds).find((k) => (r -= odds[k]) <= 0) || 'sun';
}

function diffOf(s) { return DIFFICULTY[s.diff] || DIFFICULTY.normal; }

function dateLabel(turn) {
  return `${2026 + Math.floor(turn / 4)}年 ${SEASONS[turn % 4]}`;
}

function castlesOf(s, clan) {
  return Object.keys(s.castles).filter((id) => s.castles[id].owner === clan);
}

function gensOf(s, clan) {
  return Object.values(s.gens).filter((g) => g.clan === clan);
}

function gensAt(s, id) {
  const owner = s.castles[id].owner;
  return Object.values(s.gens).filter((g) => g.loc === id && g.clan === owner);
}

function idleGensAt(s, id) {
  return gensAt(s, id).filter((g) => !s.acted[g.id]);
}

function bestBy(gens, key) {
  const f = typeof key === 'function' ? key : (g) => g[key];
  return gens.reduce((a, b) => (a && f(a) >= f(b) ? a : b), null);
}

function lordOf(s) {
  return Object.values(s.gens).find((g) => g.lord && g.clan === PLAYER);
}

function castleIncome(s, id) {
  const c = s.castles[id];
  const merchant = gensAt(s, id).some((g) => g.skill === 'shousai');
  const shop = hasFac(s, id, 'shop') ? 1.25 : 1;
  const arts = traitOf(id) === 'arts' ? 1.1 : 1;
  return Math.round(c.eco * (merchant ? 1.2 : 1) * shop * arts);
}

function income(s, clan) {
  const base = castlesOf(s, clan).reduce((a, id) => a + castleIncome(s, id), 0);
  const sc = SCENARIOS[s.scenario] || SCENARIOS.tokyo;
  if (clan === PLAYER) return Math.round(base * (s.kakun === 'pol' ? 1.15 : 1));
  return Math.round(base * diffOf(s).aiIncome * sc.aiIncome * (s.encircle ? 1.2 : 1));
}

function enemyNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => s.castles[n].owner !== owner);
}

function ownNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => s.castles[n].owner === owner);
}

// 武将の能力が経験で少し伸びる
function grow(g, stat) {
  if (!g || g[stat] >= 100 || Math.random() > 0.3) return null;
  g[stat] = Math.min(100, g[stat] + randInt(1, 2));
  return stat;
}
const STAT_NAMES = { str: '統率', pol: '政治', cha: '魅力', int: '知略' };

// ---------- 内政（g = 担当する武将。null なら武将なし） ----------
function recruitAmount(g) {
  const m = g ? (0.6 + g.cha / 125) * (g.skill === 'jinbou' ? 1.5 : 1) : 0.8;
  return Math.round((RULES.recruitAmount * m) / 10) * 10;
}
function developAmount(g) {
  const m = g ? (0.6 + g.pol / 125) * (g.skill === 'shousai' ? 1.5 : 1) : 0.8;
  return Math.max(1, Math.round(RULES.developAmount * m));
}
function fortifyAmount(g) {
  return g && g.skill === 'chikujou' ? 0.2 : RULES.fortifyAmount;
}

function canRecruit(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.recruitCost && s.castles[id].troops < RULES.troopCap;
}
function recruit(s, id, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.recruitCost;
  const mult = (c.owner === PLAYER && s.kakun === 'cha' ? 1.2 : 1) *
    (hasFac(s, id, 'gym') ? 1.3 : 1) * (traitOf(id) === 'sports' ? 1.2 : 1);
  const n = Math.round((recruitAmount(g) * mult) / 10) * 10;
  c.troops = Math.min(RULES.troopCap, c.troops + n);
  return { text: `兵+${n}`, grew: grow(g, 'cha') };
}
function canDevelop(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.developCost && s.castles[id].eco < RULES.ecoCap;
}
function develop(s, id, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.developCost;
  const n = Math.round(developAmount(g) * (traitOf(id) === 'academic' ? 1.2 : 1));
  c.eco = Math.min(RULES.ecoCap, c.eco + n);
  return { text: `経済+${n}`, grew: grow(g, 'pol') };
}
function canFortify(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.fortifyCost && s.castles[id].def < RULES.defCap - 0.01;
}
function fortify(s, id, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.fortifyCost;
  const n = Math.round(fortifyAmount(g) * (traitOf(id) === 'traditional' ? 1.5 : 1) * 100) / 100;
  c.def = Math.round(Math.min(RULES.defCap, c.def + n) * 10) / 10;
  return { text: `防御+${n.toFixed(1)}`, grew: grow(g, 'int') };
}
function moveTroops(s, from, to, n) {
  s.castles[from].troops -= n;
  s.castles[to].troops = Math.min(RULES.troopCap, s.castles[to].troops + n);
}
// 輸送で届いたばかりの兵は、その季節のうちは出陣・輸送に使えない（守りには加わる）
function arrivedTroops(s, id) {
  return Math.min(s.castles[id].troops, (s.arrived && s.arrived[id]) || 0);
}
function readyTroops(s, id) {
  return s.castles[id].troops - arrivedTroops(s, id);
}
function moveGeneral(s, gid, to) {
  s.gens[gid].loc = to;
}

// ---------- 合戦 ----------
// 攻撃側 a 人、守備側 d 人。am / dm は武将による強さの倍率
function fight(a, d, def, am, dm, o = {}) {
  const rounds = [{ a, d }];
  let won = false;
  const morale = rand(0.75, 1.25); // その日の士気
  for (let i = 0; i < 6; i++) {
    const first = i === 0 && o.totsugeki ? 1.5 : 1;
    const toD = Math.round((a * 0.22 * morale * rand(0.8, 1.2) * am * first * (o.shinsanA ? 1.15 : 1)) / def);
    const toA = Math.round(d * 0.2 * rand(0.8, 1.2) * dm * (o.shinsanD ? 1.15 : 1));
    a = Math.max(0, a - toA);
    d = Math.max(0, d - toD);
    rounds.push({ a, d });
    if (a === 0) break;
    if (d === 0 || d < a * 0.12) { won = true; d = 0; rounds[rounds.length - 1].d = 0; break; }
  }
  return { won, rounds, left: a, defLeft: d };
}

const atkMult = (g) => (0.7 + g.str / 150) * (treasureKind(g) === 'gunbai' ? 1.1 : 1);
const defMult = (g) => (g ? (0.8 + (g.str + g.int) / 600) * (treasureKind(g) === 'kabuto' ? 1.12 : 1) : 0.85);
const defLeader = (s, id) => bestBy(gensAt(s, id), (g) => g.str + g.int);

// 守りの強さ（兵力×防御×武将）。攻めるかどうかの目安に使う
function defensePower(s, id) {
  const c = s.castles[id];
  const dg = defLeader(s, id);
  const def = c.def + (dg && dg.skill === 'teppeki' ? 0.3 : 0);
  return (c.troops * def * defMult(dg) * defKakun(s, c.owner)) / 0.85;
}

// 家訓による補正
const atkKakun = (s, clan) => (clan === PLAYER && s.kakun === 'str' ? 1.1 : 1);
const defKakun = (s, clan) => (clan === PLAYER && s.kakun === 'int' ? 1.15 : 1);

// ---------- 合戦の作戦 ----------
// 守る側の作戦：城の固さ・兵の多さ・知略で選びやすさが変わる
function aiTactic(s, to) {
  const c = s.castles[to];
  const dg = defLeader(s, to);
  const w = {
    siege: 1 + (c.def >= 1.4 ? 1.5 : 0),
    charge: 1 + (c.troops >= 1500 ? 1.5 : 0),
    ambush: 1 + (dg && dg.int >= 70 ? 1.5 : 0),
  };
  let r = Math.random() * (w.siege + w.charge + w.ambush);
  for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return k; }
  return 'siege';
}

// 知略の高い大将は、敵の作戦を読める（ただし8割の確かさ）
function readTactic(s, g, to, actual) {
  const dg = defLeader(s, to);
  const skill = g.int - (dg ? dg.int : 30);
  if (g.int < 65 && skill < 15) return null;
  const guess = Math.random() < 0.8 ? actual : pick(Object.keys(TACTICS).filter((k) => k !== actual));
  return guess;
}

function tacticResult(a, d) {
  if (!a || !d || a === d) return 0;
  return TACTICS[a].beats === d ? 1 : -1;
}

// 城を失った側の武将：逃げるか捕まるか
function scatterGenerals(s, id, loser, winner, log) {
  const captured = [];
  gensAtRaw(s, id, loser).forEach((g) => {
    const refuges = MAP.adj[id].filter((n) => s.castles[n].owner === loser);
    const allOwn = castlesOf(s, loser);
    if (g.lord && allOwn.length) {
      moveGeneral(s, g.id, refuges[0] || allOwn[0]); // 当主は必ず落ちのびる
      return;
    }
    if (loser !== 'none' && refuges.length && Math.random() < (loser === PLAYER ? 0.7 : 0.6)) {
      moveGeneral(s, g.id, pick(refuges));
      return;
    }
    if (winner === PLAYER) {
      lootTreasure(s, g, log);
      g.clan = 'captive';
      g.loc = null;
      g.capturedAt = id;
      captured.push(g.id);
    } else if (Math.random() < 0.5) {
      g.clan = winner;
      g.loc = id;
      if (loser === PLAYER && log) log.push(`😢 ${g.name}は捕らえられ、${CLANS[winner].name}に寝返った`);
    } else {
      passOnTreasure(s, g, 'none');
      g.clan = 'ronin';
      g.loc = null;
      if (loser === PLAYER && log) log.push(`😢 ${g.name}は捕らえられ、行方知れずとなった`);
    }
  });
  return captured;
}
function gensAtRaw(s, id, clan) {
  return Object.values(s.gens).filter((g) => g.loc === id && g.clan === clan);
}

// 援軍を出せる城（攻め先のとなりで、命令できる武将と兵がいる自分の城）
function supportCastles(s, clan, to, except) {
  return MAP.adj[to].filter((id) => id !== except && s.castles[id].owner === clan &&
    readyTroops(s, id) > 0 && idleGensAt(s, id).length > 0);
}

// 攻撃を実行して結果を返す
// gid = 大将の武将、support = [{ from, n, gid }] 援軍（となりの城から合流する部隊）
// tactic = { a: 攻める側の作戦, d: 守る側の作戦 }（プレイヤーが攻めるときだけ）
function attack(s, from, to, n, gid, log, support = [], tactic = null) {
  const src = s.castles[from], dst = s.castles[to];
  const attacker = src.owner, defender = dst.owner;
  const g = s.gens[gid];
  const dg = defLeader(s, to);
  src.troops -= n;
  s.acted[gid] = true;
  // 攻められた家はプレイヤーの家を恨む
  if (attacker === PLAYER && s.rel[defender]) changeFriend(s, defender, -15);
  if (defender === PLAYER && s.rel[attacker]) changeFriend(s, attacker, -3);
  // 通商協定の相手と戦うと、協定は打ち切り
  const foe = attacker === PLAYER ? defender : defender === PLAYER ? attacker : null;
  if (foe && s.rel[foe] && s.rel[foe].trade > 0) s.rel[foe].trade = 0;
  // 他家どうしの戦いも、仲を悪くする
  if (attacker !== PLAYER && defender !== PLAYER && defender !== 'none') {
    const r = aiRel(s, attacker, defender);
    r.friend = clamp(r.friend - 8, 0, 100);
  }
  support.forEach((sp) => {
    s.castles[sp.from].troops -= sp.n;
    s.acted[sp.gid] = true;
    n += sp.n;
  });
  const def = dst.def + (dg && dg.skill === 'teppeki' ? 0.3 : 0);
  // 作戦の読み合い：勝てば大きく有利、負ければ不利
  const tr = tactic ? tacticResult(tactic.a, tactic.d) : 0;
  const am = atkMult(g) * atkKakun(s, attacker) * (tr > 0 ? 1.35 : tr < 0 ? 0.75 : 1);
  const dm = defMult(dg) * defKakun(s, defender) * (tr > 0 ? 0.8 : tr < 0 ? 1.25 : 1);
  const r = fight(n, dst.troops, def, am, dm, {
    totsugeki: g.skill === 'totsugeki',
    shinsanA: g.skill === 'shinsan',
    shinsanD: dg && dg.skill === 'shinsan',
  });
  const result = { ...r, from, to, attacker, defender, sent: n, gid, dgid: dg ? dg.id : null, support, captured: [], grew: null, tactic, tr };
  if (attacker === PLAYER && tr > 0) s.stats.tacticWins++;
  if (r.won) {
    dst.owner = attacker;
    dst.troops = r.left;
    dst.def = Math.max(1, Math.round((dst.def - 0.1) * 10) / 10); // 落城で城が傷む
    moveGeneral(s, gid, to);
    result.captured = scatterGenerals(s, to, defender, attacker, log);
    result.grew = grow(g, 'str');
    if (attacker === PLAYER) { s.stats.battlesWon++; changeLoyal(g, 3); }
    result.surrendered = capitalFallen(s, to, defender, attacker, log);
  } else {
    if (attacker === PLAYER) changeLoyal(g, -3);
    if (defender === PLAYER && dg) changeLoyal(dg, 4);
    dst.troops = r.defLeft;
    // 生き残りは出てきた城へ、兵の割合に応じて帰る
    const parts = [{ from, n: n - support.reduce((a, sp) => a + sp.n, 0) }, ...support];
    parts.forEach((p) => { s.castles[p.from].troops += Math.round((r.left * p.n) / n); });
    if (dg) grow(dg, 'int');
  }
  recordBattle(s, result);
  battleNews(s, result);
  return result;
}

// 捕らえた武将を登用する
function recruitChance(s, g) {
  const lord = lordOf(s);
  let p = 0.2 + ((lord ? lord.cha : 60) - 50) / 150;
  if (lord && lord.skill === 'jinbou') p += 0.15;
  if (s.kakun === 'cha') p += 0.1;
  if (g.origin === 'none') p += 0.2;                                  // 独立校の武将は仕えやすい
  if (g.origin !== 'none' && castlesOf(s, g.origin).length === 0) p += 0.25; // 主家が滅んでいる
  return clamp(p, 0.05, 0.95);
}
function tryRecruitCaptive(s, gid) {
  const g = s.gens[gid];
  const ok = Math.random() < recruitChance(s, g);
  if (ok && s.castles[g.capturedAt].owner === PLAYER) {
    g.clan = PLAYER;
    g.loc = g.capturedAt;
    g.loyal = randInt(35, 55); // 捕虜から仕えた武将は、まだ心を開いていない
    s.stats.recruited++;
  } else {
    g.clan = 'ronin';
    g.loc = null;
  }
  return ok;
}
function releaseCaptive(s, gid) {
  const g = s.gens[gid];
  g.clan = 'ronin';
  g.loc = null;
}

// ---------- 自動で命令する（敵の思考・委任） ----------
// 前線までの距離（自分の城の中で）
// 城がどれだけ危ないか（となりの敵兵 ÷ 自分の守り）
function threatOf(s, id) {
  const c = s.castles[id];
  const enemy = hostileNeighbors(s, id)
    .filter((n) => s.castles[n].owner !== 'none') // 独立校は攻めてこない
    .reduce((a, n) => a + s.castles[n].troops * 0.8, 0);
  return enemy / Math.max(1, c.troops * c.def);
}

// 前線までの距離。危ない城があれば、そこへ兵が集まるようにする
function frontDistance(s, clan) {
  const dist = {};
  const queue = [];
  const fronts = castlesOf(s, clan).filter((id) => hostileNeighbors(s, id).length);
  const danger = fronts.filter((id) => threatOf(s, id) >= 0.9);
  (danger.length ? danger : fronts).forEach((id) => { dist[id] = 0; queue.push(id); });
  while (queue.length) {
    const id = queue.shift();
    ownNeighbors(s, id).forEach((n) => {
      if (dist[n] === undefined) { dist[n] = dist[id] + 1; queue.push(n); }
    });
  }
  return dist;
}

function battleLine(s, r) {
  const a = CLANS[r.attacker].name, t = MAP.byId[r.to].name;
  const g = s.gens[r.gid];
  const d = r.defender === 'none' ? '' : `（${CLANS[r.defender].name}）`;
  if (r.defender === PLAYER) {
    return r.won ? `🔥 ${a}の${g.name}が ${t} を攻め落とした！` : `🛡️ ${a}の${g.name}が ${t} に攻めてきたが、撃退した！`;
  }
  if (r.attacker === PLAYER) {
    return r.won ? `🏯 委任：${g.name}が ${t}${d}を攻略！` : `💨 委任：${g.name}が ${t} を攻めたが失敗`;
  }
  return `⚔️ ${a}が ${t}${d}を攻略`;
}

// 家の本拠か（家の名のもとになった城）
function isCapital(id, clan) {
  return id === clan && !!CLANS[clan] && clan !== 'none';
}
// 本拠を落とされた家は動揺し、残る城がそれぞれ降伏することがある（プレイヤーが落としたときだけ）
function capitalFallen(s, id, loser, winner, log) {
  if (winner !== PLAYER || !isCapital(id, loser)) return [];
  const gave = [];
  castlesOf(s, loser).forEach((cid) => {
    if (Math.random() >= 0.4) return;
    const c = s.castles[cid];
    c.owner = PLAYER;
    c.troops = Math.round(c.troops * 0.6);
    s.delegate[cid] = true; // 降った城は、ひとまず委任しておく
    Object.values(s.gens).filter((g) => g.loc === cid && g.clan === loser).forEach((g) => {
      if (g.lord) { const rest = castlesOf(s, loser); if (rest.length) g.loc = rest[0]; else { g.clan = 'ronin'; g.loc = null; } return; }
      g.clan = PLAYER;
      g.loyal = randInt(40, 55); // 降将はまだ心を許していない
    });
    gave.push(cid);
  });
  if (log) {
    log.push(`🏯 本拠を失った${CLANS[loser].name}は大きく動揺した！`);
    if (gave.length) log.push(`🏳️ ${gave.map((c) => MAP.byId[c].short).join('・')}が${pName()}に降伏した！`);
    if (!castlesOf(s, loser).length) log.push(`☠️ ${CLANS[loser].name}は滅亡した`);
  }
  addNews(s, `${pName()}、${CLANS[loser].name}の本拠・${MAP.byId[id].name}を攻略！`,
    gave.length ? `${gave.length}城が相次いで降伏` : `${CLANS[loser].name}に激震走る`, 95);
  return gave;
}

// ---------- 学園新聞の記事 ----------
// 季節のあいだの出来事を集めておき、ターン終了のときに新聞にする。weight が大きいほど大きな見出しになる
function addNews(s, head, sub = '', weight = 50) {
  s.news = s.news || [];
  s.news.push({ head, sub, weight });
  if (s.news.length > 60) s.news.shift();
  // 大きな出来事は、エンディングの絵巻のために残しておく
  if (weight >= 42 && !(s.saga || []).some((e) => e.turn === s.turn && e.head === head)) {
    s.saga = s.saga || [];
    s.saga.push({ turn: s.turn, head, sub, weight });
    if (s.saga.length > 100) {
      const i = s.saga.reduce((m, e, j) => (e.weight < s.saga[m].weight ? j : m), 0);
      s.saga.splice(i, 1);
    }
  }
}
// 合戦の結果を記事にする（attack() と endBattle() の結果に共通）
function battleNews(s, r) {
  const to = MAP.byId[r.to].name;
  const an = CLANS[r.attacker].name, dn = CLANS[r.defender].name;
  if (r.attacker === PLAYER && r.won && !isCapital(r.to, r.defender)) addNews(s, `${an}、${to}を攻略`, r.defender === 'none' ? '独立校がまた一つ' : `${dn}は後退`, 40);
  else if (r.defender === PLAYER && r.won) addNews(s, `${an}、${pName()}の${to}を奪う`, '守りの見直しが急務か', 60);
  else if (r.defender === PLAYER && !r.won) addNews(s, `${pName()}、${to}で${an}を撃退`, '守将の奮戦光る', 35);
  else if (r.attacker !== PLAYER && r.defender !== PLAYER && r.won) addNews(s, `${an}、${to}を攻略`, '', 15);
  if (r.won && r.defender !== 'none' && CLANS[r.defender] && !castlesOf(s, r.defender).length) {
    addNews(s, `${dn}、滅亡`, `${an}に敗れ、その歴史に幕を下ろす`, 90);
  }
}

// 共同出兵中の他家にとって、その城が標的の家のものか
function jointTarget(s, clan, id) {
  return !!s.joint && s.joint.ally === clan && s.castles[id].owner === s.joint.target;
}

function autoCastle(s, clan, id, cfg, dist, log) {
  const c = s.castles[id];
  if (c.owner !== clan) return;
  const reserve = cfg.reserve;
  const idle = () => idleGensAt(s, id);
  const use = (g) => { if (g) s.acted[g.id] = true; };
  // 旗揚げ直後の猶予期間は、他家は麻布家を攻めない
  const grace = clan !== PLAYER && s.turn < graceTurns(s);
  const enemies = hostileNeighbors(s, id).filter((n) => !(grace && s.castles[n].owner === PLAYER) && !s.underAttack[n]);

  if (!enemies.length) {
    // 後方：兵と武将を前線へ送り、残りは開発
    const next = ownNeighbors(s, id).sort((a, b) => (dist[a] ?? 99) - (dist[b] ?? 99))[0];
    if (next !== undefined && (dist[next] ?? 99) < (dist[id] ?? 99)) {
      let gens = idle();
      if (c.troops > 400 && (gens.length || cfg.noGeneral)) {
        const g = gens[0];
        moveTroops(s, id, next, Math.floor(c.troops * 0.8));
        use(g);
      }
      gens = idle();
      if (gensAt(s, id).length > 1 && gens.length) {
        const g = bestBy(gens, 'str');
        moveGeneral(s, g.id, next);
        use(g);
      }
    }
    idle().forEach((g) => {
      if (canDevelop(s, id) && s.gold[clan] >= RULES.developCost + reserve) { develop(s, id, g); use(g); }
    });
    return;
  }

  // 前線：勝てそうなら攻める
  const leader = bestBy(idle(), 'str');
  if (leader && c.troops > 0) {
    // 包囲網の間は麻布家の城を優先して狙う
    const aim = (t) => defensePower(s, t) *
      (s.encircle && clan !== PLAYER && s.castles[t].owner === PLAYER ? 0.6 : 1) *
      (clan !== PLAYER && personaOf(clan).neutral && s.castles[t].owner === 'none' ? 0.7 : 1) * // 拡張型は独立校を優先
      (jointTarget(s, clan, t) ? 0.5 : 1); // 共同出兵の標的を優先
    const target = enemies.reduce((a, b) => (aim(a) <= aim(b) ? a : b));
    const send = Math.floor(c.troops * 0.8);
    const need = defensePower(s, target) * cfg.ratio * (jointTarget(s, clan, target) ? 0.85 : 1) *
      (rallyOn(s, clan) && s.castles[target].owner === PLAYER ? FINALE.rallyNeed : 1) + 100; // 大連合の大反攻は強気に攻める
    let support = [];
    if (send * atkMult(leader) <= need) {
      // 一城で足りなければ、となりの城から援軍を集める
      support = supportCastles(s, clan, target, id).map((sid) => ({
        from: sid, n: Math.floor(s.castles[sid].troops * 0.8), gid: bestBy(idleGensAt(s, sid), 'str').id,
      }));
    }
    const total = send + support.reduce((a, sp) => a + sp.n, 0);
    if (total * atkMult(leader) > need) {
      // プレイヤーが守りの合戦を采配する設定なら、ここでは決着させず「敵襲」として後で戦う
      if (clan !== PLAYER && s.castles[target].owner === PLAYER && s.deferDefense && !s.delegate[target]) {
        c.troops -= send;
        s.acted[leader.id] = true;
        support.forEach((sp) => { s.castles[sp.from].troops -= sp.n; s.acted[sp.gid] = true; });
        if (s.rel[clan]) changeFriend(s, clan, -3);
        s.pendingDefense.push({ from: id, to: target, n: send, gid: leader.id, support, attacker: clan });
        s.underAttack[target] = true;
        log.push(`⚠️ ${CLANS[clan].name}の${leader.name}が ${MAP.byId[target].name} に攻めてきた！`);
        return;
      }
      const r = attack(s, id, target, send, leader.id, log, support);
      if (r.defender === PLAYER || r.won || clan === PLAYER) log.push(battleLine(s, r));
      if (r.won && r.defender !== 'none' && castlesOf(s, r.defender).length === 0) {
        log.push(`☠️ ${CLANS[r.defender].name}は${CLANS[clan].name}に滅ぼされた`);
      }
      if (clan === PLAYER && r.captured.length) {
        // 委任中に捕らえた武将は、自動で登用を試みる
        r.captured.forEach((gid) => {
          const ok = tryRecruitCaptive(s, gid);
          log.push(ok ? `🤝 ${s.gens[gid].name}が${pName()}に加わった` : `🚶 ${s.gens[gid].name}は登用を断って去った`);
        });
      }
    }
  }
  // 残った武将：徴兵 → 築城
  idle().sort((a, b) => b.cha - a.cha).forEach((g) => {
    if (canRecruit(s, id) && s.gold[clan] >= RULES.recruitCost + reserve) { recruit(s, id, g); use(g); }
    else if (canFortify(s, id) && s.gold[clan] >= RULES.fortifyCost + reserve * 2) { fortify(s, id, g); use(g); }
  });
  // 武将がいない城（敵だけ）：徴兵だけはできる
  if (cfg.noGeneral && !gensAt(s, id).length && canRecruit(s, id) && s.gold[clan] >= RULES.recruitCost + reserve) {
    recruit(s, id, null);
  }
}

function aiTurn(s, log) {
  const D = diffOf(s);
  for (const clan of aiClans()) {
    const mine = castlesOf(s, clan);
    if (!mine.length) continue;
    hireRonin(s, clan);
    const dist = frontDistance(s, clan);
    // 前線の城から先に動く（攻めたあとで後方から兵を補充できるように）
    mine
      .sort((a, b) => (dist[a] ?? 99) - (dist[b] ?? 99) || Math.random() - 0.5)
      .forEach((id) => autoCastle(s, clan, id, { ratio: D.aiRatio * personaOf(clan).ratio, reserve: 0, noGeneral: true }, dist, log));
    // ときどき施設を建てる（性格で頻度が変わる）
    if (Math.random() < 0.15 * personaOf(clan).build) {
      const id = pick(castlesOf(s, clan));
      if (id) autoBuild(s, clan, id, 500);
    }
  }
  // 独立校は少しずつ兵が増える
  Object.values(s.castles).forEach((c) => {
    if (c.owner === 'none') c.troops = Math.min(RULES.neutralCap, c.troops + D.neutralGrowth);
  });
}

function graceTurns(s) {
  const g = (SCENARIOS[s.scenario] || SCENARIOS.tokyo).grace;
  return s.diff === 'hard' ? Math.floor(g / 2) : g;
}

// 敵の家は、浪人を雇って武将のいない城に置く
function hireRonin(s, clan) {
  if (s.gold[clan] < 700 || Math.random() > 0.3) return;
  const ronin = Object.values(s.gens).filter((g) => g.clan === 'ronin');
  const empty = castlesOf(s, clan).filter((id) => !gensAt(s, id).length);
  if (!ronin.length || !empty.length) return;
  const g = bestBy(ronin, (x) => x.str + x.int);
  const dest = empty.reduce((a, b) => (threatOf(s, a) >= threatOf(s, b) ? a : b));
  g.clan = clan;
  g.loc = dest;
  s.gold[clan] -= 300;
}

// 委任した城と、一括命令
function runDelegated(s, log) {
  const dist = frontDistance(s, PLAYER);
  castlesOf(s, PLAYER)
    .filter((id) => s.delegate[id])
    .forEach((id) => {
      autoCastle(s, PLAYER, id, { ratio: RULES.delegateRatio, reserve: RULES.delegateReserve }, dist, log);
      // 委任した城では、忠誠の低い家臣に自動で褒美を与える
      gensAt(s, id).filter((g) => g.loyal < 50 && canReward(s, g) && s.gold[PLAYER] >= LOYAL.rewardCost + RULES.delegateReserve)
        .forEach((g) => reward(s, g.id));
      // 金に十分な余裕があれば、施設も建てる
      if (s.castles[id].owner === PLAYER) autoBuild(s, PLAYER, id, 400);
    });
}

function bulkCommand(s, kind) {
  const fn = { recruit, develop }[kind];
  const can = { recruit: canRecruit, develop: canDevelop }[kind];
  const stat = kind === 'recruit' ? 'cha' : 'pol';
  let count = 0;
  castlesOf(s, PLAYER)
    .filter((id) => !s.delegate[id])
    .forEach((id) => {
      const g = bestBy(idleGensAt(s, id), stat);
      if (g && can(s, id)) { fn(s, id, g); s.acted[g.id] = true; count++; }
    });
  return count;
}

// ---------- 忠誠度 ----------
const LOYAL = {
  rewardCost: 100, rewardGain: 12,
  leaveBelow: 40,   // これより低いと出奔することがある
  rebelBelow: 30,   // これより低いと謀反を起こすことがある
};

function changeLoyal(g, d) {
  if (g && !g.lord) g.loyal = clamp(Math.round((g.loyal ?? 70) + d), 0, 100);
}

function canReward(s, g) {
  return g.clan === PLAYER && !g.lord && !s.rewarded[g.id] && s.gold[PLAYER] >= LOYAL.rewardCost && g.loyal < 100;
}

// 褒美：金を与えて忠誠を上げる（命令の回数は使わない。1人1季に1回）
function reward(s, gid) {
  const g = s.gens[gid];
  const lord = lordOf(s);
  const gain = LOYAL.rewardGain + (lord && lord.cha >= 80 ? 3 : 0);
  s.gold[PLAYER] -= LOYAL.rewardCost;
  s.rewarded[gid] = true;
  changeLoyal(g, gain);
  return gain;
}

// 季節ごとの忠誠の変化と、出奔・謀反
function loyaltyTick(s, log) {
  const lord = lordOf(s);
  const drift = (lord ? lord.cha - 70 : -20) / 25 - 1.6; // 当主の魅力が高いほど下がりにくい
  const mine = castlesOf(s, PLAYER);
  gensOf(s, PLAYER).filter((g) => g.loc && !g.lord).forEach((g) => {
    changeLoyal(g, Math.floor(drift + Math.random()));
    // 出奔
    if (g.loyal < LOYAL.leaveBelow && Math.random() < (LOYAL.leaveBelow - g.loyal) / 150) {
      passOnTreasure(s, g, PLAYER);
      g.clan = 'ronin';
      g.loc = null;
      log.push(`🚶 忠誠の薄れた${g.name}が、${pName()}を出奔した…`);
      return;
    }
    // 謀反：城でいちばん強い武将が、城ごと独立する（当主のいる城では起きない）
    const here = gensAt(s, g.loc);
    const top = bestBy(here, 'str');
    const lordHere = here.some((x) => x.lord);
    if (g.loyal < LOYAL.rebelBelow && top === g && !lordHere && mine.length >= 2 &&
        Math.random() < (LOYAL.rebelBelow - g.loyal) / 120) {
      const id = g.loc;
      const refuge = MAP.adj[id].find((n) => s.castles[n].owner === PLAYER && n !== id);
      here.filter((x) => x !== g).forEach((x) => {
        if (refuge) moveGeneral(s, x.id, refuge); else { x.clan = 'ronin'; x.loc = null; }
      });
      s.castles[id].owner = 'none';
      delete s.delegate[id];
      g.clan = 'none';
      g.loyal = 100;
      log.push(`🔥 謀反！ ${g.name}が ${MAP.byId[id].name} ごと${pName()}から独立した！`);
    }
  });
}

// ---------- 卒業と入学 ----------
function kakunOf(g) {
  return ['str', 'pol', 'cha', 'int'].reduce((a, k) => (g[k] > g[a] ? k : a), 'str');
}
const genPower = (g) => g.str + g.pol + g.cha + g.int;

// 春：3年生は卒業、ほかは進級。各校に新入生が入る
function graduation(s) {
  const info = { left: [], joined: [], joinedIds: [], lordLeft: null };
  // 卒業して2年以上たった武将は、もう出てこないのでデータから消す（セーブを軽くするため）
  Object.values(s.gens).forEach((g) => {
    if (g.clan === 'graduated' && g.gradTurn !== undefined && g.gradTurn < s.turn - 4) {
      delete s.usedNames[g.name]; // 名前は新入生に使えるように空ける
      delete s.gens[g.id];
    }
  });
  // 消えた武将の因縁も片付ける
  if (s.rivals) Object.keys(s.rivals).forEach((k) => { const [a, b] = k.split('|'); if (!s.gens[a] || !s.gens[b]) delete s.rivals[k]; });
  Object.values(s.gens).forEach((g) => {
    if (['ronin', 'captive'].includes(g.clan) && g.grade >= 3) { g.clan = 'graduated'; g.gradTurn = s.turn; return; }
    if (g.clan === 'graduated') { if (g.gradTurn === undefined) g.gradTurn = s.turn; return; }
    if (g.grade >= 3) {
      if (g.clan === PLAYER) { info.left.push(g.name); enshrine(s, g); bondGraduate(s, g); }
      passOnTreasure(s, g, g.clan);
      if (g.lord && g.clan === PLAYER) info.lordLeft = g.id;
      g.clan = 'graduated';
      g.gradTurn = s.turn;
      g.loc = null;
      g.lord = false;
    } else {
      g.grade++;
      // 進級すると少し成長する
      const k = pick(['str', 'pol', 'cha', 'int']);
      g[k] = Math.min(100, g[k] + randInt(1, 3));
    }
  });
  // 新入生：各校に1人くらい（ときどき2人）入る。武将のいない城には必ず1人
  // 卒業で毎年3分の1が抜けるので、1城あたり約2.5人で落ち着く
  Object.keys(s.castles).forEach((id) => {
    const owner = s.castles[id].owner;
    const need = gensAt(s, id).length === 0;
    const count = (need || Math.random() < 0.6 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const g = makeGeneral(s, id, owner, { grade: 1, title: '新入生', strong: Math.random() < 0.15 });
      if (owner === PLAYER) { info.joined.push(g.name); info.joinedIds.push(g.id); }
    }
  });
  // プレイヤーの家には、少なくとも2人は入ってくる
  const mine = castlesOf(s, PLAYER);
  while (mine.length && info.joined.length < 2) {
    const g = makeGeneral(s, pick(mine), PLAYER, { grade: 1, title: '新入生' });
    info.joined.push(g.name);
    info.joinedIds.push(g.id);
  }
  return info;
}

// 後継者の候補（来春も残る1・2年生を優先して、実力順に3人）
function successionCandidates(s) {
  const gens = gensOf(s, PLAYER).filter((g) => g.loc);
  const young = gens.filter((g) => g.grade <= 2);
  return (young.length ? young : gens).sort((a, b) => genPower(b) - genPower(a)).slice(0, 3);
}

// 家督を継がせる。選ばれなかった実力者は出奔することがある
function succeed(s, gid) {
  const heir = s.gens[gid];
  const passed = successionCandidates(s).filter((g) => g.id !== gid);
  heir.lord = true;
  heir.title = '当主';
  heir.loyal = 100;
  // 当主が代わると家臣の心は少し揺れる。選ばれなかった候補は特に不満を持つ
  gensOf(s, PLAYER).forEach((g) => { if (!g.lord) changeLoyal(g, passed.includes(g) ? -15 : -3); });
  s.kakun = kakunOf(heir);
  s.lords.push({ name: heir.name, from: s.turn, kakun: s.kakun });
  addNews(s, `${pName()}に新当主・${heir.name}`, `${s.lords.length}代目、家訓は「${KAKUN[s.kakun].name}」`, 70);
  let text = `${heir.name}が${s.lords.length}代目当主となった。家訓は「${KAKUN[s.kakun].name}」（${KAKUN[s.kakun].desc}）。`;
  const rival = passed.find((g) => genPower(g) > genPower(heir) + 15);
  if (rival && Math.random() < 0.5) {
    rival.clan = 'ronin';
    rival.loc = null;
    text += `\n家督争いに敗れた${rival.name}は、不満を抱いて家を去った…`;
  }
  return text;
}

// ---------- ターン終了 ----------
function endTurn(s) {
  const log = [];
  s.moves = [];
  s.pendingDefense = [];
  s.underAttack = {};
  runDelegated(s, log);
  if (!s.debugFreeze && s.turn >= graceTurns(s)) aiSchemes(s, log);
  if (!s.debugFreeze) aiTurn(s, log);
  s.turn++;
  Object.keys(CLANS).forEach((k) => {
    if (k !== 'none') s.gold[k] += income(s, k);
  });
  s.acted = {};
  s.arrived = {};
  s.weather = rollWeather(s.turn);
  s.rewarded = {};
  Object.keys(s.delegate).forEach((id) => { if (s.castles[id].owner !== PLAYER) delete s.delegate[id]; });
  tickDiplomacy(s, log);
  tickAiDiplomacy(s, log);
  loyaltyTick(s, log);
  aiLoyaltyTick(s, log);
  traitTick(s);
  bondTick(s);
  shiTick(s);
  aiClans().forEach((k) => { if (castlesOf(s, k).length) aiLordOf(s, k); });
  debtTick(s);
  finaleTick(s, log);
  s.grad = s.turn % 4 === 0 ? graduation(s) : null;
  checkWin(s);
  if (s.turn >= 4) s.stats.minCastles = Math.min(s.stats.minCastles, castlesOf(s, PLAYER).length);
  s.pending = s.result ? [] : [...((s.finale && s.finale.queue) || []).splice(0), ...rollEvents(s)];
  const ob = !s.result && obTick(s); // 卒業生の来訪
  if (ob) s.pending.push(ob);
  if (!s.result && s.bondQueue && s.bondQueue.length) s.pending.push(...s.bondQueue.splice(0));
  s.log = log;
  return log;
}

function checkWin(s) {
  const mine = castlesOf(s, PLAYER).length;
  if (mine === 0) s.result = 'lose';
  else if (mine === MAP.nodes.length) s.result = 'win';
}

// ---------- 武将列伝：戦歴・あだ名・卒業生 ----------
// 戦歴 g.rec = { w: 合戦の勝ち, l: 負け, cap: 落とした城, def: 守り抜いた城, dw: 一騎打ちの勝ち, dl: 負け }
function recOf(g) {
  if (!g.rec) g.rec = { w: 0, l: 0, cap: 0, def: 0, dw: 0, dl: 0 };
  return g.rec;
}
// 合戦の結果を、攻めた大将と守った大将の戦歴に記す（attack と endBattle の両方から呼ぶ）
function recordBattle(s, r) {
  // 世界が動く地図：ターン終了のあいだの合戦を記録しておき、あとで地図の上で見せる（s.moves は endTurn のあいだだけある）
  if (s.moves) {
    s.moves.push({ from: r.from, to: r.to, att: r.attacker, def: r.defender, won: !!r.won });
    (r.surrendered || []).forEach((id) => s.moves.push({ from: r.to, to: id, att: r.attacker, def: r.defender, won: true, kind: 'fall' }));
  }
  const ga = s.gens[r.gid], gd = r.dgid ? s.gens[r.dgid] : null;
  if (ga) { const a = recOf(ga); if (r.won) { a.w++; a.cap++; shiHit(s, ga, 'cap', r.to); } else a.l++; }
  addClash(s, ga, gd, 1);
  countClanClash(s, r);
  if (gd) { const d = recOf(gd); if (r.won) d.l++; else { d.w++; d.def++; shiHit(s, gd, 'def'); } }
}
function recordDuel(s, winner, loser) {
  addClash(s, winner, loser, 2);
  if (winner) { recOf(winner).dw++; if (winner.clan === PLAYER) s.stats.duelWins = (s.stats.duelWins || 0) + 1; shiHit(s, winner, 'duel', loser); }
  if (loser) recOf(loser).dl++;
}

// あだ名：戦歴と能力から、いちばん目立つものをひとつ
const NICKNAMES = [
  [(r) => r.dw >= 4, (g) => `${MAP.byId[g.school] ? MAP.byId[g.school].short : ''}の鬼`],
  [(r) => r.cap >= 8, () => '城喰い'],
  [(r) => r.def >= 5, () => '不落の盾'],
  [(r) => r.w >= 8, () => '常勝'],
  [(r) => r.cap >= 4, () => '一番槍'],
  [(r) => r.dw >= 2, () => '剣豪'],
  [(r) => r.def >= 3, () => '鉄壁'],
  [(r, g) => g.str >= 90, () => '剛勇'],
  [(r, g) => g.int >= 88, () => '今孔明'],
  [(r, g) => g.cha >= 88, () => '人たらし'],
  [(r, g) => g.pol >= 88, () => '名奉行'],
  [(r) => r.l >= 5 && r.w <= 1, () => '七転び八起き'],
];
function nickOf(g) {
  if (g.shi && g.shi.done && g.shi.title) return g.shi.title; // 志を果たした者の異名がいちばん
  const r = recOf(g);
  const hit = NICKNAMES.find(([test]) => test(r, g));
  return hit ? hit[1](g) : null;
}

// 卒業の一言（戦歴に合わせて）
function farewellOf(g) {
  const r = recOf(g);
  if (r.dw >= 2) return pick(['この腕、次は大学で試すとしよう', '刀を置く日が来たか']);
  if (r.cap >= 4) return pick(['落とした城の数だけ、思い出がある', '次の世代も攻め続けろ']);
  if (r.def >= 3) return pick(['守り抜いたこの学び舎を、頼んだぞ', 'わが盾は後輩に譲る']);
  if (r.l >= 4) return pick(['負けの数だけ強くなれた', '悔いはない。……少ししかない']);
  return pick(['三年間、楽しかった', 'この学び舎を忘れない', '後は任せた']);
}

// 卒業生を列伝に残す（自分の家の武将だけ。多くなりすぎたら古い順に消す）
function enshrine(s, g) {
  s.hall = s.hall || [];
  const r = recOf(g);
  s.hall.push({
    name: g.name, nick: nickOf(g), rec: { ...r }, school: g.school, lord: !!g.lord,
    since: g.since || 0, until: s.turn, look: g.look, female: !!g.female,
    str: g.str, pol: g.pol, cha: g.cha, int: g.int, clan: PLAYER, words: farewellOf(g),
  });
  if (s.hall.length > 80) s.hall.shift();
  const fame = r.w + r.cap + r.dw * 2 + r.def;
  if (fame >= 5) {
    const nick = nickOf(g);
    addNews(s, `${nick ? `「${nick}」` : ''}${g.name}、卒業`, `「${s.hall[s.hall.length - 1].words}」`, 50);
  }
}

// ---------- 家宝 ----------
// g.treasure = 家宝のid。プレイヤーの家の、誰にも持たせていない家宝は s.vault（蔵）に入る
const treasureKind = (g) => (g && g.treasure && TREASURES[g.treasure] ? TREASURES[g.treasure].kind : null);
function ownedTreasures(s) {
  const owned = new Set(s.vault || []);
  Object.values(s.gens).forEach((g) => { if (g.treasure && !['graduated'].includes(g.clan)) owned.add(g.treasure); });
  return owned;
}
function freeTreasures(s) {
  const owned = ownedTreasures(s);
  return Object.keys(TREASURES).filter((id) => !owned.has(id));
}
// はじめは各家の当主（いちばん強い武将）が1つずつ持つ
function initTreasures(s) {
  if (s.treasureInit) return;
  s.treasureInit = true;
  s.vault = s.vault || [];
  Object.keys(CLANS).filter((k) => k !== 'none' && castlesOf(s, k).length).forEach((k) => {
    const free = freeTreasures(s);
    if (!free.length) return;
    const gens = gensOf(s, k).filter((g) => g.loc);
    const holder = gens.find((g) => g.lord) || bestBy(gens, (g) => g.str + g.int + g.cha + g.pol);
    if (holder && !holder.treasure) holder.treasure = pick(free);
  });
}
// 捕らえた武将の家宝は蔵へ（プレイヤーが捕らえたとき）
function lootTreasure(s, g, log) {
  if (!g || !g.treasure) return;
  s.vault = s.vault || [];
  s.vault.push(g.treasure);
  if (log) log.push(`🏺 ${g.name}の家宝「${TREASURES[g.treasure].name}」を手に入れた！`);
  addNews(s, `${pName()}、家宝「${TREASURES[g.treasure].name}」を得る`, `${g.name}から奪い取る`, 55);
  g.treasure = null;
}
// 卒業や浪人で家を離れるとき：プレイヤーの家なら蔵へ、他家なら家の誰かへ受け継ぐ
function passOnTreasure(s, g, clan) {
  if (!g || !g.treasure) return;
  const t = g.treasure;
  g.treasure = null;
  if (clan === PLAYER) { s.vault = s.vault || []; s.vault.push(t); return; }
  if (!CLANS[clan] || clan === 'none') return; // 持ち主を失った家宝は、世に散る
  const heir = bestBy(gensOf(s, clan).filter((x) => x.loc && !x.treasure), (x) => x.str + x.int);
  if (heir) heir.treasure = t;
}
function equipTreasure(s, gid, tid) {
  const g = s.gens[gid];
  s.vault = s.vault || [];
  const i = s.vault.indexOf(tid);
  if (!g || i < 0) return;
  s.vault.splice(i, 1);
  if (g.treasure) s.vault.push(g.treasure);
  g.treasure = tid;
}
function unequipTreasure(s, gid) {
  const g = s.gens[gid];
  if (!g || !g.treasure) return;
  s.vault = s.vault || [];
  s.vault.push(g.treasure);
  g.treasure = null;
}

// ---------- 因縁：何度もぶつかった敵将どうしは宿敵になる ----------
const RIVAL_AT = 3; // 対決がこの回数に届くと宿敵
const rivalKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function addClash(s, ga, gb, n = 1) {
  if (!ga || !gb || ga.clan === gb.clan) return;
  if (ga.clan !== PLAYER && gb.clan !== PLAYER) return; // 自分の家が関わる対決だけを数える
  s.rivals = s.rivals || {};
  const k = rivalKey(ga.id, gb.id);
  const before = s.rivals[k] || 0;
  s.rivals[k] = before + n;
  if (before < RIVAL_AT && s.rivals[k] >= RIVAL_AT && (ga.clan === PLAYER || gb.clan === PLAYER)) {
    addNews(s, `宿命の対決！ ${ga.name}と${gb.name}`, `${s.rivals[k]}度目の激突、ついに宿敵に`, 42);
  }
  // 宿敵の名は、卒業していなくなってもエンディングで語れるよう残す
  if (s.rivals[k] >= RIVAL_AT) {
    const [me, foe] = ga.clan === PLAYER ? [ga, gb] : [gb, ga];
    s.rivalBook = s.rivalBook || {};
    s.rivalBook[k] = { me: me.name, foe: foe.name, foeClan: foe.clan, n: s.rivals[k], meId: me.id, foeId: foe.id };
  }
}
const clashes = (s, a, b) => (s.rivals && a && b ? s.rivals[rivalKey(a.id, b.id)] || 0 : 0);
const areRivals = (s, a, b) => clashes(s, a, b) >= RIVAL_AT;
// いちばん因縁の深い相手（まだこの世にいる武将）
function rivalOf(s, g) {
  if (!s.rivals || !g) return null;
  let best = null, bestN = RIVAL_AT - 1;
  Object.entries(s.rivals).forEach(([k, n]) => {
    if (n <= bestN) return;
    const [a, b] = k.split('|');
    const other = a === g.id ? b : b === g.id ? a : null;
    if (other && s.gens[other] && s.gens[other].clan !== 'graduated') { best = s.gens[other]; bestN = n; }
  });
  return best ? { g: best, n: bestN } : null;
}

// ---------- 地図の前線表示 ----------
// 自分の城の危うさ：となりの敵城（同じ家）が兵の8割を集めて攻めてきたら、守り切れる見込み
// keep：おまかせで守ったときの見込み（0〜1）。となりに敵がいなければ null
function dangerOf(s, id, ratioToChance) {
  const byClan = {};
  MAP.adj[id].forEach((n) => {
    const o = s.castles[n].owner;
    if (o === PLAYER || o === 'none' || atPeace(s, PLAYER, o)) return;
    const lead = bestBy(gensAt(s, n), 'str');
    const b = byClan[o] || (byClan[o] = { troops: 0, mult: 1 });
    b.troops += Math.floor(s.castles[n].troops * 0.8);
    if (lead) b.mult = Math.max(b.mult, atkMult(lead));
  });
  const clans = Object.keys(byClan);
  if (!clans.length) return null;
  const power = Math.max(1, defensePower(s, id));
  const worst = Math.max(...clans.map((k) => byClan[k].troops * byClan[k].mult / power));
  return { keep: 1 - ratioToChance(worst), ratio: worst };
}

// ---------- 絆（自分の家の武将どうし） ----------
// s.bonds[key] = { a, b, type, since }  ／ s.bondPts[key] = 点数 ／ s.bondQueue = 次に見せる場面
const bondKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function bondsOf(s, g) {
  if (!s.bonds || !g) return [];
  return Object.values(s.bonds).filter((b) => b.a === g.id || b.b === g.id)
    .map((b) => ({ ...b, other: b.a === g.id ? b.b : b.a }));
}
const bondBetween = (s, a, b) => (s.bonds && a && b ? s.bonds[bondKey(a.id, b.id)] : null);
// 二人の組み合わせで、生まれる絆の種類（同じ城で過ごすとき）
function bondKindOf(a, b) {
  if (a.grade === b.grade) return 'shin';
  const [hi, lo] = a.grade > b.grade ? [a, b] : [b, a];
  const best = ['str', 'int', 'pol', 'cha'].reduce((x, y) => (hi[y] > hi[x] ? y : x));
  return hi[best] >= 65 && hi[best] >= lo[best] + 8 ? 'shitei' : null;
}
function addBondPts(s, a, b, type, n) {
  if (!a || !b || a.id === b.id || a.clan !== PLAYER || b.clan !== PLAYER) return;
  s.bonds = s.bonds || {};
  s.bondPts = s.bondPts || {};
  const k = bondKey(a.id, b.id);
  if (s.bonds[k]) return;
  s.bondPts[k] = (s.bondPts[k] || 0) + n;
  // 1季に生まれるのは1組まで。家の中の絆の数にも上限がある
  if (s.bondPts[k] >= BOND_AT && bondsOf(s, a).length < BOND_MAX && bondsOf(s, b).length < BOND_MAX &&
      s.lastBond !== s.turn && Object.keys(s.bonds).length < BOND_LIVE) {
    s.lastBond = s.turn;
    formBond(s, a, b, type);
  }
}
function formBond(s, a, b, type) {
  const k = bondKey(a.id, b.id);
  // 師弟は、学年の上の人を a（師）にする
  const [x, y] = type === 'shitei' && b.grade > a.grade ? [b, a] : [a, b];
  s.bonds[k] = { a: x.id, b: y.id, type, since: s.turn };
  delete s.bondPts[k];
  if (type === 'shin') [x, y].forEach((g) => { g.loyal = Math.min(100, (g.loyal || 60) + 8); });
  if (type === 'senyu') [x, y].forEach((g) => { g.str = Math.min(100, g.str + 1); });
  s.bondQueue = s.bondQueue || [];
  s.bondQueue.push({ id: 'bond', p: { a: x.id, b: y.id, type, line: randInt(0, 1) } });
  addNews(s, `${x.name}と${y.name}、${BOND_TYPES[type].name}の契り`, '二人の絆が家を強くする', 43);
}
// 季節ごと：同じ城にいる自分の武将どうしに点を足す
function bondTick(s) {
  castlesOf(s, PLAYER).forEach((id) => {
    const gens = gensAt(s, id).filter((g) => g.clan === PLAYER);
    for (let i = 0; i < gens.length; i++) {
      for (let j = i + 1; j < gens.length; j++) {
        const type = bondKindOf(gens[i], gens[j]);
        if (type && Math.random() < 0.5) addBondPts(s, gens[i], gens[j], type, 1);
      }
    }
  });
}
// 卒業：絆の相手との別れ。師弟なら弟子が師の得意を受け継ぐ
function bondGraduate(s, g) {
  bondsOf(s, g).forEach((bd) => {
    const other = s.gens[bd.other];
    delete s.bonds[bondKey(g.id, bd.other)];
    if (!other || other.clan !== PLAYER || other.grade >= 3) return; // 二人とも卒業するなら、別れの場面はなし
    let gift = null;
    if (bd.type === 'shitei' && bd.a === g.id) {
      gift = ['str', 'int', 'pol', 'cha'].reduce((x, y) => (g[y] > g[x] ? y : x));
      other[gift] = Math.min(100, other[gift] + 3);
    }
    s.bondQueue = s.bondQueue || [];
    s.bondQueue.push({ id: 'farewell', p: { a: g.id, b: other.id, type: bd.type, line: randInt(0, 1), gift } });
  });
}
// 合戦で、大将が絆の相手と並んでいるか（攻め：援軍の大将／守り：同じ城の武将）
function bondPartnerIn(s, leader, gids) {
  if (!leader || leader.clan !== PLAYER) return null;
  const id = gids.find((x) => x !== leader.id && bondBetween(s, leader, s.gens[x]));
  return id ? s.gens[id] : null;
}

// ---------- 学校の校風 ----------
function schoolLore(id) {
  if (SCHOOL_LORE[id]) return SCHOOL_LORE[id];
  const list = TRAIT_MOTTOS[traitOf(id)] || TRAIT_MOTTOS.traditional;
  return { motto: list[hashStr(id) % list.length] };
}

// ---------- 他家の当主 ----------
// s.aiLords[家] = 当主の武将id。卒業や捕縛でいなくなったら、その家でいちばん格の高い者が継ぐ
function aiLordOf(s, clan) {
  if (clan === PLAYER || !CLANS[clan] || clan === 'none') return null;
  s.aiLords = s.aiLords || {};
  const cur = s.gens[s.aiLords[clan]];
  if (cur && cur.clan === clan && cur.loc) return cur;
  const heir = bestBy(gensOf(s, clan).filter((g) => g.loc), (g) => g.str + g.cha + g.pol + g.int);
  if (!heir) return null;
  const first = !s.aiLords[clan];
  s.aiLords[clan] = heir.id;
  heir.title = '当主';
  if (!first && castlesOf(s, clan).length) addNews(s, `${CLANS[clan].name}に新当主・${heir.name}`, lordVoice(clan).catch ? `「${lordVoice(clan).catch}」` : '', 36);
  return heir;
}
const lordVoice = (clan) => LORD_VOICE[CLAN_PERSONA[clan]] || LORD_VOICE.balanced;
// 自分の家との合戦を数え、節目で当主から書状を送らせる
function countClanClash(s, r) {
  const foe = r.attacker === PLAYER ? r.defender : r.defender === PLAYER ? r.attacker : null;
  if (!foe || foe === 'none' || !CLANS[foe]) return;
  s.clanClash = s.clanClash || {};
  s.clanClash[foe] = (s.clanClash[foe] || 0) + 1;
  const i = LETTER_AT.indexOf(s.clanClash[foe]);
  if (i < 0 || !lordVoice(foe).letters[i]) return;
  const lord = aiLordOf(s, foe);
  if (!lord) return;
  s.bondQueue = s.bondQueue || [];
  s.bondQueue.push({ id: 'letter', p: { clan: foe, lord: lord.id, i, n: s.clanClash[foe] } });
}

// ---------- 恩と恨み（捕らえた当主の扱いの後日談） ----------
// 情けをかけて帰した当主は、しばらくして恩を返しに来る。身代金を取られた当主は、恨みの書状を寄こす
function addDebt(s, clan, lord, kind) {
  s.debts = s.debts || [];
  s.debts.push({ clan, lord, kind, due: s.turn + randInt(2, 5) });
}
function debtTick(s) {
  if (!s.debts || !s.debts.length) return;
  s.debts = s.debts.filter((d) => {
    if (s.turn < d.due) return true;
    const lord = s.gens[d.lord];
    if (!lord || !castlesOf(s, d.clan).length || aiLordOf(s, d.clan) !== lord) return false; // 当主が代わっていたら、話は立ち消え
    s.bondQueue = s.bondQueue || [];
    if (d.kind === 'ransom') {
      if (s.rel[d.clan]) changeFriend(s, d.clan, -10);
      s.bondQueue.push({ id: 'letter', p: { clan: d.clan, lord: d.lord, mood: 'angry', sub: '身代金の恨み',
        text: '金で買い戻されたあの日の屈辱、片時も忘れたことはない。いずれ必ず、この借りは返させてもらう。', gift: `${CLANS[d.clan].name}の友好度が下がった` } });
      return false;
    }
    // 恩返し：金か、となりの城への援兵
    const border = castlesOf(s, PLAYER).filter((id) => MAP.adj[id].some((n) => s.castles[n].owner === d.clan));
    const to = border.length ? pick(border) : castlesOf(s, PLAYER)[0];
    if (to && Math.random() < 0.5) {
      const n = 300 + castlesOf(s, d.clan).length * 40;
      s.castles[to].troops = Math.min(RULES.troopCap, s.castles[to].troops + n);
      s.bondQueue.push({ id: 'letter', p: { clan: d.clan, lord: d.lord, mood: 'smile', sub: '先の恩に報いて',
        text: '貴殿に救われた命、ここで返そう。我が家の精鋭を、貴殿の城へ送り届ける。存分に使ってくれ。', gift: `${MAP.byId[to].short}に ${n} の援兵が加わった` } });
    } else {
      const g = 300 + castlesOf(s, d.clan).length * 50;
      s.gold[PLAYER] += g;
      s.bondQueue.push({ id: 'letter', p: { clan: d.clan, lord: d.lord, mood: 'smile', sub: '先の恩に報いて',
        text: '先の恩、片時も忘れてはおらぬ。わずかだが受け取ってほしい。これで貸し借りなしだ、とは言わぬ。', gift: `金 ${g} が届いた` } });
    }
    if (s.rel[d.clan]) changeFriend(s, d.clan, 5);
    addNews(s, `${CLANS[d.clan].name}当主・${lord.name}、${pName()}に恩を返す`, '敵味方を超えた義理', 40);
    return false;
  });
}

// ---------- 天下目前（終盤の山場） ----------
// 節目（城の半分・4分の3・9割）で一枚絵。4分の3を越えると、残る家が「最後の大連合」を組んで大反攻に出る
// 同じころから、となりの独立校が自ら帰順してくる（終盤の掃除を短くする）
const FINALE = { marks: [0.5, 0.75, 0.9], rallyShare: 0.75, rallyTurns: 3, rallyBoost: 0.4, rallyGold: 800, rallyNeed: 0.8, kijun: 0.3, kijunMax: 2 };
const shareOf = (s) => castlesOf(s, PLAYER).length / MAP.nodes.length;
const rallyOn = (s, clan) => !!(s.finale && s.finale.rally && s.turn < s.finale.rally.until && s.finale.rally.clans.includes(clan));
function finaleTick(s, log) {
  const F = s.finale || (s.finale = { marks: [], queue: [] });
  F.queue = F.queue || [];
  const share = shareOf(s);
  if (share >= 1) return;
  // 一度にいくつも越えたときは、いちばん上の節目だけ見せる
  const passed = FINALE.marks.filter((m) => share >= m && !F.marks.includes(m));
  if (passed.length) {
    const m = Math.max(...passed);
    F.marks.push(...passed);
    F.queue.push({ id: 'milestone', p: { mark: m, n: castlesOf(s, PLAYER).length } });
    addNews(s, m >= 0.9 ? `${pName()}、天下目前` : m >= 0.75 ? `${pName()}、天下に王手` : `${pName()}、天下の半ばを制す`, `残るは${MAP.nodes.length - castlesOf(s, PLAYER).length}校`, 90);
  }
  // 最後の大連合
  const members = aiClans().filter((k) => castlesOf(s, k).length && !(s.rel[k] && s.rel[k].sister));
  if (share >= FINALE.rallyShare && !F.rally && members.length) {
    const head = members.reduce((a, b) => (castlesOf(s, a).length >= castlesOf(s, b).length ? a : b));
    const lord = aiLordOf(s, head);
    F.rally = { head, clans: members, until: s.turn + FINALE.rallyTurns, lord: lord ? lord.id : null };
    s.encircle = true;
    members.forEach((k) => {
      if (s.rel[k]) { s.rel[k].ally = 0; s.rel[k].truce = 0; s.rel[k].trade = 0; changeFriend(s, k, -30); }
      s.gold[k] += FINALE.rallyGold;
      // 自分の家と接する城に、連合の兵が集まる
      castlesOf(s, k).filter((id) => MAP.adj[id].some((n) => s.castles[n].owner === PLAYER)).forEach((id) => {
        const c = s.castles[id];
        c.troops = Math.min(RULES.troopCap, Math.round((c.troops * (1 + FINALE.rallyBoost)) / 10) * 10);
      });
    });
    s.joint = null;
    F.queue.push({ id: 'rally', p: { head, lord: F.rally.lord, clans: members } });
    const ob = obVisit(s, 'engun'); // 大連合の結成に、名を上げた卒業生が駆けつける
    if (ob) F.queue.push(ob);
    log.push(`🔥 残る${members.length}家が「最後の大連合」を結成！ 盟主は${CLANS[head].name}。${FINALE.rallyTurns}季のあいだ大反攻に出る`);
    addDiploLog(s, `${CLANS[head].name}を盟主に「最後の大連合」が結成された`, 'bad');
    addNews(s, `最後の大連合、結成`, `盟主・${CLANS[head].name}、${pName()}に総攻撃を宣言`, 95);
  }
  if (F.rally && !F.rally.over && s.turn >= F.rally.until) {
    F.rally.over = true;
    log.push(`🏳️ 最後の大連合の大反攻が終わった。連合の勢いは衰えた`);
    addNews(s, '大連合の反攻、尽きる', `${pName()}、総攻撃をしのぎ切る`, 85);
  }
  // 独立校の帰順
  if (share >= FINALE.rallyShare) {
    const near = Object.keys(s.castles).filter((id) => s.castles[id].owner === 'none' && MAP.adj[id].some((n) => s.castles[n].owner === PLAYER));
    let n = 0;
    near.sort(() => Math.random() - 0.5).forEach((id) => {
      if (n >= FINALE.kijunMax || Math.random() >= FINALE.kijun) return;
      n++;
      Object.values(s.gens).filter((g) => g.loc === id && g.clan === 'none').forEach((g) => { g.clan = PLAYER; g.loyal = randInt(60, 75); });
      s.castles[id].owner = PLAYER;
      s.delegate[id] = true; // 帰順した城は、ひとまず委任しておく
      if (s.moves) s.moves.push({ from: null, to: id, att: PLAYER, def: 'none', won: true, kind: 'kijun' });
      log.push(`🎌 ${MAP.byId[id].name}が、${pName()}の威光に帰順した`);
      addNews(s, `${MAP.byId[id].short}、${pName()}に帰順`, '戦わずして門を開く', 60);
    });
  }
}

// ---------- 志（武将ひとりひとりの目標） ----------
// g.shi = { kind, target, need, base, done }。自分の家の武将に一つずつ。果たすと「覚醒」：能力が伸び、異名がつき、決め絵の場面
// rec：戦歴の数で測る志（base からいくつ増えたか）
const SHI = {
  bokou: { name: '母校奪還', title: () => '母校の英雄', text: (s, h) => `母校・${MAP.byId[h.target].short}を、この手で取り戻す`, line: 'ただいま。……帰ってきたぞ、わが学び舎よ' },
  castle: { name: '名城攻略', title: (h) => `${MAP.byId[h.target].short}落とし`, text: (s, h) => `${MAP.byId[h.target].name}を、この手で落とす`, line: 'ついに落としたぞ。この城を、ずっと見上げてきた' },
  conquer: { name: '城取り', rec: 'cap', title: () => '城取り名人', text: (s, h) => `合戦で城を${h.need}つ落とす`, line: '落とした城の数が、わが誇りだ' },
  duel: { name: '剣の道', rec: 'dw', title: () => '剣聖', text: (s, h) => `一騎打ちで${h.need}度勝つ`, line: '剣の道、ようやく一つ極めたり' },
  shield: { name: '不落', rec: 'def', title: () => '守護神', text: (s, h) => `攻め寄せる敵から、城を${h.need}度守り抜く`, line: 'この城には、指一本触れさせぬ' },
  debate: { name: '弁舌', title: () => '弁舌の士', text: () => '舌戦で城を開かせる', line: '言葉は刃より強し。それを証してみせた' },
  grow: { name: '町づくり', title: () => '名奉行', text: (s, h) => `${MAP.byId[h.target].short}を、経済${h.need}の町に育てる`, line: '城下がにぎわう。これぞ政の醍醐味よ' },
  rival: { name: '宿敵超え', title: () => '宿敵超え', text: (s, h) => `宿敵・${s.gens[h.target] ? s.gens[h.target].name : '？'}に、一騎打ちで勝つ`, line: 'やっと……やっと貴様を越えられた' },
};
const SHI_MORALE = 10;
const SHI_BOOST = { main: 6, rest: 2, loyal: 15 };
const shiText = (s, g) => (g.shi && SHI[g.shi.kind] ? SHI[g.shi.kind].text(s, g.shi) : '');
// [いまの数, 要る数]。数で測らない志は 0/1
function shiProgress(g) {
  const h = g.shi, D = h && SHI[h.kind];
  if (!D) return [0, 1];
  if (h.done) return [h.need || 1, h.need || 1];
  if (D.rec) return [Math.min(h.need, recOf(g)[D.rec] - h.base), h.need];
  return [0, 1];
}
function shiAssign(s, g) {
  const r = recOf(g);
  const best = ['str', 'int', 'pol', 'cha'].reduce((a, b) => (g[b] > g[a] ? b : a));
  const hostile = Object.keys(s.castles).filter((id) => s.castles[id].owner !== PLAYER);
  const front = hostile.filter((id) => MAP.adj[id].some((n) => s.castles[n].owner === PLAYER));
  // 前線の先にある名門（本拠）を優先して、狙う城を選ぶ
  const aim = () => {
    const caps = hostile.filter((id) => isCapital(id, s.castles[id].owner));
    const near = caps.filter((id) => MAP.adj[id].some((n) => front.includes(n) || s.castles[n].owner === PLAYER));
    return near.length ? pick(near) : front.length ? pick(front) : null;
  };
  const opts = []; // [重み, kind, target]
  if (g.school && s.castles[g.school] && s.castles[g.school].owner !== PLAYER) opts.push([4, 'bokou', g.school]);
  const rv = rivalOf(s, g);
  if (rv && rv.g.clan !== PLAYER) opts.push([4, 'rival', rv.g.id]);
  const t = aim();
  if (best === 'str') opts.push([2, 'duel'], [2, 'conquer'], ...(t ? [[2, 'castle', t]] : []));
  if (best === 'int') opts.push([2, 'shield'], [2, 'debate']);
  if (best === 'pol' && g.loc && s.castles[g.loc] && s.castles[g.loc].owner === PLAYER && s.castles[g.loc].eco < RULES.ecoCap - 30) opts.push([3, 'grow', g.loc]);
  if (best === 'cha') opts.push([2, 'debate'], ...(t ? [[2, 'castle', t]] : []));
  if (!opts.length) opts.push([1, 'conquer'], [1, 'shield']);
  let x = Math.random() * opts.reduce((a, o) => a + o[0], 0);
  const [, kind, target] = opts.find((o) => (x -= o[0]) <= 0) || opts[0];
  const h = { kind, target: target || null, done: false };
  if (SHI[kind].rec) { h.need = kind === 'conquer' ? 3 : 2; h.base = r[SHI[kind].rec]; }
  if (kind === 'grow') h.need = Math.min(RULES.ecoCap, Math.ceil((s.castles[target].eco + 40) / 10) * 10);
  g.shi = h;
}
// 志の出来事：'cap'（城を落とした：arg=城）／'duel'（一騎打ちに勝った：arg=相手）／'def'（守り抜いた）／'debate'（舌戦で開城）
function shiHit(s, g, ev, arg) {
  const h = g && g.clan === PLAYER && g.shi;
  if (!h || h.done) return;
  const D = SHI[h.kind];
  const ok = (h.kind === 'bokou' || h.kind === 'castle') ? ev === 'cap' && arg === h.target
    : h.kind === 'rival' ? ev === 'duel' && arg && arg.id === h.target
    : h.kind === 'debate' ? ev === 'debate'
    : D.rec ? recOf(g)[D.rec] - h.base >= h.need
    : false;
  if (ok) shiDone(s, g);
}
function shiDone(s, g) {
  const h = g.shi;
  h.done = true;
  h.at = s.turn;
  const best = ['str', 'int', 'pol', 'cha'].reduce((a, b) => (g[b] > g[a] ? b : a));
  ['str', 'int', 'pol', 'cha'].forEach((k) => { g[k] = Math.min(99, g[k] + (k === best ? SHI_BOOST.main : SHI_BOOST.rest)); });
  if (!g.lord) g.loyal = Math.min(100, (g.loyal || 0) + SHI_BOOST.loyal);
  h.title = SHI[h.kind].title(h);
  s.bondQueue = s.bondQueue || [];
  s.bondQueue.push({ id: 'shi', p: { gid: g.id, best } });
  addNews(s, `${g.name}、志を果たす`, `「${SHI[h.kind].name}」──人呼んで「${h.title}」`, 70);
}
// 季節ごと：志のない武将に志を、果たせなくなった志は立て直す。町づくりはここで測る
function shiTick(s) {
  gensOf(s, PLAYER).forEach((g) => {
    if (!g.loc) return;
    const h = g.shi;
    if (h && !h.done) {
      const gone = ((h.kind === 'bokou' || h.kind === 'castle') && s.castles[h.target].owner === PLAYER) // ほかの者が落とした
        || (h.kind === 'rival' && (!s.gens[h.target] || ['graduated', PLAYER].includes(s.gens[h.target].clan)))
        || (h.kind === 'grow' && s.castles[h.target].owner !== PLAYER);
      if (h.kind === 'grow' && !gone && s.castles[h.target].eco >= h.need) { shiDone(s, g); return; }
      if (gone) delete g.shi;
    }
    if (!g.shi) shiAssign(s, g);
  });
}

// ---------- 卒業生（OB・OG）の再登場 ----------
// 名を上げて卒業した自分の家の武将が、ときどき学び舎に戻ってくる：後輩に稽古（能力+3）・危うい城へ援軍・差し入れ（金）
// s.hall の記録をそのまま使う。来訪の回数は h.visits に数える
const OB = { chance: 0.2, minFame: 3, waitTurns: 2 };
const obFame = (h) => h.rec.w + h.rec.cap + h.rec.dw * 2 + h.rec.def;
function obCandidates(s) {
  return (s.hall || []).map((h, i) => ({ h, i })).filter(({ h }) => h.clan === PLAYER && obFame(h) >= OB.minFame && s.turn - h.until >= OB.waitTurns);
}
// force：'engun' なら援軍を選ぶ（大連合の結成など）
function obVisit(s, force) {
  const cands = obCandidates(s);
  if (!cands.length || !castlesOf(s, PLAYER).length) return null;
  let x = Math.random() * cands.reduce((a, c) => a + obFame(c.h), 0);
  const { h, i } = cands.find((c) => (x -= obFame(c.h)) <= 0) || cands[0];
  const fame = obFame(h);
  const best = ['str', 'int', 'pol', 'cha'].reduce((a, b) => (h[b] > h[a] ? b : a));
  const risky = castlesOf(s, PLAYER).map((id) => [id, dangerOf(s, id, winChance)]).filter(([, t]) => t && t.keep < 0.7)
    .sort((a, b) => a[1].keep - b[1].keep);
  const kohai = gensOf(s, PLAYER).filter((g) => g.loc && !g.lord && g[best] < 95).sort((a, b) => (b.school === h.school) - (a.school === h.school) || a[best] - b[best])[0];
  const kinds = force ? [force] : [risky.length && 'engun', kohai && 'keiko', 'sashiire'].filter(Boolean);
  const kind = pick(kinds);
  const p = { hi: i, kind };
  if (kind === 'engun') {
    const to = risky.length ? risky[0][0] : pick(castlesOf(s, PLAYER));
    const n = Math.min(RULES.troopCap - s.castles[to].troops, Math.round((300 + fame * 40) / 10) * 10);
    s.castles[to].troops += Math.max(0, n);
    Object.assign(p, { to, n });
  } else if (kind === 'keiko' && kohai) {
    kohai[best] = Math.min(99, kohai[best] + 3);
    if (!kohai.lord) kohai.loyal = Math.min(100, kohai.loyal + 3);
    Object.assign(p, { gid: kohai.id, stat: best });
  } else {
    p.kind = 'sashiire';
    p.gold = Math.round((200 + fame * 25) / 10) * 10;
    s.gold[PLAYER] += p.gold;
  }
  h.visits = (h.visits || 0) + 1;
  addNews(s, `OB・${h.name}、母校に帰る`, kind === 'engun' ? '後輩の危機に駆けつける' : kind === 'keiko' ? '後輩に稽古をつける' : '差し入れを手に', 45);
  return { id: 'ob', p };
}
function obTick(s) {
  if (Math.random() >= OB.chance) return null;
  return obVisit(s);
}
