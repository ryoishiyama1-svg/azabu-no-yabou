// ---------- 百の工夫（その一）：小さな出来事を四十 ----------
// どれも一行のデータ。季節（0春〜3冬、null はいつでも）と、選択肢の効き目（fx）だけで書く
// fx：gold 金／loyal 全家臣の忠誠／loyalLow 忠誠の低い家臣／troops 全城の兵（割合）／eco 本拠の経済／def 本拠の守り
//     grow 全家臣の能力が伸びる（{k, p}）／one ひとりの能力（{k, n}）／friend 諸家の友好／saku 策の札／mom 勢い／bond 絆／treasure 家宝
const HYAKU = [
  { id: 'gakushoku', t: '学食の新メニュー', i: '食', s: null, x: '学食に「天下統一カツ丼」が登場した。家臣たちが試食会を開きたいと言っている。', c: [['試食会を開く（金100）', { gold: -100, loyal: 3 }], ['見送る', {}]] },
  { id: 'amamori', t: '校舎の雨漏り', i: '漏', s: null, x: '本拠の校舎で雨漏りが見つかった。直すには金がかかる。', c: [['修繕する（金150）', { gold: -150, eco: 5 }], ['しばらく放っておく', { troops: -0.03 }]] },
  { id: 'otoshimono', t: '落とし物の名刀', i: '拾', s: null, x: '校門の前に、見事な木刀が落ちていた。持ち主の名はない。', c: [['届け出る', { friend: 5, loyal: 1 }], ['わが家のものにする（金+200相当）', { gold: 200, loyal: -2 }]] },
  { id: 'renshu', t: '練習試合の申し込み', i: '試', s: null, x: '他校の運動部から、練習試合を申し込まれた。', c: [['受けて立つ', { grow: { k: 'str', p: 0.35 } }], ['断る', {}]] },
  { id: 'heihosho', t: '体育倉庫の兵法書', i: '書', s: null, x: '体育倉庫の奥から、古い兵法書が出てきた。', c: [['知恵者に読ませる', { one: { k: 'int', n: 3 } }], ['しまっておく', {}]] },
  { id: 'kifu', t: '怪しい寄付の申し出', i: '寄', s: null, x: '名を名乗らぬ人物から、多額の寄付の申し出があった。', c: [['受け取る（金+400）', { gold: 400, friend: -5 }], ['丁重に断る', { loyal: 2 }]] },
  { id: 'gassho', t: '合唱コンクール', i: '歌', s: 2, x: '秋の合唱コンクール。指揮を執る者が、全員での朝練を提案した。', c: [['全力で臨む', { loyal: 4, grow: { k: 'cha', p: 0.3 } }], ['ほどほどに', { loyal: 1 }]] },
  { id: 'obkai', t: 'OB会の宴', i: '宴', s: null, x: 'OB会から、宴への招待状が届いた。', c: [['当主みずから出る（金100）', { gold: -100, loyal: 5 }], ['欠席する', {}]] },
  { id: 'moshi', t: '模試の結果', i: '模', s: null, x: '模試の結果が返ってきた。思わしくない家臣もいる。', c: [['補習を開く（金100）', { gold: -100, grow: { k: 'int', p: 0.4 } }], ['気にしない', { loyal: 1 }]] },
  { id: 'neko', t: '迷い猫', i: '猫', s: null, x: '城に迷い猫が住みついた。家臣たちがこっそり餌をやっている。', c: [['城の猫として飼う', { loyal: 3 }], ['里親を探す', { friend: 2 }]] },
  { id: 'tenji', t: '文化部の展示', i: '展', s: null, x: '文化部が、町の人を招いて展示会を開きたいという。', c: [['支援する（金150）', { gold: -150, eco: 6, friend: 2 }], ['見送る', {}]] },
  { id: 'suburi', t: '早朝の素振り', i: '振', s: null, x: '剣道部の家臣が、全員での早朝素振りを提案した。', c: [['皆でやる', { grow: { k: 'str', p: 0.3 }, loyal: -1 }], ['やりたい者だけ', {}]] },
  { id: 'hanabi', t: '夏祭りの花火', i: '火', s: 1, x: '夏祭りに、わが家から花火を打ち上げようという声が上がった。', c: [['盛大に打ち上げる（金200）', { gold: -200, friend: 5, loyal: 3 }], ['今年は見送る', {}]] },
  { id: 'katazuke', t: '台風の後片付け', i: '片', s: 2, x: '台風が去った。となり町も被害が出ている。', c: [['となり町も手伝う', { troops: -0.03, friend: 4 }], ['わが町を先に', { eco: 3 }]] },
  { id: 'neage', t: '購買の値上げ', i: '購', s: null, x: '購買部が値上げを願い出てきた。', c: [['認める（金+150）', { gold: 150, loyal: -3 }], ['据え置かせる（金100を補う）', { gold: -100, loyal: 2 }]] },
  { id: 'kosoku', t: '校則の改正', i: '則', s: null, x: '生徒会から、校則を見直したいという声が上がった。', c: [['厳しくする', { troops: 0.05, loyal: -3 }], ['ゆるめる', { loyal: 4, troops: -0.03 }]] },
  { id: 'missho', t: '差出人のない密書', i: '密', s: null, x: '差出人のない密書が届いた。他家の内情が書かれているようだ。', c: [['読んで策に生かす', { saku: 1, friend: -3 }], ['読まずに燃やす', { loyal: 1 }]] },
  { id: 'tenko', t: '転校の噂', i: '噂', s: null, x: '忠誠の低い家臣たちに、転校の噂が立っている。', c: [['引き止める（金150）', { gold: -150, loyalLow: 8 }], ['去る者は追わず', {}]] },
  { id: 'nukemichi', t: '秘密の抜け道', i: '道', s: null, x: '旧校舎の床下に、となりの敷地へ通じる抜け道が見つかった。', c: [['策に使う', { saku: 1 }], ['ふさいでおく', { def: 0.1 }]] },
  { id: 'kanban', t: '看板が倒れた', i: '板', s: null, x: '強風で正門の看板が倒れてしまった。', c: [['すぐ直す（金100）', { gold: -100, loyal: 1 }], ['そのままにする', { loyal: -2 }]] },
  { id: 'fukkatsu', t: '伝説の部活の復活', i: '活', s: null, x: '十年前に途絶えた伝説の部活を、復活させたいという家臣がいる。', c: [['支援する（金150）', { gold: -150, one: { k: 'cha', n: 3 }, loyal: 2 }], ['見送る', {}]] },
  { id: 'kochizu', t: '図書室の古地図', i: '図', s: null, x: '図書室で、このあたりの古い地図が見つかった。', c: [['写して軍議に使う', { saku: 1 }], ['図書室に戻す', { grow: { k: 'int', p: 0.15 } }]] },
  { id: 'sashiire', t: '先生の差し入れ', i: '差', s: null, x: '顧問の先生が、山ほどの差し入れを持ってきてくれた。', c: [['ありがたくいただく', { loyal: 3 }]] },
  { id: 'yakisoba', t: '焼きそばパンの品切れ', i: '麺', s: null, x: '名物の焼きそばパンが、毎日昼前に売り切れてしまう。', c: [['増産させる（金100）', { gold: -100, eco: 5 }], ['希少さもまた味', { loyal: -1, gold: 50 }]] },
  { id: 'mimawari', t: '夜間の見回り', i: '回', s: null, x: '夜の校舎に、不審な影が出るという。', c: [['見回りを増やす', { def: 0.1, troops: -0.02 }], ['気にしない', {}]] },
  { id: 'ouendan', t: '応援団の結成', i: '応', s: null, x: '家臣たちが、合戦の応援団を結成したいと言い出した。', c: [['認める', { mom: 1, loyal: 2 }], ['勉学が先だ', { grow: { k: 'int', p: 0.15 } }]] },
  { id: 'ryugaku', t: '他家の留学生', i: '留', s: null, x: '他家から、留学生を受け入れてほしいと頼まれた。', c: [['受け入れる（金100）', { gold: -100, friend: 8 }], ['断る', { friend: -2 }]] },
  { id: 'nanafushigi', t: '学園の七不思議', i: '怪', s: null, x: '「夜の音楽室でピアノが鳴る」——家臣が調べたいと言っている。', c: [['調べさせる', { one: { k: 'int', n: 2 }, loyal: 2 }], ['怖いのでやめる', {}]] },
  { id: 'yukigassen', t: '雪合戦', i: '雪', s: 3, x: '大雪の朝。家臣たちが校庭で雪合戦を始めたがっている。', c: [['全員参加！', { loyal: 4, grow: { k: 'str', p: 0.2 } }], ['授業が先だ', { grow: { k: 'int', p: 0.15 } }]] },
  { id: 'hanami', t: '花見の席取り', i: '花', s: 0, x: '花見の季節。一番いい桜の下を、誰が取りに行くか。', c: [['皆で一番乗り（金50）', { gold: -50, loyal: 3 }], ['空いた所で', { loyal: 1 }]] },
  { id: 'kaki_koshu', t: '夏期講習', i: '講', s: 1, x: '夏休みに講習を開こうという声がある。', c: [['開く（金200）', { gold: -200, grow: { k: 'int', p: 0.45 } }], ['休むのも大事', { loyal: 2 }]] },
  { id: 'momijigari', t: '紅葉狩り', i: '紅', s: 2, x: '山が色づいた。家臣たちを連れて紅葉狩りに行こうか。', c: [['皆で出かける', { loyal: 4 }], ['城の守りが先', { def: 0.1 }]] },
  { id: 'osouji', t: '年末の大掃除', i: '掃', s: 3, x: '年の瀬。城の大掃除の日がやってきた。', c: [['徹底的にやる', { eco: 5, loyal: -1 }], ['ほどほどに', { loyal: 1 }]] },
  { id: 'shisatsu', t: '敵情視察', i: '察', s: null, x: '他家の文化祭に、変装して視察に行こうという案が出た。', c: [['行かせる（金100）', { gold: -100, saku: 1, friend: -3 }], ['堂々と招待を待つ', { friend: 2 }]] },
  { id: 'shodo', t: '書道部の大作', i: '筆', s: null, x: '書道部が、大広間に飾る大作「天下布武」を書き上げた。', c: [['大広間に飾る', { loyal: 2, grow: { k: 'cha', p: 0.2 } }], ['書道室に飾る', {}]] },
  { id: 'shogi', t: '将棋大会', i: '棋', s: null, x: '校内の将棋大会が開かれる。知恵者を出してみるか。', c: [['知恵者を出す', { one: { k: 'int', n: 2 } }], ['見物に回る', { loyal: 1 }]] },
  { id: 'yashoku', t: '夜食の差し入れ', i: '夜', s: null, x: '夜遅くまで軍議を続ける家臣たち。差し入れをしようか。', c: [['夜食を配る（金80）', { gold: -80, loyal: 3 }], ['早く寝かせる', { troops: 0.02 }]] },
  { id: 'seifuku', t: '制服の新調', i: '服', s: 0, x: '春に合わせて、家臣の制服を新しくしようという話が出た。', c: [['新調する（金300）', { gold: -300, loyal: 5, mom: 1 }], ['今のままで', {}]] },
  { id: 'okujo', t: '屋上の約束', i: '約', s: null, x: '屋上で、二人の家臣が「この家で天下を取ろう」と誓い合っていた。', c: [['見守る', { bond: 3, loyal: 1 }]] },
  { id: 'kyuden', t: '停電の夜', i: '電', s: null, x: '停電で、城の灯りが消えた。家臣たちは不安そうだ。', c: [['ろうそくを囲んで語らう', { loyal: 3, bond: 2 }], ['早く復旧させる（金100）', { gold: -100, eco: 3 }]] },
];
function hyakuApply(s, fx) {
  const out = [];
  const gens = gensOf(s, PLAYER), home = homeCastle(s);
  if (fx.gold) { s.gold[PLAYER] = Math.max(0, s.gold[PLAYER] + fx.gold); out.push(`金${fx.gold > 0 ? '+' : ''}${fx.gold}`); }
  if (fx.loyal) { gens.forEach((g) => changeLoyal(g, fx.loyal)); out.push(`忠誠${fx.loyal > 0 ? '+' : ''}${fx.loyal}`); }
  if (fx.loyalLow) { gens.filter((g) => !g.lord && g.loyal < 60).forEach((g) => changeLoyal(g, fx.loyalLow)); out.push(`忠誠の低い家臣の忠誠+${fx.loyalLow}`); }
  if (fx.troops) { castlesOf(s, PLAYER).forEach((id) => { const c = s.castles[id]; c.troops = clamp(Math.round((c.troops * (1 + fx.troops)) / 10) * 10, 0, RULES.troopCap); }); out.push(`兵${fx.troops > 0 ? '+' : ''}${Math.round(fx.troops * 100)}%`); }
  if (fx.eco && home) { s.castles[home].eco = clamp(s.castles[home].eco + fx.eco, 0, RULES.ecoCap); out.push(`本拠の経済+${fx.eco}`); }
  if (fx.def && home) { s.castles[home].def = Math.min(RULES.defCap, Math.round((s.castles[home].def + fx.def) * 10) / 10); out.push(`本拠の守り+${fx.def}`); }
  if (fx.grow) { let n = 0; gens.forEach((g) => { if (g[fx.grow.k] < 100 && Math.random() < fx.grow.p) { g[fx.grow.k]++; n++; } }); out.push(`${n}人の${STAT_NAMES[fx.grow.k]}+1`); }
  if (fx.one) { const g = bestBy(gens.filter((x) => !x.lord), fx.one.k) || gens[0]; if (g) { g[fx.one.k] = Math.min(100, g[fx.one.k] + fx.one.n); out.push(`${g.name}の${STAT_NAMES[fx.one.k]}+${fx.one.n}`); } }
  if (fx.friend) { aiClans().forEach((k) => { if (s.rel[k]) changeFriend(s, k, fx.friend); }); out.push(`諸家の友好${fx.friend > 0 ? '+' : ''}${fx.friend}`); }
  if (fx.saku && typeof drawSaku === 'function') { const got = drawSaku(s, fx.saku); if (got.length) out.push(`策の札「${SAKU[got[0]].name}」`); }
  if (fx.mom) { s.momentum = Math.min(MOMENTUM.max, (s.momentum || 0) + fx.mom); out.push(`勢い+${fx.mom}`); }
  if (fx.bond && gens.length >= 2) { const [a, b] = gens.slice().sort(() => Math.random() - 0.5); s.bondPts = s.bondPts || {}; const k = bondKey(a.id, b.id); s.bondPts[k] = (s.bondPts[k] || 0) + fx.bond; out.push(`${a.name}と${b.name}の絆が深まる`); }
  return out.length ? `（${out.join('・')}）` : '';
}
HYAKU.forEach((h) => {
  EVENTS[`hy_${h.id}`] = {
    icon: h.i, title: h.t, weight: 0,
    text: () => h.x,
    choices: (s) => h.c.map(([label, fx]) => ({ label, disabled: fx.gold < 0 && s.gold[PLAYER] < -fx.gold })),
    apply: (s, p, ci) => { const ch = h.c[ci] || h.c[h.c.length - 1]; return `${ch[0].replace(/（.*）/, '')}。${hyakuApply(s, ch[1])}`; },
  };
});
const HYAKU_CHANCE = 0.35;
const _hyRoll = rollEvents;
rollEvents = function (s) {
  const list = _hyRoll(s);
  if (s.turn >= 1 && list.length < (typeof GAKKO !== 'undefined' ? GAKKO.maxEvents : 4) && Math.random() < HYAKU_CHANCE) {
    s.hyakuSeen = s.hyakuSeen || [];
    const pool = HYAKU.filter((h) => (h.s === null || h.s === s.turn % 4) && !s.hyakuSeen.includes(h.id));
    const h = pool.length ? pick(pool) : null;
    if (h) { s.hyakuSeen.push(h.id); if (s.hyakuSeen.length > 30) s.hyakuSeen.shift(); list.push({ id: `hy_${h.id}`, p: {} }); }
  }
  return list;
};

// ---------- 百の工夫（その二）：実績を三十 ----------
const hyStats = (s) => (s.stats = s.stats || {});
ACHIEVEMENTS.push(
  { id: 'policy10', icon: '針', name: '方針を貫く', desc: '今季の方針を10季選ぶ', play: (s) => (hyStats(s).policies || 0) >= 10 },
  { id: 'policy_all', icon: '七', name: '七つの方針', desc: '七つの方針をすべて選ぶ', play: (s) => Object.keys(hyStats(s).policySet || {}).length >= Object.keys(POLICIES).length },
  { id: 'saku10', icon: '札', name: '策士', desc: '策の札を10枚使う', play: (s) => (hyStats(s).sakuUsed || 0) >= 10 },
  { id: 'saku_all', icon: '八', name: '八策を極める', desc: '八種の策をすべて使う', play: (s) => Object.keys(hyStats(s).sakuSet || {}).length >= Object.keys(SAKU).length },
  { id: 'heiho3', icon: '兵', name: '兵法の家', desc: '兵法を会得した家臣が3人', play: (s) => gensOf(s, PLAYER).filter((g) => (g.heiho || []).length).length >= 3 },
  { id: 'heiho_master', icon: '極', name: '兵法を極めし者', desc: '兵法を二つ会得した家臣がいる', play: (s) => gensOf(s, PLAYER).some((g) => (g.heiho || []).length >= 2) },
  { id: 'shinro3', icon: '路', name: '道を拓く', desc: '進路を決めた家臣が3人', play: (s) => gensOf(s, PLAYER).filter((g) => g.path).length >= 3 },
  { id: 'vassal1', icon: '従', name: '初めての臣従', desc: '他家を臣従させる', play: (s) => Object.keys(s.vassals || {}).length >= 1 },
  { id: 'vassal3', icon: '盟', name: '盟主', desc: '三つの家を同時に臣従させる', play: (s) => Object.keys(s.vassals || {}).length >= 3 },
  { id: 'vassal_unify', icon: '服', name: '天下を従える', desc: '臣従の諸家とともに天下統一', end: (s) => s.result === 'win' && !!s.vassalUnify },
  { id: 'seki_win', icon: '関', name: '天下分け目を制す', desc: '天下分け目の大合戦に勝つ', play: (s) => !!hyStats(s).sekiWin },
  { id: 'mission10', icon: '命', name: '密命の人', desc: '密命を10果たす', play: (s) => (hyStats(s).missions || 0) >= 10 },
  { id: 'mission30', icon: '影', name: '影の軍師', desc: '密命を30果たす', play: (s) => (hyStats(s).missions || 0) >= 30 },
  { id: 'momentum5', icon: '炎', name: '破竹の勢い', desc: '勢いが5段に達する', play: (s) => (s.momentum || 0) >= 5 },
  { id: 'town5', icon: '都', name: '天下の大都', desc: '城下町を「天下の大都」まで育てる', play: (s) => castlesOf(s, PLAYER).some((id) => townLevel(s.castles[id].eco) >= 4) },
  { id: 'fac_full', icon: '町', name: '城下の賑わい', desc: '一つの城の区画を五つすべて埋める', play: (s) => castlesOf(s, PLAYER).some((id) => (s.castles[id].fac || []).length >= 5) },
  { id: 'daily_win', icon: '日', name: '今日の天下人', desc: '今日の一局で天下統一', end: (s) => s.result === 'win' && !!s.daily },
  { id: 'win_gunyu', icon: '群', name: '群雄を制す', desc: '「群雄割拠」で天下統一', end: (s) => s.result === 'win' && s.variant === 'gunyu' },
  { id: 'win_appei', icon: '圧', name: '圧政を砕く', desc: '「大大名の圧政」で天下統一', end: (s) => s.result === 'win' && s.variant === 'appei' },
  { id: 'win_gekoku', icon: '剋', name: '下剋上の果て', desc: '「下剋上の世」で天下統一', end: (s) => s.result === 'win' && s.variant === 'gekoku' },
  { id: 'nemesis_down', icon: '仇', name: '宿願', desc: '宿敵の家を討ち果たす', play: (s) => !!s.nemesisDone && !!s.nemesis && !castlesOf(s, s.nemesis).length },
  { id: 'meiba6', icon: '絵', name: '名場面帖', desc: '戦国の名場面を6つ集める', play: (s) => Object.keys(s.meiba || {}).length >= 6 },
  { id: 'meiba_all', icon: '巻', name: '名場面を極める', desc: '戦国の名場面をすべて集める（一局で）', play: (s) => Object.keys(s.meiba || {}).length >= Object.keys(MEIBA).length },
  { id: 'story5', icon: '語', name: '家の語り部', desc: '家の物語を5話見る', play: (s) => Object.keys(s.story || {}).filter((k) => !k.startsWith('fall:')).length >= 5 },
  { id: 'fall3', icon: '弔', name: '興亡を見届ける', desc: '三つの家の最期を見届ける', play: (s) => Object.keys(s.story || {}).filter((k) => k.startsWith('fall:')).length >= 3 },
  { id: 'talk20', icon: '声', name: '聞き上手', desc: '家臣の声に20回答える', play: (s) => (hyStats(s).talkN || 0) >= 20 },
  { id: 'fuku3', icon: '伏', name: '待ち伏せの名手', desc: '伏兵で3度敵を襲う', play: (s) => (hyStats(s).fukuN || 0) >= 3 },
  { id: 'pincer5', icon: '挟', name: '挟撃の妙', desc: '挟み撃ちで5回攻める', play: (s) => (hyStats(s).pincerN || 0) >= 5 },
  { id: 'kankoku5', icon: '勧', name: '言葉の力', desc: '勧告を5回成功させる', play: (s) => (hyStats(s).kankokuWins || 0) >= 5 },
  { id: 'hyaku20', icon: '百', name: '学園の日々', desc: '小さな出来事を20迎える', play: (s) => (hyStats(s).hyakuN || 0) >= 20 },
);
// 実績のための数え方
const _hyPolicy = choosePolicy;
choosePolicy = function (s, k) { _hyPolicy(s, k); hyStats(s).policies = (hyStats(s).policies || 0) + 1; hyStats(s).policySet = { ...(hyStats(s).policySet || {}), [k]: 1 }; };
const _hySaku = useSaku;
useSaku = function (s, B, side, idx) { const k = _hySaku(s, B, side, idx); if (k && B[side].clan === PLAYER) { hyStats(s).sakuUsed = (hyStats(s).sakuUsed || 0) + 1; hyStats(s).sakuSet = { ...(hyStats(s).sakuSet || {}), [k]: 1 }; } return k; };
const _hyTalk = talkAnswer;
talkAnswer = function (s, ci) { const r = _hyTalk(s, ci); if (r) hyStats(s).talkN = (hyStats(s).talkN || 0) + 1; return r; };
const _hyFuku = springFuku;
springFuku = function (s, to, n) { const own = s.castles[to].owner === PLAYER; const loss = _hyFuku(s, to, n); if (loss && own) hyStats(s).fukuN = (hyStats(s).fukuN || 0) + 1; return loss; };
const _hyStart = startBattle;
startBattle = function (s, o) { const B = _hyStart(s, o); if (B.pincer && B.attacker === PLAYER) hyStats(s).pincerN = (hyStats(s).pincerN || 0) + 1; return B; };
const _hySeki = sekiEnd;
sekiEnd = function (s, B) { const r = _hySeki(s, B); if (B.over === 'win') hyStats(s).sekiWin = 1; return r; };
const _hyResolve = resolveEvent;
resolveEvent = function (s, ev, ci) { if (ev && String(ev.id).startsWith('hy_')) hyStats(s).hyakuN = (hyStats(s).hyakuN || 0) + 1; return _hyResolve(s, ev, ci); };

// ---------- 百の工夫（その三）：家臣の声を三十 ----------
// 季節の世間話を増やし、他家の噂話という話題を足す
const SEKEN_MORE = [
  ['新入生の名簿、目を通されましたか。面白い者がおりまする', '桜の下で弁当を食べると、なぜかうまいのです', '春は眠うございますな……いえ、目は覚めております', '部活の勧誘で、校門が戦場のようでした', '新しい制服、少し大きかったようで', '花冷えの朝は、兵の動きも鈍りまする', '入学式の答辞、見事でございました'],
  ['夏の大会に向けて、部の者が燃えておりまする', 'かき氷は宇治金時に限りますな', '蝉の声で、軍議が聞こえませぬ', '夏休みの課題が……いえ、なんでもございませぬ', '海に行きたいと、皆がうるさくて', '夕立のあとの校庭は、気持ちがよいものです', '花火の音を聞くと、合戦を思い出しまする'],
  ['文化祭の準備で、徹夜の者が増えております', '秋の夜長、兵法書が進みまする', '焼き芋の匂いが、どこからか', '体育祭の筋肉痛が、まだ抜けませぬ', '紅葉の色に、つい見とれてしまいました', '中間試験の範囲が広すぎまする', '秋は食欲の季節。兵糧が心配で'],
  ['寒さで、筆を持つ手がかじかみまする', 'こたつから出られぬ者が続出しておりまする', '受験の三年生に、何かしてやれぬものか', '雪の積もった校庭は、まるで戦の跡のよう', '年越しそばは、皆で食べとうございますな', '初詣で、天下統一を願ってまいりました', '吐く息が白いと、身が引き締まりまする'],
];
const UWASA = ['の当主は、毎朝誰よりも早く登校するとか', 'では、兵の鍛錬が厳しすぎて不満が出ているそうな', 'の購買は、焼きそばパンが絶品との評判', 'の家中で、跡目争いの噂がございます', 'は、近ごろ兵を集めているようでございます'];
const _hyTopics = talkTopics;
talkTopics = function (s, g) {
  const out = _hyTopics(s, g);
  const sk = out.find((t) => t.kind === 'seken');
  if (sk) sk.line = pick(SEKEN_MORE[s.turn % 4]);
  const others = aiClans().filter((k) => castlesOf(s, k).length);
  if (others.length) {
    const k = pick(others);
    out.push({ w: 1.5, kind: 'uwasa', mood: 'think', clan: k, line: `噂でございますが……${CLANS[k].name}${pick(UWASA)}`, a: { label: '詳しく調べさせる', sub: '策の札を一枚' }, b: { label: '噂に惑わされるな', sub: '忠誠+1' } });
  }
  return out;
};
const _hyAns = talkAnswer;
talkAnswer = function (s, ci) {
  const t = s.talk;
  if (t && !t.done && t.kind === 'uwasa') {
    const g = s.gens[t.gid];
    t.done = ci === 0 ? 'a' : 'b';
    hyStats(s).talkN = (hyStats(s).talkN || 0) + 1;
    if (ci === 0 && typeof drawSaku === 'function') { const got = drawSaku(s); return got.length ? `探りを入れてまいりまする（策の札「${SAKU[got[0]].name}」）` : '探りを入れましたが、手札がもういっぱいのようで'; }
    if (g) changeLoyal(g, 1);
    return 'は、肝に銘じまする（忠誠+1）';
  }
  return _hyAns(s, ci);
};
