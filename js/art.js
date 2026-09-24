// 絵を描く部分（家紋・天守閣・地図の風景・領地）。画像ファイルは使わずSVGで描く

// ---------- 家紋 ----------
// viewBox -30..30 の中に描く。fg = 紋の色
function crestInner(kind, fg) {
  const ring = `<circle r="26" fill="none" stroke="${fg}" stroke-width="3.5"/>`;
  const rot = (n, step, d) => Array.from({ length: n }, (_, k) => `<path d="${d}" transform="rotate(${k * step})" fill="${fg}"/>`).join('');
  switch (kind) {
    case 'asanoha': // 麻の葉
      return ring + rot(6, 60, 'M0,0 L5.5,-10 L0,-21 L-5.5,-10 Z') +
        Array.from({ length: 6 }, (_, k) => `<line x1="0" y1="-21" x2="0" y2="-26" stroke="${fg}" stroke-width="2" transform="rotate(${k * 60 + 30})"/>`).join('');
    case 'kuyo': // 九曜
      return ring + `<circle r="7.5" fill="${fg}"/>` +
        Array.from({ length: 8 }, (_, k) => {
          const a = (k * Math.PI) / 4;
          return `<circle cx="${(Math.sin(a) * 16).toFixed(1)}" cy="${(-Math.cos(a) * 16).toFixed(1)}" r="5" fill="${fg}"/>`;
        }).join('');
    case 'tomoe': // 三つ巴
      return ring + rot(3, 120, 'M0,-6 A7,7 0 1,1 0,-20 C9,-20 18,-12 19,1 C14,-8 8,-6 0,-6 Z');
    case 'kikyo': // 桔梗
      return ring + rot(5, 72, 'M0,-2 C7,-6 10,-15 5,-21 L0,-17 L-5,-21 C-10,-15 -7,-6 0,-2 Z') + `<circle r="2.5" fill="${fg}"/>`;
    case 'hishi': // 四つ割菱
      return ring + rot(4, 90, 'M0,-2 L7.5,-10.5 L0,-19 L-7.5,-10.5 Z');
    case 'hiki': // 丸に二つ引
      return ring + `<rect x="-22" y="-10" width="44" height="6" fill="${fg}"/><rect x="-22" y="4" width="44" height="6" fill="${fg}"/>`;
    default: // 丸
      return ring + `<circle r="6" fill="${fg}"/>`;
  }
}

// 色つきの丸に白い紋
function crestBadge(clan, size = 20) {
  const c = CLANS[clan];
  return `<svg class="crest" width="${size}" height="${size}" viewBox="-30 -30 60 60" aria-hidden="true">
    <circle r="30" fill="${c.color}"/>${crestInner(c.crest, '#fff')}</svg>`;
}

// ---------- 一騎打ちの舞台：夕日の野原。両軍の旗が風になびく ----------
function duelScene(clanA, clanD) {
  const flag = (x, clan, flip) => {
    const c = CLANS[clan] ? CLANS[clan].color : '#777';
    const d = flip ? -1 : 1;
    return `<g class="du-flag" transform="translate(${x},0)">
      <line x1="0" y1="62" x2="0" y2="128" stroke="#3a2616" stroke-width="2"/>
      <path d="M0,62 Q${9 * d},60 ${18 * d},64 L${18 * d},96 Q${9 * d},92 0,96 Z" fill="${c}"/>
    </g>`;
  };
  return `<svg class="du-scene" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="du-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3b2446"/><stop offset="0.45" stop-color="#c1553a"/><stop offset="0.8" stop-color="#f2a65a"/>
      </linearGradient>
      <radialGradient id="du-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c4"/><stop offset="0.6" stop-color="#f7c35f"/><stop offset="1" stop-color="#f7c35f" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="320" height="160" fill="url(#du-sky)"/>
    <circle cx="160" cy="104" r="46" fill="url(#du-sun)"/>
    <circle cx="160" cy="104" r="22" fill="#fde7a6"/>
    <path d="M0,112 L40,94 L78,106 L120,88 L160,104 L205,86 L250,102 L290,90 L320,100 L320,160 L0,160 Z" fill="#5a2f35" opacity="0.8"/>
    <path d="M0,124 Q80,112 160,120 Q240,128 320,116 L320,160 L0,160 Z" fill="#2d2019"/>
    <g stroke="#4b3a22" stroke-width="1.2" opacity="0.8">${Array.from({ length: 26 }, (_, i) => {
      const x = 6 + i * 12.4, h = 5 + (i * 7) % 8;
      return `<path d="M${x},${140 + (i % 3) * 5} q2,-${h} 5,-${h + 2}"/>`;
    }).join('')}</g>
    ${flag(22, clanA, false)}${flag(40, clanA, false)}${flag(298, clanD, true)}${flag(280, clanD, true)}
    <g class="du-birds" fill="none" stroke="#2a1a24" stroke-width="1.2"><path d="M110,34 q4,-4 8,0 q4,-4 8,0"/><path d="M200,24 q3,-3 6,0 q3,-3 6,0"/></g>
  </svg>`;
}

// ---------- 会談の部屋（相手の生徒会室。床の間に相手の家紋の掛け軸） ----------
function meetingRoom(clan) {
  const c = CLANS[clan];
  const shoji = (x) => `<rect x="${x}" y="12" width="78" height="98" fill="#fbf6e6"/>
    ${[1, 2, 3].map((i) => `<line x1="${x + i * 19.5}" y1="12" x2="${x + i * 19.5}" y2="110" stroke="#8a6a44" stroke-width="1"/>`).join('')}
    ${[1, 2, 3, 4, 5].map((i) => `<line x1="${x}" y1="${12 + i * 16.3}" x2="${x + 78}" y2="${12 + i * 16.3}" stroke="#8a6a44" stroke-width="1"/>`).join('')}
    <rect x="${x}" y="12" width="78" height="98" fill="none" stroke="#5b3f22" stroke-width="3"/>`;
  return `<svg class="mt-room" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="mt-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dbb8"/><stop offset="1" stop-color="#d9c79d"/></linearGradient>
      <linearGradient id="mt-light" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="320" height="160" fill="url(#mt-wall)"/>
    ${shoji(2)}${shoji(240)}
    <rect x="0" y="0" width="320" height="12" fill="#4a3220"/>
    <rect x="0" y="108" width="320" height="4" fill="#4a3220"/>
    <rect x="98" y="16" width="124" height="92" fill="#cbb488"/>
    <rect x="98" y="16" width="124" height="92" fill="none" stroke="#4a3220" stroke-width="3"/>
    <rect x="96" y="100" width="128" height="8" fill="#6b4a2c"/>
    <!-- 掛け軸 -->
    <rect x="140" y="20" width="40" height="3" rx="1.5" fill="#3a2a1a"/>
    <rect x="143" y="23" width="34" height="70" fill="#f3ead2" stroke="#9a7a4a" stroke-width="0.8"/>
    <rect x="143" y="23" width="34" height="8" fill="${c.color}" opacity="0.8"/>
    <g transform="translate(160,55) scale(0.42)"><circle r="30" fill="${c.color}"/>${crestInner(c.crest, '#fff')}</g>
    <rect x="140" y="92" width="40" height="3" rx="1.5" fill="#3a2a1a"/>
    <!-- 生け花 -->
    <path d="M198,100 Q196,92 200,88 L206,88 Q210,92 208,100 Z" fill="#5a6f86"/>
    <path d="M203,88 Q200,70 188,62 M203,88 Q210,74 214,70 M203,88 Q204,78 198,74" stroke="#5b4630" stroke-width="1.2" fill="none"/>
    <g fill="#e89aac"><circle cx="188" cy="62" r="2.4"/><circle cx="214" cy="70" r="2.2"/><circle cx="198" cy="74" r="2"/><circle cx="193" cy="66" r="1.6"/></g>
    <!-- 畳 -->
    <rect x="0" y="112" width="320" height="48" fill="#c9bf86"/>
    <g stroke="#9f9660" stroke-width="0.6" opacity="0.6">${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${116 + i * 5}" x2="320" y2="${116 + i * 5}"/>`).join('')}</g>
    <path d="M0,136 L320,136 M106,112 L106,160 M214,112 L214,160" stroke="#3c4a2e" stroke-width="2.4"/>
    <!-- 座卓と茶 -->
    <path d="M112,128 L208,128 L216,138 L104,138 Z" fill="#5a3a22"/>
    <rect x="104" y="138" width="112" height="4" fill="#3e2716"/>
    <path d="M140,124 L148,124 L147,129 L141,129 Z M172,124 L180,124 L179,129 L173,129 Z" fill="#6f8a6a"/>
    <rect width="320" height="160" fill="url(#mt-light)"/>
  </svg>`;
}

// ---------- 天守閣 ----------
function castleMarkup(capital) {
  const shachi = capital
    ? '<circle cx="-5.5" cy="-24.5" r="1.8" fill="#e8c55a"/><circle cx="5.5" cy="-24.5" r="1.8" fill="#e8c55a"/>'
    : '';
  return `
    <ellipse class="shadow" cx="0" cy="15" rx="19" ry="4.5"/>
    <path class="stone" d="M-17,14 L17,14 L13,3 L-13,3 Z"/>
    <path class="stone-line" d="M-15,9 L15,9 M-8,3 L-9,14 M0,3 L0,14 M8,3 L9,14"/>
    <rect class="wall" x="-11" y="-4" width="22" height="8"/>
    <path class="roof" d="M-17,-2 Q-13,-4 -11,-9 L11,-9 Q13,-4 17,-2 Z"/>
    <rect class="wall" x="-7" y="-15" width="14" height="7"/>
    <rect class="window" x="-3" y="-13" width="6" height="3"/>
    <path class="roof" d="M-12,-13 Q-8,-15 -6,-22 L6,-22 Q8,-15 12,-13 Z"/>
    ${shachi}`;
}

// ---------- 合戦の絵 ----------
// 季節の空・遠くの山・攻める城を背景に、足軽の隊列がぶつかり合う
const BATTLE_SKY = [
  ['#f3b9c6', '#fbe4d6', '#8d6a86'], // 春：桜色の夕空
  ['#6fa5d8', '#f3d59e', '#4d6a8a'], // 夏：夏の夕方
  ['#e07a4a', '#f6cf98', '#7a4a3a'], // 秋：夕焼け
  ['#8497ad', '#dfe6ec', '#5a6878'], // 冬：雪空
];

// 足軽1人（右向き）。flip で左向き
function soldier(color, flip) {
  return `<g class="sol-art" transform="scale(${flip ? -1 : 1},1)">
    <line x1="1" y1="-4" x2="1" y2="-30" stroke="#5a3a1a" stroke-width="0.9"/>
    <rect x="1" y="-30" width="6" height="9" fill="${color}" stroke="#2a1a10" stroke-width="0.4"/>
    <line x1="4" y1="-10" x2="17" y2="-24" stroke="#6b5a40" stroke-width="1"/>
    <path d="M16,-25 L19,-27 L17.5,-23.5 Z" fill="#cfd6dc"/>
    <path d="M-3.5,0 L-1.5,-6 L1.5,-6 L3.5,0" stroke="#2a2420" stroke-width="1.6" fill="none"/>
    <path d="M-4,-6 L-3.5,-14 L3.5,-14 L4,-6 Z" fill="#3a2e28"/>
    <rect x="-4" y="-10.5" width="8" height="2" fill="${color}"/>
    <circle cx="0" cy="-16.5" r="2.6" fill="#e9c19e"/>
    <path d="M-5.5,-17 L0,-21 L5.5,-17 Z" fill="#2b2b2b"/>
  </g>`;
}

// side: 'a' = 攻める側（左）/ 'd' = 守る側（右）
function armyMarkup(side, n, color) {
  const out = [];
  const perRow = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    const scale = 0.85 + row * 0.12;          // 手前ほど大きく
    const y = 168 + row * 17;
    const x = side === 'a' ? 150 - col * 17 - row * 6 : 232 + col * 15 + row * 6;
    out.push(`<g transform="translate(${x},${y}) scale(${scale.toFixed(2)})"><g class="sol" data-i="${i}">${soldier(color, side === 'd')}</g></g>`);
  }
  return out.join('');
}

function battleScene(r, season) {
  const [skyTop, skyBottom, mount] = BATTLE_SKY[season % 4];
  const ca = CLANS[r.attacker].color, cd = CLANS[r.defender].color;
  const na = clamp(Math.round(r.rounds[0].a / 180), 4, 18);
  const nd = clamp(Math.round(r.rounds[0].d / 180), 3, 15);
  const banner = (x, y, h, clan, flip) => `<g transform="translate(${x},${y})">
      <line x1="0" y1="0" x2="0" y2="${-h}" stroke="#3a200c" stroke-width="1.6"/>
      <rect x="${flip ? -12 : 0}" y="${-h}" width="12" height="${h * 0.62}" fill="${CLANS[clan].color}"/>
      <svg x="${flip ? -11 : 1}" y="${-h + 2}" width="10" height="10" viewBox="-30 -30 60 60">${crestInner(CLANS[clan].crest, '#fff')}</svg>
    </g>`;
  const snow = season % 4 === 3
    ? Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 37) % 400}" cy="${(i * 53) % 150}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity="0.8"/>`).join('')
    : '';
  const petalsBg = season % 4 === 0
    ? Array.from({ length: 14 }, (_, i) => `<ellipse cx="${(i * 61) % 400}" cy="${(i * 29) % 140}" rx="2" ry="1.3" fill="#f6b9c8" opacity="0.9"/>`).join('')
    : '';
  return `<svg class="bf" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
      <linearGradient id="bf-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c6a45"/><stop offset="1" stop-color="#4a3d28"/></linearGradient>
      <clipPath id="bf-clip"><rect width="400" height="220" rx="10"/></clipPath>
    </defs>
    <g clip-path="url(#bf-clip)">
    <rect width="400" height="220" fill="url(#bf-sky)"/>
    <circle cx="80" cy="52" r="20" fill="#fff4d0" opacity="0.75"/>
    ${snow}${petalsBg}
    <path d="M0,130 L40,96 L70,112 L110,78 L150,110 L190,90 L230,118 L270,86 L320,114 L360,92 L400,118 L400,150 L0,150 Z" fill="${mount}" opacity="0.55"/>
    <path d="M0,142 Q60,120 120,138 T240,134 T400,130 L400,160 L0,160 Z" fill="${mount}" opacity="0.8"/>
    <g transform="translate(340,118) scale(2.1)" class="bf-castle" style="--c:${cd}">${castleMarkup(false)}</g>
    <g class="bf-fire" id="bf-fire">
      <path d="M322,96 Q326,80 331,92 Q334,74 340,90 Q345,78 348,95 Z" fill="#ff8a2a"/>
      <path d="M328,98 Q331,88 335,95 Q338,84 342,96 Z" fill="#ffd34a"/>
    </g>
    <rect y="150" width="400" height="70" fill="url(#bf-ground)"/>
    <path d="M0,158 L400,154 M0,176 L400,170 M0,198 L400,194" stroke="#8d7a52" stroke-width="0.6" opacity="0.5"/>
    ${banner(30, 160, 58, r.attacker, false)}${banner(58, 164, 50, r.attacker, false)}
    ${banner(372, 160, 50, r.defender, true)}
    <g class="army" id="army-a">${armyMarkup('a', na, ca)}</g>
    <g class="army" id="army-d">${armyMarkup('d', nd, cd)}</g>
    <g id="bf-arrows"></g>
    <g class="dust" id="bf-dust"><circle cx="190" cy="185" r="16"/><circle cx="205" cy="178" r="12"/><circle cx="178" cy="176" r="10"/></g>
    </g>
    <rect x="1.5" y="1.5" width="397" height="217" rx="9" fill="none" stroke="#d4a93c" stroke-width="3"/>
  </svg>`;
}

// 矢の一斉射撃（左→右 か 右→左）
function arrowVolley(fromLeft) {
  return Array.from({ length: 7 }, (_, i) => {
    const y = 120 + (i % 4) * 9, x = fromLeft ? 110 + (i % 3) * 12 : 260 - (i % 3) * 12;
    return `<line class="arrow ${fromLeft ? 'r' : 'l'}" style="animation-delay:${i * 0.04}s" x1="${x}" y1="${y}" x2="${x + (fromLeft ? 10 : -10)}" y2="${y - 3}" stroke="#2a1a10" stroke-width="1.1"/>`;
  }).join('');
}

// ---------- 地図の風景 ----------
function pathFrom(points, close) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + (close ? ' Z' : '');
}

// 点の列をなめらかな曲線にする
function smoothPath(points) {
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2, my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q${points[i].x.toFixed(1)},${points[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x.toFixed(1)},${last.y.toFixed(1)}`;
}

const RIVERS = [
  { name: '多摩川', label: 4, pts: [[35.76, 139.22], [35.70, 139.33], [35.665, 139.42], [35.648, 139.50], [35.628, 139.57], [35.61, 139.63], [35.585, 139.68], [35.565, 139.72], [35.545, 139.765]] },
  { name: '荒川', label: 3, pts: [[35.815, 139.64], [35.79, 139.70], [35.775, 139.75], [35.76, 139.80], [35.735, 139.83], [35.70, 139.845], [35.665, 139.85], [35.64, 139.845]] },
  { name: '隅田川', label: 4, pts: [[35.785, 139.72], [35.765, 139.765], [35.745, 139.79], [35.72, 139.80], [35.695, 139.796], [35.672, 139.787], [35.652, 139.776]] },
];

const BAY = [[35.53, 139.775], [35.56, 139.768], [35.59, 139.762], [35.62, 139.754], [35.636, 139.76], [35.645, 139.772],
  [35.642, 139.80], [35.646, 139.83], [35.65, 139.86], [35.655, 139.90], [35.60, 139.98], [35.45, 139.98], [35.45, 139.775]];

function sceneryMarkup() {
  const g = MAP.geo;
  const W = MAP.width, H = MAP.height;
  let s = '';

  // 山（多摩の奥）
  const hachi = MAP.byId.hachioji;
  const mx = hachi ? hachi.x - 40 : -9999, my = hachi ? hachi.y - 150 : -9999;
  if (hachi) s += `<g class="mountains" transform="translate(${mx},${my})">
    <path d="M-80,120 C-40,60 -20,20 20,0 C50,30 70,60 120,120 Z" fill="url(#mtn)"/>
    <path d="M40,120 C80,50 100,30 130,15 C160,45 190,80 230,120 Z" fill="url(#mtn)" opacity="0.8"/>
    <path d="M-20,120 C10,80 30,65 60,55 C90,75 110,95 140,120 Z" fill="url(#mtn)" opacity="0.6"/>
  </g>`;

  // 東京湾
  const bay = BAY.map(([la, lo]) => g(la, lo));
  s += `<path class="bay" d="${pathFrom(bay, true)}"/>`;
  s += `<path class="bay-waves" d="${pathFrom(bay, true)}"/>`;
  const bl = g(35.60, 139.86);
  s += `<text class="map-label sea" x="${bl.x}" y="${bl.y}">東京湾</text>`;

  // 川
  RIVERS.forEach((r) => {
    const pts = r.pts.map(([la, lo]) => g(la, lo));
    const d = smoothPath(pts);
    s += `<path class="river" d="${d}"/><path class="river-hi" d="${d}"/>`;
    const p = pts[r.label], q = pts[r.label + 1];
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const a = ang > 90 || ang < -90 ? ang + 180 : ang;
    s += `<text class="map-label river-name" transform="translate(${((p.x + q.x) / 2).toFixed(0)},${((p.y + q.y) / 2 - 8).toFixed(0)}) rotate(${a.toFixed(0)})">${r.name}</text>`;
  });

  // 金の霞（すやり霞）
  const clouds = [[W * 0.02, H * 0.82, 260], [W * 0.55, H * 0.03, 300], [W * 0.78, H * 0.22, 220], [W * 0.25, H * 0.06, 200]];
  clouds.forEach(([x, y, w]) => {
    s += `<g class="kasumi" transform="translate(${x.toFixed(0)},${y.toFixed(0)})">
      <rect x="0" y="0" width="${w}" height="22" rx="11"/><rect x="${w * 0.25}" y="16" width="${w * 0.6}" height="18" rx="9"/></g>`;
  });

  // 地域名
  const tama = MAP.nodes.filter((n) => n.ward.endsWith('市'));
  if (tama.length) {
    const avgX = tama.reduce((a, n) => a + n.x, 0) / tama.length;
    s += `<text class="map-label region" x="${avgX.toFixed(0)}" y="${(Math.max(...tama.map((n) => n.y)) + 90).toFixed(0)}">多 摩</text>`;
  }
  const ku = MAP.nodes.filter((n) => n.ward.endsWith('区'));
  const kx = ku.reduce((a, n) => a + n.x, 0) / ku.length;
  s += `<text class="map-label region" x="${kx.toFixed(0)}" y="46">${MAP_SCENARIO === 'toshin' ? '江 戸 都 心' : '江 戸 二 十 三 区'}</text>`;
  return s;
}

// ---------- 領地（ボロノイ図） ----------
// 各城から一番近い範囲を、その城の領地として塗る
function clipHalf(poly, px, py, nx, ny) {
  // 点 p を通り法線 n の側（n·(q-p) <= 0）だけ残す
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a.x - px) * nx + (a.y - py) * ny;
    const db = (b.x - px) * nx + (b.y - py) * ny;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function buildCells() {
  const R = 105;
  const cells = {};
  MAP.nodes.forEach((n) => {
    let poly = Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return { x: n.x + Math.cos(a) * R, y: n.y + Math.sin(a) * R };
    });
    MAP.nodes.forEach((o) => {
      if (o === n || Math.hypot(o.x - n.x, o.y - n.y) > R * 2) return;
      poly = clipHalf(poly, (n.x + o.x) / 2, (n.y + o.y) / 2, o.x - n.x, o.y - n.y);
    });
    cells[n.id] = pathFrom(poly, true);
  });
  return cells;
}

// ---------- タイトルの屏風絵 ----------
function titleArt() {
  return `<svg class="byobu" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f3dc92"/><stop offset="0.45" stop-color="#d9b04a"/>
        <stop offset="0.7" stop-color="#e9c96e"/><stop offset="1" stop-color="#b8892c"/>
      </linearGradient>
      <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1f2233"/><stop offset="1" stop-color="#1f2233" stop-opacity="0.55"/>
      </linearGradient>
      <pattern id="leaf" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" stroke="#a37a22" stroke-opacity="0.18" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="400" height="800" fill="url(#gold)"/>
    <rect width="400" height="800" fill="url(#leaf)"/>
    <circle cx="300" cy="170" r="62" fill="#c0303a"/>
    <g fill="#fff4d0" opacity="0.85">
      <rect x="-40" y="120" width="230" height="30" rx="15"/><rect x="40" y="140" width="160" height="26" rx="13"/>
      <rect x="230" y="245" width="220" height="28" rx="14"/><rect x="-30" y="600" width="260" height="30" rx="15"/>
      <rect x="200" y="640" width="240" height="26" rx="13"/>
    </g>
    <path d="M-20,560 L120,380 Q150,350 175,372 L330,560 Z" fill="url(#ink)"/>
    <path d="M112,392 Q150,345 185,385 L170,395 L158,382 L146,398 L132,384 L120,400 Z" fill="#fbf7ea"/>
    <path d="M180,560 L300,440 L420,560 Z" fill="#2a2d42" opacity="0.7"/>
    <g transform="translate(290,560) scale(3.2)" class="title-castle">
      <path d="M-17,14 L17,14 L13,3 L-13,3 Z" fill="#1f2233"/>
      <rect x="-11" y="-4" width="22" height="8" fill="#1f2233"/>
      <path d="M-17,-2 Q-13,-4 -11,-9 L11,-9 Q13,-4 17,-2 Z" fill="#1f2233"/>
      <rect x="-7" y="-15" width="14" height="7" fill="#1f2233"/>
      <path d="M-12,-13 Q-8,-15 -6,-22 L6,-22 Q8,-15 12,-13 Z" fill="#1f2233"/>
      <circle cx="-5.5" cy="-24.5" r="1.8" fill="#f3dc92"/><circle cx="5.5" cy="-24.5" r="1.8" fill="#f3dc92"/>
    </g>
    <rect y="600" width="400" height="200" fill="#1f2233" opacity="0.9"/>
    <g fill="#fff4d0" opacity="0.9">
      <rect x="-30" y="588" width="250" height="24" rx="12"/><rect x="190" y="596" width="260" height="20" rx="10"/>
    </g>
  </svg>`;
}
