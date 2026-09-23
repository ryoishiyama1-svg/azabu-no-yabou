// 地図の作成・ゲームのルール・合戦・敵の思考
const RULES = {
  startGold: 800,
  aiStartGold: 600,
  recruitCost: 200, recruitAmount: 300, troopCap: 9990,
  developCost: 200, developAmount: 15, ecoCap: 250,
  fortifyCost: 300, fortifyAmount: 0.1, defCap: 2.0,
  neutralGrowth: 15, neutralCap: 1500,
  aiAttackRatio: 1.35,
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
  const MIN = 64;
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

  const PAD = 50;
  const minX = Math.min(...nodes.map((n) => n.x)), minY = Math.min(...nodes.map((n) => n.y));
  nodes.forEach((n) => { n.x = Math.round(n.x - minX + PAD); n.y = Math.round(n.y - minY + PAD); });
  const width = Math.max(...nodes.map((n) => n.x)) + PAD;
  const height = Math.max(...nodes.map((n) => n.y)) + PAD;

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
  return { nodes, byId, edges, adj, width, height };
}

const MAP = buildMap();

// ---------- ゲームの状態 ----------
function newGame() {
  const castles = {};
  MAP.nodes.forEach((n) => {
    const r = seeded(hashStr(n.id));
    const capital = n.clan !== 'none';
    castles[n.id] = {
      owner: n.clan,
      troops: capital ? 1500 : Math.round((400 + r() * 700) / 10) * 10,
      def: capital ? 1.5 : Math.round((1 + r() * 0.5) * 10) / 10,
      eco: capital ? 120 : Math.round(40 + r() * 60),
    };
  });
  const gold = {};
  Object.keys(CLANS).forEach((k) => (gold[k] = k === 'azabu' ? RULES.startGold : RULES.aiStartGold));
  return { turn: 0, gold, castles, acted: {}, log: [], result: null };
}

function dateLabel(turn) {
  return `${2026 + Math.floor(turn / 4)}年 ${SEASONS[turn % 4]}`;
}

function castlesOf(s, clan) {
  return Object.keys(s.castles).filter((id) => s.castles[id].owner === clan);
}

function income(s, clan) {
  return castlesOf(s, clan).reduce((a, id) => a + s.castles[id].eco, 0);
}

function enemyNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => s.castles[n].owner !== owner);
}

function ownNeighbors(s, id) {
  const owner = s.castles[id].owner;
  return MAP.adj[id].filter((n) => s.castles[n].owner === owner);
}

// ---------- 内政 ----------
function canRecruit(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.recruitCost && s.castles[id].troops < RULES.troopCap;
}
function recruit(s, id) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.recruitCost;
  c.troops = Math.min(RULES.troopCap, c.troops + RULES.recruitAmount);
}
function canDevelop(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.developCost && s.castles[id].eco < RULES.ecoCap;
}
function develop(s, id) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.developCost;
  c.eco = Math.min(RULES.ecoCap, c.eco + RULES.developAmount);
}
function canFortify(s, id) {
  return s.gold[s.castles[id].owner] >= RULES.fortifyCost && s.castles[id].def < RULES.defCap - 0.01;
}
function fortify(s, id) {
  const c = s.castles[id];
  s.gold[c.owner] -= RULES.fortifyCost;
  c.def = Math.round(Math.min(RULES.defCap, c.def + RULES.fortifyAmount) * 10) / 10;
}
function moveTroops(s, from, to, n) {
  s.castles[from].troops -= n;
  s.castles[to].troops = Math.min(RULES.troopCap, s.castles[to].troops + n);
}

// ---------- 合戦 ----------
// 攻撃側 a 人、守備側 d 人、守備側の防御力 def で最大6回ぶつかる
function fight(a, d, def) {
  const rounds = [{ a, d }];
  let won = false;
  const morale = rand(0.75, 1.25); // その日の士気
  for (let i = 0; i < 6; i++) {
    const toD = Math.round((a * 0.22 * morale * rand(0.8, 1.2)) / def);
    const toA = Math.round(d * 0.2 * rand(0.8, 1.2));
    a = Math.max(0, a - toA);
    d = Math.max(0, d - toD);
    rounds.push({ a, d });
    if (a === 0) break;
    if (d === 0 || d < a * 0.12) { won = true; d = 0; rounds[rounds.length - 1].d = 0; break; }
  }
  return { won, rounds, left: a, defLeft: d };
}

// 攻撃を実行して結果を返す
function attack(s, from, to, n) {
  const src = s.castles[from], dst = s.castles[to];
  const attacker = src.owner, defender = dst.owner;
  src.troops -= n;
  const r = fight(n, dst.troops, dst.def);
  if (r.won) {
    dst.owner = attacker;
    dst.troops = r.left;
    dst.def = Math.max(1, Math.round((dst.def - 0.1) * 10) / 10); // 落城で城が傷む
  } else {
    dst.troops = r.defLeft;
    src.troops += r.left; // 生き残りは帰城
  }
  return { ...r, from, to, attacker, defender, sent: n };
}

// ---------- 敵の思考 ----------
function aiTurn(s) {
  const log = [];
  const clans = Object.keys(CLANS).filter((k) => !CLANS[k].player && k !== 'none');

  for (const clan of clans) {
    const mine = castlesOf(s, clan).sort(() => Math.random() - 0.5);
    for (const id of mine) {
      const c = s.castles[id];
      if (c.owner !== clan) continue; // このターン中に奪われた
      const targets = enemyNeighbors(s, id);
      if (targets.length === 0) {
        // 前線でない城は兵を前線へ送る
        const front = ownNeighbors(s, id).find((n) => enemyNeighbors(s, n).length > 0);
        if (front && c.troops > 600) moveTroops(s, id, front, Math.floor(c.troops * 0.5));
        else if (canDevelop(s, id)) develop(s, id);
        continue;
      }
      const weakest = targets.reduce((a, b) =>
        s.castles[a].troops * s.castles[a].def <= s.castles[b].troops * s.castles[b].def ? a : b);
      const t = s.castles[weakest];
      const send = Math.floor(c.troops * 0.7);
      if (send > t.troops * t.def * RULES.aiAttackRatio + 100) {
        const r = attack(s, id, weakest, send);
        if (r.defender === 'azabu' || r.won) log.push(battleLine(r));
        if (r.won && castlesOf(s, r.defender).length === 0 && r.defender !== 'none') {
          log.push(`☠️ ${CLANS[r.defender].name}は${CLANS[clan].name}に滅ぼされた`);
        }
      } else if (canRecruit(s, id)) {
        recruit(s, id);
      }
    }
  }

  // 独立校は少しずつ兵が増える
  Object.values(s.castles).forEach((c) => {
    if (c.owner === 'none') c.troops = Math.min(RULES.neutralCap, c.troops + RULES.neutralGrowth);
  });
  return log;
}

function battleLine(r) {
  const a = CLANS[r.attacker].name, t = MAP.byId[r.to].name;
  const d = r.defender === 'none' ? '' : `（${CLANS[r.defender].name}）`;
  if (r.defender === 'azabu') {
    return r.won ? `🔥 ${a}が ${t} を攻め落とした！` : `🛡️ ${a}が ${t} に攻めてきたが、撃退した！`;
  }
  return `⚔️ ${a}が ${t}${d}を攻略`;
}

// ---------- ターン終了 ----------
function endTurn(s) {
  const log = aiTurn(s);
  s.turn++;
  Object.keys(CLANS).forEach((k) => {
    if (k !== 'none') s.gold[k] += income(s, k);
  });
  s.acted = {};
  const mine = castlesOf(s, 'azabu').length;
  if (mine === 0) s.result = 'lose';
  else if (mine === MAP.nodes.length) s.result = 'win';
  s.log = log;
  return log;
}

function checkWin(s) {
  if (castlesOf(s, 'azabu').length === MAP.nodes.length) s.result = 'win';
}
