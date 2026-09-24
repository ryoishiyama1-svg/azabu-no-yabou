// 計略（流言・引き抜き・離間・調略）と、他家の計略・他家の武将の忠誠
const SCHEMES = {
  rumor: { name: '流言', cost: 150, stat: 'int', desc: '敵城の兵を減らし、守りを弱める' },
  lure: { name: '引き抜き', cost: 300, stat: 'int', desc: '敵の武将を寝返らせる（忠誠が低いほど成功しやすい）' },
  discord: { name: '離間', cost: 200, stat: 'int', desc: '敵城の武将の忠誠を下げる（出奔や謀反を誘う）' },
  subvert: { name: '調略', cost: 300, stat: 'cha', desc: '独立校を戦わずに味方につける' },
};
const SCHEME_RANGE = 2; // 何本の道の先まで仕掛けられるか

// 城から n 本以内の道で行ける城
function castlesWithin(from, n) {
  const dist = { [from]: 0 };
  const q = [from];
  while (q.length) {
    const id = q.shift();
    if (dist[id] >= n) continue;
    MAP.adj[id].forEach((m) => { if (dist[m] === undefined) { dist[m] = dist[id] + 1; q.push(m); } });
  }
  return Object.keys(dist).filter((id) => id !== from);
}

// 計略を仕掛けられる相手の城
function schemeTargets(s, from, kind) {
  const owner = s.castles[from].owner;
  return castlesWithin(from, SCHEME_RANGE).filter((id) => {
    const o = s.castles[id].owner;
    if (o === owner || atPeace(s, owner, o)) return false;
    if (kind === 'subvert') return o === 'none';
    if (kind === 'lure') return gensAt(s, id).some((g) => !g.lord);
    if (kind === 'discord') return gensAt(s, id).length > 0;
    return true;
  });
}

// 計略を防ぐ力：守将の知略と、物見やぐら
function schemeGuard(s, id) {
  const dg = bestBy(gensAt(s, id), 'int');
  return (dg ? dg.int : 30) + (hasFac(s, id, 'tower') ? 25 : 0);
}

// 成功率
function schemeChance(s, kind, g, to, target) {
  const guard = schemeGuard(s, to);
  if (kind === 'rumor') return clamp(0.45 + (g.int - guard) / 100, 0.1, 0.9);
  if (kind === 'discord') return clamp(0.4 + (g.int - guard) / 100, 0.1, 0.85);
  if (kind === 'lure') {
    if (!target || target.lord || target.loyal >= 90) return 0;
    const tower = hasFac(s, to, 'tower') ? 0.5 : 1; // 物見やぐらがあると見張りが厳しい
    return clamp((0.05 + (g.int + g.cha - 100) / 200 + (60 - target.loyal) / 70) * tower, 0.02, 0.85);
  }
  if (kind === 'subvert') {
    const c = s.castles[to];
    const near = MAP.adj[to].filter((n) => s.castles[n].owner === s.castles[g.loc].owner)
      .reduce((a, n) => a + s.castles[n].troops, 0);
    const might = near / Math.max(1, c.troops * c.def);
    return clamp(0.05 + (g.cha - 50) / 120 + (might - 1) * 0.15, 0.03, 0.75);
  }
  return 0;
}

// 計略を実行する。g = 仕掛ける武将。target = 引き抜く武将
function runScheme(s, kind, g, to, target) {
  const clan = g.clan;
  const c = s.castles[to];
  const victim = c.owner;
  const cost = SCHEMES[kind].cost;
  s.gold[clan] -= cost;
  s.acted[g.id] = true;
  const p = schemeChance(s, kind, g, to, target);
  const ok = Math.random() < p;
  grow(g, SCHEMES[kind].stat);
  const place = MAP.byId[to].name;
  let text;
  if (kind === 'rumor') {
    if (ok) {
      const loss = Math.round(c.troops * 0.15 / 10) * 10;
      c.troops -= loss;
      c.def = Math.max(1, Math.round((c.def - 0.1) * 10) / 10);
      text = `流言が広まり、${place}の兵 ${loss.toLocaleString()} が逃げ出した！ 守りも弱まった`;
    } else text = `${place}で流言を広めようとしたが、見破られた`;
  }
  if (kind === 'discord') {
    if (ok) {
      gensAt(s, to).forEach((x) => { if (!x.lord) x.loyal = clamp(x.loyal - 15, 0, 100); });
      text = `${place}の武将たちに疑いの種をまいた。忠誠が大きく下がった`;
    } else text = `${place}での離間の計は失敗した`;
  }
  if (kind === 'lure') {
    if (ok) {
      target.clan = clan;
      target.loc = g.loc;
      target.loyal = randInt(40, 55);
      text = `${target.name}が寝返った！ ${MAP.byId[g.loc].short}に迎え入れた`;
    } else text = `${target.name}に寝返りを持ちかけたが、断られた`;
  }
  if (kind === 'subvert') {
    if (ok) {
      c.owner = clan;
      // 独立校の武将は、そのまま仕える
      Object.values(s.gens).filter((x) => x.loc === to && x.clan === 'none').forEach((x) => {
        x.clan = clan;
        x.loyal = randInt(50, 65);
      });
      text = `${place}は戦わずに降った！ 城と武将がそのまま味方になった`;
    } else text = `${place}を説いたが、首を縦に振らなかった`;
  }
  // 仕掛けられた家は恨む
  if (s.rel && s.rel[victim] && clan === PLAYER) changeFriend(s, victim, ok ? -10 : -5);
  return { ok, text, p };
}

// ---------- 他家の計略（プレイヤーをねらう） ----------
function aiSchemes(s, log) {
  aiClans().forEach((clan) => {
    if (!castlesOf(s, clan).length || s.gold[clan] < 450 || Math.random() > 0.3 * personaOf(clan).scheme) return;
    if (atPeace(s, clan, PLAYER)) return;
    // 麻布家（プレイヤー）の城に近い、知略の高い武将が仕掛ける
    const agents = gensOf(s, clan).filter((g) => g.loc && !s.acted[g.id] && g.int >= 55)
      .filter((g) => castlesWithin(g.loc, SCHEME_RANGE).some((id) => s.castles[id].owner === PLAYER));
    const g = bestBy(agents, 'int');
    if (!g) return;
    // 物見やぐらのある城は、半分の確率でねらいから外す
    const targets = castlesWithin(g.loc, SCHEME_RANGE).filter((id) => s.castles[id].owner === PLAYER)
      .filter((id) => !hasFac(s, id, 'tower') || Math.random() < 0.5);
    if (!targets.length) return;
    // 忠誠の低い家臣がいれば引き抜き、いなければ流言か離間
    const lurable = targets.flatMap((id) => gensAt(s, id)).filter((x) => !x.lord && x.loyal < 55)
      .sort((a, b) => a.loyal - b.loyal);
    const who = CLANS[clan].name;
    if (lurable.length && s.gold[clan] >= SCHEMES.lure.cost) {
      const t = lurable[0];
      const from = t.loc;
      const r = runScheme(s, 'lure', g, from, t);
      if (r.ok) log.push(`😱 ${t.name}が${who}に引き抜かれた！（${MAP.byId[from].short}）`);
      else log.push(`🛡️ ${who}が${t.name}の引き抜きを図ったが、${t.name}は断った`);
      return;
    }
    const to = pick(targets);
    const kind = Math.random() < 0.5 ? 'rumor' : 'discord';
    const r = runScheme(s, kind, g, to);
    if (r.ok) log.push(`🌀 ${who}の${SCHEMES[kind].name}：${r.text}`);
  });
}

// ---------- 他家の武将の忠誠 ----------
// 他家の武将は少しずつ忠誠が戻る。とても低いと、城ごと独立することがある
function aiLoyaltyTick(s, log) {
  aiClans().forEach((clan) => {
    gensOf(s, clan).filter((g) => g.loc).forEach((g) => {
      if (g.loyal < 72 && Math.random() < 0.5) g.loyal++;
      const here = gensAt(s, g.loc);
      if (g.loyal < 25 && bestBy(here, 'str') === g && g.loc !== clan && castlesOf(s, clan).length >= 2 &&
          Math.random() < 0.2) {
        const id = g.loc;
        s.castles[id].owner = 'none';
        here.forEach((x) => { x.clan = 'none'; x.loyal = 80; });
        log.push(`🔥 ${CLANS[clan].name}の${MAP.byId[id].name}で謀反！ ${g.name}が独立した`);
      }
    });
  });
}
