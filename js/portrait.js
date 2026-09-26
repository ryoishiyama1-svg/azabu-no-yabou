// 武将の顔（錦絵風の胸像）。絵そのものは js/ukiyo.js の部品で組み立てる
// 武将の look（数値）と能力値・性別・家から、髪型・装束・持ち物を決める
// portrait(g, size, mood, dir)
//   mood：'happy' 笑顔 / 'angry' 怒り / 'think' 思案 / 'laugh' 大笑い / 'surprise' 驚き / 'frustrated' 悔しさ（省略でふつう）
//   dir ：'L' 左向き（省略時）/ 'R' 右向き。画面の左にいる人は 'R' にして向かい合わせる
const MOOD_MAP = { happy: 'smile', angry: 'angry', think: 'think', laugh: 'laugh', surprise: 'surprise', frustrated: 'frustrated', smile: 'smile' };
const PORTRAIT_BG = ['seigaiha', 'asanoha', 'ichimatsu'];

function portraitOptions(g) {
  const r = seeded((g.look || 1) * 7 + 3);
  const rr = (n) => Math.floor(r() * n);
  const clan = CLANS[g.clan] && g.clan !== 'none' ? g.clan : CLANS[g.origin] && g.origin !== 'none' ? g.origin : 'none';
  const color = CLANS[clan] ? CLANS[clan].color : '#8a8170';
  const female = !!g.female;
  const str = g.str || 50, int = g.int || 50, pol = g.pol || 50, cha = g.cha || 50;
  const strong = str >= 75;
  let over = null;
  if (g.lord || strong) over = 'kataginu';
  else if (pol >= 68 || cha >= 68) over = 'haori';
  else if (rr(3) === 0) over = 'haori';
  return {
    female,
    hair: female ? ['long', 'pony', 'bob'][rr(3)] : ['spiky', 'neat'][rr(2)],
    garment: female ? 'sailor' : 'gakuran',
    over,
    tasuki: female && str >= 65,
    head: strong ? (female ? 'hachigane' : 'hachimaki') : null,
    glasses: int >= 80,
    kuma: str >= 80,
    str,
    color,
    clan,
    bg: PORTRAIT_BG[rr(3)],
  };
}

function portrait(g, size = 48, mood = null, dir = 'L') {
  const o = portraitOptions(g);
  o.mood = MOOD_MAP[mood] || 'normal';
  o.dir = dir;
  o.small = size <= 56;
  // 丸い枠や四角い枠に収まるよう、上下を少し切って正方形にする
  return UKIYO.bust(o)
    .replace('<svg viewBox="0 0 200 220"', `<svg class="portrait" width="${size}" height="${size}" viewBox="0 ${o.small ? 6 : 14} 200 200"`);
}
