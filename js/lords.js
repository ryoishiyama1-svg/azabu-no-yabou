// ---------- 他家の当主の個性と台詞 ----------
// 家の志ごとの言い回し。外交の間柄、合戦の名乗り、宿敵の家の宣戦布告で使う
const LORD_LINES = {
  hado: {
    friendly: ['貴殿とは、いずれ並んで天下を見たいものだ', '強き者は好きだ。いまは手を組もう'],
    neutral: ['天下は力で取るもの。貴殿もそう思わぬか', '弱き者に興味はない'],
    hostile: ['貴殿の城、いずれすべていただく', '刃で語ろうではないか'],
    battle: ['天下布武！ 道を開けよ！', 'わが前に立つ者は、すべて斬る！'],
    declare: '天下は一つ。二つの旗は並ばぬ。——いざ、雌雄を決しようぞ！',
  },
  odo: {
    friendly: ['争わずに済むなら、それに越したことはない', '貴殿とは、よき隣人でありたい'],
    neutral: ['徳なき者に、天下は治められぬ', '話し合えば、分かり合えることもある'],
    hostile: ['仁を忘れた者には、天も味方せぬぞ', '義を欠く家と、手は結べぬ'],
    battle: ['民のため、ここは退かぬ！', '義はわれにあり！'],
    declare: '貴殿のやり方では、民が泣く。仁義のため、この王道で貴殿を止めてみせよう！',
  },
  fukoku: {
    friendly: ['商いが栄えれば、皆が潤う。よい付き合いをしよう', '貴殿の町も、なかなかの賑わいだ'],
    neutral: ['戦は金がかかる。損な戦はせぬ主義でな', '国が富めば、兵は自ずと集まる'],
    hostile: ['貴殿の町、わが市に取り込んでくれよう', '金の力を、甘く見るでないぞ'],
    battle: ['わが富は、この兵の数よ！', '金をかけた城、そう簡単には落ちぬ！'],
    declare: '貴殿の町の繁盛も、そこまでだ。富国強兵——わが家の財で、天下を買い取ってくれよう！',
  },
  boryaku: {
    friendly: ['ふふ……貴殿とは、まだ敵でいる必要はない', '良い取引であった。また頼む'],
    neutral: ['戦は、始まる前に決まっている', '表の顔と裏の顔、どちらで話そうか'],
    hostile: ['すでに、貴殿の家中には手を打ってある', '気づいた時には遅いのだよ'],
    battle: ['すべて読み通りよ', '罠にかかったな！'],
    declare: '盤上の駒は、すべて揃った。深謀遠慮——貴殿の家は、もう詰んでいる。',
  },
  shusei: {
    friendly: ['守りを固めるのが、わが家の流儀。貴殿とは争わぬ', 'よき隣人であれば、それでよい'],
    neutral: ['城は落とすより守るほうが難しい', '焦る者から崩れるものだ'],
    hostile: ['わが城は鉄壁。来るなら来い', '攻めあぐねて、引き返すがいい'],
    battle: ['金城鉄壁！ 一歩も通さぬ！', 'この石垣は、破れぬぞ！'],
    declare: '貴殿は攻めすぎた。金城鉄壁——わが守りの前に、その勢いもここまでだ。',
  },
  bunbu: {
    friendly: ['文武両道。貴殿の家にも学ぶところは多い', '良き競い相手がいると、張り合いがある'],
    neutral: ['学びも戦も、日々の積み重ねよ', '勝っても驕らず、負けても腐らず'],
    hostile: ['その慢心、いずれ痛い目を見るぞ', '貴殿の家の弱みは、もう見えている'],
    battle: ['鍛えた技、とくと見よ！', '文武両道の真髄、見せてくれよう！'],
    declare: 'いずれ雌雄を決する日が来ると思っていた。文武両道——正々堂々、勝負だ！',
  },
};
function lordLines(k) {
  const t = typeof taishiOf === 'function' && taishiOf(S, k);
  return LORD_LINES[t ? t.k : PERSONA_TAISHI[CLAN_PERSONA[k]] || 'bunbu'] || LORD_LINES.bunbu;
}
function lordSay(k, mood) {
  const L = lordLines(k);
  const r = seeded((S.turn + 1) * 31 + k.length * 7);
  const arr = L[mood] || L.neutral;
  return arr[Math.floor(r() * arr.length)];
}
const relMood = (k) => { const r = S.rel[k]; if (!r) return 'neutral'; if (r.ally > 0 || r.friend >= 60) return 'friendly'; if (r.friend < 30) return 'hostile'; return 'neutral'; };

// 宿敵の家の宣戦布告：猶予の季が明けたら、一度だけ
const _ldRender = render;
render = function (...a) {
  const r = _ldRender.apply(this, a);
  if (S && S.nemesis && !S.declared && !S.result && S.turn >= graceTurns(S) && castlesOf(S, S.nemesis).length && !$('game').hidden) {
    const lord = aiLordOf(S, S.nemesis);
    if (lord) {
      S.declared = true;
      const shot = () => {
        const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden;
        if (busy) { setTimeout(shot, 1200); return; }
        Sound.horagai(); setTimeout(() => Sound.horagai(), 700);
        showKime(lord, '宣戦布告', lordLines(S.nemesis).declare, null, 'angry', `<p class="ts-up">${CLANS[S.nemesis].name}当主・${esc(lord.name)}より</p>`);
        save();
      };
      setTimeout(shot, 1500);
    }
  }
  return r;
};
// 合戦：他家の当主が出ている合戦では、敵の当主が名乗る
const _ldRun = runBattle;
runBattle = function (B, opts) {
  const res = _ldRun(B, opts);
  const foeSide = B.playerSide === 'a' ? 'd' : 'a';
  const cmd = foeSide === 'a' ? S.gens[B.gid] : B.dgid ? S.gens[B.dgid] : null;
  const k = B[foeSide] && B[foeSide].clan;
  // 他家の当主が大将のとき、または守る城にいるとき
  const lord = CLANS[k] && k !== PLAYER ? aiLordOf(S, k) : null;
  const fg = lord && ((cmd && cmd.id === lord.id) || (foeSide === 'd' && lord.loc === B.to)) ? lord : null;
  if (fg) {
    const add = () => {
      const head = document.querySelector('#battle .b-head');
      if (head && !head.querySelector('.foe-lord')) head.insertAdjacentHTML('beforeend', `<div class="foe-lord">${portrait(fg, 44, 'angry')}<p><small>${CLANS[k].name}当主</small><b>${esc(fg.name)}</b>「${esc(lordSay(k, 'battle'))}」</p></div>`);
    };
    setTimeout(add, 50); setTimeout(add, 1700); // 行列のあとに開く合戦にも
  }
  return res;
};
