// ---------- 家の物語：自分の家に、節目ごとの物語の一話 ----------
// 実在の学校の本当の歴史ではなく、このゲームの中だけの物語。家の名・地方の言葉・家紋・志・宿敵の家から組み立てる
// 一話ずつ一度だけ。決め絵と同じ場面（映画の黒い帯つき）で絵巻のように見せ、小さな褒美がつく
const CREST_LORE = {
  asanoha: ['麻の葉', 'まっすぐ伸びる麻のように、まっすぐ育て'], kuyo: ['九曜', '九つの星のように、一人ひとりが光れ'],
  tomoe: ['巴', 'めぐる巴のように、勝っても負けても次がある'], kikyo: ['桔梗', '桔梗の花のように、凛として折れるな'],
  hishi: ['菱', '菱のように、角を立てても崩れるな'], nami: ['波', '寄せては返す波のように、何度でも挑め'],
  hiki: ['引両', '二本の線のように、仲間と並んで進め'], umebachi: ['梅鉢', '寒さの中で咲く梅のように、苦しい時こそ花を'],
  sakura: ['桜', '散り際まで美しく、潔く戦え'], mokko: ['木瓜', '実を結ぶ木瓜のように、努力は必ず実る'],
  yuki: ['雪', '雪のように、静かに積もって大地を覆え'], yotsume: ['四つ目', '四方に目を配り、油断するな'],
  uroko: ['鱗', '鱗を重ねるように、守りを重ねよ'], maru: ['丸', '丸く収め、角の立たぬ道を選べ'],
  kikkou: ['亀甲', '亀の甲羅のように、粘り強く、長く生きよ'], jyuji: ['十字', '交わる道の真ん中に立ち、皆をつなげ'],
  hoshi: ['星', '夜空の星のように、迷う者の目印となれ'], aoi: ['葵', '葵の葉のように、日を仰いで高く伸びよ'],
};
const crestLore = (k) => CREST_LORE[CLANS[k].crest] || ['家紋', '旗に恥じぬ戦いをせよ'];
const voiceOf = (k) => (typeof lordVoice === 'function' ? lordVoice(k) : {}) || {};

const STORY = {
  yurai: {
    title: '旗の由来',
    when: (s) => s.turn >= 4,
    text(s) {
      const [cn, word] = crestLore(PLAYER);
      return [`${pName()}の旗に染め抜かれた「${cn}」の紋。`,
        `それは、この家を興した先輩たちが、最初の旗揚げの夜に決めたものだという。`,
        `「${word}」——古い部室の壁に、いまもその言葉が残っている。`,
        `${pShort()}の旗のもとに集った者たちよ。この紋に恥じぬ戦いを。`];
    },
    reward(s) { gensOf(s, PLAYER).forEach((g) => changeLoyal(g, 3)); return '家の由来を聞き、家臣の心がひとつになった（全家臣の忠誠+3）'; },
  },
  shukumei: {
    title: '宿命の相手',
    when: (s) => s.nemesis && s.fateMet && castlesOf(s, s.nemesis).length,
    hero: (s) => aiLordOf(s, s.nemesis),
    text(s) {
      const k = s.nemesis, v = voiceOf(k);
      return [`${CLANS[k].name}——となり合う地に生まれ、同じ天下を夢見た家。`,
        `はじめて刃を交えたその夜、${CLANS[k].name}の陣から一通の書状が届いた。`,
        `「${(v.letters && v.letters[1]) || 'いずれ、決着をつけようぞ'}」`,
        `この家を倒さぬかぎり、${pName()}の天下はない。`];
    },
    reward(s) { s.fateBonus = true; return `次の${CLANS[s.nemesis].name}との合戦で、士気がさらに上がる`; },
  },
  yuigon: {
    title: '先代の遺言',
    when: (s) => (s.lords || []).length >= 2 && lordOf(s),
    text(s) {
      const prev = s.lords[s.lords.length - 2], now = lordOf(s);
      const T = typeof taishiOf === 'function' && taishiOf(s, PLAYER) ? TAISHI[taishiOf(s, PLAYER).k] : null;
      return [`卒業の日、先代・${prev.name}は、新しい当主${now.name}を屋上に呼んだ。`,
        `「天下は、一代では取れぬかもしれぬ。だがな、旗は渡せる」`,
        T ? `「わが家の志は『${T.motto}』。それだけは、忘れてくれるな」` : '「皆を頼んだぞ。それだけだ」',
        `夕焼けの校庭に、${pShort()}の旗がひるがえっていた。`];
    },
    reward(s) { const g = lordOf(s); if (g) g.cha = Math.min(100, g.cha + 5); return `${g ? g.name : '当主'}の魅力が5上がった`; },
  },
  chikai: {
    title: '志の誓い',
    when: (s) => typeof taishiOf === 'function' && taishiOf(s, PLAYER) && taishiLv(taishiOf(s, PLAYER)) >= 2,
    text(s) {
      const T = TAISHI[taishiOf(s, PLAYER).k];
      return [`「${T.motto}」。`, `口にするだけなら、たやすい言葉だった。`,
        `だが${pName()}は、その言葉のとおりに戦い、その言葉のとおりに勝ってきた。`,
        `${T.desc.split('。')[0]}——いま、その志は家臣一人ひとりの胸にある。`];
    },
    reward(s) { s.gold[PLAYER] += 300; return '志に共鳴したOB会から、金300が届いた'; },
  },
  higan: {
    title: '悲願',
    when: (s) => castlesOf(s, PLAYER).length / MAP.nodes.length >= 0.5,
    text(s) {
      const v = voiceOf(PLAYER);
      return [`地図の半ばが、${pShort()}の色に染まった。`, `旗揚げのあの日、誰がここまで来ると思っただろう。`,
        `「${v.catch || '天下は、もう目の前だ'}」`, `残るは、あと${MAP.nodes.length - castlesOf(s, PLAYER).length}校。`];
    },
    reward(s) { gensOf(s, PLAYER).forEach((g) => changeLoyal(g, 5)); return '天下を目前に、家臣たちは奮い立った（全家臣の忠誠+5）'; },
  },
};
const STORY_ORDER = ['yurai', 'shukumei', 'yuigon', 'chikai', 'higan'];

// ○○家の最期：自分の家が滅ぼした家の、最後の言葉
function fallStory(s, k) {
  const v = voiceOf(k), [cn] = crestLore(k);
  return { id: `fall:${k}`, title: `${CLANS[k].name}の最期`, clan: k,
    text: [`最後の城が落ち、${CLANS[k].name}の「${cn}」の旗が降ろされた。`, `その当主は、静かに言ったという。`,
      `「${v.captured || '……見事であった。天下を、頼んだぞ'}」`, `ひとつの家の物語が、ここに幕を閉じた。`],
    reward: null };
}

// どの話を、いつ出すか（季の終わりの render のあとで調べる）
function storyNext(s) {
  if (!s || s.result) return null;
  s.story = s.story || {};
  for (const id of STORY_ORDER) {
    if (!s.story[id] && STORY[id].when(s)) return { id, title: STORY[id].title, text: STORY[id].text(s), hero: STORY[id].hero ? STORY[id].hero(s) : lordOf(s), chapter: Object.keys(s.story).filter((x) => !x.startsWith('fall:')).length + 1 };
  }
  // 滅ぼした家の最期
  const gone = (s.storyGone || []).find((k) => !s.story[`fall:${k}`]);
  if (gone) { const f = fallStory(s, gone); f.hero = null; return f; }
  return null;
}
function storyDone(s, st) {
  s.story = s.story || {};
  s.story[st.id] = s.turn;
  const R = STORY[st.id];
  return R && R.reward ? R.reward(s) : '';
}
// 宿敵の家とはじめてぶつかった／自分の家が家を滅ぼした、を拾う
const _stRecordBattle = recordBattle;
recordBattle = function (s, r) {
  _stRecordBattle(s, r);
  if (s.nemesis && ((r.attacker === PLAYER && r.defender === s.nemesis) || (r.defender === PLAYER && r.attacker === s.nemesis))) s.fateMet = true;
  if (r.won && r.attacker === PLAYER && r.defender !== 'none' && CLANS[r.defender] && !castlesOf(s, r.defender).length) {
    s.storyGone = [...new Set([...(s.storyGone || []), r.defender])];
  }
};
// 宿命の一話のあと、宿敵の家との次の合戦は士気がさらに上がる
const _stStart = startBattle;
startBattle = function (s, o) {
  const B = _stStart(s, o);
  if (s.fateBonus && s.nemesis && B.attacker === PLAYER && B.defender === s.nemesis) { B.a.morale = clamp(B.a.morale + 6, 15, 100); s.fateBonus = false; }
  return B;
};
