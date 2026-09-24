// 合戦（1合ずつの采配・士気・戦法・一騎打ち）
// 合戦の状態 B は、攻める側 a と守る側 d の兵力・士気などを持つ。
// 画面とは関係なく動くので、自動の合戦（おまかせ）にもそのまま使える
const BATTLE = {
  maxRounds: 8,
  baseMorale: 65,
  atkRate: 0.15,  // 1合で与える損害の割合（攻める側）
  defRate: 0.14,  // 同（守る側）
};
const CMD_BEATS = { charge: 'scheme', guard: 'charge', scheme: 'guard' };
const other = (side) => (side === 'a' ? 'd' : 'a');
const moraleF = (m) => 0.6 + m / 250;
const shortName = (clan) => CLANS[clan].name.replace('家', '');

// 戦法を使える武将（大将と、合戦に加わった武将）
function artUsers(s, gids) {
  return gids.filter((id) => s.gens[id] && s.gens[id].skill && ARTS[s.gens[id].skill]);
}

// 合戦を始める。committed = true のときは、兵はすでに城から出してある（敵の攻撃を後で采配するとき）
function startBattle(s, o) {
  const { from, to, gid, support = [], tactic = null, playerSide = null, committed = false } = o;
  let n = o.n;
  const src = s.castles[from], dst = s.castles[to];
  const attacker = o.attacker || src.owner, defender = dst.owner;
  if (!committed) {
    src.troops -= n;
    s.acted[gid] = true;
    support.forEach((sp) => { s.castles[sp.from].troops -= sp.n; s.acted[sp.gid] = true; });
    if (attacker === PLAYER && s.rel[defender]) changeFriend(s, defender, -15);
    if (defender === PLAYER && s.rel[attacker]) changeFriend(s, attacker, -3);
  }
  n += support.reduce((a, sp) => a + sp.n, 0);
  const dg = defLeader(s, to);
  const tr = tactic ? tacticResult(tactic.a, tactic.d) : 0;
  if (attacker === PLAYER && tr > 0) s.stats.tacticWins++;
  const def = dst.def + (dg && dg.skill === 'teppeki' ? 0.3 : 0);
  const ratio = n / Math.max(1, dst.troops * def);
  const ratioBonus = clamp(Math.round((ratio - 1) * 10), -10, 10);
  const kakunBonus = (clan) => (clan === PLAYER && s.kakun === 'cha' ? 5 : 0);
  return {
    from, to, attacker, defender, gid, dgid: dg ? dg.id : null, support, tactic, tr,
    parts: [{ from, n: n - support.reduce((a, sp) => a + sp.n, 0) }, ...support],
    playerSide, def,
    a: {
      clan: attacker, troops: n, start: n, confused: 0, wall: 0, wallRate: 1, starve: 0, last: null,
      morale: clamp(BATTLE.baseMorale + tr * 15 + ratioBonus + kakunBonus(attacker), 15, 100),
      arts: artUsers(s, [gid, ...support.map((sp) => sp.gid)]), used: {},
    },
    d: {
      clan: defender, troops: dst.troops, start: Math.max(1, dst.troops), confused: 0, wall: 0, wallRate: 1, starve: 0, last: null,
      morale: clamp(BATTLE.baseMorale + 5 - tr * 15 - ratioBonus + kakunBonus(defender) - (dg ? 0 : 10), 15, 100),
      arts: artUsers(s, gensAt(s, to).map((g) => g.id)), used: {},
    },
    round: 0, over: null, duel: null, duelDone: false, duelCapture: null,
    rounds: [{ a: n, d: dst.troops, ma: 0, md: 0 }],
  };
}

// 命令の相性：+1 = 勝ち、-1 = 負け
function cmdMatch(x, y) {
  if (CMD_BEATS[x] === y) return 1;
  if (CMD_BEATS[y] === x) return -1;
  return 0;
}

// 敵（またはおまかせ）の命令を選ぶ。大将の性格と戦況で変わる
function aiCommand(s, B, side) {
  const me = B[side], foe = B[other(side)];
  const g = s.gens[side === 'a' ? B.gid : B.dgid];
  if (side === 'a' && B.playerSide !== 'a' && me.morale < 22 && me.troops < foe.troops * 0.7 && Math.random() < 0.6) return 'retreat';
  const arts = me.arts.filter((id) => !me.used[id]);
  if (arts.length && Math.random() < (B.round >= 2 ? 0.4 : 0.15)) return `art:${arts[0]}`;
  const w = {
    attack: 3,
    charge: 1 + (g && g.str >= 75 ? 1.5 : 0) + (me.troops > foe.troops * 1.4 ? 1.5 : 0),
    guard: 1 + (me.morale < 40 ? 2 : 0) + (me.troops < foe.troops * 0.6 ? 1 : 0),
    scheme: 0.6 + (g && g.int >= 70 ? 1.8 : 0),
  };
  // 相手の前の手に合わせる（読み合い）
  if (foe.last === 'charge') w.guard += 1.2;
  if (foe.last === 'guard') w.scheme += 1.2;
  if (foe.last === 'scheme') w.charge += 1.2;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return k; }
  return 'attack';
}

// 1合すすめる。cmds = { a: 命令, d: 命令 }。結果の文を返す
function stepBattle(s, B, cmds) {
  B.round++;
  const lines = [];
  const name = { a: shortName(B.attacker), d: shortName(B.defender) };
  const leader = { a: s.gens[B.gid], d: B.dgid ? s.gens[B.dgid] : null };
  const act = {};
  ['a', 'd'].forEach((sd) => {
    act[sd] = B[sd].confused > 0 ? 'confused' : cmds[sd];
    if (B[sd].confused > 0) { B[sd].confused--; lines.push(`${name[sd]}は混乱して動けない！`); }
  });

  // 退却
  if (act.a === 'retreat') {
    const loss = Math.round(B.a.troops * 0.1);
    B.a.troops -= loss;
    B.over = 'retreat';
    lines.push(`${name.a}は退却を命じた（退くときに ${loss.toLocaleString()} 兵を失った）`);
    B.rounds.push({ a: B.a.troops, d: B.d.troops, ma: B.a.morale, md: B.d.morale });
    return { lines, act };
  }

  const eff = { a: { out: 1, in: 1, morale: 0, foeMorale: 0, extra: 0 }, d: { out: 1, in: 1, morale: 0, foeMorale: 0, extra: 0 } };
  const baseCmd = {};
  ['a', 'd'].forEach((sd) => {
    const c = act[sd];
    const e = eff[sd], me = B[sd], foe = B[other(sd)];
    if (c === 'confused') { e.out = 0.3; e.in = 1.2; baseCmd[sd] = null; return; }
    if (c && c.startsWith('art:')) {
      const g = s.gens[c.slice(4)];
      me.used[g.id] = true;
      const art = g.skill;
      lines.push(`${name[sd]}・${g.name}の戦法「${ARTS[art].name}」！`);
      if (art === 'totsugeki') { e.out = 2; e.foeMorale -= 12; }
      if (art === 'teppeki') { me.wall = 2; me.wallRate = 0.5; e.out = 0.6; }
      if (art === 'shinsan') { e.extra = foe.troops * 0.12; e.foeMorale -= 18; e.out = 0.8; }
      if (art === 'jinbou') { e.morale += 25; }
      if (art === 'shousai') { foe.starve = 2; }
      if (art === 'chikujou') { me.wall = 3; me.wallRate = 0.7; e.out = 0.8; }
      baseCmd[sd] = null;
      return;
    }
    baseCmd[sd] = c;
    if (c === 'charge') { e.out = 1.5; e.in = 1.3; }
    if (c === 'guard') { e.out = 0.5; e.in = 0.6; e.morale += 6; }
    if (c === 'scheme') { e.out = 0.6; }
  });

  // 命令どうしの相性
  const m = baseCmd.a && baseCmd.d ? cmdMatch(baseCmd.a, baseCmd.d) : 0;
  const winner = m > 0 ? 'a' : m < 0 ? 'd' : null;
  if (winner) {
    const loser = other(winner);
    const wc = baseCmd[winner], lc = baseCmd[loser];
    if (wc === 'guard' && lc === 'charge') {
      eff[loser].out *= 0.5; eff[loser].morale -= 8;
      lines.push(`${name[loser]}の突撃は、${name[winner]}の守りに受け止められた！`);
    } else if (wc === 'charge' && lc === 'scheme') {
      eff[winner].out *= 1.2; eff[loser].morale -= 6;
      lines.push(`${name[loser]}が計略を仕掛ける前に、${name[winner]}の突撃が襲いかかった！`);
    } else if (wc === 'scheme' && lc === 'guard') {
      B[loser].confused = 1; eff[loser].morale -= 12;
      lines.push(`${name[winner]}の計略が決まった！ 守りを固めていた${name[loser]}は混乱している`);
    }
    eff[winner].morale += 3;
  } else {
    // 相性がないときの計略は、知略の勝負
    ['a', 'd'].forEach((sd) => {
      if (baseCmd[sd] !== 'scheme') return;
      const mine = leader[sd] ? leader[sd].int : 40, theirs = leader[other(sd)] ? leader[other(sd)].int : 40;
      if (Math.random() < clamp(0.45 + (mine - theirs) / 100, 0.15, 0.85)) {
        B[other(sd)].confused = 1; eff[other(sd)].morale -= 10;
        lines.push(`${name[sd]}の計略が決まった！ ${name[other(sd)]}は混乱している`);
      } else {
        lines.push(`${name[sd]}の計略は見破られた`);
      }
    });
    if (!lines.length) {
      const say = { attack: '攻めかかった', charge: '突撃した', guard: '守りを固めた' };
      lines.push(['a', 'd'].filter((sd) => say[act[sd]]).map((sd) => `${name[sd]}は${say[act[sd]]}`).join('。') || '両軍がにらみ合った');
    }
  }

  // 鉄壁・築陣・兵糧攻めの効果
  ['a', 'd'].forEach((sd) => {
    const me = B[sd];
    if (me.wall > 0) { eff[sd].in *= me.wallRate; me.wall--; }
    if (me.starve > 0) { eff[sd].morale -= 8; me.starve--; lines.push(`${name[sd]}は兵糧が乏しく、士気が下がっている`); }
  });

  // 損害
  const am = atkMult(leader.a) * atkKakun(s, B.attacker);
  const dm = defMult(leader.d) * defKakun(s, B.defender);
  const r1 = rand(0.85, 1.15), r2 = rand(0.85, 1.15);
  let toD = (B.a.troops * BATTLE.atkRate * am * eff.a.out * eff.d.in * moraleF(B.a.morale) * r1) / B.def + eff.a.extra;
  let toA = B.d.troops * BATTLE.defRate * dm * eff.d.out * eff.a.in * moraleF(B.d.morale) * r2 + eff.d.extra;
  toD = Math.min(B.d.troops, Math.round(toD));
  toA = Math.min(B.a.troops, Math.round(toA));
  const beforeA = B.a.troops, beforeD = B.d.troops;
  B.a.troops -= toA;
  B.d.troops -= toD;

  // 士気：損害の大きさと、命令の結果で変わる
  B.a.morale = clamp(Math.round(B.a.morale - (toA / Math.max(1, beforeA)) * 55 + eff.a.morale + eff.d.foeMorale), 0, 100);
  B.d.morale = clamp(Math.round(B.d.morale - (toD / Math.max(1, beforeD)) * 55 + eff.d.morale + eff.a.foeMorale), 0, 100);
  lines.push(`${name.d}に ${toD.toLocaleString()}、${name.a}に ${toA.toLocaleString()} の損害`);

  B.a.last = baseCmd.a; B.d.last = baseCmd.d;
  checkBattleEnd(B, lines, name);
  B.rounds.push({ a: B.a.troops, d: B.d.troops, ma: B.a.morale, md: B.d.morale });

  // 一騎打ち：2合目以降、大将どうしがいるとときどき起こる
  if (!B.over && !B.duelDone && B.round >= 2 && leader.a && leader.d && Math.random() < 0.07) {
    B.duelDone = true;
    B.duel = { challenger: leader.a.str >= leader.d.str ? 'a' : 'd' };
  }
  return { lines, act, toA, toD };
}

function checkBattleEnd(B, lines, name) {
  if (B.d.troops <= 0 || B.d.troops < B.a.troops * 0.1) { B.over = 'win'; lines.push(`${name.d}の城兵は総崩れとなった！`); return; }
  if (B.d.morale <= 0) { B.over = 'win'; lines.push(`${name.d}の士気が尽き、城は開かれた！`); return; }
  if (B.a.troops <= 0) { B.over = 'lose'; return; }
  if (B.a.morale <= 0) { B.over = 'lose'; lines.push(`${name.a}の士気が尽き、総崩れとなった…`); return; }
  if (B.round >= BATTLE.maxRounds) { B.over = 'timeout'; lines.push('日が暮れた。攻め手は城を落とせず引き上げる'); }
}

// ---------- 一騎打ち ----------
function startDuel(B) {
  B.duel = Object.assign(B.duel || {}, { hp: { a: 3, d: 3 }, turn: 0, done: null, log: [] });
  return B.duel;
}

function aiDuelMove() {
  return pick(Object.keys(DUEL_MOVES));
}

// 一太刀すすめる
function duelStep(s, B, moves) {
  const D = B.duel;
  D.turn++;
  const ga = s.gens[B.gid], gd = s.gens[B.dgid];
  const x = moves.a, y = moves.d;
  let text;
  const hitBonus = (w, l) => (w.str - l.str >= 20 && Math.random() < 0.5 ? 1 : 0);
  if (DUEL_MOVES[x].beats === y) {
    const dmg = 1 + hitBonus(ga, gd);
    D.hp.d -= dmg;
    text = `${ga.name}の「${DUEL_MOVES[x].name}」が${gd.name}の「${DUEL_MOVES[y].name}」を破った！`;
  } else if (DUEL_MOVES[y].beats === x) {
    const dmg = 1 + hitBonus(gd, ga);
    D.hp.a -= dmg;
    text = `${gd.name}の「${DUEL_MOVES[y].name}」が${ga.name}の「${DUEL_MOVES[x].name}」を破った！`;
  } else {
    // 同じ手：統率の高いほうが押し勝ちやすい
    const pa = ga.str / (ga.str + gd.str);
    if (Math.random() < pa) { D.hp.d -= 1; text = `激しく打ち合い、${ga.name}が押し勝った`; }
    else { D.hp.a -= 1; text = `激しく打ち合い、${gd.name}が押し勝った`; }
  }
  D.log.push(text);
  if (D.hp.a <= 0 || D.hp.d <= 0 || D.turn >= 5) {
    D.done = D.hp.a === D.hp.d ? (ga.str >= gd.str ? 'a' : 'd') : D.hp.a > D.hp.d ? 'a' : 'd';
  }
  return text;
}

// 一騎打ちの決着を合戦に反映する
function endDuel(s, B) {
  const D = B.duel;
  const w = D.done, l = other(w);
  B[l].morale = clamp(B[l].morale - 35, 0, 100);
  B[w].morale = clamp(B[w].morale + 10, 0, 100);
  const loserHp = D.hp[l];
  // 大きく打ち負かすと、その場で捕らえることがある（当主は必ず逃げのびる）
  const loserGen = s.gens[l === 'a' ? B.gid : B.dgid];
  if (loserHp <= 0 && !loserGen.lord && Math.random() < 0.4) B.duelCapture = l;
  grow(s.gens[w === 'a' ? B.gid : B.dgid], 'str');
  const lines = [`一騎打ちは${s.gens[w === 'a' ? B.gid : B.dgid].name}の勝ち！ ${shortName(B[l].clan)}の士気が大きく下がった`];
  if (B.duelCapture) lines.push(`${loserGen.name}は捕らえられた！`);
  B.duel = null;
  const name = { a: shortName(B.attacker), d: shortName(B.defender) };
  checkBattleEnd(B, lines, name);
  if (B.over) B.rounds.push({ a: B.a.troops, d: B.d.troops, ma: B.a.morale, md: B.d.morale });
  return lines;
}

// 一騎打ちを断る
function declineDuel(B, side) {
  B[side].morale = clamp(B[side].morale - 10, 0, 100);
  B.duel = null;
  return `${shortName(B[side].clan)}は一騎打ちを断った。士気が少し下がった`;
}

// 一騎打ちを自動で決める。挑まれた側は、統率が大きく劣らなければ受ける
function autoDuel(s, B) {
  const target = other(B.duel.challenger);
  const gt = s.gens[target === 'a' ? B.gid : B.dgid], gc = s.gens[B.duel.challenger === 'a' ? B.gid : B.dgid];
  if (gt.str + 10 >= gc.str) {
    startDuel(B);
    while (!B.duel.done) duelStep(s, B, { a: aiDuelMove(), d: aiDuelMove() });
    return endDuel(s, B);
  }
  return [declineDuel(B, target)];
}

// 残りを自動で進める（おまかせ・結果まで飛ばす）
function autoBattle(s, B) {
  let guard = 0;
  while (!B.over && guard++ < 20) {
    if (B.duel) { autoDuel(s, B); continue; }
    stepBattle(s, B, { a: aiCommand(s, B, 'a'), d: aiCommand(s, B, 'd') });
  }
}

// 合戦の結果をゲームに反映する（attack() と同じ形の結果を返す）
function endBattle(s, B, log) {
  const dst = s.castles[B.to];
  const g = s.gens[B.gid];
  const dg = B.dgid ? s.gens[B.dgid] : null;
  const won = B.over === 'win';
  const result = {
    won, left: B.a.troops, defLeft: B.d.troops, rounds: B.rounds.map((r) => ({ a: r.a, d: r.d })),
    from: B.from, to: B.to, attacker: B.attacker, defender: B.defender, sent: B.a.start,
    gid: B.gid, dgid: B.dgid, support: B.support, captured: [], grew: null, tactic: B.tactic, tr: B.tr, over: B.over,
  };
  // 一騎打ちで捕らえた武将
  const captureGen = (gen, captor, at) => {
    if (!gen || gen.lord) return;
    if (captor === PLAYER) {
      gen.clan = 'captive'; gen.loc = null; gen.capturedAt = at;
      result.captured.push(gen.id);
    } else if (Math.random() < 0.5) {
      gen.clan = captor; gen.loc = at;
    } else {
      gen.clan = 'ronin'; gen.loc = null;
    }
  };
  if (B.duelCapture === 'a') captureGen(g, B.defender, B.to);

  if (won) {
    if (B.duelCapture === 'd') captureGen(dg, B.attacker, B.to);
    dst.owner = B.attacker;
    dst.troops = B.a.troops;
    dst.def = Math.max(1, Math.round((dst.def - 0.1) * 10) / 10);
    if (g.clan === B.attacker) moveGeneral(s, B.gid, B.to);
    result.captured.push(...scatterGenerals(s, B.to, B.defender, B.attacker, log));
    result.grew = g.clan === B.attacker ? grow(g, 'str') : null;
    if (B.attacker === PLAYER) s.stats.battlesWon++;
  } else {
    if (B.duelCapture === 'd') captureGen(dg, B.attacker, B.to);
    dst.troops = B.d.troops;
    const total = B.a.start;
    B.parts.forEach((p) => {
      if (s.castles[p.from].owner === B.attacker) s.castles[p.from].troops += Math.round((B.a.troops * p.n) / total);
    });
    if (dg && dg.clan === B.defender) grow(dg, 'int');
  }
  return result;
}
