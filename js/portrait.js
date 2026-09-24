// 武将の顔（制服姿の胸像）
// look（数値）から、顔の形・目・髪型・制服などを決める。能力値で表情や小物が変わる
const SKIN_TONES = [['#f7dcc4', '#e9c0a2'], ['#f1cfb1', '#dfb48f'], ['#e9c19e', '#d4a57f'], ['#f4d4b8', '#e2b797'], ['#e2b48f', '#c99670']];
const HAIR_COLORS = [['#1b1818', '#4a4040'], ['#2a1f1a', '#5a4436'], ['#3b2a1f', '#6e5240'], ['#141414', '#3d3d45'], ['#4a3326', '#7d5c45'], ['#2c2433', '#564a66']];

// mood：会談などで表情を変える（'happy' 笑顔 / 'angry' 怒り / 'think' 思案）。省略すると能力値で決まる
function portrait(g, size = 48, mood = null) {
  const r = seeded((g.look || 1) * 7 + 3);
  const rr = (n) => Math.floor(r() * n);
  const [skin, skinShade] = SKIN_TONES[rr(SKIN_TONES.length)];
  const [hair, hairHi] = HAIR_COLORS[rr(HAIR_COLORS.length)];
  const clan = CLANS[g.clan] ? g.clan : g.origin && CLANS[g.origin] ? g.origin : 'none';
  const color = CLANS[clan].color;
  const f = !!g.female;
  const faceType = rr(3);
  const eyeType = rr(4);
  const style = rr(6);
  const blazer = hashStr(g.school || 'x') % 3 === 0; // 学校によってブレザー
  const ribbon = f && r() < 0.4;

  // ---------- 体と制服 ----------
  const shoulders = 'M-28,34 Q-27,13 0,11 Q27,13 28,34 Z';
  let body;
  if (!f && !blazer) { // 学ラン
    body = `<path d="${shoulders}" fill="#1f2230"/>
      <path d="M-7,10.5 L-7,16 L7,16 L7,10.5" fill="#1f2230" stroke="#3b3f52" stroke-width="0.8"/>
      <circle cx="0" cy="21" r="1.4" fill="#e3bd55"/><circle cx="0" cy="27" r="1.4" fill="#e3bd55"/>
      <rect x="4" y="12" width="2.2" height="2.2" fill="#e3bd55"/>`;
  } else if (!f) { // ブレザー（男子）
    body = `<path d="${shoulders}" fill="#2b3a5c"/>
      <path d="M-7,11 L0,25 L7,11 Z" fill="#f4f4f0"/>
      <path d="M-1.8,13 L1.8,13 L2.6,24 L0,27 L-2.6,24 Z" fill="${color}"/>
      <path d="M-7,11 L-2,26 M7,11 L2,26" stroke="#1e2a45" stroke-width="1.2"/>`;
  } else if (!blazer) { // セーラー服
    body = `<path d="${shoulders}" fill="#26325c"/>
      <path d="M-16,13 L0,26 L16,13 L12,12 L0,21 L-12,12 Z" fill="#f4f4f0"/>
      <path d="M-14,14.5 L0,24 L14,14.5" fill="none" stroke="#26325c" stroke-width="0.7"/>
      <path d="M-5,23 L5,23 L2,26 L4,31 L0,28 L-4,31 L-2,26 Z" fill="${color}"/>`;
  } else { // ブレザー（女子）
    body = `<path d="${shoulders}" fill="#3a3350"/>
      <path d="M-6,11 L0,22 L6,11 Z" fill="#f4f4f0"/>
      <path d="M-5,15 L0,17.5 L5,15 L5,19 L0,17.5 L-5,19 Z" fill="${color}"/>`;
  }

  // ---------- 髪（後ろ・前） ----------
  let back = '', front = '';
  const hl = `stroke="${hairHi}" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"`;
  if (f) {
    const bangs = `<path d="M-12,-2 Q-12,-18 0,-18.5 Q12,-18 12,-2 Q9,-9 5,-10.5 Q3,-7 0,-9.5 Q-4,-7 -6,-10.5 Q-10,-8 -12,-2 Z" fill="${hair}"/>`;
    const straight = `<path d="M-12,-4 Q-12,-18.5 0,-18.5 Q12,-18.5 12,-4 L11,-6 L-11,-6 Z" fill="${hair}"/>`;
    switch (style) {
      case 0: // ロング
        back = `<path d="M-14,-2 Q-15,-21 0,-21 Q15,-21 14,-2 L15,25 L-15,25 Z" fill="${hair}"/>`;
        front = bangs + `<path d="M-12,-4 L-13.5,12 L-10,7 Z M12,-4 L13.5,12 L10,7 Z" fill="${hair}"/>`;
        break;
      case 1: // ボブ
        back = `<path d="M-14.5,-2 Q-15.5,-21 0,-21 Q15.5,-21 14.5,-2 L14.5,9 Q0,12 -14.5,9 Z" fill="${hair}"/>`;
        front = straight;
        break;
      case 2: // ポニーテール
        back = `<path d="M8,-15 Q25,-10 17,17 Q13,5 8,-4 Z" fill="${hair}"/>`;
        front = bangs + `<rect x="7.5" y="-15.5" width="3.5" height="3" rx="1" fill="${color}"/>`;
        break;
      case 3: // ツインテール
        back = `<path d="M-11,-11 Q-25,0 -17,19 Q-14,6 -10,-3 Z M11,-11 Q25,0 17,19 Q14,6 10,-3 Z" fill="${hair}"/>`;
        front = straight + `<circle cx="-11.5" cy="-11" r="2" fill="${color}"/><circle cx="11.5" cy="-11" r="2" fill="${color}"/>`;
        break;
      case 4: // おだんご
        back = `<circle cx="0" cy="-20" r="5.5" fill="${hair}"/><path d="M-13.5,-2 Q-14,-20 0,-20 Q14,-20 13.5,-2 L13,3 L-13,3 Z" fill="${hair}"/>`;
        front = bangs;
        break;
      default: // サイドテール
        back = `<path d="M-10,-15 Q-27,-6 -18,17 Q-15,4 -10,-3 Z" fill="${hair}"/>`;
        front = bangs + `<rect x="-12" y="-15" width="3.5" height="3" rx="1" fill="${color}" transform="rotate(-20 -10 -13)"/>`;
    }
    if (ribbon && style !== 3) front += `<path d="M5,-18 L10,-21 L10,-15 Z M5,-18 L0,-21 L0,-15 Z" fill="${color}"/><circle cx="5" cy="-18" r="1.3" fill="${color}"/>`;
    front += `<path d="M-6,-15 Q-2,-17 3,-16" ${hl}/>`;
  } else {
    switch (style) {
      case 0: // 短髪
        front = `<path d="M-12,-3 Q-13,-19.5 0,-19.5 Q13,-19.5 12,-3 Q10,-11 4,-12 Q-2,-9 -7,-12 Q-10,-10 -12,-3 Z" fill="${hair}"/>`;
        break;
      case 1: // つんつん
        front = `<path d="M-12,-3 L-14.5,-12 L-10,-11 L-11,-18 L-6,-14.5 L-4,-21.5 L0,-15.5 L4,-22 L6,-14.5 L11,-19 L10,-11 L14.5,-12 L12,-3 Q8,-10 0,-10 Q-8,-10 -12,-3 Z" fill="${hair}"/>`;
        break;
      case 2: // 七三
        front = `<path d="M-12,-2 Q-13,-19.5 1,-19.5 Q13,-18.5 12,-3 Q10,-10 4,-11 L-3,-13.5 Q-8,-9 -12,-2 Z" fill="${hair}"/>
          <path d="M-3,-13.5 L-1,-19" stroke="${hairHi}" stroke-width="0.8"/>`;
        break;
      case 3: // 坊主
        front = `<path d="M-11.5,-5 Q-11,-16.5 0,-17 Q11,-16.5 11.5,-5 Q6,-10 0,-10 Q-6,-10 -11.5,-5 Z" fill="${hair}" opacity="0.8"/>`;
        break;
      case 4: // ちょんまげ風に結った髪
        front = `<path d="M-12,-3 Q-13,-19 0,-19 Q13,-19 12,-3 Q9,-12 0,-12.5 Q-9,-12 -12,-3 Z" fill="${hair}"/>
          <ellipse cx="0" cy="-21" rx="3" ry="3.8" fill="${hair}"/><rect x="-2.6" y="-19.5" width="5.2" height="1.6" fill="${color}"/>`;
        break;
      default: // オールバックで後ろに結ぶ
        back = `<path d="M-12,-2 Q-14,-19 0,-20 Q14,-19 12,-2 L12.5,9 L-12.5,9 Z" fill="${hair}"/>`;
        front = `<path d="M-12,-4 Q-10,-18 0,-18 Q10,-18 12,-4 Q6,-13.5 0,-13.5 Q-6,-13.5 -12,-4 Z" fill="${hair}"/>`;
    }
    front += `<path d="M-7,-16 Q-2,-18 4,-17" ${hl}/>`;
  }

  // ---------- 顔 ----------
  const faceShape = faceType === 0
    ? '<ellipse cx="0" cy="-2" rx="11.5" ry="12.8" fill="SKIN"/>'
    : faceType === 1
      ? '<ellipse cx="0" cy="-2" rx="10.6" ry="13.6" fill="SKIN"/>'
      : '<path d="M-11,-6 Q-11,-17.5 0,-17.5 Q11,-17.5 11,-6 L10.2,3 Q7,10.5 0,11.8 Q-7,10.5 -10.2,3 Z" fill="SKIN"/>';
  const ears = f && (style === 0 || style === 1) ? '' : `<ellipse cx="-11.2" cy="-1" rx="2" ry="3.4" fill="${skin}"/><ellipse cx="11.2" cy="-1" rx="2" ry="3.4" fill="${skin}"/>`;

  // 目：タイプごとに形を変え、ハイライトを入れる
  const eye = (x) => {
    const s = x < 0 ? -1 : 1;
    switch (eyeType) {
      case 0: // 丸い目
        return `<ellipse cx="${x}" cy="-1.5" rx="2.2" ry="2.5" fill="#fff"/><circle cx="${x}" cy="-1.2" r="1.7" fill="#2a1c16"/><circle cx="${x + 0.6}" cy="-2" r="0.6" fill="#fff"/>`;
      case 1: // 細い目
        return `<path d="M${x - 2.6},-1.3 Q${x},-2.8 ${x + 2.6},-1.3" stroke="#2a1c16" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
      case 2: // 切れ長
        return `<path d="M${x - 2.8},-1 L${x + 2.6},${-2.4 * 1}" stroke="#2a1c16" stroke-width="1.1" stroke-linecap="round"/>
          <ellipse cx="${x + 0.2 * s}" cy="-0.6" rx="1.3" ry="1.4" fill="#2a1c16"/><circle cx="${x + 0.6}" cy="-1" r="0.4" fill="#fff"/>`;
      default: // たれ目
        return `<path d="M${x - 2.6},-2.2 Q${x},-3.4 ${x + 2.6},-1.4" stroke="#2a1c16" stroke-width="1" fill="none" stroke-linecap="round"/>
          <ellipse cx="${x}" cy="-0.8" rx="1.5" ry="1.7" fill="#2a1c16"/><circle cx="${x + 0.5}" cy="-1.3" r="0.5" fill="#fff"/>`;
    }
  };
  // 眉：統率が高いとつり上がり、低いと下がる
  let tilt = g.str >= 75 ? 2 : g.str < 45 ? -1.2 : 0.6;
  if (mood === 'angry') tilt = 3.2;
  if (mood === 'happy') tilt = -1.5;
  // 思案顔は片方の眉だけ上げる
  const tiltR = mood === 'think' ? -2 : tilt;
  const brows = `<path d="M-8.5,${-5.4 - tilt} L-2.6,${mood === 'angry' ? -4.2 : -5}" stroke="${hair}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8.5,${-5.4 - tiltR} L2.6,${mood === 'angry' ? -4.2 : -5}" stroke="${hair}" stroke-width="1.5" stroke-linecap="round"/>`;
  const nose = `<path d="M0.2,1 L-0.8,4 L0.8,4.3" stroke="${skinShade}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  // 口：魅力が高いと笑顔、統率が高いと不敵な笑み
  let mouth;
  if (g.cha >= 72) mouth = '<path d="M-3,6.6 Q0,10 3,6.6 Z" fill="#9c3b35"/><path d="M-2.4,6.9 L2.4,6.9" stroke="#fff" stroke-width="0.8"/>';
  else if (g.str >= 78) mouth = '<path d="M-2.8,7.2 Q0.5,8.6 3,6.4" stroke="#7a3a30" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  else if (g.cha >= 55) mouth = '<path d="M-2.6,7 Q0,8.6 2.6,7" stroke="#8a4a3a" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  else mouth = '<path d="M-2.2,7.6 L2.2,7.6" stroke="#8a4a3a" stroke-width="1.1" stroke-linecap="round"/>';
  if (mood === 'happy') mouth = '<path d="M-3.4,6.2 Q0,10.4 3.4,6.2 Z" fill="#9c3b35"/><path d="M-2.8,6.5 L2.8,6.5" stroke="#fff" stroke-width="0.8"/>';
  if (mood === 'angry') mouth = '<path d="M-3,8.6 Q0,6.2 3,8.6" stroke="#7a3a30" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
  if (mood === 'think') mouth = '<path d="M-1.6,7.6 Q1,7 2.4,7.9" stroke="#8a4a3a" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  const vein = mood === 'angry' ? '<path d="M7,-12 l2,1.4 M8.6,-13.4 l-0.2,2.4 M9.8,-12.2 l-2.2,0.2" stroke="#c0392b" stroke-width="0.9" stroke-linecap="round"/>' : '';
  const sweat = mood === 'think' ? '<path d="M-11.5,-9 Q-12.8,-6.5 -11.5,-5.6 Q-10.2,-6.5 -11.5,-9 Z" fill="#9fd3f0" stroke="#5a9cc4" stroke-width="0.4"/>' : '';
  const blush = mood === 'happy' || g.cha >= 65 ? '<ellipse cx="-6.8" cy="3.6" rx="2.2" ry="1.2" fill="#f08a8a" opacity="0.35"/><ellipse cx="6.8" cy="3.6" rx="2.2" ry="1.2" fill="#f08a8a" opacity="0.35"/>' : '';

  // ---------- 小物 ----------
  let extra = '';
  if (g.str >= 75) { // 鉢巻
    extra += `<path d="M-12.4,-11 Q0,-13.5 12.4,-11 L12.4,-7.8 Q0,-10.3 -12.4,-7.8 Z" fill="${color}"/>
      <path d="M11.5,-10 L18,-13 L16.5,-8.5 Z M11.5,-9 L17,-6 L13,-5.5 Z" fill="${color}"/>`;
  }
  if (g.int >= 80) { // 眼鏡
    extra += `<g fill="none" stroke="#2b2b30" stroke-width="0.9"><rect x="-8" y="-4.3" width="6.8" height="5.4" rx="1.8"/>
      <rect x="1.2" y="-4.3" width="6.8" height="5.4" rx="1.8"/><path d="M-1.2,-2 L1.2,-2 M-8,-2 L-11,-3 M8,-2 L11,-3"/></g>
      <path d="M-7,-3.6 L-5,-3.6" stroke="#fff" stroke-width="0.6" opacity="0.8"/>`;
  }
  if (g.lord) { // 当主：兜の三日月の前立て
    extra += `<path d="M-10,-22 Q0,-37 10,-22 Q0,-30 -10,-22 Z" fill="#e3bd55" stroke="#9a7a24" stroke-width="0.6"/>
      <circle cx="0" cy="-21" r="1.8" fill="#9a7a24"/>`;
  }

  const gid = `pbg-${clan}`;
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="-30 -30 60 60" aria-hidden="true">
    <defs><radialGradient id="${gid}" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="${color}" stop-opacity="0.55"/></radialGradient></defs>
    <rect x="-30" y="-30" width="60" height="60" fill="url(#${gid})"/>
    ${back}${body}
    <path d="M-4.5,6 L-4.5,13 Q0,15 4.5,13 L4.5,6 Z" fill="${skinShade}"/>
    ${ears}${faceShape.replace('SKIN', skin)}
    <path d="M-10,-8 Q0,-4.5 10,-8 L10,-10 L-10,-10 Z" fill="${skinShade}" opacity="0.35"/>
    ${front}${brows}${eye(-4.6)}${eye(4.6)}${nose}${mouth}${blush}${extra}${vein}${sweat}
  </svg>`;
}
