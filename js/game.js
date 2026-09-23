// 地図の作成・ゲームのルール・武将・合戦・敵の思考
const PLAYER = 'azabu';
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

function buildMap() {
  const nodes = SCHOOL_ROWS.map(([id, name, short, ward, lat, lon, clan]) => ({
    id, name, short, ward, clan: clan || 'none', ...project(lat, lon),
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
    const p = project(lat, lon);
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

const MAP = buildMap();

// ---------- 武将の作成 ----------
function makeGeneral(s, school, clan, { strong = false, title } = {}) {
  const female = GIRLS_SCHOOLS.includes(school) ? true : BOYS_SCHOOLS.includes(school) ? false : Math.random() < 0.35;
  let name;
  do {
    name = `${pick(SURNAMES)} ${pick(female ? FEMALE_NAMES : MALE_NAMES)}`;
  } while (s.usedNames[name]);
  s.usedNames[name] = true;

  const [lo, hi] = strong ? [55, 85] : [30, 72];
  const g = {
    id: `g${++s.genSeq}`,
    name, female,
    title: title || pick(TITLES),
    school, origin: clan, clan, loc: school,
    str: randInt(lo, hi), pol: randInt(lo, hi), cha: randInt(lo, hi), int: randInt(lo, hi),
    skill: Math.random() < (strong ? 0.55 : 0.25) ? pick(Object.keys(SKILLS)) : null,
    look: randInt(0, 9999),
  };
  const best = pick(['str', 'pol', 'cha', 'int']);
  g[best] = Math.min(98, g[best] + randInt(8, 16)); // 得意な能力
  s.gens[g.id] = g;
  return g;
}

// ---------- ゲームの状態 ----------
function newGame({ lordName = '麻布 一郎', diff = 'normal' } = {}) {
  const D = DIFFICULTY[diff];
  const s = {
    turn: 0, diff, gold: {}, castles: {}, gens: {}, genSeq: 0, usedNames: {},
    acted: {}, delegate: {}, log: [], result: null,
  };
  MAP.nodes.forEach((n) => {
    const r = seeded(hashStr(n.id));
    const capital = n.clan !== 'none';
    s.castles[n.id] = {
      owner: n.clan,
      troops: capital ? 1500 : Math.round((400 + r() * 700) / 10) * 10,
      def: capital ? 1.5 : Math.round((1 + r() * 0.5) * 10) / 10,
      eco: capital ? 120 : Math.round(40 + r() * 60),
    };
    if (n.clan === PLAYER) {
      const lord = makeGeneral(s, n.id, PLAYER, { strong: true, title: '当主' });
      Object.assign(lord, { name: lordName, str: 72, pol: 68, cha: 84, int: 70, skill: 'jinbou', lord: true });
      for (let i = 0; i < 3; i++) makeGeneral(s, n.id, PLAYER, { strong: true, title: i === 0 ? '生徒会長' : undefined });
    } else if (capital) {
      for (let i = 0; i < 3; i++) makeGeneral(s, n.id, n.clan, { strong: true, title: i === 0 ? '生徒会長' : undefined });
    } else {
      const count = Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < count; i++) makeGeneral(s, n.id, 'none', { title: i === 0 ? '生徒会長' : undefined });
    }
  });
  Object.keys(CLANS).forEach((k) => {
    s.gold[k] = k === PLAYER ? D.gold : Math.round(RULES.aiStartGold * D.aiGold);
  });
  return migrate(s);
}

// 古いセーブデータに、あとから増えた項目を足す
function migrate(s) {
  s.rel = s.rel || {};
  aiClans().forEach((k) => { s.rel[k] = s.rel[k] || { friend: 30, truce: 0, ally: 0 }; });
  s.encircle = !!s.encircle;
  s.pending = s.pending || [];
  return s;
}

function aiClans() {
  return Object.keys(CLANS).filter((k) => !CLANS[k].player && k !== 'none');
}

// ---------- 外交 ----------
const DIPLO = {
  giftCost: 300,
  truceTurns: 8,
  allyTurns: 12,
  encircleShare: 0.45,
};

// 2つの勢力が戦わない関係か
function atPeace(s, a, b) {
  if (a === b) return true;
  if (a === 'none' || b === 'none') return false;
  if (a === PLAYER || b === PLAYER) {
    const r = s.rel[a === PLAYER ? b : a];
    return !!r && (r.truce > 0 || r.ally > 0);
  }
  return s.encircle; // 包囲網の間、他家どうしは争わない
}

function relLabel(s, clan) {
  const r = s.rel[clan];
  if (!r) return '';
  if (r.ally > 0) return `同盟（残り${r.ally}季）`;
  if (r.truce > 0) return `停戦（残り${r.truce}季）`;
  return '交戦中';
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
  return clamp((r.friend - 30) / 60 + g.cha / 400 + size, 0.03, 0.95);
}
function allyChance(s, clan, g) {
  const r = s.rel[clan];
  return clamp((r.friend - 50) / 45 + g.cha / 300, 0, 0.9);
}

function diploGift(s, clan, g) {
  s.gold[PLAYER] -= DIPLO.giftCost;
  s.acted[g.id] = true;
  const d = 8 + Math.round(g.cha / 10);
  changeFriend(s, clan, d);
  grow(g, 'cha');
  return `${CLANS[clan].name}に贈り物をした。友好度 +${d}`;
}
function diploTruce(s, clan, g) {
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
  r.ally = 0;
  r.truce = 0;
  changeFriend(s, clan, -40);
  aiClans().forEach((k) => { if (k !== clan) changeFriend(s, k, -10); }); // 信用を失う
  return `${CLANS[clan].name}との約束を破棄した。諸家の信用を失った…`;
}

// 毎ターンの外交の変化
function tickDiplomacy(s, log) {
  aiClans().forEach((k) => {
    const r = s.rel[k];
    if (!castlesOf(s, k).length) return;
    if (r.truce > 0 && --r.truce === 0) log.push(`🕊️ ${CLANS[k].name}との停戦が終わった`);
    if (r.ally > 0 && --r.ally === 0) log.push(`🤝 ${CLANS[k].name}との同盟が期限を迎えた`);
    if (r.ally > 0) changeFriend(s, k, 1);
    // 国境を接していると少しずつ緊張が高まる
    const border = castlesOf(s, PLAYER).some((id) => MAP.adj[id].some((n) => s.castles[n].owner === k));
    if (border && !r.ally && !r.truce) changeFriend(s, k, -1);
  });
  // 麻布包囲網
  const share = castlesOf(s, PLAYER).length / MAP.nodes.length;
  const alive = aiClans().filter((k) => castlesOf(s, k).length);
  if (!s.encircle && share >= DIPLO.encircleShare && alive.length >= 2) {
    s.encircle = true;
    alive.forEach((k) => {
      s.rel[k].ally = 0; s.rel[k].truce = 0; changeFriend(s, k, -30);
      s.gold[k] += 600; // 軍資金
    });
    log.push('🔥 麻布家の台頭を恐れた諸家が「麻布包囲網」を結成！ 同盟・停戦はすべて破棄された');
  }
}

// 攻めてよい相手のとなりの城
function hostileNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => !atPeace(s, owner, s.castles[n].owner));
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
  return Math.round(c.eco * (merchant ? 1.2 : 1));
}

function income(s, clan) {
  const base = castlesOf(s, clan).reduce((a, id) => a + castleIncome(s, id), 0);
  return clan === PLAYER ? base : Math.round(base * diffOf(s).aiIncome * (s.encircle ? 1.2 : 1));
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
  const n = recruitAmount(g);
  c.troops = Math.min(RULES.troopCap, c.troops + n);
  return { text: `兵+${n}`, grew: grow(g, 'cha') };
}
function canDevelop(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.developCost && s.castles[id].eco < RULES.ecoCap;
}
function develop(s, id, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.developCost;
  const n = developAmount(g);
  c.eco = Math.min(RULES.ecoCap, c.eco + n);
  return { text: `経済+${n}`, grew: grow(g, 'pol') };
}
function canFortify(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.fortifyCost && s.castles[id].def < RULES.defCap - 0.01;
}
function fortify(s, id, g) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.fortifyCost;
  const n = fortifyAmount(g);
  c.def = Math.round(Math.min(RULES.defCap, c.def + n) * 10) / 10;
  return { text: `防御+${n.toFixed(1)}`, grew: grow(g, 'int') };
}
function moveTroops(s, from, to, n) {
  s.castles[from].troops -= n;
  s.castles[to].troops = Math.min(RULES.troopCap, s.castles[to].troops + n);
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

const atkMult = (g) => 0.7 + g.str / 150;
const defMult = (g) => (g ? 0.8 + (g.str + g.int) / 600 : 0.85);
const defLeader = (s, id) => bestBy(gensAt(s, id), (g) => g.str + g.int);

// 守りの強さ（兵力×防御×武将）。攻めるかどうかの目安に使う
function defensePower(s, id) {
  const c = s.castles[id];
  const dg = defLeader(s, id);
  const def = c.def + (dg && dg.skill === 'teppeki' ? 0.3 : 0);
  return (c.troops * def * defMult(dg)) / 0.85;
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
      g.clan = 'captive';
      g.loc = null;
      g.capturedAt = id;
      captured.push(g.id);
    } else if (Math.random() < 0.5) {
      g.clan = winner;
      g.loc = id;
      if (loser === PLAYER && log) log.push(`😢 ${g.name}は捕らえられ、${CLANS[winner].name}に寝返った`);
    } else {
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
    s.castles[id].troops > 0 && idleGensAt(s, id).length > 0);
}

// 攻撃を実行して結果を返す
// gid = 大将の武将、support = [{ from, n, gid }] 援軍（となりの城から合流する部隊）
function attack(s, from, to, n, gid, log, support = []) {
  const src = s.castles[from], dst = s.castles[to];
  const attacker = src.owner, defender = dst.owner;
  const g = s.gens[gid];
  const dg = defLeader(s, to);
  src.troops -= n;
  s.acted[gid] = true;
  // 攻められた家は麻布家を恨む
  if (attacker === PLAYER && s.rel[defender]) changeFriend(s, defender, -15);
  if (defender === PLAYER && s.rel[attacker]) changeFriend(s, attacker, -3);
  support.forEach((sp) => {
    s.castles[sp.from].troops -= sp.n;
    s.acted[sp.gid] = true;
    n += sp.n;
  });
  const def = dst.def + (dg && dg.skill === 'teppeki' ? 0.3 : 0);
  const r = fight(n, dst.troops, def, atkMult(g), defMult(dg), {
    totsugeki: g.skill === 'totsugeki',
    shinsanA: g.skill === 'shinsan',
    shinsanD: dg && dg.skill === 'shinsan',
  });
  const result = { ...r, from, to, attacker, defender, sent: n, gid, dgid: dg ? dg.id : null, support, captured: [], grew: null };
  if (r.won) {
    dst.owner = attacker;
    dst.troops = r.left;
    dst.def = Math.max(1, Math.round((dst.def - 0.1) * 10) / 10); // 落城で城が傷む
    moveGeneral(s, gid, to);
    result.captured = scatterGenerals(s, to, defender, attacker, log);
    result.grew = grow(g, 'str');
  } else {
    dst.troops = r.defLeft;
    // 生き残りは出てきた城へ、兵の割合に応じて帰る
    const parts = [{ from, n: n - support.reduce((a, sp) => a + sp.n, 0) }, ...support];
    parts.forEach((p) => { s.castles[p.from].troops += Math.round((r.left * p.n) / n); });
    if (dg) grow(dg, 'int');
  }
  return result;
}

// 捕らえた武将を登用する
function recruitChance(s, g) {
  const lord = lordOf(s);
  let p = 0.2 + ((lord ? lord.cha : 60) - 50) / 150;
  if (lord && lord.skill === 'jinbou') p += 0.15;
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
function frontDistance(s, clan) {
  const dist = {};
  const queue = [];
  castlesOf(s, clan).forEach((id) => {
    if (hostileNeighbors(s, id).length) { dist[id] = 0; queue.push(id); }
  });
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

function autoCastle(s, clan, id, cfg, dist, log) {
  const c = s.castles[id];
  if (c.owner !== clan) return;
  const reserve = cfg.reserve;
  const idle = () => idleGensAt(s, id);
  const use = (g) => { if (g) s.acted[g.id] = true; };
  const enemies = hostileNeighbors(s, id);

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
    const aim = (t) => defensePower(s, t) * (s.encircle && clan !== PLAYER && s.castles[t].owner === PLAYER ? 0.6 : 1);
    const target = enemies.reduce((a, b) => (aim(a) <= aim(b) ? a : b));
    const send = Math.floor(c.troops * 0.8);
    const need = defensePower(s, target) * cfg.ratio + 100;
    let support = [];
    if (send * atkMult(leader) <= need) {
      // 一城で足りなければ、となりの城から援軍を集める
      support = supportCastles(s, clan, target, id).map((sid) => ({
        from: sid, n: Math.floor(s.castles[sid].troops * 0.8), gid: bestBy(idleGensAt(s, sid), 'str').id,
      }));
    }
    const total = send + support.reduce((a, sp) => a + sp.n, 0);
    if (total * atkMult(leader) > need) {
      const r = attack(s, id, target, send, leader.id, log, support);
      if (r.defender === PLAYER || r.won || clan === PLAYER) log.push(battleLine(s, r));
      if (r.won && r.defender !== 'none' && castlesOf(s, r.defender).length === 0) {
        log.push(`☠️ ${CLANS[r.defender].name}は${CLANS[clan].name}に滅ぼされた`);
      }
      if (clan === PLAYER && r.captured.length) {
        // 委任中に捕らえた武将は、自動で登用を試みる
        r.captured.forEach((gid) => {
          const ok = tryRecruitCaptive(s, gid);
          log.push(ok ? `🤝 ${s.gens[gid].name}が麻布家に加わった` : `🚶 ${s.gens[gid].name}は登用を断って去った`);
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
  const clans = Object.keys(CLANS).filter((k) => !CLANS[k].player && k !== 'none');
  for (const clan of clans) {
    const dist = frontDistance(s, clan);
    castlesOf(s, clan)
      .sort(() => Math.random() - 0.5)
      .forEach((id) => autoCastle(s, clan, id, { ratio: D.aiRatio, reserve: 0, noGeneral: true }, dist, log));
  }
  // 独立校は少しずつ兵が増える
  Object.values(s.castles).forEach((c) => {
    if (c.owner === 'none') c.troops = Math.min(RULES.neutralCap, c.troops + D.neutralGrowth);
  });
}

// 委任した城と、一括命令
function runDelegated(s, log) {
  const dist = frontDistance(s, PLAYER);
  castlesOf(s, PLAYER)
    .filter((id) => s.delegate[id])
    .forEach((id) => autoCastle(s, PLAYER, id, { ratio: RULES.delegateRatio, reserve: RULES.delegateReserve }, dist, log));
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

// ---------- ターン終了 ----------
function endTurn(s) {
  const log = [];
  runDelegated(s, log);
  aiTurn(s, log);
  s.turn++;
  Object.keys(CLANS).forEach((k) => {
    if (k !== 'none') s.gold[k] += income(s, k);
  });
  s.acted = {};
  Object.keys(s.delegate).forEach((id) => { if (s.castles[id].owner !== PLAYER) delete s.delegate[id]; });
  tickDiplomacy(s, log);
  checkWin(s);
  s.pending = s.result ? [] : rollEvents(s);
  s.log = log;
  return log;
}

function checkWin(s) {
  const mine = castlesOf(s, PLAYER).length;
  if (mine === 0) s.result = 'lose';
  else if (mine === MAP.nodes.length) s.result = 'win';
}
