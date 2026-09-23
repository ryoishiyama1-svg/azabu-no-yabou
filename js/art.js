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

// ---------- 武将の顔 ----------
// look（数値）から髪型や肌の色を決めて、制服姿の胸像を描く
function portrait(g, size = 48) {
  const r = seeded(g.look + 7);
  const skin = ['#f6d7bd', '#efc9a6', '#e8bd97', '#f3d0b0'][Math.floor(r() * 4)];
  const hair = ['#1d1a1a', '#2b211c', '#3d2b20', '#141414', '#4a3326'][Math.floor(r() * 5)];
  const style = Math.floor(r() * 4);
  const clan = CLANS[g.clan] ? g.clan : g.origin && CLANS[g.origin] ? g.origin : 'none';
  const color = CLANS[clan].color;
  const f = g.female;
  let back = '', front = '', body, extra = '';

  if (f) {
    if (style === 0) back = `<path d="M-14,-2 Q-15,-19 0,-19 Q15,-19 14,-2 L15,22 L-15,22 Z" fill="${hair}"/>`;
    if (style === 1) back = `<path d="M-14,-2 Q-15,-19 0,-19 Q15,-19 14,-2 L14,8 Q0,12 -14,8 Z" fill="${hair}"/>`;
    if (style === 2) back = `<path d="M9,-12 Q22,-8 17,14 Q14,4 9,-2 Z" fill="${hair}"/>`;
    if (style === 3) back = `<circle cx="0" cy="-17" r="5.5" fill="${hair}"/><path d="M-13,-2 Q-14,-18 0,-18 Q14,-18 13,-2 L13,4 L-13,4 Z" fill="${hair}"/>`;
    front = `<path d="M-12,-2 Q-12,-17 0,-17 Q12,-17 12,-2 Q7,-10 1,-8 Q-5,-11 -12,-2 Z" fill="${hair}"/>`;
    body = `<path d="M-27,32 Q-25,13 0,12 Q25,13 27,32 Z" fill="#26325c"/>
      <path d="M-15,13 L0,25 L15,13" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="M-4,22 L4,22 L0,29 Z" fill="${color}"/>`;
  } else {
    if (style === 0) front = `<path d="M-12,-3 Q-13,-18 0,-18 Q13,-18 12,-3 Q9,-11 0,-11 Q-9,-11 -12,-3 Z" fill="${hair}"/>`;
    if (style === 1) front = `<path d="M-12,-3 L-13,-14 L-9,-12 L-8,-19 L-4,-14 L0,-21 L4,-14 L8,-19 L9,-12 L13,-14 L12,-3 Q6,-10 0,-10 Q-6,-10 -12,-3 Z" fill="${hair}"/>`;
    if (style === 2) front = `<path d="M-12,-2 Q-13,-18 1,-18 Q13,-17 12,-3 Q10,-9 3,-10 Q-6,-13 -12,-2 Z" fill="${hair}"/>`;
    if (style === 3) front = `<path d="M-11.5,-5 Q-11,-15 0,-15.5 Q11,-15 11.5,-5 Q6,-9 0,-9 Q-6,-9 -11.5,-5 Z" fill="${hair}" opacity="0.85"/>`;
    body = `<path d="M-27,32 Q-25,13 0,12 Q25,13 27,32 Z" fill="#1e2029"/>
      <path d="M-6,12 L-6,17 L6,17 L6,12" fill="#1e2029" stroke="#3a3d4d" stroke-width="1"/>
      <circle cx="0" cy="22" r="1.6" fill="#d4a93c"/><circle cx="0" cy="28" r="1.6" fill="#d4a93c"/>`;
  }
  if (g.str >= 75) {
    extra += `<rect x="-12.5" y="-10.5" width="25" height="3.5" fill="${color}"/>
      <path d="M11,-9 L17,-12 L16,-7 Z" fill="${color}"/>`;
  }
  const brow = g.str >= 70 ? 1.8 : 0;
  const face = `
    <path d="M-8.5,${-5 - brow} L-2.5,-4.5 M8.5,${-5 - brow} L2.5,-4.5" stroke="${hair}" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="-4.5" cy="-1" rx="1.3" ry="1.7" fill="#222"/>
    <ellipse cx="4.5" cy="-1" rx="1.3" ry="1.7" fill="#222"/>
    <path d="M-2.5,6 Q0,${g.cha >= 70 ? 8 : 6.6} 2.5,6" stroke="#8a4a3a" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  const glasses = g.int >= 80
    ? '<g fill="none" stroke="#333" stroke-width="1"><circle cx="-4.5" cy="-1" r="3.4"/><circle cx="4.5" cy="-1" r="3.4"/><path d="M-1.1,-1 L1.1,-1"/></g>'
    : '';
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="-30 -30 60 60" aria-hidden="true">
    <rect x="-30" y="-30" width="60" height="60" fill="${color}" opacity="0.28"/>
    ${back}${body}
    <rect x="-4" y="7" width="8" height="7" fill="${skin}"/>
    <ellipse cx="0" cy="-2" rx="11" ry="13" fill="${skin}"/>
    ${front}${extra}${face}${glasses}
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
