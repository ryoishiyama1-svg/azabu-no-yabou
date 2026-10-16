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
    case 'uroko': // 三つ鱗
      return ring + `<path d="M0,-19 L9,-3 L-9,-3Z M-9.5,-1 L-0.5,15 L-18.5,15Z M9.5,-1 L18.5,15 L0.5,15Z" fill="${fg}"/>`;
    case 'umebachi': // 梅鉢
      return ring + Array.from({ length: 5 }, (_, k) => {
        const a = (k * 2 * Math.PI) / 5;
        return `<circle cx="${(Math.sin(a) * 12).toFixed(1)}" cy="${(-Math.cos(a) * 12).toFixed(1)}" r="6.5" fill="${fg}"/>`;
      }).join('') + `<circle r="4" fill="none" stroke="${fg}" stroke-width="2"/>`;
    case 'yuki': // 雪輪（六つの枝）
      return ring + rot(6, 60, 'M-2,0 L-2,-18 L2,-18 L2,0Z M0,-12 L-6,-18 L-4,-20 L0,-15 L4,-20 L6,-18Z') + `<circle r="4" fill="${fg}"/>`;
    case 'yotsume': // 四つ目
      return ring + [[-8, -8], [8, -8], [-8, 8], [8, 8]].map(([x, y]) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="none" stroke="${fg}" stroke-width="3.5" transform="rotate(45 ${x} ${y})"/>`).join('');
    case 'mokko': // 木瓜
      return ring + rot(4, 90, 'M0,-3 C8,-8 12,-18 0,-21 C-12,-18 -8,-8 0,-3Z') + `<circle r="4" fill="${fg}"/>`;
    case 'aoi': // 三つ葉葵
      return ring + rot(3, 120, 'M0,-2 C-10,-6 -12,-18 -4,-21 C-1,-22 0,-19 0,-17 C0,-19 1,-22 4,-21 C12,-18 10,-6 0,-2Z') + `<circle r="3" fill="${fg}"/>`;
    case 'kikkou': // 亀甲に花
      return ring + `<path d="M0,-20 L17,-10 L17,10 L0,20 L-17,10 L-17,-10Z" fill="none" stroke="${fg}" stroke-width="4"/>` + rot(4, 90, 'M0,0 C4,-4 4,-8 0,-10 C-4,-8 -4,-4 0,0Z');
    case 'sakura': // 桜
      return ring + rot(5, 72, 'M0,-3 C6,-8 8,-16 3,-21 L0,-18 L-3,-21 C-8,-16 -6,-8 0,-3Z') + `<circle r="2.5" fill="${fg}"/>`;
    case 'hoshi': // 三つ星
      return ring + [[0, -10], [-9, 6], [9, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${fg}"/>`).join('') + `<rect x="-20" y="16" width="40" height="4" fill="${fg}"/>`;
    case 'jyuji': // 丸に十字
      return ring + `<rect x="-3.5" y="-20" width="7" height="40" fill="${fg}"/><rect x="-20" y="-3.5" width="40" height="7" fill="${fg}"/>`;
    case 'nami': // 丸に波
      return ring + `<path d="M-21,6 q5,-12 10.5,0 q5,-12 10.5,0 q5,-12 10.5,0 q5,-12 10.5,0 M-21,-6 q5,-12 10.5,0 q5,-12 10.5,0 q5,-12 10.5,0 q5,-12 10.5,0" fill="none" stroke="${fg}" stroke-width="4" stroke-linecap="round"/>
        <path d="M-18,14 H18" stroke="${fg}" stroke-width="4" stroke-linecap="round"/>`;
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
      <line x1="0" y1="62" x2="0" y2="128" stroke="#1c1a17" stroke-width="2.4"/>
      <path d="M0,62 Q${9 * d},60 ${18 * d},64 L${18 * d},96 Q${9 * d},92 0,96 Z" fill="${c}" stroke="#1c1a17" stroke-width="1.4"/>
    </g>`;
  };
  // 武者絵の背景：朱の地に山吹の集中線、墨の地面。両軍の旗が風になびく
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return `<path d="M160,96 L${(160 + Math.cos(a) * 260).toFixed(0)},${(96 + Math.sin(a) * 260).toFixed(0)} L${(160 + Math.cos(a + 0.09) * 260).toFixed(0)},${(96 + Math.sin(a + 0.09) * 260).toFixed(0)} Z"/>`;
  }).join('');
  return `<svg class="du-scene" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="du-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22406b"/><stop offset="1" stop-color="#22406b" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="320" height="160" fill="#c8372d"/>
    <g fill="#e0a526" opacity="0.9">${rays}</g>
    <rect width="320" height="46" fill="url(#du-sky)" opacity="0.85"/>
    <path d="M0,124 Q80,114 160,120 Q240,126 320,116 L320,160 L0,160 Z" fill="#3a2c20" stroke="#1c1a17" stroke-width="2.5"/>
    <g stroke="#6b5a3a" stroke-width="1.4">${Array.from({ length: 26 }, (_, i) => {
      const x = 6 + i * 12.4, h = 5 + (i * 7) % 8;
      return `<path d="M${x},${140 + (i % 3) * 5} q2,-${h} 5,-${h + 2}" fill="none"/>`;
    }).join('')}</g>
    ${flag(22, clanA, false)}${flag(40, clanA, false)}${flag(298, clanD, true)}${flag(280, clanD, true)}
  </svg>`;
}

// ---------- 一騎打ちの技の演出（舞台と同じ 320×160 の座標） ----------
// side：技を出した側 'L'（左）/'R'（右）。相手は反対側
const DU_POS = { L: { x: 94, y: 106 }, R: { x: 226, y: 106 } };
function duelFx(kind, side) {
  const me = DU_POS[side], to = DU_POS[side === 'L' ? 'R' : 'L'];
  const dir = side === 'L' ? 1 : -1;
  const { x, y } = to;
  switch (kind) {
    case 'slash': // 斜めの斬撃
      return `<g class="fx">
        <path class="fx-draw fx-glow" pathLength="100" d="M${x - 34 * dir},${y - 44} Q${x + 6 * dir},${y - 18} ${x + 30 * dir},${y + 26}" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path class="fx-draw" pathLength="100" d="M${x - 40 * dir},${y - 40} Q${x},${y - 12} ${x + 24 * dir},${y + 32}" stroke="#ffe6a8" stroke-width="2" fill="none"/>
      </g>`;
    case 'sweep': // 横なぎ
      return `<g class="fx">
        <path class="fx-draw fx-glow" pathLength="100" d="M${x - 58 * dir},${y + 4} Q${x},${y + 34} ${x + 56 * dir},${y - 6}" stroke="#bff3ff" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.55"/>
        <path class="fx-draw" pathLength="100" d="M${x - 58 * dir},${y + 4} Q${x},${y + 34} ${x + 56 * dir},${y - 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g>`;
    case 'block': // 刀を交差させた受けと、金の盾
      return `<g class="fx">
        <circle class="fx-ring" cx="${me.x + 30 * dir}" cy="${me.y - 8}" r="34" fill="rgba(255,215,120,0.18)" stroke="#ffd774" stroke-width="3"/>
        <g class="fx-pop" stroke="#f3f3f3" stroke-width="4" stroke-linecap="round">
          <line x1="${me.x + 14 * dir}" y1="${me.y - 34}" x2="${me.x + 46 * dir}" y2="${me.y + 12}"/>
          <line x1="${me.x + 46 * dir}" y1="${me.y - 34}" x2="${me.x + 14 * dir}" y2="${me.y + 12}"/>
        </g>
      </g>`;
    case 'charge': // 気を溜める：立ちのぼる炎の気
      return `<g class="fx">
        <ellipse class="fx-aura" cx="${me.x}" cy="${me.y + 6}" rx="50" ry="56" fill="rgba(255,140,40,0.28)" stroke="#ffb347" stroke-width="2"/>
        ${[-30, -14, 2, 18, 32].map((dx, i) => `<path class="fx-flame" style="animation-delay:${i * 0.07}s" d="M${me.x + dx},${me.y + 44} q-6,-16 0,-30 q6,14 0,30 Z" fill="#ffcf5a"/>`).join('')}
      </g>`;
    case 'totsugeki': // 一番槍：集中線と一直線の突き
      return `<g class="fx">
        <g class="fx-speed" stroke="#fff" stroke-width="1.5" opacity="0.8">${Array.from({ length: 9 }, (_, i) => {
          const yy = 30 + i * 13;
          return `<line x1="${side === 'L' ? 0 : 320}" y1="${yy}" x2="${side === 'L' ? 120 + (i % 3) * 40 : 200 - (i % 3) * 40}" y2="${yy}" style="animation-delay:${(i % 4) * 0.04}s"/>`;
        }).join('')}</g>
        <line class="fx-draw fx-glow" pathLength="100" x1="${me.x}" y1="${me.y - 10}" x2="${x + 6 * dir}" y2="${y - 10}" stroke="#fff4c8" stroke-width="14" stroke-linecap="round" opacity="0.7"/>
        <line class="fx-draw" pathLength="100" x1="${me.x}" y1="${me.y - 10}" x2="${x + 6 * dir}" y2="${y - 10}" stroke="#6b3f1d" stroke-width="4" stroke-linecap="round"/>
        <path class="fx-pop fx-glow" d="M${x + 2 * dir},${y - 20} L${x + 46 * dir},${y - 10} L${x + 2 * dir},${y} L${x + 10 * dir},${y - 10} Z" fill="#f4f7ff" stroke="#9aa6b8" stroke-width="1"/>
      </g>`;
    case 'teppeki': // 不動の構え：背後に大きな文字と、金色の結界
      return `<g class="fx">
        <text class="fx-kanji" x="${me.x}" y="${me.y - 30}" text-anchor="middle" font-size="58" fill="#ffd774" stroke="#7a4d10" stroke-width="1.5" font-family="Yuji Syuku, serif">不動</text>
        <circle class="fx-ring slow" cx="${me.x}" cy="${me.y}" r="58" fill="rgba(255,215,120,0.2)" stroke="#ffd774" stroke-width="4"/>
        <circle class="fx-ring slow" style="animation-delay:.15s" cx="${me.x}" cy="${me.y}" r="46" fill="none" stroke="#fff3c4" stroke-width="2"/>
      </g>`;
    case 'shinsan': // 読み切り：暗転、目の光、×字の斬撃
      return `<g class="fx">
        <rect class="fx-dark" width="320" height="160" fill="#0b1030"/>
        <g class="fx-pop fx-glow"><path d="M${me.x - 26},${me.y - 6} L${me.x + 26},${me.y - 6}" stroke="#8fe3ff" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="${me.x - 7}" cy="${me.y - 6}" r="3.5" fill="#dff8ff"/><circle cx="${me.x + 7}" cy="${me.y - 6}" r="3.5" fill="#dff8ff"/></g>
        <text class="fx-pop" x="160" y="46" text-anchor="middle" font-size="26" fill="#bfefff" font-family="Yuji Syuku, serif">見切った</text>
        <path class="fx-draw late fx-glow" pathLength="100" d="M${x - 34},${y - 40} L${x + 34},${y + 28}" stroke="#e8fbff" stroke-width="6" stroke-linecap="round"/>
        <path class="fx-draw later fx-glow" pathLength="100" d="M${x + 34},${y - 40} L${x - 34},${y + 28}" stroke="#e8fbff" stroke-width="6" stroke-linecap="round"/>
      </g>`;
    case 'konshin': // 渾身の一撃：真上からの振り下ろしと地割れ
      return `<g class="fx">
        <path class="fx-draw fx-glow" pathLength="100" d="M${x - 10 * dir},0 Q${x + 26 * dir},${y - 50} ${x + 4 * dir},${y + 40}" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/>
        <g class="fx-crack late" stroke="#1a0d08" stroke-width="2.5" fill="none">
          <path d="M${x},${146} l-14,6 l-10,-4 l-16,8"/><path d="M${x},${146} l12,5 l8,-5 l18,7"/><path d="M${x},${146} l-2,10"/>
        </g>
      </g>`;
    default:
      return '';
  }
}
// 当たったところの火花
function duelImpact(side, big) {
  const { x, y } = DU_POS[side];
  const n = big ? 12 : 8, r0 = big ? 16 : 10, r1 = big ? 46 : 30;
  return `<g class="fx fx-impact">
    <circle class="fx-ring fast" cx="${x}" cy="${y - 6}" r="${big ? 30 : 20}" fill="rgba(255,255,255,0.5)"/>
    <g stroke="#ffe27a" stroke-width="${big ? 3.5 : 2.5}" stroke-linecap="round">${Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return `<line x1="${x + Math.cos(a) * r0}" y1="${y - 6 + Math.sin(a) * r0}" x2="${x + Math.cos(a) * r1}" y2="${y - 6 + Math.sin(a) * r1}"/>`;
    }).join('')}</g>
  </g>`;
}
// 相打ち・受け止めたときの鍔ぜりの火花（真ん中）
function duelClashFx() {
  return `<g class="fx fx-impact">
    <g stroke="#fff" stroke-width="4" stroke-linecap="round"><line x1="138" y1="80" x2="182" y2="112"/><line x1="182" y1="80" x2="138" y2="112"/></g>
    <g stroke="#ffd24a" stroke-width="2" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `<line x1="${160 + Math.cos(a) * 8}" y1="${96 + Math.sin(a) * 8}" x2="${160 + Math.cos(a) * 34}" y2="${96 + Math.sin(a) * 30}"/>`;
    }).join('')}</g>
  </g>`;
}

// ---------- 会談の部屋（相手の生徒会室。床の間に相手の家紋の掛け軸） ----------
function meetingRoom(clan) {
  const c = CLANS[clan];
  const shoji = (x) => `<rect x="${x}" y="12" width="78" height="98" fill="#fbf6e6"/>
    ${[1, 2, 3].map((i) => `<line x1="${x + i * 19.5}" y1="12" x2="${x + i * 19.5}" y2="110" stroke="#8a6a44" stroke-width="1"/>`).join('')}
    ${[1, 2, 3, 4, 5].map((i) => `<line x1="${x}" y1="${12 + i * 16.3}" x2="${x + 78}" y2="${12 + i * 16.3}" stroke="#8a6a44" stroke-width="1"/>`).join('')}
    <rect x="${x}" y="12" width="78" height="98" fill="none" stroke="#1c1a17" stroke-width="3"/>`;
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
    <rect x="98" y="16" width="124" height="92" fill="none" stroke="#1c1a17" stroke-width="3"/>
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
// 学園城：扇の勾配の石垣に、下見板張りの校舎、反りのある屋根に時計台の天守。屋根が家の色になる
// 家の本拠は三重の天守に金の鯱、金の棟、左右に隅櫓を構えた堂々たる城
function castleMarkup(capital) {
  const K = '#1c1a17', G = '#e0a526';
  // 反りのある屋根（左右の軒先 x=±w, 軒の高さ y, 棟の高さ top）
  const roof = (w, y, top) => {
    const m = w * 0.48, h = y - top;
    return `M${-w},${y} Q${-w * 0.7},${y - h * 0.12} ${-m},${y - h * 0.45} L0,${top} L${m},${y - h * 0.45} Q${w * 0.7},${y - h * 0.12} ${w},${y} Q${w * 0.55},${y - h * 0.07} 0,${y - h * 0.05} Q${-w * 0.55},${y - h * 0.07} ${-w},${y} Z`;
  };
  // 屋根の雪：軒から棟への上の縁だけ白く
  const snowOn = (w, y, top) => {
    const m = w * 0.48, h = y - top;
    return `M${-w},${y} Q${-w * 0.7},${y - h * 0.12} ${-m},${y - h * 0.45} L0,${top} L${m},${y - h * 0.45} Q${w * 0.7},${y - h * 0.12} ${w},${y} L${w * 0.8},${y - h * 0.08} Q${w * 0.6},${y - h * 0.2} ${m * 0.9},${y - h * 0.55} L0,${top + h * 0.3} L${-m * 0.9},${y - h * 0.55} Q${-w * 0.6},${y - h * 0.2} ${-w * 0.8},${y - h * 0.08} Z`;
  };
  const hafu = (x, y, s) => `<path d="M${x - 4 * s},${y} L${x},${y - 4.5 * s} L${x + 4 * s},${y} Z" fill="#f3ead2" stroke="${K}" stroke-width="${0.9 * s}" class="hafu"/><circle cx="${x}" cy="${y - 1.6 * s}" r="${0.8 * s}" fill="${G}" class="trim"/>`;
  const shitami = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2b2622" class="shitami"/><path d="${Array.from({ length: Math.floor(h / 1.6) }, (_, i) => `M${x},${(y + 1.2 + i * 1.6).toFixed(1)} H${x + w}`).join(' ')}" stroke="#4a423a" stroke-width="0.4" class="shitami-line"/>`;
  const stone = (w) => `
    <ellipse class="shadow" cx="0" cy="17" rx="${w + 3}" ry="4.5"/>
    <path class="stone" d="M${-w + 4},8 L${w - 4},8 Q${w - 3},13 ${w + 1},16 L${-w - 1},16 Q${-w + 3},13 ${-w + 4},8 Z"/>
    <path class="stone-line" d="M${-w + 3},10.7 H${w - 3} M${-w + 2},13.4 H${w - 2} ${Array.from({ length: Math.ceil(w / 5) }, (_, i) => { const x = -w + 6 + i * 10; return x > w - 5 ? '' : `M${x},8 V10.7 M${x + 5},10.7 V13.4 M${x},13.4 V16`; }).join(' ')}"/>`;
  if (!capital) {
    return `${stone(22)}
    <rect class="wall" x="-16" y="-6" width="32" height="14"/>
    ${shitami(-15.2, 3, 30.4, 4.2)}
    <rect class="window" x="-12.5" y="-3.5" width="5" height="4"/><rect class="window" x="7.5" y="-3.5" width="5" height="4"/>
    <path class="window" d="M-3,8 V1.5 Q0,-1 3,1.5 V8 Z"/>
    <path class="roof" d="${roof(21, -4.5, -15)}"/>
    <rect class="wall" x="-7" y="-23.5" width="14" height="10"/>
    <circle class="clock" cx="0" cy="-18.5" r="3.2"/>
    <path d="M0,-18.5 V-20.6 M0,-18.5 H1.6" stroke="${K}" stroke-width="0.6" class="trim"/>
    <path class="roof" d="${roof(12, -22.5, -31)}"/>
    <path class="snow" d="${snowOn(21, -4.5, -15)} ${snowOn(12, -22.5, -31)}"/>`;
  }
  const turret = (x) => `<g transform="translate(${x},0)"><rect class="wall" x="-4" y="-1" width="8" height="9"/>${shitami(-3.4, 4.2, 6.8, 3.2)}<rect class="window" x="-1.2" y="0.6" width="2.4" height="2.4"/><path class="roof" d="${roof(7, -0.5, -7)}"/><path class="snow" d="${snowOn(7, -0.5, -7)}"/></g>`;
  return `${stone(27)}
    ${turret(-22)}${turret(22)}
    <rect class="wall" x="-16" y="-6" width="32" height="14"/>
    ${shitami(-15.2, 3, 30.4, 4.2)}
    <rect class="window" x="-12.5" y="-3.5" width="5" height="4"/><rect class="window" x="7.5" y="-3.5" width="5" height="4"/>
    <path class="window" d="M-3,8 V1.5 Q0,-1 3,1.5 V8 Z"/>
    <path class="roof" d="${roof(21, -4.5, -14)}"/>
    ${hafu(-9.5, -7.8, 1)}${hafu(9.5, -7.8, 1)}
    <rect class="wall" x="-11" y="-21" width="22" height="9"/>
    ${shitami(-10.4, -15.6, 20.8, 3)}
    <rect class="window" x="-7.5" y="-19.5" width="3.5" height="3"/><rect class="window" x="4" y="-19.5" width="3.5" height="3"/>
    <path class="roof" d="${roof(15.5, -20.5, -28)}"/>
    <path d="M-6,-23.6 Q0,-28.6 6,-23.6" fill="#f3ead2" stroke="${K}" stroke-width="0.9" class="hafu"/>
    <rect class="wall" x="-6.5" y="-35" width="13" height="8.5"/>
    <circle class="clock" cx="0" cy="-30.8" r="2.9"/>
    <path d="M0,-30.8 V-32.7 M0,-30.8 H1.5" stroke="${K}" stroke-width="0.6" class="trim"/>
    <path class="roof" d="${roof(11, -34.5, -41)}"/>
    <path d="M-5.3,-38.5 L0,-41 L5.3,-38.5 M-21,-4.5 Q-14.7,-5.8 -10,-9.2 M21,-4.5 Q14.7,-5.8 10,-9.2 M-15.5,-20.5 Q-10.8,-21.4 -7.4,-23.9 M15.5,-20.5 Q10.8,-21.4 7.4,-23.9" fill="none" stroke="${G}" stroke-width="1" stroke-linecap="round" class="trim"/>
    <path class="shachi" d="M-5.6,-38.6 Q-7.4,-41.6 -5.4,-43.4" fill="none" stroke="${G}" stroke-width="1.6" stroke-linecap="round"/><path class="shachi" d="M5.6,-38.6 Q7.4,-41.6 5.4,-43.4" fill="none" stroke="${G}" stroke-width="1.6" stroke-linecap="round"/>
    <circle class="shachi-dot" cx="-5.4" cy="-43.4" r="1.2" fill="${G}"/><circle class="shachi-dot" cx="5.4" cy="-43.4" r="1.2" fill="${G}"/>
    <path class="snow" d="${snowOn(21, -4.5, -14)} ${snowOn(15.5, -20.5, -28)} ${snowOn(11, -34.5, -41)}"/>`;
}

// ---------- 合戦の絵 ----------
// 季節の空・遠くの山・攻める城を背景に、足軽の隊列がぶつかり合う
// 季節ごとの「ぼかし」の色と、遠くの山の色（春：桜 / 夏：藍 / 秋：朱 / 冬：鉄色）
const BATTLE_SKY = [
  ['#e9a3a8', '#b7a3c4'],
  ['#3c6aa3', '#8aa0bd'],
  ['#c8372d', '#b58a6a'],
  ['#6a7a92', '#a9b6c6'],
];

// 足軽1人（右向き）。陣笠に、家の色の旗指物を背負う。flip で左向き
// 兵種：i 番目の兵が何か（槍が主、鉄砲・弓・騎馬が混じる。並びが変わっても同じ兵は同じ兵種）
const UNIT_MIX = ['yari', 'teppo', 'yari', 'yumi', 'yari', 'teppo', 'kiba', 'yari', 'yumi', 'yari', 'teppo', 'yari'];
const unitOf = (i) => UNIT_MIX[i % UNIT_MIX.length];
function soldier(color, flip, kind = 'yari') {
  const K = '#1c1a17';
  const body = `<path d="M-3,-4 L-4,0 M3,-4 L4,0" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-4.5,-4 L-4,-12 L4,-12 L4.5,-4 Z" fill="#2b2b36" stroke="${K}" stroke-width="0.8"/>
    <rect x="-4.2" y="-8.6" width="8.4" height="1.8" fill="${color}"/>
    <circle cx="0" cy="-14.5" r="2.6" fill="#fbe7cc" stroke="${K}" stroke-width="0.6"/>
    <path d="M-6,-15 L0,-19.5 L6,-15 Z" fill="${K}"/>`;
  const flag = `<line x1="-1.5" y1="-12" x2="-1.5" y2="-33" stroke="${K}" stroke-width="1"/><rect x="-1.5" y="-33" width="7" height="10" fill="${color}" stroke="${K}" stroke-width="0.8"/>`;
  if (kind === 'teppo') {
    // 鉄砲足軽：筒を前に構え、撃てば筒先に白煙
    return `<g class="sol-art teppo" transform="scale(${flip ? -1 : 1},1)">${flag}${body}
      <path d="M-1,-10 L17,-12.5" stroke="#3a2a1a" stroke-width="1.8" stroke-linecap="round"/><path d="M-1,-10 L4,-10.6" stroke="#6b4a2c" stroke-width="2.6"/>
      <g class="smoke"><circle cx="20" cy="-13" r="3"/><circle cx="25" cy="-15" r="4"/><circle cx="30" cy="-12" r="3.4"/></g></g>`;
  }
  if (kind === 'yumi') {
    // 弓足軽：弦を張った弓
    return `<g class="sol-art yumi" transform="scale(${flip ? -1 : 1},1)">${flag}${body}
      <path d="M6,-27 Q14,-16 6,-4" stroke="#6b4a2c" stroke-width="1.4" fill="none"/><path d="M6,-27 L6,-4" stroke="#e8e0cc" stroke-width="0.6"/></g>`;
  }
  if (kind === 'kiba') {
    // 騎馬武者：馬にまたがり、長い槍を斜めに
    return `<g class="sol-art kiba" transform="scale(${flip ? -1 : 1},1)">
      <path d="M-14,-10 Q-4,-15 8,-12 L15,-19 L19,-17 L14,-8 Q11,-2 5,-3 L-10,-3 Q-16,-5 -14,-10 Z" fill="#4a3220" stroke="${K}" stroke-width="0.8"/>
      <g stroke="#4a3220" stroke-width="2" stroke-linecap="round"><path d="M-10,-4 L-13,4"/><path d="M-5,-4 L-3,4"/><path d="M4,-4 L1,4"/><path d="M9,-4 L12,4"/></g>
      <path d="M-15,-9 Q-20,-6 -19,-1" stroke="${K}" stroke-width="1.4" fill="none"/>
      <g transform="translate(0,-9)">${flag}
        <path d="M-4.5,-4 L-4,-12 L4,-12 L4.5,-4 Z" fill="${color}" stroke="${K}" stroke-width="0.8"/>
        <circle cx="0" cy="-14.5" r="2.6" fill="#fbe7cc" stroke="${K}" stroke-width="0.6"/>
        <path d="M-6,-15 L0,-20 L6,-15 Z" fill="${K}"/><path d="M-3,-19 L-6,-24 M3,-19 L6,-24" stroke="#e0a526" stroke-width="1.2"/>
        <line x1="2" y1="-8" x2="22" y2="-30" stroke="#6b5a40" stroke-width="1.2"/><path d="M21,-31 L25,-33 L23,-29 Z" fill="#dfe6ea" stroke="${K}" stroke-width="0.4"/></g></g>`;
  }
  return `<g class="sol-art" transform="scale(${flip ? -1 : 1},1)">
    <line x1="-1.5" y1="-12" x2="-1.5" y2="-33" stroke="#1c1a17" stroke-width="1"/>
    <rect x="-1.5" y="-33" width="7" height="10" fill="${color}" stroke="#1c1a17" stroke-width="0.8"/>
    <line x1="3" y1="-9" x2="17" y2="-26" stroke="#6b5a40" stroke-width="1.1"/>
    <path d="M16,-27 L19.5,-29 L17.8,-25 Z" fill="#dfe6ea" stroke="#1c1a17" stroke-width="0.4"/>
    <path d="M-3,-4 L-4,0 M3,-4 L4,0" stroke="#1c1a17" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-4.5,-4 L-4,-12 L4,-12 L4.5,-4 Z" fill="#2b2b36" stroke="#1c1a17" stroke-width="0.8"/>
    <rect x="-4.2" y="-8.6" width="8.4" height="1.8" fill="${color}"/>
    <circle cx="0" cy="-14.5" r="2.6" fill="#fbe7cc" stroke="#1c1a17" stroke-width="0.6"/>
    <path d="M-6,-15 L0,-19.5 L6,-15 Z" fill="#1c1a17"/>
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
    const x = side === 'a' ? 150 - col * 17 - row * 6 : 232 + col * 12 + row * 6;
    out.push(`<g transform="translate(${x},${y}) scale(${scale.toFixed(2)})"><g class="sol" data-i="${i}">${soldier(color, side === 'd', unitOf(i))}</g></g>`);
  }
  return out.join('');
}

// ぶつかり合い：槍の交わる火花と、それぞれの軍の上に討たれた数（合戦の舞台と同じ 400×220 の座標）
function meleeMarkup(x, lossA, lossD, xa, xd) {
  const star = (cx, cy, r, d) => `<path class="bf-clash" style="animation-delay:${d}s" d="${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.4 : r; return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; }).join(' ')}Z"/>`;
  const spears = [0, 1, 2].map((i) => { const y = 172 + i * 13; return `<path class="bf-spear" style="animation-delay:${i * 0.06}s" d="M${x - 16},${y + 4} L${x + 6},${y - 6} M${x + 16},${y + 4} L${x - 6},${y - 6}"/>`; }).join('');
  const dmg = (cx, n, side) => (n > 0 ? `<text class="bf-dmg ${side}" x="${cx.toFixed(0)}" y="150">−${Math.round(n).toLocaleString('ja-JP')}</text>` : '');
  return `<g class="bf-melee">${star(x, 178, 11, 0)}${star(x - 8, 196, 8, 0.12)}${star(x + 7, 166, 7, 0.22)}${spears}${dmg(xa, lossA, 'a')}${dmg(xd, lossD, 'd')}</g>`;
}

// 合戦屏風の部品：金雲・陣幕・幟
const bfKinun = (d) => `<path d="${d}" fill="url(#bf-kin)" stroke="#5a3a10" stroke-width="1.4"/>`;
// 陣幕：白と家の色の横縞の幕を杭に張り、真ん中に家紋
function bfJinmaku(x, y, w, clan) {
  const c = CLANS[clan].color, poles = [0, w / 2, w].map((p) => `<line x1="${x + p}" y1="${y - 4}" x2="${x + p}" y2="${y + 20}" stroke="#4a3220" stroke-width="2"/>`).join('');
  const sag = (yy) => `M${x},${yy} Q${x + w / 4},${yy + 3} ${x + w / 2},${yy} Q${x + w * 0.75},${yy + 3} ${x + w},${yy}`;
  return `<g class="bf-jinmaku">
    <path d="${sag(y)} L${x + w},${y + 18} Q${x + w * 0.75},${y + 21} ${x + w / 2},${y + 18} Q${x + w / 4},${y + 21} ${x},${y + 18} Z" fill="#f4efe2" stroke="#1c1a17" stroke-width="1.2"/>
    <path d="${sag(y + 6)} M${x + w},${y + 12} Q${x + w * 0.75},${y + 15} ${x + w / 2},${y + 12} Q${x + w / 4},${y + 15} ${x},${y + 12}" fill="none" stroke="${c}" stroke-width="5"/>
    ${[0.25, 0.75].map((f) => `<svg x="${x + w * f - 7}" y="${y + 2}" width="14" height="14" viewBox="-32 -32 64 64"><circle r="30" fill="#f4efe2" stroke="#1c1a17" stroke-width="3"/>${crestInner(CLANS[clan].crest, c)}</svg>`).join('')}
    ${poles}</g>`;
}
// 幟：細い竿に縦長の旗。風にゆれる（delay でずらす）
function bfNobori(x, y, h, clan, flip, delay) {
  const c = CLANS[clan].color, fx = flip ? -7 : 0;
  return `<g class="bf-nobori" style="animation-delay:-${delay}s; transform-origin:${x}px ${y}px">
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y - h}" stroke="#1c1a17" stroke-width="1.4"/>
    <line x1="${x}" y1="${y - h + 1}" x2="${x + (flip ? -8 : 8)}" y2="${y - h + 1}" stroke="#1c1a17" stroke-width="1.2"/>
    <path d="M${x + fx},${y - h + 1} h7 v${h * 0.62} q-3.5,2 -7,0 Z" fill="${c}" stroke="#1c1a17" stroke-width="0.9"/>
    <rect x="${x + fx}" y="${y - h + 1}" width="7" height="5" fill="#f4efe2" stroke="#1c1a17" stroke-width="0.6"/>
    <svg x="${x + fx + 0.5}" y="${y - h + 9}" width="6" height="6" viewBox="-32 -32 64 64">${crestInner(CLANS[clan].crest, '#fff')}</svg></g>`;
}

function battleScene(r, season) {
  const [sky, mount] = BATTLE_SKY[season % 4];
  const ca = CLANS[r.attacker].color, cd = CLANS[r.defender].color;
  const na = clamp(Math.round(r.rounds[0].a / 130), 5, 24);
  const nd = clamp(Math.round(r.rounds[0].d / 130), 4, 20);
  const banner = (x, y, h, clan, flip) => `<g transform="translate(${x},${y})">
      <line x1="0" y1="0" x2="0" y2="${-h}" stroke="#1c1a17" stroke-width="2"/>
      <rect x="${flip ? -12 : 0}" y="${-h}" width="12" height="${h * 0.62}" fill="${CLANS[clan].color}" stroke="#1c1a17" stroke-width="1.2"/>
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
      <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sky}" stop-opacity="0"/></linearGradient>
      <pattern id="bf-kin" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#e3b94e"/><rect width="5" height="5" fill="#ecc660"/><rect x="5" y="5" width="5" height="5" fill="#d9ad3f"/></pattern>
      <clipPath id="bf-clip"><rect width="400" height="220"/></clipPath>
      <linearGradient id="bf-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6470" stop-opacity="0.55"/><stop offset="1" stop-color="#5a6470" stop-opacity="0"/></linearGradient>
      <linearGradient id="bf-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#f1e6cc" stop-opacity="0"/><stop offset="1" stop-color="#f1e6cc" stop-opacity="0.75"/></linearGradient>
    </defs>
    <g clip-path="url(#bf-clip)">
    <rect width="400" height="220" fill="#f1e6cc"/>
    <rect width="400" height="110" fill="url(#bf-sky)"/>
    <circle cx="84" cy="56" r="22" fill="#c8372d"/><circle cx="81" cy="53" r="22" fill="none" stroke="#1c1a17" stroke-width="2"/>
    ${snow}${petalsBg}
    <path d="M0,104 L30,80 L52,92 L96,58 L130,86 L176,64 L214,90 L262,60 L300,84 L346,66 L400,90 L400,140 L0,140 Z" fill="url(#bf-far)" opacity="0.7"/>
    <path d="M0,130 L40,96 L70,112 L110,78 L150,110 L190,90 L230,118 L270,86 L320,114 L360,92 L400,118 L400,160 L0,160 Z" fill="${mount}" stroke="#1c1a17" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M0,130 L40,96 L70,112 L110,78 L150,110 L190,90 L230,118 L270,86 L320,114 L360,92 L400,118 L400,160 L0,160 Z" fill="url(#bf-mist)"/>
    ${bfKinun('M-10,34 Q-6,20 12,22 Q20,8 40,14 Q54,2 74,12 Q92,4 104,16 Q126,12 128,26 Q146,26 144,38 Q132,46 112,42 Q94,50 74,42 Q52,50 34,42 Q12,48 -10,42 Z')}
    ${bfKinun('M150,40 Q146,30 158,29 Q161,20 174,23 Q183,16 194,23 Q208,20 211,30 Q222,31 219,40 Z')}
    ${bfKinun('M196,122 Q200,110 218,112 Q228,100 248,106 Q262,96 280,106 Q292,104 290,116 Q284,126 262,124 Q244,130 226,124 Q208,130 196,122 Z')}
    <path d="M0,142 Q60,120 120,138 T240,134 T400,130 L400,160 L0,160 Z" fill="#6f8a5a" stroke="#1c1a17" stroke-width="1.6"/>
    <g transform="translate(340,118) scale(2.1)" class="bf-castle" style="--c:${cd}">${castleMarkup(false)}</g>
    <g class="bf-wall" id="bf-wall">
      <path d="M292,152 L296,140 L400,140 L400,152 Z" fill="#8a8170" stroke="#1c1a17" stroke-width="1.4"/>
      <path d="M296,146 H400 M306,140 V146 M322,146 V152 M346,140 V146 M370,146 V152 M388,140 V146" stroke="#5a5348" stroke-width="0.7" fill="none"/>
      <rect x="296" y="133" width="104" height="7" fill="#f1e6cc" stroke="#1c1a17" stroke-width="1.2"/>
      ${[304, 336, 360, 384].map((x) => `<rect x="${x}" y="135" width="3" height="3" fill="#1c1a17"/>`).join('')}
      <path d="M293,134 L403,134 L399,129 L297,129 Z" fill="#3a3f4a" stroke="#1c1a17" stroke-width="1.2"/>
      <path class="bf-crack" d="M330,140 l3,4 l-2,3 l4,5 M356,133 l-2,4 l3,3 M378,141 l2,5 l-3,4" stroke="#1c1a17" stroke-width="1" fill="none" opacity="0"/>
      <g id="bf-gate" transform="translate(316,152)">
        <rect x="-11" y="-22" width="3" height="22" fill="#5a3a22" stroke="#1c1a17" stroke-width="0.8"/><rect x="8" y="-22" width="3" height="22" fill="#5a3a22" stroke="#1c1a17" stroke-width="0.8"/>
        <path d="M-15,-22 L15,-22 L12,-27 L-12,-27 Z" fill="#3a3f4a" stroke="#1c1a17" stroke-width="1"/>
        <g class="door l"><rect x="-8" y="-20" width="8" height="20" fill="#7a4a26" stroke="#1c1a17" stroke-width="0.8"/><circle cx="-2" cy="-10" r="0.9" fill="#e0a526"/></g>
        <g class="door r"><rect x="0" y="-20" width="8" height="20" fill="#7a4a26" stroke="#1c1a17" stroke-width="0.8"/><circle cx="2" cy="-10" r="0.9" fill="#e0a526"/></g>
      </g>
    </g>
    ${bfJinmaku(8, 132, 118, r.attacker)}
    <g class="bf-nobori-row">${[14, 34, 54, 74, 94, 114].map((x, i) => bfNobori(x, 150 - (i % 2) * 3, 44 + (i % 3) * 5, r.attacker, false, i * 0.23)).join('')}</g>
    <g class="bf-nobori-row">${[246, 264, 282].map((x, i) => bfNobori(x, 156 - (i % 2) * 3, 40 + (i % 2) * 6, r.defender, true, i * 0.31)).join('')}</g>
    <g class="bf-smoke"><ellipse cx="170" cy="150" rx="40" ry="9"/><ellipse cx="230" cy="142" rx="30" ry="7"/><ellipse cx="120" cy="146" rx="26" ry="6"/></g>
    <g class="bf-fire" id="bf-fire">
      <path d="M322,96 Q326,80 331,92 Q334,74 340,90 Q345,78 348,95 Z" fill="#ff8a2a"/>
      <path d="M328,98 Q331,88 335,95 Q338,84 342,96 Z" fill="#ffd34a"/>
    </g>
    <path d="M0,152 Q200,146 400,150 L400,220 L0,220 Z" fill="#b69a6a" stroke="#1c1a17" stroke-width="1.8"/>
    <path d="M0,172 Q200,166 400,170 M0,196 Q200,190 400,194" fill="none" stroke="#8d7550" stroke-width="1.2"/>
    ${banner(30, 160, 58, r.attacker, false)}${banner(58, 164, 50, r.attacker, false)}
    ${banner(372, 160, 50, r.defender, true)}
    <g class="army" id="army-a">${armyMarkup('a', na, ca)}</g>
    <g class="army" id="army-d">${armyMarkup('d', nd, cd)}</g>
    <g id="bf-front" transform="translate(191,0)"><path class="bf-front-line" d="M0,156 L-4,214"/><path class="bf-push a" d="M-6,206 l12,0 l-4,-4 M6,206 l-4,4"/><path class="bf-push d" d="M6,206 l-12,0 l4,-4 M-6,206 l4,4"/></g>
    <g id="bf-arrows"></g>
    <g id="bf-weather">${weatherMarkup(r.weather)}</g>
    <g id="bf-fx"></g>
    <g class="dust" id="bf-dust"><circle cx="190" cy="185" r="16"/><circle cx="205" cy="178" r="12"/><circle cx="178" cy="176" r="10"/></g>
    </g>
    <rect x="1.5" y="1.5" width="397" height="217" fill="none" stroke="#1c1a17" stroke-width="3"/>
  </svg>`;
}

// ---------- 合戦の命令・戦法の演出（合戦の舞台と同じ 400×220 の座標） ----------
// side：'a'（攻め・左）/ 'd'（守り・右）。軍の中心と、相手の軍の中心
const BF_POS = { a: { x: 105, y: 180 }, d: { x: 280, y: 180 } };
function battleFx(kind, side) {
  const me = BF_POS[side], foe = BF_POS[side === 'a' ? 'd' : 'a'];
  const dir = side === 'a' ? 1 : -1;
  const horse = (x, y, s, delay) => `<g class="bfx-ride" style="animation-delay:${delay}s; --dx:${120 * dir}px">
    <g transform="translate(${x},${y}) scale(${s * dir},${s})">
      <path d="M-14,-10 Q-4,-16 8,-12 L16,-20 L20,-18 L15,-9 Q12,-2 6,-2 L-10,-2 Q-16,-4 -14,-10 Z" fill="#3a2a20"/>
      <g stroke="#3a2a20" stroke-width="2.2" stroke-linecap="round"><path d="M-10,-3 L-14,6"/><path d="M-5,-3 L-2,6"/><path d="M4,-3 L0,6"/><path d="M9,-3 L13,6"/></g>
      <path d="M-15,-9 L-22,-4" stroke="#3a2a20" stroke-width="2"/>
      <path d="M-3,-14 L-2,-26 L3,-26 L4,-14 Z" fill="#553b2a"/><circle cx="0.5" cy="-29" r="3" fill="#e9c19e"/>
      <path d="M-4,-30 L0.5,-34 L5,-30 Z" fill="#222"/>
      <line x1="2" y1="-20" x2="24" y2="-32" stroke="#6b5a40" stroke-width="1.4"/><path d="M23,-33 L28,-35 L25,-30 Z" fill="#dfe6ea"/>
    </g></g>`;
  const smoke = (cx, cy, n, color, cls = 'bfx-smoke') => Array.from({ length: n }, (_, i) =>
    `<circle class="${cls}" style="animation-delay:${(i % 5) * 0.08}s" cx="${cx + ((i * 23) % 70) - 35}" cy="${cy - ((i * 13) % 30)}" r="${12 + (i % 3) * 5}" fill="${color}"/>`).join('');
  const stakes = (x0, n, h, color) => Array.from({ length: n }, (_, i) =>
    `<path d="M${x0 + i * 9 * dir},${198} l-2.5,-${h} l2.5,-5 l2.5,5 l-2.5,${h}" fill="${color}" stroke="#3a2412" stroke-width="0.6"/>`).join('');
  switch (kind) {
    case 'charge': // 騎馬の突撃
      return `<g class="bfx">
        ${smoke(me.x + 30 * dir, 196, 6, 'rgba(160,130,90,0.55)', 'bfx-dust')}
        ${horse(me.x + 10 * dir, 178, 1.3, 0.15)}${horse(me.x - 10 * dir, 194, 1.6, 0)}${horse(me.x - 44 * dir, 208, 1.8, 0.08)}
      </g>`;
    case 'guard': // 馬防柵がせり上がる
      return `<g class="bfx"><g class="bfx-rise">
        ${stakes(me.x + 52 * dir - 36 * dir, 9, 26, '#9a6b3c')}
        <path d="M${me.x + 16 * dir},180 L${me.x + 90 * dir},180 M${me.x + 16 * dir},190 L${me.x + 90 * dir},190" stroke="#6b4a26" stroke-width="2.2"/>
      </g></g>`;
    case 'scheme': // 敵陣に煙
      return `<g class="bfx">${smoke(foe.x, 176, 10, 'rgba(150,140,170,0.6)')}</g>`;
    case 'confused': // 混乱：頭上をまわる星
      return `<g class="bfx"><g class="bfx-spin" style="transform-origin:${me.x}px 140px">
        ${[0, 1, 2, 3].map((i) => `<text x="${me.x + Math.cos(i * 1.57) * 30}" y="${140 + Math.sin(i * 1.57) * 8}" font-size="14" fill="#ffe27a" text-anchor="middle">★</text>`).join('')}
      </g></g>`;
    case 'totsugeki': // 一番槍：戦場を貫く大槍
      return `<g class="bfx">
        <g stroke="#fff" stroke-width="1.6" opacity="0.8">${Array.from({ length: 10 }, (_, i) => {
          const y = 120 + i * 9;
          return `<line class="bfx-speed" style="animation-delay:${(i % 4) * 0.04}s" x1="${side === 'a' ? 0 : 400}" y1="${y}" x2="${side === 'a' ? 180 + (i % 3) * 30 : 220 - (i % 3) * 30}" y2="${y}"/>`;
        }).join('')}</g>
        <line class="bfx-draw bfx-glow" pathLength="100" x1="${me.x - 40 * dir}" y1="172" x2="${foe.x + 10 * dir}" y2="172" stroke="#fff4c8" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
        <line class="bfx-draw" pathLength="100" x1="${me.x - 40 * dir}" y1="172" x2="${foe.x + 10 * dir}" y2="172" stroke="#6b3f1d" stroke-width="4"/>
        <path class="bfx-pop" d="M${foe.x + 6 * dir},160 L${foe.x + 50 * dir},172 L${foe.x + 6 * dir},184 L${foe.x + 16 * dir},172 Z" fill="#f4f7ff" stroke="#9aa6b8"/>
      </g>`;
    case 'teppeki': // 鉄壁の陣：盾の壁と金の結界
      return `<g class="bfx">
        <path class="bfx-dome" d="M${me.x - 70},205 Q${me.x},90 ${me.x + 70},205" fill="rgba(255,215,120,0.2)" stroke="#ffd774" stroke-width="3"/>
        <g class="bfx-rise">${Array.from({ length: 6 }, (_, i) => `<rect x="${me.x + 30 * dir + i * 10 * dir - 5}" y="172" width="11" height="24" rx="2" fill="#7b6a58" stroke="#e8d9a8" stroke-width="1"/>`).join('')}</g>
        <text class="bfx-kanji" x="${me.x}" y="130" text-anchor="middle" font-size="34" fill="#ffd774" stroke="#6b4a10" stroke-width="1" font-family="Yuji Syuku, serif">鉄壁</text>
      </g>`;
    case 'shinsan': // 火計：火矢と炎上
      return `<g class="bfx">
        ${[0, 1, 2, 3, 4].map((i) => `<path class="bfx-draw" style="animation-delay:${i * 0.06}s" pathLength="100" d="M${me.x},${150} Q${(me.x + foe.x) / 2},${60 + i * 8} ${foe.x - 30 + i * 15},${178}" stroke="#ff9a3a" stroke-width="2" fill="none"/>`).join('')}
        <g class="bfx-fire">${[0, 1, 2, 3, 4, 5].map((i) => {
          const x = foe.x - 45 + i * 18;
          return `<path style="animation-delay:${0.3 + (i % 3) * 0.08}s" d="M${x - 9},200 Q${x - 7},178 ${x},186 Q${x + 2},168 ${x + 7},184 Q${x + 11},176 ${x + 10},200 Z" fill="#ff7a22"/>
            <path style="animation-delay:${0.35 + (i % 3) * 0.08}s" d="M${x - 5},200 Q${x - 3},186 ${x + 1},192 Q${x + 4},182 ${x + 6},200 Z" fill="#ffd34a"/>`;
        }).join('')}</g>
        ${smoke(foe.x, 150, 6, 'rgba(60,50,50,0.45)')}
      </g>`;
    case 'jinbou': // 鼓舞：大太鼓と光の輪
      return `<g class="bfx">
        <g transform="translate(${me.x},122)"><g class="bfx-pop">
          <ellipse cx="0" cy="0" rx="20" ry="16" fill="#8a3a22" stroke="#3a1a10" stroke-width="1.5"/>
          <ellipse cx="0" cy="-3" rx="16" ry="11" fill="#f1e2c4" stroke="#6b4a26"/>
          <line x1="-26" y1="-24" x2="-8" y2="-6" stroke="#5a3a1a" stroke-width="2.4"/><line x1="26" y1="-24" x2="8" y2="-6" stroke="#5a3a1a" stroke-width="2.4"/>
        </g></g>
        ${[0, 1, 2].map((i) => `<ellipse class="bfx-ring" style="animation-delay:${i * 0.18}s" cx="${me.x}" cy="186" rx="70" ry="18" fill="none" stroke="#ffd774" stroke-width="3"/>`).join('')}
        ${[0, 1, 2, 3, 4].map((i) => `<text class="bfx-up" style="animation-delay:${i * 0.1}s" x="${me.x - 50 + i * 25}" y="196" font-size="16" fill="#ffe27a" text-anchor="middle">↑</text>`).join('')}
      </g>`;
    case 'shousai': // 兵糧攻め：崩れる米俵と暗い雲
      return `<g class="bfx">
        ${smoke(foe.x, 130, 7, 'rgba(40,40,60,0.45)')}
        ${[0, 1, 2].map((i) => `<g transform="translate(${foe.x - 30 + i * 30},150)"><g class="bfx-fall" style="animation-delay:${i * 0.12}s">
          <ellipse cx="0" cy="0" rx="12" ry="8" fill="#d9c28a" stroke="#7a6130"/><path d="M-6,-7 L-6,7 M6,-7 L6,7" stroke="#7a6130" stroke-width="1.5"/>
          <path d="M-10,-8 L10,8 M10,-8 L-10,8" stroke="#c0392b" stroke-width="2.4"/></g></g>`).join('')}
      </g>`;
    case 'chikujou': // 築陣：土塁と柵
      return `<g class="bfx"><g class="bfx-rise">
        <path d="M${me.x + 5 * dir},204 Q${me.x + 50 * dir},178 ${me.x + 100 * dir},204 Z" fill="#8a6a3a" stroke="#4a3418" stroke-width="1"/>
        ${stakes(me.x + 20 * dir, 9, 22, '#b08050')}
      </g></g>`;
    default:
      return '';
  }
}

// 合戦の舞台に重ねる天気（雨・雪・霧・強風）
function weatherMarkup(w) {
  if (w === 'rain') {
    return `<rect width="400" height="220" fill="rgba(40,50,70,0.25)"/>
      <g class="wx-rain" stroke="rgba(220,235,255,0.7)" stroke-width="1">${Array.from({ length: 40 }, (_, i) =>
      `<line x1="${(i * 41) % 410}" y1="${(i * 29) % 220}" x2="${(i * 41) % 410 - 5}" y2="${(i * 29) % 220 + 14}" style="animation-delay:-${(i % 7) * 0.1}s"/>`).join('')}</g>`;
  }
  if (w === 'snow') {
    return `<g class="wx-snow" fill="#fff">${Array.from({ length: 34 }, (_, i) =>
      `<circle cx="${(i * 47) % 400}" cy="${(i * 31) % 220}" r="${1.2 + (i % 3) * 0.7}" style="animation-delay:-${(i % 9) * 0.4}s"/>`).join('')}</g>`;
  }
  if (w === 'fog') {
    return `<g class="wx-fog">${[70, 120, 170].map((y, i) =>
      `<ellipse cx="${120 + i * 90}" cy="${y}" rx="190" ry="26" fill="rgba(240,240,245,0.45)" style="animation-delay:-${i * 2}s"/>`).join('')}</g>`;
  }
  if (w === 'wind') {
    return `<g class="wx-wind" stroke="rgba(255,255,255,0.65)" stroke-width="1.4" fill="none" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) =>
      `<path d="M${-40 + (i * 53) % 200},${30 + i * 22} q30,-8 60,0 t60,0" style="animation-delay:-${i * 0.3}s"/>`).join('')}
      ${Array.from({ length: 8 }, (_, i) => `<ellipse class="wx-leaf" cx="${(i * 61) % 400}" cy="${20 + (i * 37) % 180}" rx="3" ry="1.6" fill="#8fb35a" stroke="none" style="animation-delay:-${i * 0.4}s"/>`).join('')}</g>`;
  }
  return '';
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

// 首都圏版の海：東京湾をまるごと（横浜・横須賀・房総の岸）と、相模湾
const BAY_WIDE = [[35.53, 139.775], [35.56, 139.768], [35.59, 139.762], [35.62, 139.754], [35.636, 139.76], [35.645, 139.772],
  [35.642, 139.80], [35.646, 139.83], [35.65, 139.86], [35.648, 139.90], [35.685, 139.985], [35.645, 140.04], [35.58, 140.09],
  [35.48, 140.03], [35.38, 139.91], [35.31, 139.79], [35.18, 139.80], [35.18, 139.72], [35.25, 139.745], [35.28, 139.67],
  [35.33, 139.64], [35.41, 139.665], [35.45, 139.65], [35.51, 139.74]];
const SAGAMI = [[35.18, 139.05], [35.25, 139.15], [35.30, 139.40], [35.31, 139.48], [35.30, 139.55], [35.26, 139.60], [35.18, 139.64]];
const RIVERS_WIDE = [
  { name: '江戸川', label: 2, pts: [[35.98, 139.86], [35.88, 139.885], [35.80, 139.90], [35.74, 139.905], [35.68, 139.90], [35.65, 139.895]] },
  { name: '相模川', label: 2, pts: [[35.60, 139.33], [35.52, 139.36], [35.44, 139.38], [35.36, 139.38], [35.32, 139.385]] },
];
const bayPoints = () => (MAP_SCENARIO === 'shutoken' ? BAY_WIDE : BAY);

// ---------- 版ごとの風景 ----------
// sc.scenery = { lands: 陸の多角形（あれば海の上に陸を描く）, seas: 海, lakes: 湖, rivers: 川, labels: [{ t, at: [緯度, 経度], kind: 'sea' | 'region' }] }
const sceneryOf = () => (SCENARIOS[MAP_SCENARIO] && SCENARIOS[MAP_SCENARIO].scenery) || null;
const inPolygon = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
// 地図の座標 (x, y) が水の上か（木や飾りを置かないため）
function waterTest() {
  const sc = sceneryOf();
  const toPts = (poly) => poly.map(([la, lo]) => MAP.geo(la, lo));
  if (!sc) { const bay = toPts(bayPoints()); return (x, y) => inPolygon(bay, x, y); }
  const lands = (sc.lands || []).map(toPts), water = [...(sc.seas || []), ...(sc.lakes || [])].map(toPts), isles = (sc.islands || []).map(toPts);
  return (x, y) => (lands.length && !lands.some((p) => inPolygon(p, x, y))) || (water.some((p) => inPolygon(p, x, y)) && !isles.some((p) => inPolygon(p, x, y)));
}
function drawRivers(list) {
  let s = '';
  list.forEach((r) => {
    const pts = r.pts.map(([la, lo]) => MAP.geo(la, lo));
    const d = smoothPath(pts);
    s += `<path class="river" d="${d}"/><path class="river-hi" d="${d}"/>`;
    const p = pts[r.label], q = pts[r.label + 1];
    if (!p || !q) return;
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const a = ang > 90 || ang < -90 ? ang + 180 : ang;
    s += `<text class="map-label river-name" transform="translate(${((p.x + q.x) / 2).toFixed(0)},${((p.y + q.y) / 2 - 8).toFixed(0)}) rotate(${a.toFixed(0)})">${r.name}</text>`;
  });
  return s;
}
function editionScenery(sc) {
  const g = MAP.geo, W = MAP.width, H = MAP.height;
  const poly = (pts) => pathFrom(pts.map(([la, lo]) => g(la, lo)), true);
  let s = '';
  if (sc.lands) {
    s += `<rect class="bay" width="${W}" height="${H}"/><rect class="bay-waves" width="${W}" height="${H}"/>`;
    sc.lands.forEach((l) => { s += `<path class="land" d="${poly(l)}"/>`; });
  }
  (sc.seas || []).forEach((p) => { s += `<path class="bay" d="${poly(p)}"/><path class="bay-waves" d="${poly(p)}"/>`; });
  (sc.islands || []).forEach((p) => { s += `<path class="land" d="${poly(p)}"/>`; }); // 海に浮かぶ島（淡路島など）
  (sc.lakes || []).forEach((p) => { s += `<path class="bay lake" d="${poly(p)}"/><path class="bay-waves" d="${poly(p)}"/>`; });
  s += drawRivers(sc.rivers || []);
  s += inkMountains();
  s += seasonTrees();
  const clouds = [[W * 0.02, H * 0.82, 260], [W * 0.55, H * 0.03, 300], [W * 0.78, H * 0.22, 220], [W * 0.25, H * 0.06, 200]];
  clouds.forEach(([x, y, w]) => {
    s += `<g class="kasumi" transform="translate(${x.toFixed(0)},${y.toFixed(0)}) scale(${(w / 100).toFixed(2)})">
      <path transform="translate(0,34)" d="M0,0 Q-6,-14 10,-16 Q14,-28 32,-24 Q44,-34 60,-24 Q80,-28 84,-14 Q100,-12 96,0 Z"/></g>`;
  });
  (sc.labels || []).forEach((l) => {
    const p = g(l.at[0], l.at[1]);
    s += `<text class="map-label ${l.kind || 'region'}" x="${p.x.toFixed(0)}" y="${p.y.toFixed(0)}">${l.t}</text>`;
  });
  return s;
}

function sceneryMarkup() {
  const esc = sceneryOf();
  if (esc) return editionScenery(esc);
  const g = MAP.geo;
  const W = MAP.width, H = MAP.height;
  const wide = MAP_SCENARIO === 'shutoken';
  let s = '';

  // 山（多摩の奥）
  const hachi = MAP.byId.hachioji;
  const mx = hachi ? hachi.x - 40 : -9999, my = hachi ? hachi.y - 150 : -9999;
  if (hachi) s += `<g class="mountains" transform="translate(${mx},${my})">
    <path d="M-80,120 C-40,60 -20,20 20,0 C50,30 70,60 120,120 Z" fill="#8aa0bd"/>
    <path d="M40,120 C80,50 100,30 130,15 C160,45 190,80 230,120 Z" fill="#9fb0c8" opacity="0.9"/>
    <path d="M-20,120 C10,80 30,65 60,55 C90,75 110,95 140,120 Z" fill="#b7c4d6"/>
    <path class="snowcap" d="M8,10 L20,0 L32,12 L26,9 L20,14 L14,9Z M112,24 L130,15 L146,28 L138,25 L130,30 L122,25Z"/>
  </g>`;

  // 東京湾
  const bay = bayPoints().map(([la, lo]) => g(la, lo));
  s += `<path class="bay" d="${pathFrom(bay, true)}"/>`;
  s += `<path class="bay-waves" d="${pathFrom(bay, true)}"/>`;
  const bl = wide ? g(35.45, 139.85) : g(35.60, 139.86);
  s += `<text class="map-label sea" x="${bl.x}" y="${bl.y}">東京湾</text>`;
  if (wide) {
    const sg = SAGAMI.map(([la, lo]) => g(la, lo));
    s += `<path class="bay" d="${pathFrom(sg, true)}"/><path class="bay-waves" d="${pathFrom(sg, true)}"/>`;
    const sl = g(35.22, 139.40);
    s += `<text class="map-label sea" x="${sl.x}" y="${sl.y}">相模湾</text>`;
  }

  // 川
  (wide ? [...RIVERS, ...RIVERS_WIDE] : RIVERS).forEach((r) => {
    const pts = r.pts.map(([la, lo]) => g(la, lo));
    const d = smoothPath(pts);
    s += `<path class="river" d="${d}"/><path class="river-hi" d="${d}"/>`;
    const p = pts[r.label], q = pts[r.label + 1];
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const a = ang > 90 || ang < -90 ? ang + 180 : ang;
    s += `<text class="map-label river-name" transform="translate(${((p.x + q.x) / 2).toFixed(0)},${((p.y + q.y) / 2 - 8).toFixed(0)}) rotate(${a.toFixed(0)})">${r.name}</text>`;
  });

  s += inkMountains();
  s += seasonTrees();

  // 金の霞（すやり霞）
  const clouds = [[W * 0.02, H * 0.82, 260], [W * 0.55, H * 0.03, 300], [W * 0.78, H * 0.22, 220], [W * 0.25, H * 0.06, 200]];
  clouds.forEach(([x, y, w]) => {
    s += `<g class="kasumi" transform="translate(${x.toFixed(0)},${y.toFixed(0)}) scale(${(w / 100).toFixed(2)})">
      <path transform="translate(0,34)" d="M0,0 Q-6,-14 10,-16 Q14,-28 32,-24 Q44,-34 60,-24 Q80,-28 84,-14 Q100,-12 96,0 Z"/></g>`;
  });

  // 地域名
  const tama = MAP.nodes.filter((n) => !n.pref && n.ward.endsWith('市'));
  if (tama.length) {
    const avgX = tama.reduce((a, n) => a + n.x, 0) / tama.length;
    s += `<text class="map-label region" x="${avgX.toFixed(0)}" y="${(Math.max(...tama.map((n) => n.y)) + 90).toFixed(0)}">多 摩</text>`;
  }
  const ku = MAP.nodes.filter((n) => !n.pref && n.ward.endsWith('区'));
  const kx = ku.reduce((a, n) => a + n.x, 0) / ku.length;
  s += `<text class="map-label region" x="${kx.toFixed(0)}" y="${wide ? (Math.min(...ku.map((n) => n.y)) - 60).toFixed(0) : 46}">${MAP_SCENARIO === 'toshin' ? '江 戸 都 心' : '江 戸 二 十 三 区'}</text>`;
  // 首都圏版：県の名（その県の学校の真ん中あたり）
  if (wide) {
    const avg = (ns, k) => ns.reduce((a, n) => a + n[k], 0) / ns.length;
    const pos = { 神奈川: (ns) => [avg(ns, 'x') - 60, Math.max(...ns.map((n) => n.y)) + 70], 埼玉: (ns) => [avg(ns, 'x'), Math.min(...ns.map((n) => n.y)) - 60], 千葉: (ns) => [avg(ns, 'x') + 40, Math.max(...ns.map((n) => n.y)) + 70] };
    Object.entries(pos).forEach(([pref, at]) => {
      const ns = MAP.nodes.filter((n) => n.pref === pref);
      if (!ns.length) return;
      const [x, y] = at(ns);
      s += `<text class="map-label region" x="${x.toFixed(0)}" y="${Math.min(H - 20, Math.max(40, y)).toFixed(0)}">${pref.split('').join(' ')}</text>`;
    });
  }
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
// 金屏風：金箔の地に、すやり霞の金雲、群青の川、三家の天守、松、幟の行列。四曲の折り目に陰、黒漆の縁
function titleArt(season = realSeason()) {
  const K = '#1c1a17', P = '#f1e6cc';
  const r = seeded(4242 + season);
  // すやり霞：角の丸い長い金雲。縁を茶で取り、内側に一段明るい金
  const kasumi = (x, y, w, h = 30) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#tb-kin)" stroke="#7a5418" stroke-width="2.5"/>
    <rect x="${x + 8}" y="${y + 5}" width="${w - 16}" height="${h - 10}" rx="${(h - 10) / 2}" fill="none" stroke="#f6dc8a" stroke-width="1.6" opacity="0.8"/></g>`;
  const pine = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M0,40 Q-4,20 4,6 Q10,-6 2,-18" stroke="#3b2a22" stroke-width="6" fill="none" stroke-linecap="round"/>
    ${[[-14, -18, 18], [12, -8, 16], [-4, -30, 15], [16, -26, 12]].map(([cx, cy, w]) => `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${w * 0.42}" fill="#2f5d3a" stroke="${K}" stroke-width="2"/><path d="M${cx - w * 0.7},${cy} H${cx + w * 0.7}" stroke="#4f8a5a" stroke-width="1.4"/>`).join('')}</g>`;
  const keep = (x, y, s, clan) => `<g class="zk-castle" style="--c:${CLANS[clan] ? CLANS[clan].color : '#c8372d'}" transform="translate(${x},${y}) scale(${s})">${castleMarkup(true)}</g>`;
  const marchers = Array.from({ length: 9 }, (_, i) => {
    const x = 40 + i * 20, y = 560 + Math.sin(i * 0.8) * 3;
    return `<g transform="translate(${x},${y}) scale(0.9)">${soldier(i % 3 === 0 ? '#c8372d' : '#22406b', false)}</g>`;
  }).join('');
  const seams = [100, 200, 300].map((x, i) => `<rect x="${x - (i % 2 ? 0 : 40)}" y="0" width="40" height="800" fill="url(#tb-fold${i % 2})"/><line x1="${x}" y1="0" x2="${x}" y2="800" stroke="#7a5418" stroke-width="1.5" opacity="0.6"/>`).join('');
  const dust = Array.from({ length: 40 }, () => `<rect x="${(r() * 400).toFixed(0)}" y="${(r() * 620).toFixed(0)}" width="${(2 + r() * 4).toFixed(1)}" height="${(2 + r() * 4).toFixed(1)}" fill="#f6dc8a" opacity="${(0.4 + r() * 0.5).toFixed(2)}" transform="rotate(${(r() * 90).toFixed(0)})"/>`).join('');
  return `<svg class="byobu" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <pattern id="tb-kin" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#e2b64c"/><rect width="12" height="12" fill="#e9c25e"/><rect x="12" y="12" width="12" height="12" fill="#d8aa40"/><path d="M0,0 H24 V24" fill="none" stroke="#c99a35" stroke-width="0.6"/></pattern>
      <linearGradient id="tb-fold0" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a2408" stop-opacity="0.12"/></linearGradient>
      <linearGradient id="tb-fold1" x1="0" x2="1"><stop offset="0" stop-color="#fff6d6" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="tb-river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a4f8f"/><stop offset="1" stop-color="#1b3466"/></linearGradient>
    </defs>
    <rect width="400" height="800" fill="url(#tb-kin)"/>
    ${dust}
    <circle cx="300" cy="190" r="86" fill="#c8372d"/>
    <circle cx="294" cy="184" r="86" fill="none" stroke="${K}" stroke-width="4"/>
    ${titleSeasonArt(season)}
    <path d="M70,330 L136,248 L202,330Z" fill="#3c6aa3" stroke="${K}" stroke-width="3.5"/>
    <path d="M116,272 L136,248 L156,272 L148,268 L142,277 L136,268 L129,277 L123,268Z" fill="${P}" stroke="${K}" stroke-width="2.5"/>
    ${kasumi(-20, 300, 250, 34)}${kasumi(210, 284, 220, 30)}
    <path d="M0,360 Q80,340 150,360 T300,352 T400,358 L400,470 L0,470Z" fill="#6f9a5a" stroke="${K}" stroke-width="3"/>
    <path d="M-10,440 Q90,400 180,430 Q270,462 410,410 L410,452 Q270,500 180,470 Q90,440 -10,482Z" fill="url(#tb-river)" stroke="${K}" stroke-width="3"/>
    <path d="M30,452 q12,-8 24,0 M120,440 q12,-8 24,0 M230,462 q12,-8 24,0 M330,440 q12,-8 24,0" stroke="#cfe0f0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${keep(312, 404, 1.4, 'kaisei')}${pine(40, 392, 1)}${keep(118, 428, 1.7, 'azabu')}${pine(372, 424, 0.8)}${keep(222, 392, 1.1, 'tsukukoma')}
    ${kasumi(150, 478, 280, 34)}${kasumi(-30, 500, 160, 28)}
    <path d="M0,540 Q100,528 200,540 T400,536 L400,620 L0,620Z" fill="#b69a6a" stroke="${K}" stroke-width="3"/>
    <path d="M20,572 Q200,560 380,572" stroke="#8d7550" stroke-width="2" fill="none"/>
    <g class="tb-march">${marchers}${[40, 100, 160].map((x, i) => bfNobori(x, 566, 54, 'azabu', false, i * 0.4)).join('')}</g>
    ${pine(330, 590, 1.2)}
    ${kasumi(200, 606, 240, 30)}
    <path d="M0,650 Q48,600 96,630 Q132,580 192,622 Q240,570 300,616 Q348,584 400,620 L400,800 L0,800Z" fill="#22406b" stroke="${K}" stroke-width="5"/>
    <path d="M96,630 q-8,-12 5,-20 q-3,10 8,12 M192,622 q-8,-12 5,-20 q-3,10 8,12 M300,616 q-8,-12 5,-20 q-3,10 8,12" fill="${P}" stroke="${K}" stroke-width="2.5"/>
    <path d="M0,690 Q48,654 96,680 T192,676 T300,670 T400,676 M0,730 Q48,700 96,722 T192,716 T300,710 T400,716" fill="none" stroke="#3c6aa3" stroke-width="5"/>
    ${seams}
    <rect x="0" y="0" width="400" height="800" fill="none" stroke="#120b08" stroke-width="10"/>
    <rect x="5" y="5" width="390" height="790" fill="none" stroke="#c99a2e" stroke-width="2"/>
  </svg>`;
}

// ---------- 季節の行事の一枚絵（錦絵風・340×150） ----------
// 校舎：横長の学び舎に時計塔。屋根と窓の色、雪で季節を出す
function schoolHouse(x, y, { roof = '#22406b', wall = '#f1e6cc', win = '#22406b', snow = false } = {}) {
  const wins = [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${x + 10 + i * 22}" y="${y + 20}" width="12" height="12" fill="${win}" stroke="#1c1a17" stroke-width="1.5"/>`).join('');
  const snowCap = snow
    ? `<path d="M${x - 6},${y + 12} Q${x + 72},${y + 4} ${x + 150},${y + 12} L${x + 140},${y + 3} Q${x + 72},${y - 2} ${x + 4},${y + 3}Z" fill="#fffaf0"/>
       <path d="M${x + 52},${y - 20} L${x + 72},${y - 36} L${x + 92},${y - 20} Q${x + 72},${y - 27} ${x + 52},${y - 20}Z" fill="#fffaf0"/>`
    : '';
  return `<g>
    <rect x="${x}" y="${y + 10}" width="144" height="40" fill="${wall}" stroke="#1c1a17" stroke-width="2.5"/>
    <path d="M${x - 6},${y + 12} L${x + 150},${y + 12} L${x + 140},${y + 2} L${x + 4},${y + 2}Z" fill="${roof}" stroke="#1c1a17" stroke-width="2.5"/>
    ${wins}
    <rect x="${x + 57}" y="${y - 22}" width="30" height="34" fill="${wall}" stroke="#1c1a17" stroke-width="2.5"/>
    <path d="M${x + 52},${y - 20} L${x + 72},${y - 36} L${x + 92},${y - 20}Z" fill="${roof}" stroke="#1c1a17" stroke-width="2.5"/>
    <circle cx="${x + 72}" cy="${y - 7}" r="8" fill="#fffaf0" stroke="#1c1a17" stroke-width="2"/>
    <path d="M${x + 72},${y - 7} L${x + 72},${y - 12} M${x + 72},${y - 7} L${x + 76},${y - 6}" stroke="#1c1a17" stroke-width="1.6"/>
    <rect x="${x + 64}" y="${y + 34}" width="16" height="16" fill="#1c1a17"/>
    ${snowCap}
  </g>`;
}

function seasonArt(kind) {
  const W = 340, H = 150;
  const frame = `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="#1c1a17" stroke-width="4"/>`;
  const r = seeded(kind.length * 31 + 7);
  const open = `<svg viewBox="0 0 ${W} ${H}" class="season-art" aria-hidden="true">`;

  if (kind === 'spring') {
    const petals = Array.from({ length: 26 }, () => {
      const x = (r() * W).toFixed(0), y = (r() * H).toFixed(0), a = (r() * 180).toFixed(0);
      return `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2" fill="#f6c9cd" stroke="#e9a3a8" stroke-width=".6" transform="rotate(${a} ${x} ${y})"/>`;
    }).join('');
    const tree = (x, s) => `<g transform="translate(${x},70) scale(${s})">
      <path d="M0,60 L0,10 M0,22 L-14,6 M0,18 L12,2" stroke="#4a3328" stroke-width="5" fill="none"/>
      <circle cx="-14" cy="-2" r="20" fill="#f3c6cb"/><circle cx="12" cy="-8" r="22" fill="#eeb3b9"/><circle cx="0" cy="-22" r="18" fill="#f6d2d5"/></g>`;
    return `${open}<rect width="${W}" height="${H}" fill="#fbeee6"/>
      <rect width="${W}" height="70" fill="url(#bokashi)" opacity=".35"/>
      <rect y="122" width="${W}" height="28" fill="#d9c9a3"/>
      ${schoolHouse(98, 74, { roof: '#c8372d' })}
      ${tree(78, 0.8)}${tree(262, 0.85)}${tree(40, 1.1)}${tree(300, 1.15)}
      ${petals}${frame}</svg>`;
  }

  if (kind === 'summer') {
    const burst = (cx, cy, rad, col) => Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const x1 = (cx + Math.cos(a) * rad * 0.35).toFixed(1), y1 = (cy + Math.sin(a) * rad * 0.35).toFixed(1);
      const x2 = (cx + Math.cos(a) * rad).toFixed(1), y2 = (cy + Math.sin(a) * rad).toFixed(1);
      const x3 = (cx + Math.cos(a) * rad * 1.1).toFixed(1), y3 = (cy + Math.sin(a) * rad * 1.1).toFixed(1);
      return `<path d="M${x1},${y1} L${x2},${y2}" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${x3}" cy="${y3}" r="1.8" fill="${col}"/>`;
    }).join('');
    const stars = Array.from({ length: 22 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 70).toFixed(0)}" r="${(0.6 + r()).toFixed(1)}" fill="#f1e6cc" opacity=".7"/>`).join('');
    const lanterns = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<g transform="translate(${30 + i * 40},${(86 + Math.sin(i) * 3).toFixed(1)})">
      <path d="M0,-10 L0,-4" stroke="#1c1a17"/><ellipse rx="7" ry="9" fill="#c8372d" stroke="#1c1a17" stroke-width="1.5"/><path d="M-7,0 L7,0" stroke="#e0a526" stroke-width="1.2"/></g>`).join('');
    return `${open}<defs><linearGradient id="sa-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101a33"/><stop offset="1" stop-color="#22406b"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#sa-night)"/>${stars}
      ${burst(80, 44, 30, '#e0a526')}${burst(200, 34, 26, '#e9a3a8')}${burst(276, 58, 22, '#c8372d')}${burst(140, 66, 14, '#f1e6cc')}
      <path d="M0,76 Q170,66 340,76" stroke="#1c1a17" stroke-width="1.5" fill="none"/>${lanterns}
      <rect y="112" width="${W}" height="38" fill="url(#seigaiha)"/>
      <path d="M0,112 L${W},112" stroke="#1c1a17" stroke-width="3"/>${frame}</svg>`;
  }

  if (kind === 'autumn') {
    const leaves = Array.from({ length: 18 }, () => {
      const x = (r() * W).toFixed(0), y = (r() * H).toFixed(0), a = (r() * 360).toFixed(0);
      const c = ['#c8372d', '#e0a526', '#d9622b'][Math.floor(r() * 3)];
      return `<path transform="translate(${x},${y}) rotate(${a}) scale(.9)" d="M0,-7 L2,-2 L7,-3 L3,1 L5,6 L0,3 L-5,6 L-3,1 L-7,-3 L-2,-2Z" fill="${c}"/>`;
    }).join('');
    const lanterns = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const x = 20 + i * 37.5, y = 34 - Math.pow((x - 170) / 170, 2) * 14;
      return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="6.5" ry="8.5" fill="${i % 2 ? '#e0a526' : '#c8372d'}" stroke="#1c1a17" stroke-width="1.5"/>`;
    }).join('');
    const nobori = (x, col, txt) => `<g transform="translate(${x},52)"><path d="M0,0 L0,72" stroke="#1c1a17" stroke-width="2.5"/>
      <rect x="2" y="2" width="16" height="50" fill="${col}" stroke="#1c1a17" stroke-width="1.5"/>
      ${[...txt].map((ch, i) => `<text x="10" y="${18 + i * 14}" font-size="11" fill="#fffaf0" text-anchor="middle" font-weight="900">${ch}</text>`).join('')}</g>`;
    return `${open}<defs><linearGradient id="sa-eve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a05a"/><stop offset=".7" stop-color="#f6dcb0"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#sa-eve)"/>
      <circle cx="282" cy="40" r="20" fill="#c8372d" opacity=".85"/>
      <rect y="122" width="${W}" height="28" fill="#cdb98f"/>
      ${schoolHouse(98, 74, { roof: '#6b3a5e', win: '#e0a526' })}
      <path d="M0,22 Q170,48 340,22" stroke="#1c1a17" stroke-width="1.5" fill="none"/>${lanterns}
      ${nobori(40, '#c8372d', '文化祭')}${nobori(66, '#22406b', '模擬店')}${nobori(258, '#5d8a4a', '演劇部')}
      ${leaves}${frame}</svg>`;
  }

  // 冬：雪の学び舎と梅
  const snow = Array.from({ length: 40 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(1 + r() * 1.6).toFixed(1)}" fill="#fffaf0" opacity=".9"/>`).join('');
  const ume = [[30, 30], [52, 18], [70, 36], [44, 50], [86, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#c8372d"/><circle cx="${x}" cy="${y}" r="1.4" fill="#e0a526"/>`).join('');
  return `${open}<defs><linearGradient id="sa-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2846"/><stop offset="1" stop-color="#4b6286"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sa-win)"/>
    <circle cx="236" cy="30" r="14" fill="#f1e6cc"/><circle cx="242" cy="26" r="13" fill="#1f2b4a"/>
    <rect y="120" width="${W}" height="30" fill="#f4efe4"/>
    ${schoolHouse(98, 74, { roof: '#22406b', win: '#f3d27a', snow: true })}
    <path d="M0,40 C30,34 60,40 96,22" stroke="#3b2a22" stroke-width="5" fill="none"/>
    <path d="M40,37 L56,52 M66,32 L72,14" stroke="#3b2a22" stroke-width="3" fill="none"/>${ume}
    ${snow}${frame}</svg>`;
}

// ---------- 地図の季節の木（春：桜、夏：青葉、秋：紅葉、冬：雪） ----------
// 色はCSSで季節ごとに変える。城や湾に重ならない場所に、決まった配置で植える
function seasonTrees() {
  const inBay = waterTest();
  const r = seeded(MAP.nodes.length * 13 + 5);
  const trees = [];
  MAP.nodes.forEach((n) => {
    for (let k = 0; k < 2; k++) {
      const a = r() * Math.PI * 2, d = 44 + r() * 20;
      const x = n.x + Math.cos(a) * d, y = n.y + Math.sin(a) * d * 0.8;
      if (x < 20 || y < 30 || x > MAP.width - 20 || y > MAP.height - 20 || inBay(x, y)) continue;
      if (MAP.nodes.some((m) => Math.hypot(m.x - x, m.y - y) < 40)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 26)) continue;
      trees.push({ x, y, s: 0.85 + r() * 0.4 });
    }
  });
  return `<g class="trees">${trees.map((t) => `<g class="tree" transform="translate(${t.x.toFixed(0)},${t.y.toFixed(0)}) scale(${t.s.toFixed(2)})">
    <path class="trunk" d="M0,2 L0,-8"/>
    <circle class="crown c2" cx="-7" cy="-9" r="6.5"/><circle class="crown c2" cx="7" cy="-9" r="6.5"/><circle class="crown" cy="-15" r="8"/>
    <path class="cap" d="M-8,-19 Q0,-26 8,-19 Q4,-21 0,-20 Q-4,-21 -8,-19Z"/></g>`).join('')}</g>`;
}

// ---------- タイトルの季節（遊ぶ日の月で決まる） ----------
// 0 春（3〜5月）・1 夏（6〜8月）・2 秋（9〜11月）・3 冬（12〜2月）
function realSeason(d = new Date()) {
  return Math.floor(((d.getMonth() + 10) % 12) / 3);
}
// 右上から垂れる枝（春：桜／秋：紅葉／冬：紅梅）と、夏の花火・冬の雪
function titleSeasonArt(season) {
  const K = '#1c1a17';
  const r = seeded(97 + season);
  const branch = `<path d="M410,-6 C360,30 330,40 300,78 M352,34 C340,58 318,70 292,74 M330,50 C334,80 352,96 372,104" fill="none" stroke="#3b2a22" stroke-width="7" stroke-linecap="round"/>`;
  const along = [[300, 78], [292, 74], [316, 66], [338, 46], [372, 104], [356, 92], [344, 30], [370, 18], [324, 58], [306, 86]];
  if (season === 0) {
    const fl = along.map(([x, y]) => `<g transform="translate(${x},${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="5" ry="7" cy="-6" transform="rotate(${a})" fill="#f6d2d5" stroke="${K}" stroke-width="1.2"/>`).join('')}<circle r="2.5" fill="#c8372d"/></g>`).join('');
    return branch + fl;
  }
  if (season === 1) {
    const burst = (cx, cy, rad, col) => Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return `<path d="M${(cx + Math.cos(a) * rad * 0.3).toFixed(1)},${(cy + Math.sin(a) * rad * 0.3).toFixed(1)} L${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;
    }).join('');
    return `<g opacity=".9">${burst(330, 70, 48, '#e0a526')}${burst(250, 40, 30, '#e9a3a8')}${burst(372, 150, 24, '#f1e6cc')}</g>`;
  }
  if (season === 2) {
    const lv = along.map(([x, y], i) => `<path transform="translate(${x},${y}) rotate(${(r() * 360).toFixed(0)}) scale(1.6)" d="M0,-7 L2,-2 L7,-3 L3,1 L5,6 L0,3 L-5,6 L-3,1 L-7,-3 L-2,-2Z" fill="${i % 3 ? '#c8372d' : '#e0a526'}" stroke="${K}" stroke-width=".8"/>`).join('');
    return branch + lv;
  }
  const ume = along.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#c8372d" stroke="${K}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="2" fill="#e0a526"/>`).join('');
  const snow = Array.from({ length: 46 }, () => `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 600).toFixed(0)}" r="${(1.5 + r() * 2.5).toFixed(1)}" fill="#fffaf0" stroke="${K}" stroke-width=".6"/>`).join('');
  return branch + ume + snow;
}

// ---------- 城下町（経済で育つ町並み） ----------
// 城の左右に町家・のぼり・屋台・提灯が増えていく。data-lv の段階に達したものだけ見せる（ui.js の render で切り替え）
const TOWN_LEVELS = [
  { eco: 0, name: '田畑の村' },
  { eco: 70, name: '門前町' },
  { eco: 100, name: '宿場町' },
  { eco: 140, name: '城下町' },
  { eco: 190, name: '天下の大都' },
];
const townLevel = (eco) => TOWN_LEVELS.reduce((lv, t, i) => (eco >= t.eco ? i : lv), 0);
function townMarkup() {
  const house = (x, y, lv, s = 1) => `<g class="th" data-lv="${lv}" transform="translate(${x},${y}) scale(${s})">
    <rect class="tw" x="-4.5" y="-5" width="9" height="6"/><rect class="tdoor" x="-1.3" y="-2.6" width="2.6" height="3.6"/>
    <path class="tr" d="M-6,-4.6 L0,-9.5 L6,-4.6Z"/></g>`;
  const nobori = (x, y, lv) => `<g class="tn" data-lv="${lv}" transform="translate(${x},${y})">
    <path class="pole" d="M0,2 V-17 M0,-16 H4.5"/><rect class="flag" x="0.6" y="-16" width="4.2" height="12"/></g>`;
  return `<g class="town">
    <path class="field" data-lv="0" d="M-46,15 l12,-4 l12,4 l-12,4Z M22,15 l12,-4 l12,4 l-12,4Z"/>
    ${house(-33, 13, 1)}${house(33, 13, 1)}
    ${house(-43, 9, 2, 0.9)}${house(43, 9, 2, 0.9)}${nobori(-25, 13, 2)}${nobori(25, 13, 2)}
    <g class="ty" data-lv="3" transform="translate(-38,20)"><rect class="tw" x="-5" y="-4" width="10" height="5"/><path class="awning" d="M-6.5,-4 L-5,-8 H5 L6.5,-4Z"/></g>
    <g class="tl" data-lv="3" transform="translate(38,19)"><path class="pole" d="M0,2 V-7"/><ellipse class="lamp" cx="0" cy="-8" rx="2.6" ry="3.4"/></g>
    <g class="tf" data-lv="4"><path class="string" d="M-46,-1 Q-36,5 -26,0 M26,0 Q36,5 46,-1"/>
      ${[-41, -36, -31, 31, 36, 41].map((x) => `<circle class="lamp" cx="${x}" cy="${Math.abs(x) === 36 ? 3.2 : 1.8}" r="1.7"/>`).join('')}</g>
    ${house(-46, 18, 4, 0.8)}${house(46, 18, 4, 0.8)}
    <g class="tk" data-lv="4" transform="translate(-48,4)"><path class="pole" d="M-3,8 L0,-10 L3,8 M-2.2,2 H2.2 M-1.4,-4 H1.4"/><path class="tr" d="M-3.5,-10 L0,-13.5 L3.5,-10Z"/></g>
  </g>`;
}

// ---------- 墨の山なみ：地図の空いた陸に、筆で掃いたような山を置く ----------
// 城や水から離れた所に、地図の大きさに応じた数だけ。濃い墨の稜線から下へ薄れていく
function inkMountains() {
  const wet = waterTest();
  const r = seeded(MAP.nodes.length * 31 + 7);
  const want = Math.max(4, Math.round(MAP.nodes.length / 7));
  const peaks = [];
  for (let tries = 0; peaks.length < want && tries < want * 40; tries++) {
    const x = 60 + r() * (MAP.width - 120), y = 60 + r() * (MAP.height - 120);
    if (wet(x, y) || wet(x, y + 30)) continue;
    if (MAP.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 95)) continue;
    if (peaks.some((p) => Math.hypot(p.x - x, p.y - y) < 160)) continue;
    peaks.push({ x, y, s: 0.8 + r() * 0.7, f: r() < 0.5 ? -1 : 1 });
  }
  return `<g class="ink-mtn">${peaks.map((p) => `<g transform="translate(${p.x.toFixed(0)},${p.y.toFixed(0)}) scale(${(p.s * p.f).toFixed(2)},${p.s.toFixed(2)})">
    <path class="m3" d="M-70,28 Q-40,-8 -16,-20 Q2,-10 20,4 Q40,-6 70,28Z"/>
    <path class="m1" d="M-50,28 Q-30,-14 -8,-46 Q6,-30 18,-12 Q30,-24 52,28Z"/>
    <path class="m2" d="M-8,-46 Q-14,-30 -26,-12 M-8,-46 Q2,-26 -2,-6 M18,-12 Q14,0 8,10" fill="none"/></g>`).join('')}</g>`;
}

// ---------- 城下町の普請：区画に建つ施設の絵（足もと中央が 0,0。幅およそ 56） ----------
function facArt(k, color = '#c8372d') {
  const K = '#1c1a17', P = '#f1e6cc', W = '#e8dcc0';
  const roof = (w, y, h, fill = '#3a3f4a') => `<path d="M${-w},${y} L${-w + 6},${y - h} L${w - 6},${y - h} L${w},${y} Z" fill="${fill}" stroke="${K}" stroke-width="1.6"/>`;
  const wall = (w, y, h, fill = W) => `<rect x="${-w}" y="${y}" width="${w * 2}" height="${h}" fill="${fill}" stroke="${K}" stroke-width="1.6"/>`;
  switch (k) {
    case 'shop': // 購買部：のれんの商家
      return `${wall(22, -24, 24)}${roof(26, -24, 10)}<rect x="-16" y="-22" width="32" height="9" fill="${color}" stroke="${K}" stroke-width="1"/>
        <path d="M-8,-22 V-13 M0,-22 V-13 M8,-22 V-13" stroke="${P}" stroke-width="1"/><text x="0" y="-15.5" font-size="6" text-anchor="middle" fill="${P}" font-weight="900">購</text>
        <rect x="-14" y="-10" width="28" height="10" fill="#6b4a2c" stroke="${K}" stroke-width="1"/>`;
    case 'library': // 図書館：白壁の蔵
      return `${wall(18, -30, 30, P)}${roof(22, -30, 10, '#2f3a4a')}<rect x="-18" y="-8" width="36" height="8" fill="#2b2622"/>
        <rect x="-5" y="-24" width="10" height="9" fill="${K}"/><path d="M-12,-8 V0 M12,-8 V0" stroke="#4a423a"/>`;
    case 'gym': // 体育館：大屋根の館
      return `${wall(26, -20, 20)}<path d="M-30,-20 Q0,-40 30,-20 Z" fill="#7a3a2a" stroke="${K}" stroke-width="1.6"/>
        <rect x="-6" y="-14" width="12" height="14" fill="#6b4a2c" stroke="${K}" stroke-width="1"/><path d="M-20,-14 h8 M12,-14 h8" stroke="${K}" stroke-width="2"/>`;
    case 'tower': // 物見やぐら
      return `<path d="M-10,0 L-6,-34 M10,0 L6,-34 M-9,-10 L9,-22 M9,-10 L-9,-22" stroke="#5a3a22" stroke-width="2.4" fill="none"/>
        <rect x="-10" y="-42" width="20" height="9" fill="${W}" stroke="${K}" stroke-width="1.4"/>${roof(14, -42, 7)}
        <rect x="-3" y="-60" width="1.6" height="12" fill="${K}"/><rect x="-1.4" y="-60" width="8" height="5" fill="${color}" stroke="${K}" stroke-width="0.8"/>`;
    case 'market': // 楽市：日よけの屋台が並ぶ
      return [-17, 0, 17].map((x, i) => `<g transform="translate(${x},0)"><rect x="-7" y="-12" width="14" height="12" fill="#a87b4f" stroke="${K}" stroke-width="1.2"/>
        <path d="M-10,-12 L10,-12 L8,-20 L-8,-20 Z" fill="${i === 1 ? color : i ? '#2d5fb4' : '#e0a526'}" stroke="${K}" stroke-width="1.2"/>
        <path d="M-6,-12 v3 M0,-12 v3 M6,-12 v3" stroke="${P}" stroke-width="1"/><circle cx="${i - 1}" cy="-5" r="2" fill="${['#e66', '#fd6', '#6a6'][i]}"/></g>`).join('') +
        `<rect x="-3" y="-34" width="1.4" height="14" fill="${K}"/><path d="M-1.6,-34 h9 v11 h-9 Z" fill="${P}" stroke="${K}" stroke-width="0.8"/><text x="3" y="-25.5" font-size="6" text-anchor="middle" font-weight="900" fill="${color}">市</text>`;
    case 'dojo': // 道場：看板を掲げた館
      return `${wall(22, -24, 24)}${roof(27, -24, 12, '#4a3a2a')}<rect x="-10" y="-34" width="20" height="8" fill="${P}" stroke="${K}" stroke-width="1"/>
        <text x="0" y="-28" font-size="6.5" text-anchor="middle" font-weight="900" fill="${K}">道場</text>
        <rect x="-8" y="-16" width="16" height="16" fill="#6b4a2c" stroke="${K}" stroke-width="1"/><path d="M0,-16 V0" stroke="${K}"/>`;
    case 'teahouse': // 茶屋：赤い野点傘と縁台
      return `${wall(14, -18, 18)}${roof(18, -18, 8, '#5a6a4a')}<rect x="-6" y="-14" width="12" height="9" fill="${color}" opacity="0.9"/>
        <path d="M16,-30 Q26,-40 36,-30 Z" fill="${color}" stroke="${K}" stroke-width="1.2"/><path d="M26,-30 V0" stroke="${K}" stroke-width="1.2"/>
        <rect x="14" y="-6" width="22" height="3" fill="#c94a3a" stroke="${K}" stroke-width="0.8"/><path d="M16,-3 v3 M34,-3 v3" stroke="${K}"/>`;
    default:
      return '';
  }
}
