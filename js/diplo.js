// 外交の会談（話題選び・心証・交渉の姿勢・条件・値切り）と、外交の記録
// 会談の状態 M は、相手の家・心証・使った話題などを持つ。画面とは関係なく動く

// 話題：相手の性格や状況で効き目が変わる
const TOPICS = {
  enemy: { name: '共通の敵の話', desc: 'おたがいを脅かす敵の話をする' },
  favor: { name: '過去の恩を持ち出す', desc: 'これまでの付き合いに訴える' },
  gift: { name: '手土産を渡す', desc: '金100の手土産で気持ちを示す', cost: 100 },
  might: { name: '力を見せつける', desc: 'こちらの勢いを示して圧をかける' },
  praise: { name: '当主をほめる', desc: '相手の当主の手腕をたたえる' },
};

// 交渉の姿勢
const STANCES = {
  humble: { name: '下手に出る', desc: '成功しやすいが、条件をつけられやすい' },
  equal: { name: '対等に話す', desc: 'ふつうに話す' },
  bold: { name: '強気に出る', desc: 'こちらが大きいほど効く。失敗すると関係が悪化' },
};

// 申し出の種類
// avail：申し出できるか（できなければ理由の文字列）／chance：基本の成功率／apply：結んだときの効果
const DIPLO2 = { tradeTurns: 12, aidCooldown: 4, jointTurns: 3, sisterFriend: 70 };
const PROPOSALS = {
  truce: {
    name: '停戦', icon: '🕊️', desc: `${DIPLO.truceTurns}季のあいだ、おたがいに攻めない`, gold: 300,
    avail: (s, k) => (s.rel[k].truce > 0 || s.rel[k].ally > 0 || s.rel[k].sister ? 'すでに和平中' : true),
    chance: (s, k, g) => truceChance(s, k, g),
    apply(s, k) { s.rel[k].truce = DIPLO.truceTurns; },
  },
  ally: {
    name: '同盟', icon: '🤝', desc: `${DIPLO.allyTurns}季のあいだ手を結ぶ。援軍や共同出兵を頼める`, gold: 400,
    avail: (s, k) => (s.rel[k].ally > 0 || s.rel[k].sister ? 'すでに同盟中' : true),
    chance: (s, k, g) => allyChance(s, k, g),
    apply(s, k) { s.rel[k].ally = DIPLO.allyTurns; s.rel[k].truce = 0; },
  },
  trade: {
    name: '通商協定', icon: '💰', desc: `${DIPLO2.tradeTurns}季のあいだ、毎季おたがいに金が入る`, gold: 200,
    avail: (s, k) => (s.rel[k].trade > 0 ? '協定中' : true),
    chance: (s, k, g) => clamp(((s.rel[k].friend - 20) / 60 + g.cha / 400) * personaOf(k).diplo *
      (CLAN_PERSONA[k] === 'expansive' ? 1.5 : 1), 0.03, 0.9),
    apply(s, k) { s.rel[k].trade = DIPLO2.tradeTurns; },
  },
  sister: {
    name: '姉妹校提携', icon: '🌸', desc: '期限のない固い絆。包囲網にも加わらない（破棄すると大きく信用を失う）', gold: 500,
    avail: (s, k) => (s.rel[k].sister ? '提携中' : !(s.rel[k].ally > 0) ? '同盟中の家とだけ結べる'
      : s.rel[k].friend < DIPLO2.sisterFriend ? `友好度${DIPLO2.sisterFriend}以上が必要` : true),
    chance: (s, k, g) => clamp(((s.rel[k].friend - 60) / 40 + g.cha / 500) * personaOf(k).diplo, 0.05, 0.85),
    apply(s, k) { s.rel[k].sister = true; s.rel[k].ally = 0; s.rel[k].truce = 0; },
  },
  aid: {
    name: '援軍の要請', icon: '🛡️', desc: '相手の兵を、こちらの危ない城へ送ってもらう', gold: 250,
    avail: (s, k) => (!(s.rel[k].ally > 0 || s.rel[k].sister) ? '同盟・姉妹校だけに頼める'
      : s.rel[k].aidCd > 0 ? `あと${s.rel[k].aidCd}季は頼めない` : !aidAmount(s, k) ? '相手に余裕がない' : true),
    chance: (s, k) => clamp(0.45 + (s.rel[k].friend - 50) / 100 + (s.rel[k].sister ? 0.3 : 0), 0.1, 0.95),
    apply(s, k, M) {
      const n = aidAmount(s, k);
      const from = aidSource(s, k), to = aidDest(s);
      s.castles[from].troops -= n;
      s.castles[to].troops = Math.min(RULES.troopCap, s.castles[to].troops + n);
      s.rel[k].aidCd = DIPLO2.aidCooldown;
      changeFriend(s, k, s.rel[k].sister ? -4 : -8);
      M.result = `${CLANS[k].name}から ${n} 兵の援軍が ${MAP.byId[to].name} に着いた！`;
    },
  },
  joint: {
    name: '共同出兵', icon: '⚔️', desc: `${DIPLO2.jointTurns}季のあいだ、相手の家にも同じ敵を攻めてもらう`, gold: 200,
    avail: (s, k) => (!(s.rel[k].ally > 0 || s.rel[k].sister) ? '同盟・姉妹校だけに頼める'
      : s.joint ? '共同出兵の最中' : !jointTargetFor(s, k) ? '共に攻める相手がいない' : true),
    chance: (s, k) => clamp((0.35 + (s.rel[k].friend - 50) / 100 + (threatTo(s, k) === jointTargetFor(s, k) ? 0.2 : 0)) *
      (CLAN_PERSONA[k] === 'aggressive' ? 1.3 : CLAN_PERSONA[k] === 'cautious' ? 0.7 : 1), 0.05, 0.9),
    apply(s, k, M) {
      const t = jointTargetFor(s, k);
      s.joint = { ally: k, target: t, turns: DIPLO2.jointTurns };
      const r = aiRel(s, k, t);
      r.truce = 0; r.ally = 0; r.friend = clamp(r.friend - 20, 0, 100);
      M.result = `${CLANS[k].name}と共に${CLANS[t].name}を攻めることになった（${DIPLO2.jointTurns}季）`;
    },
  },
};

// 援軍：相手のいちばん兵の多い城から、4割（最大800）
function aidSource(s, k) {
  return bestBy(castlesOf(s, k), (id) => s.castles[id].troops);
}
function aidAmount(s, k) {
  const id = aidSource(s, k);
  if (!id) return 0;
  const n = Math.min(800, Math.floor((s.castles[id].troops * 0.4) / 10) * 10);
  return n >= 100 ? n : 0;
}
// 援軍の行き先：いちばん危ない自分の城
function aidDest(s) {
  const mine = castlesOf(s, PLAYER);
  return mine.reduce((a, b) => (threatOf(s, a) >= threatOf(s, b) ? a : b));
}
// 共同出兵の標的：相手と国境を接していて、こちらとも接している、相手と和平していない家
function jointTargetFor(s, k) {
  const cands = aiClans().filter((t) => t !== k && castlesOf(s, t).length && !atPeace(s, PLAYER, t)
    && aiBorder(s, k, t) && aiBorder(s, PLAYER, t) && !(aiRel(s, k, t).ally > 0));
  return bestBy(cands, (t) => -aiRel(s, k, t).friend);
}

// 相手の家の当主（いちばん格の高い武将）
function clanLord(s, clan) {
  return bestBy(gensOf(s, clan).filter((g) => g.loc), (g) => g.str + g.cha + g.pol + g.int);
}

// 相手を脅かしている第三の家（となりにいる、相手より大きい家）
function threatTo(s, clan) {
  const size = castlesOf(s, clan).length;
  return aiClans().filter((k) => k !== clan && castlesOf(s, k).length > size && aiBorder(s, clan, k))
    .sort((a, b) => castlesOf(s, b).length - castlesOf(s, a).length)[0] || null;
}

// ---------- 会談 ----------
function startMeeting(s, clan, proposal, envoy) {
  const r = s.rel[clan];
  return {
    clan, proposal, envoy: envoy.id, host: (clanLord(s, clan) || {}).id,
    impression: clamp(Math.round(r.friend / 2 + 20), 5, 90),
    rounds: 0, maxRounds: envoy.int >= 75 ? 3 : 2,
    used: {}, mood: 'think', lines: [], over: null, condition: null,
  };
}

// 使者の知略が高いと、相手の本音のヒントが見える
function meetingHints(s, M) {
  const g = s.gens[M.envoy];
  const hints = [];
  if (g.int < 60) return hints;
  const t = threatTo(s, M.clan);
  if (t) hints.push(`${CLANS[M.clan].name}は${CLANS[t].name}を恐れているようだ`);
  if (s.gold[M.clan] < 300) hints.push('金に困っているようだ');
  const p = CLAN_PERSONA[M.clan];
  if (g.int >= 75) {
    if (p === 'aggressive') hints.push('当主は強い者を認める気質らしい');
    if (p === 'cunning') hints.push('当主は口先のお世辞を見抜くだろう');
    if (p === 'expansive') hints.push('当主は実利を重んじるらしい');
    if (p === 'diplomatic') hints.push('当主は話し合いを好むらしい');
    if (p === 'cautious') hints.push('当主は争いを避けたがっているようだ');
  }
  return hints;
}

// 話題の効き目（心証の増減）
function topicEffect(s, M, topic) {
  const clan = M.clan;
  const p = CLAN_PERSONA[clan];
  const g = s.gens[M.envoy];
  const r = s.rel[clan];
  const mine = castlesOf(s, PLAYER).length, theirs = castlesOf(s, clan).length;
  let v = 0;
  if (topic === 'enemy') v = threatTo(s, clan) ? 16 : 3;
  if (topic === 'favor') v = r.friend >= 50 ? 14 : r.friend >= 30 ? 4 : -6;
  if (topic === 'gift') v = 10 + (s.gold[clan] < 300 ? 6 : 0);
  if (topic === 'might') v = clamp(Math.round((mine / Math.max(1, theirs) - 1) * 8), -8, 16);
  if (topic === 'praise') v = 4 + Math.round((g.cha - 50) / 10);
  // 性格による好み
  const like = {
    aggressive: { might: 1.5, praise: 0.7, favor: 0.6 },
    cunning: { praise: 0.3, enemy: 1.3 },
    diplomatic: { enemy: 1.4, favor: 1.3, might: -0.6 },
    expansive: { gift: 1.6, praise: 0.8 },
    cautious: { might: 1.3, enemy: 1.2 },
  }[p] || {};
  if (like[topic] !== undefined) v = Math.round(v * like[topic]);
  return v;
}

// 話題を切り出す。心証が変わり、相手が反応する
function useTopic(s, M, topic) {
  M.used[topic] = true;
  M.rounds++;
  if (TOPICS[topic].cost) s.gold[PLAYER] -= TOPICS[topic].cost;
  const v = topicEffect(s, M, topic);
  M.impression = clamp(M.impression + v, 0, 100);
  M.mood = v >= 10 ? 'happy' : v < 0 ? 'angry' : 'think';
  return { v, line: hostLine(s, M, v >= 10 ? 'good' : v < 0 ? 'bad' : 'meh', topic) };
}

// 成功率（姿勢ごと）
function meetingChance(s, M, stance) {
  const g = s.gens[M.envoy];
  const base = PROPOSALS[M.proposal].chance(s, M.clan, g);
  let p = base + (M.impression - 40) / 100;
  if (stance === 'humble') p += 0.15;
  if (stance === 'bold') {
    const ratio = castlesOf(s, PLAYER).length / Math.max(1, castlesOf(s, M.clan).length);
    p += clamp((ratio - 1) * 0.15, -0.2, 0.25);
  }
  return clamp(p, 0.02, 0.95);
}

// 条件（金の額）：相手の性格と力の差で決まる
function conditionGold(s, M) {
  const ratio = castlesOf(s, M.clan).length / Math.max(1, castlesOf(s, PLAYER).length);
  const base = PROPOSALS[M.proposal].gold;
  const mult = { aggressive: 1.3, expansive: 1.2, diplomatic: 0.8 }[CLAN_PERSONA[M.clan]] || 1;
  return Math.round((base * mult * clamp(0.7 + ratio * 0.3, 0.6, 1.6) - M.impression * 2) / 50) * 50 + 100;
}

// 姿勢を決めて、申し出を切り出す → 受諾 / 条件つき / 拒否
function propose(s, M, stance) {
  M.stance = stance;
  s.acted[M.envoy] = true;
  s.stats.diplo++;
  const p = meetingChance(s, M, stance);
  const roll = Math.random();
  if (roll < p) {
    // 下手に出ると、成功しても足元を見られることがある
    if (stance === 'humble' && Math.random() < 0.4) return offerCondition(s, M, 0.6);
    return concludeMeeting(s, M, true);
  }
  // 失敗しても、心証が悪くなければ条件を出してくる
  if (M.impression >= 35 && roll < p + 0.35) return offerCondition(s, M, 1);
  if (stance === 'bold') changeFriend(s, M.clan, -10);
  return concludeMeeting(s, M, false);
}

function offerCondition(s, M, scale) {
  const gold = Math.max(100, Math.round((conditionGold(s, M) * scale) / 50) * 50);
  M.condition = { gold };
  M.mood = 'think';
  M.lines.push(hostLine(s, M, 'condition'));
  return 'condition';
}

// 条件を飲む／値切る／断る
function answerCondition(s, M, answer) {
  if (answer === 'accept') {
    if (s.gold[PLAYER] < M.condition.gold) return concludeMeeting(s, M, false);
    s.gold[PLAYER] -= M.condition.gold;
    return concludeMeeting(s, M, true);
  }
  if (answer === 'haggle') {
    const g = s.gens[M.envoy];
    const p = clamp(0.3 + (g.cha - 50) / 100 + (M.impression - 50) / 200, 0.1, 0.8);
    if (Math.random() < p) {
      const cut = M.condition.gold;
      M.condition.gold = Math.max(50, Math.round((cut * rand(0.5, 0.7)) / 50) * 50);
      M.haggled = true;
      M.mood = 'think';
      M.lines.push(hostLine(s, M, 'haggleOk'));
      return 'condition';
    }
    M.lines.push(hostLine(s, M, 'haggleNg'));
    changeFriend(s, M.clan, -5);
    return concludeMeeting(s, M, false);
  }
  return concludeMeeting(s, M, false);
}

// 会談の決着
function concludeMeeting(s, M, ok) {
  M.over = ok ? 'deal' : 'fail';
  M.mood = ok ? 'happy' : 'angry';
  const P = PROPOSALS[M.proposal];
  if (ok) {
    changeFriend(s, M.clan, 5);
    P.apply(s, M.clan, M);
    grow(s.gens[M.envoy], 'cha');
    addDiploLog(s, M.proposal === 'aid' || M.proposal === 'joint'
      ? `${CLANS[M.clan].name}が${pName()}の${P.name}に応じた`
      : `${pName()}と${CLANS[M.clan].name}が${P.name}を結んだ`, 'good');
  } else {
    changeFriend(s, M.clan, -3);
    addDiploLog(s, `${CLANS[M.clan].name}との${P.name}の会談が決裂した`, 'bad');
  }
  M.lines.push(hostLine(s, M, ok ? 'accept' : 'refuse'));
  return M.over;
}

// ---------- 当主のセリフ ----------
const HOST_LINES = {
  greet: {
    aggressive: ['何の用だ。手短に話せ', '停戦だと？ 臆したか', 'ほう、自ら出向くとは度胸だけはあるようだな'],
    cunning: ['ふむ……そちらの狙い、読めておるぞ', '面白い。話だけは聞いてやろう', 'さて、どんな手を持ってきた？'],
    diplomatic: ['よく来たな。まずは茶でも飲もう', 'はるばるご苦労だった。話を聞こう', '話し合いはいつでも歓迎だ'],
    expansive: ['で、こちらに何の得がある？', '商談なら聞こう。損な話は御免だ', '手短にな。やることは山ほどある'],
    cautious: ['……争いは避けたいと思っていたところだ', '慎重に考えさせてもらう', '用件を聞こうか'],
    balanced: ['よく来た。用件を聞こう', 'まあ座れ。話を聞こう', 'さて、何の話だ？'],
  },
  good: ['ほう……それは一理ある', 'なるほど、悪くない話だ', 'その心意気、気に入った'],
  meh: ['ふむ……', 'それで？', 'まあ、そういう見方もあるな'],
  bad: ['それが何だというのだ', '話をそらすな', '……気分が悪いな'],
  // 話題ごとの反応（あればこちらを使う）
  topic: {
    gift: { good: ['ほう、気が利くではないか', 'これはありがたく頂戴しよう'], meh: ['……まあ、受け取っておこう'] },
    praise: { good: ['ふっ、わかっておるではないか', 'そう言われて悪い気はせんな'], meh: ['世辞はいい'], bad: ['見え透いた世辞だな'] },
    might: { good: ['……なるほど、その勢いは認めよう', '侮れぬ相手になったものだ'], meh: ['数だけで勝てるとは限らんぞ'], bad: ['脅しのつもりか！', 'その程度で我らが怯むと思うな'] },
    enemy: { good: ['……たしかに、あの家は目障りだ', 'その話、詳しく聞かせてもらおう'], meh: ['どこも同じことを言う'] },
    favor: { good: ['……そうだな。あの時は世話になった', '恩を忘れるほど落ちぶれてはおらん'], bad: ['恩を着せる気か', 'よくもぬけぬけと'] },
  },
  acceptBy: {
    truce: ['よかろう。しばらく矛を収めよう', '承知した。互いに無益な争いは避けよう', 'いいだろう。約束は守る'],
    ally: ['いいだろう。手を結ぼう', 'よかろう。今日から我らは盟友だ', '承知した。共に天下を目指そう'],
    trade: ['商いなら大歓迎だ', 'よかろう。互いに潤おうではないか'],
    sister: ['……よかろう。これより我らは姉妹校だ', '末永く、よろしく頼む'],
    aid: ['盟友の頼みだ。兵を送ろう', 'よかろう。すぐに援軍を出す'],
    joint: ['よし、共に攻め上がろう！', 'あの家には借りがある。乗った！'],
  },
  condition: ['……いいだろう。ただし、金{gold}を納めてもらおう', '条件がある。金{gold}だ', 'ただでとは言わせんぞ。金{gold}でどうだ'],
  haggleOk: ['ちっ……しかたない、金{gold}でよい', '口がうまいな。では金{gold}だ'],
  haggleNg: ['欲をかくな。この話はなかったことにする', '値切るとは無礼な。帰ってもらおう'],
  accept: ['よかろう。約束は守ろう', 'いいだろう。手を結ぼう', '承知した。互いに悪い話ではない'],
  refuse: ['断る。帰るがいい', 'その話は受けられぬ', '今はまだ、その時ではない'],
};

function hostLine(s, M, kind, topic) {
  let pool = HOST_LINES[kind];
  if (kind === 'greet') pool = pool[CLAN_PERSONA[M.clan]] || pool.balanced;
  if (topic && HOST_LINES.topic[topic] && HOST_LINES.topic[topic][kind]) pool = HOST_LINES.topic[topic][kind];
  if (kind === 'accept' && HOST_LINES.acceptBy[M.proposal]) pool = HOST_LINES.acceptBy[M.proposal];
  let line = pick(pool);
  if (M.condition) line = line.replace('{gold}', M.condition.gold);
  return line;
}

// ---------- 外交の記録 ----------
// kind：'good'（約束が結ばれた）/ 'bad'（決裂・破棄）/ 'ai'（他家どうし）/ 'info'
function addDiploLog(s, text, kind = 'info') {
  s.diploLog = s.diploLog || [];
  s.diploLog.push({ turn: s.turn, text, kind });
  if (s.diploLog.length > 80) s.diploLog.shift();
  if (kind !== 'info') addNews(s, text, '', kind === 'ai' ? 25 : 30);
}
