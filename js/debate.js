// 舌戦：言葉で城に開城を迫る勝負。理・情・利・威の四つの論で、説得のゲージを満たせば無血開城
const DEBATE = { rounds: 4, needNone: 95, needClan: 118, gainCost: 100 };
const DEBATE_ARGS = {
  logic: { name: '理', full: '理を説く', desc: '理屈で説く（知略）', foe: '頑固' },
  heart: { name: '情', full: '情に訴える', desc: '心に訴える（魅力）', foe: '情に厚い' },
  gain: { name: '利', full: '利を示す', desc: `得を示す（政治・金${DEBATE.gainCost}）`, foe: '欲深' },
  threat: { name: '威', full: '威を示す', desc: '兵の多さで脅す（兵力の差）', foe: '臆病' },
};
// 相いれない論：弱点の反対の論は効きにくい
const DEBATE_OPPOSITE = { logic: 'heart', heart: 'logic', gain: 'threat', threat: 'gain' };

// 舌戦を仕掛けられる城か（本拠と、当主のいる城は開城しない）
function canDebate(s, id) {
  const c = s.castles[id];
  if (c.owner === PLAYER || atPeace(s, PLAYER, c.owner)) return false;
  if (isCapital(id, c.owner)) return false;
  if (gensAt(s, id).some((g) => g.lord)) return false;
  if (s.debateCd && s.debateCd[id] > s.turn) return false; // 断られた城には、しばらく仕掛けられない
  return true;
}
// 使者：となりの自分の城で命令できる武将のうち、知略と魅力がいちばん高い人
function debateEnvoy(s, id) {
  const cands = MAP.adj[id].filter((n) => s.castles[n].owner === PLAYER && !s.delegate[n])
    .flatMap((n) => idleGensAt(s, n));
  return bestBy(cands, (g) => g.int + g.cha);
}
// 守将の弱点（いちばん効く論）
function debateWeakness(dg, owner) {
  if (!dg) return owner === 'none' ? 'gain' : 'threat';
  const score = {
    logic: dg.str - dg.int + 20,
    heart: dg.cha,
    gain: 90 - dg.pol + (owner === 'none' ? 10 : 0),
    threat: 100 - dg.str,
  };
  return Object.keys(score).reduce((a, b) => (score[a] >= score[b] ? a : b));
}

function startDebate(s, id, envoy) {
  const c = s.castles[id];
  const dg = defLeader(s, id);
  const weak = debateWeakness(dg, c.owner);
  s.acted[envoy.id] = true;
  // 使者の知略しだいで、相手の弱点が見える
  const dInt = dg ? dg.int : 40;
  const r = Math.random();
  let read = { level: 'none' };
  if (envoy.int >= dInt + 10 || r < 0.15) read = { level: 'clear', weak };
  else if (envoy.int >= dInt - 10) read = { level: 'guess', weak: Math.random() < 0.7 ? weak : pick(Object.keys(DEBATE_ARGS).filter((k) => k !== weak)) };
  return {
    id, owner: c.owner, envoy: envoy.id, dg: dg ? dg.id : null, weak, read,
    need: c.owner === 'none' ? DEBATE.needNone : DEBATE.needClan,
    gauge: 0, round: 0, done: null, used: {}, mood: { me: null, foe: null }, lines: [],
  };
}

function debateNearTroops(s, id) {
  return MAP.adj[id].filter((n) => s.castles[n].owner === PLAYER).reduce((a, n) => a + s.castles[n].troops, 0);
}

// 一つの論の強さ（弱点なら2倍、相いれない論なら半分）
function debatePower(s, Dt, arg) {
  const g = s.gens[Dt.envoy];
  const c = s.castles[Dt.id];
  let p = 14; // 能力の差はなだらかに。勝負を分けるのは、弱点を見抜いて論を選ぶ腕
  if (arg === 'logic') p += g.int / 6;
  if (arg === 'heart') p += g.cha / 6;
  if (arg === 'gain') p += g.pol / 6;
  if (arg === 'threat') p += clamp((debateNearTroops(s, Dt.id) / Math.max(1, c.troops)) * 6, 0, 16);
  if (arg === Dt.weak) p *= 2;
  else if (DEBATE_OPPOSITE[Dt.weak] === arg) p *= 0.5;
  if (Dt.used[arg]) p *= 0.8; // 同じ論のくり返しは効き目が落ちる
  return Math.round(p);
}

const DEBATE_LINES = {
  logic: ['この戦、続けて得る者は誰もおらぬ。道理をお考えあれ', '兵の数、城の守り、どれを比べても勝ち目はない'],
  heart: ['城の後輩たちを、むざむざ傷つけるおつもりか', 'あなたの志、わが家でこそ生かせると信じております'],
  gain: ['開城していただければ、この金子をお納めします', 'わが家に加われば、部の予算は倍にいたしましょう'],
  threat: ['城を囲む兵、ご覧になったか。次は容赦せぬ', '降るなら今のうち。明日には遅いぞ'],
};
const DEBATE_REPLY = {
  weak: ['……う、それを言われると……', 'くっ……一理ある', '……心が揺れる'],
  normal: ['ふん、それがどうした', 'その程度では動かぬ', 'なるほど。だが……'],
  resist: ['見え透いておるわ！', 'かえって腹が立った', 'そんな言葉、通じぬ'],
  counter: ['わが城には誇りがある！', '先輩たちが守ってきた城を、渡すものか', 'まだ戦える！'],
};

// 一合すすめる。戻り値：{ power, counter, kind: 'weak'|'normal'|'resist' }
function debateStep(s, Dt, arg) {
  if (arg === 'gain') s.gold[PLAYER] -= DEBATE.gainCost;
  const power = Math.round(debatePower(s, Dt, arg) * rand(0.9, 1.1)); // その場の空気で効き目が少し揺れる
  Dt.used[arg] = true;
  Dt.round++;
  const kind = arg === Dt.weak ? 'weak' : DEBATE_OPPOSITE[Dt.weak] === arg ? 'resist' : 'normal';
  Dt.gauge += power;
  // 弱点の論が刺されば、相手の弱みが見える（次の一手からは迷わない）
  if (kind === 'weak') Dt.read = { level: 'clear', weak: Dt.weak };
  // 相いれない論で反発されたら、少なくともそれは弱点ではないとわかる
  else if (kind === 'resist' && Dt.read.level === 'guess' && Dt.read.weak === arg) Dt.read = { level: 'none' };
  // 相手の言い返し
  const dg = Dt.dg ? s.gens[Dt.dg] : null;
  const counter = Dt.gauge >= Dt.need ? 0 : Math.round(rand(3, 5) + (dg ? (dg.int + dg.cha) / 30 : 2));
  Dt.gauge = Math.max(0, Dt.gauge - counter);
  Dt.mood = { me: kind === 'weak' ? 'happy' : kind === 'resist' ? 'think' : null, foe: kind === 'weak' ? 'think' : kind === 'resist' ? 'angry' : null };
  Dt.lines = [
    { who: 'me', text: pick(DEBATE_LINES[arg]) },
    { who: 'foe', text: pick(DEBATE_REPLY[kind]) },
  ];
  if (counter) Dt.lines.push({ who: 'foe', text: pick(DEBATE_REPLY.counter) });
  if (Dt.gauge >= Dt.need) Dt.done = 'win';
  else if (Dt.round >= DEBATE.rounds) Dt.done = 'lose';
  return { power, counter, kind };
}

// 決着を反映する
function endDebate(s, Dt) {
  const c = s.castles[Dt.id];
  const g = s.gens[Dt.envoy];
  const name = MAP.byId[Dt.id].name;
  if (Dt.done === 'win') {
    const loser = c.owner;
    c.owner = PLAYER;
    c.troops = Math.round(c.troops * 0.5); // 城兵の半分がそのまま加わる
    // 城の武将は降って家臣になる
    Object.values(s.gens).filter((x) => x.loc === Dt.id && x.clan === loser).forEach((x) => {
      x.clan = PLAYER;
      x.loyal = randInt(42, 58);
    });
    if (s.rel[loser]) changeFriend(s, loser, -10);
    grow(g, 'cha'); grow(g, 'int');
    recOf(g).cap++;
    shiHit(s, g, 'debate'); shiHit(s, g, 'cap', Dt.id);
    if (loser !== 'none') s.stats.clanCaps = (s.stats.clanCaps || 0) + 1;
    s.stats.debateWins = (s.stats.debateWins || 0) + 1;
    addNews(s, `${g.name}、舌戦で${name}を無血開城`, '一兵も失わずに城を得る', 50);
    return `${name}は開城した！ 一兵も失わずに城を手に入れた`;
  }
  if (s.rel[c.owner]) changeFriend(s, c.owner, -5);
  s.debateCd = s.debateCd || {};
  s.debateCd[Dt.id] = s.turn + 4;
  return `${name}は開城を拒んだ……（4季のあいだ、舌戦には応じない）`;
}
