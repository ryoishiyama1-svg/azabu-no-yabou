// 錦絵風の武将の胸像を、部品の組み合わせで描く
// ukiyoBust(o) → SVG の文字列（viewBox 0 0 200 220）
// o = { dir: 'L' | 'R', hair, garment, over, head, glasses, kuma, female, mood, color, clan, bg, str }
//   hair: 'spiky' とげ / 'neat' 七三 / 'long' 長髪 / 'pony' ポニーテール / 'bob' おかっぱ
//   garment: 'gakuran' 学ラン / 'sailor' セーラー服
//   over: 'kataginu' 肩衣 / 'haori' 羽織 / 'tasuki' たすき / null
//   head: 'hachimaki' 鉢巻 / 'hachigane' 鉢金 / null
//   mood: 'normal' / 'smile' 笑う / 'angry' 怒る / 'surprise' 驚く / 'frustrated' 悔しがる
//   bg: 'seigaiha' / 'asanoha' / 'ichimatsu'（見本帳の <defs> にある柄の名前）
// 絵は「左向き」を基準に描き、右向きは左右を反転する
const UKIYO = (() => {
  const INK = '#1c1a17', KINARI = '#f1e6cc', SHU = '#c8372d', SKIN = '#fbe7cc', SKIN2 = '#e8c7a2', GOLD = '#e0a526';

  // 色を暗くする（柄の線などに使う）
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  // 家の色ごとの亀甲柄を、必要になったときに作る
  const madePatterns = {};
  function kikkou(color) {
    const id = `kk${color.slice(1)}`;
    if (!madePatterns[id]) {
      madePatterns[id] = `<pattern id="${id}" width="24" height="41.6" patternUnits="userSpaceOnUse">
        <rect width="24" height="41.6" fill="${color}"/>
        <path d="M6,0 L18,0 L24,10.4 L18,20.8 L6,20.8 L0,10.4Z M6,20.8 L0,31.2 L6,41.6 M18,20.8 L24,31.2 L18,41.6" fill="none" stroke="${shade(color, 0.7)}" stroke-width="2"/>
        <path d="M8,4 L16,4 L20,10.4 L16,16.8 L8,16.8 L4,10.4Z" fill="none" stroke="${shade(color, 1.35)}" stroke-width="1"/></pattern>`;
      // ページに隠し置き場（#ukiyo-defs）があれば、すぐそこへ入れる
      const defs = typeof document !== 'undefined' && document.getElementById('ukiyo-defs');
      if (defs) defs.insertAdjacentHTML('beforeend', madePatterns[id]);
    }
    return `url(#${id})`;
  }
  // 作った柄を、ページの隠し <defs> に入れる
  function flushPatterns(defs) {
    if (defs && defs.id !== 'ukiyo-defs') defs.innerHTML = Object.values(madePatterns).join('');
  }

  // 家紋（小さく）
  function crest(clan, x, y, r) {
    const s = r / 44;
    const dia = (n, rot) => `<path d="M0,0 L7,-14 L0,-32 L-7,-14Z" transform="rotate(${rot})"/>`;
    const inner = {
      azabu: `<g fill="${INK}">${[0, 60, 120, 180, 240, 300].map((a) => dia(0, a)).join('')}</g>`,
      kaisei: `<g stroke="${INK}" stroke-width="8" stroke-linecap="round">${[0, 120, 240].map((a) => `<path d="M0,0 L0,-30" transform="rotate(${a})"/>`).join('')}</g><circle r="8" fill="${INK}"/>`,
      tsukukoma: `<path d="M-6,32 L-6,-32 M6,32 L6,-32" stroke="${INK}" stroke-width="7"/><path d="M-30,24 L30,-24" stroke="${INK}" stroke-width="9"/>`,
      hibiya: `<path d="M-28,18 Q-14,10 0,18 Q14,10 28,18 L28,30 Q14,22 0,30 Q-14,22 -28,30Z" fill="${INK}"/>
        <g transform="translate(0,-10)">${[0, 72, 144, 216, 288].map((a) => `<path d="M0,-3 Q-8,-18 0,-22 Q8,-18 0,-3Z" fill="${INK}" transform="rotate(${a})"/>`).join('')}</g>`,
      waseda: `<path d="M0,28 L0,4" stroke="${INK}" stroke-width="5"/><path d="M0,6 Q-32,0 -26,-22 Q-12,-32 0,-16 Q12,-32 26,-22 Q32,0 0,6Z" fill="${INK}"/>`,
      nishi: `<path d="M-8,-30 A22,22 0 1 0 18,4 A17,17 0 1 1 -8,-30Z" fill="${INK}"/><path d="M-30,22 q8,-10 15,0 q8,-10 15,0 q8,-10 15,0 q8,-10 15,0" stroke="${INK}" stroke-width="5" fill="none"/>`,
    }[clan] || '';
    return `<g transform="translate(${x},${y}) scale(${s})"><circle r="44" fill="${KINARI}" stroke="${INK}" stroke-width="6"/>${inner}</g>`;
  }

  // ---------- 部品 ----------
  const face = `<path d="M118,118 Q100,140 104,176 Q108,210 128,232 Q140,242 152,238 Q176,230 190,204 Q200,176 196,146 Q192,118 170,108 Q140,100 118,118Z" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="197" cy="178" rx="7" ry="13" fill="${SKIN}" stroke="${INK}" stroke-width="3"/><path d="M195,172 q3,4 0,10" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
  // 女子の輪郭：あごを小さく、丸みを持たせる
  const faceF = `<path d="M120,120 Q104,142 108,176 Q112,206 130,226 Q142,236 152,232 Q174,224 186,200 Q196,174 192,146 Q188,120 168,110 Q140,102 120,120Z" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="193" cy="178" rx="6" ry="11" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  const neck =`<path d="M134,226 L134,266 Q156,276 178,264 L178,222Z" fill="${SKIN2}" stroke="${INK}" stroke-width="3"/>`;
  const kegaki = `<g fill="none" stroke="${INK}" stroke-width="0.9" stroke-linecap="round">${
    [124, 129, 134, 139, 144, 149, 154, 159, 164, 169, 174, 179, 184].map((x, i) => `<path d="M${x},${117 - Math.round(Math.sin((i / 12) * Math.PI) * 9)} q1,5 0,9"/>`).join('')
  }<path d="M193,150 q2,8 1,14"/><path d="M196,152 q2,8 1,14"/></g>`;

  const backHair = {
    long: `<path d="M104,118 Q80,200 96,272 L206,272 Q222,200 200,116Z" fill="${INK}"/>`,
    pony: `<path d="M196,118 Q244,106 264,152 Q272,204 250,244 Q244,192 222,162 Q210,148 196,140Z" fill="${INK}"/>`,
    bob: `<path d="M100,118 Q86,182 108,216 L196,216 Q214,182 200,116Z" fill="${INK}"/>`,
  };
  const frontHair = {
    spiky: `<path d="M98,152 Q84,100 128,84 Q130,72 144,74 Q152,62 166,70 Q182,66 186,82 Q214,100 210,152 Q206,124 190,114 Q160,102 122,116 Q106,126 98,152Z" fill="${INK}"/>
      <path d="M186,82 Q206,78 214,66 Q212,90 200,98Z" fill="${INK}"/><path d="M192,146 L202,186 L190,190Z" fill="${INK}"/>`,
    neat: `<path d="M98,150 Q88,94 148,84 Q208,88 210,150 Q204,120 186,110 L128,118 Q108,126 98,150Z" fill="${INK}"/>
      <path d="M128,118 L146,86" stroke="#4a4040" stroke-width="1.5"/><path d="M192,146 L200,180 L190,182Z" fill="${INK}"/>`,
    bangs: `<path d="M100,152 Q92,98 150,88 Q208,94 208,150 Q200,122 186,114 L180,132 L170,114 L160,132 L150,114 L140,132 L130,114 L122,130 Q106,132 100,152Z" fill="${INK}"/>
      <path d="M196,140 L204,198 L192,196Z" fill="${INK}"/>`,
  };

  function body(o) {
    let s = '';
    if (o.garment === 'sailor') {
      s += `<path d="M40,430 Q46,302 150,276 Q254,300 280,430Z" fill="#26325c" stroke="${INK}" stroke-width="4"/>
        <path d="M92,292 L150,340 L208,292 L196,282 L150,322 L104,282Z" fill="${KINARI}" stroke="${INK}" stroke-width="3"/>
        <path d="M136,330 L164,330 L157,340 L165,362 L150,350 L135,362 L143,340Z" fill="${SHU}" stroke="${INK}" stroke-width="3"/>`;
    } else {
      s += `<path d="M40,430 Q46,300 150,272 Q256,296 280,430Z" fill="#23315a" stroke="${INK}" stroke-width="4"/>
        <path d="M126,262 L150,300 L176,262 L184,272 L150,316 L118,272Z" fill="${INK}"/>
        <circle cx="150" cy="342" r="6" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/>`;
    }
    if (o.over === 'kataginu') {
      const f = kikkou(o.color);
      s += `<path d="M16,300 L126,266 L148,330 L134,430 L44,430 L40,332Z" fill="${f}" stroke="${INK}" stroke-width="4"/>
        <path d="M284,300 L178,266 L156,330 L170,430 L276,430 L280,332Z" fill="${f}" stroke="${INK}" stroke-width="4"/>${crest(o.clan, 86, 352, 16)}`;
    } else if (o.over === 'haori') {
      s += `<path d="M40,430 Q46,310 112,284 L136,430Z" fill="${o.color}" stroke="${INK}" stroke-width="4"/>
        <path d="M280,430 Q274,310 188,284 L164,430Z" fill="${o.color}" stroke="${INK}" stroke-width="4"/>
        <path d="M70,330 L76,430 M230,330 L224,430" stroke="${shade(o.color, 0.72)}" stroke-width="3"/>${crest(o.clan, 84, 352, 14)}`;
    }
    if (o.over === 'tasuki' || o.tasuki) {
      s += `<path d="M60,318 L250,420 L244,432 L54,330Z M240,318 L70,420 L76,432 L246,330Z" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/>`;
    }
    return s;
  }

  function headgear(o) {
    if (o.head === 'hachimaki') {
      return `<path d="M198,128 Q222,118 244,106 L242,122 Q222,132 200,140Z" fill="${o.color}" stroke="${INK}" stroke-width="2.5"/>
        <path d="M102,130 Q150,112 200,126 L200,140 Q150,126 102,144Z" fill="${o.color}" stroke="${INK}" stroke-width="3"/>
        <g fill="${KINARI}">${[112, 124, 136, 148, 160, 172, 184].map((x, i) => `<circle cx="${x}" cy="${134 - Math.round(Math.sin((i / 6) * Math.PI) * 5)}" r="1.8"/>`).join('')}</g>`;
    }
    if (o.head === 'hachigane') {
      return `<path d="M100,120 Q150,104 204,118 L204,130 Q150,116 100,132Z" fill="#26325c" stroke="${INK}" stroke-width="2.5"/>
        <rect x="130" y="104" width="44" height="18" rx="3" fill="#b9c2cc" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="136" cy="113" r="2" fill="${INK}"/><circle cx="168" cy="113" r="2" fill="${INK}"/>`;
    }
    return '';
  }

  // 瞳：茶の虹彩に墨の瞳孔、光をひとつ
  const eyeball = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3b2a22"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="${INK}"/>
    <circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${Math.max(1, r * 0.3)}" fill="#fff"/>`;

  // 表情：眉・目・口
  function expression(o) {
    const w = o.str >= 70 ? 7 : 5;
    const m = o.mood || 'normal';
    let s = '';
    if (m === 'smile') {
      // 口を閉じた微笑み（ふだんの笑顔）
      s += `<path d="M144,152 Q162,142 185,149" stroke="${INK}" stroke-width="${w - 1}" fill="none" stroke-linecap="round"/>
        <path d="M110,154 Q120,148 132,151" stroke="${INK}" stroke-width="${w - 2}" fill="none" stroke-linecap="round"/>
        <path d="M146,170 Q160,162 178,167 Q162,172 146,170Z" fill="#fff" stroke="${INK}" stroke-width="3"/>
        <path d="M143,168 Q160,156 181,165" stroke="${INK}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
        ${eyeball(154, 168, 4)}
        <path d="M112,170 Q121,164 132,167 Q122,173 112,170Z" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <path d="M110,168 Q121,159 135,165" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <circle cx="120" cy="168" r="2.8" fill="${INK}"/>
        <path d="M128,213 Q140,222 154,210" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M134,218 Q141,221 148,217" stroke="${SHU}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    } else if (m === 'laugh') {
      s += `<path d="M144,150 Q162,142 184,148" stroke="${INK}" stroke-width="${w - 1}" fill="none" stroke-linecap="round"/>
        <path d="M110,152 Q120,147 132,150" stroke="${INK}" stroke-width="${w - 2}" fill="none" stroke-linecap="round"/>
        <path d="M146,170 Q161,157 178,168" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M112,170 Q121,162 132,168" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M126,208 Q140,228 156,208Z" fill="#8e2219" stroke="${INK}" stroke-width="3"/>
        <path d="M130,210 L152,210" stroke="#fff" stroke-width="3"/>`;
    } else if (m === 'angry') {
      s += `<path d="M146,162 L186,142" stroke="${INK}" stroke-width="${w + 1}" stroke-linecap="round"/>
        <path d="M112,150 L132,160" stroke="${INK}" stroke-width="${w - 1}" stroke-linecap="round"/>
        <path d="M147,170 Q160,164 177,166 Q162,174 147,170Z" fill="#fff" stroke="${INK}" stroke-width="3"/>
        <path d="M144,168 L180,160" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        ${eyeball(157, 169, 3.4)}
        <path d="M113,168 Q122,165 131,167 Q122,172 113,168Z" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <path d="M110,164 L134,168" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="120" cy="168" r="2.4" fill="${INK}"/>
        <path d="M126,212 L154,212 L152,224 L128,224Z" fill="#fff" stroke="${INK}" stroke-width="3"/>
        <path d="M127,218 L153,218 M140,212 L140,224" stroke="${INK}" stroke-width="1.5"/>
        <path d="M176,122 l8,6 M184,120 l-2,10 M178,130 l8,-2" stroke="${SHU}" stroke-width="2.5" stroke-linecap="round"/>`;
    } else if (m === 'surprise') {
      s += `<path d="M146,144 Q162,130 184,138" stroke="${INK}" stroke-width="${w - 1}" fill="none" stroke-linecap="round"/>
        <path d="M110,146 Q120,138 132,142" stroke="${INK}" stroke-width="${w - 2}" fill="none" stroke-linecap="round"/>
        <circle cx="161" cy="168" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/>${eyeball(160, 168, 3.2)}
        <circle cx="122" cy="168" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="121" cy="168" r="2.3" fill="${INK}"/>
        <ellipse cx="140" cy="220" rx="6" ry="9" fill="#5a1510" stroke="${INK}" stroke-width="3"/>
        <path d="M200,110 l6,-8 M206,118 l9,-3 M196,104 l1,-9" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
    } else if (m === 'frustrated') {
      s += `<path d="M146,150 L182,160" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>
        <path d="M112,158 L132,150" stroke="${INK}" stroke-width="${w - 1}" stroke-linecap="round"/>
        <path d="M150,164 L168,170 L150,176" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M130,162 L116,168 L130,174" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M126,218 q5,-5 10,0 q5,5 10,0 q5,-5 10,0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M172,178 q6,10 0,16 q-6,-6 0,-16Z" fill="#9fd3f0" stroke="${INK}" stroke-width="1.5"/>
        <path d="M106,128 q-5,8 0,12 q5,-4 0,-12Z" fill="#9fd3f0" stroke="${INK}" stroke-width="1.5"/>`;
    } else {
      s += `<path d="M144,154 Q162,140 186,147" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
        <path d="M110,156 Q120,149 132,152" stroke="${INK}" stroke-width="${w - 1}" fill="none" stroke-linecap="round"/>
        <path d="M146,170 Q160,160 178,166 Q162,176 146,170Z" fill="#fff" stroke="${INK}" stroke-width="3"/>
        <path d="M143,168 Q160,154 181,164" stroke="${INK}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
        ${eyeball(153, 169, 4.6)}
        <path d="M112,170 Q121,162 132,166 Q122,175 112,170Z" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <path d="M110,168 Q121,157 135,164" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <circle cx="119" cy="168" r="3.2" fill="${INK}"/>`;
      if (m === 'think') {
        // 考え込む：口を結び、こめかみに汗
        s += `<path d="M132,216 L148,215" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M104,132 q-5,8 0,12 q5,-4 0,-12Z" fill="#9fd3f0" stroke="${INK}" stroke-width="1.5"/>`;
      } else {
        s += o.female
          ? `<path d="M132,215 Q141,211 150,215 Q141,221 132,215Z" fill="${SHU}" stroke="${INK}" stroke-width="2"/>`
          : `<path d="M130,216 Q140,212 150,216" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
             <path d="M133,219 Q141,223 149,219" stroke="${SHU}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      }
    }
    // 鼻：浮世絵らしい一筆の線
    s += o.female
      ? `<path d="M131,178 Q125,190 117,198 Q123,202 131,199" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M131,160 Q124,186 115,198 Q122,202 131,199" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (o.female && m !== 'laugh') s += `<path d="M181,163 l7,-4 M179,160 l4,-7" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    if (o.female || m === 'smile' || m === 'laugh') s += `<ellipse cx="170" cy="192" rx="10" ry="5" fill="#e9a3a8" opacity="0.85"/>`;
    return s;
  }

  function kumadori(o) {
    if (!o.kuma) return '';
    return `<path d="M180,164 Q194,150 190,126 M178,174 Q190,182 186,196 M110,162 Q100,152 104,136" stroke="${SHU}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  function glasses(o) {
    if (!o.glasses) return '';
    return `<g fill="rgba(255,255,255,0.3)" stroke="${INK}" stroke-width="3.5">
      <rect x="142" y="157" width="44" height="23" rx="6"/><rect x="106" y="158" width="30" height="21" rx="6"/></g>
      <path d="M136,167 L142,167 M186,166 L198,170" stroke="${INK}" stroke-width="3"/>
      <path d="M148,161 L156,161" stroke="#fff" stroke-width="2"/>`;
  }

  // 一段だけの影（平塗りの決まりは守る）：前髪の下、奥の頬、あごの下
  const SHADOW = '#efcfae';
  const shadows = (female) => `
    <path d="M104,144 Q150,124 202,138 L200,150 Q150,134 106,156Z" fill="${SHADOW}"/>
    ${female ? `<path d="M108,178 Q112,206 130,226 Q120,210 116,188Z" fill="${SHADOW}"/>` : `<path d="M104,178 Q108,210 128,232 Q118,214 113,190Z" fill="${SHADOW}"/>`}`;
  const neckShadow = `<path d="M134,226 L178,222 L178,236 Q156,246 134,240Z" fill="#d6b08a"/>`;
  // 髪のつや
  const hairShine = {
    spiky: `<path d="M118,104 Q140,92 164,94 M130,112 Q150,104 172,106" stroke="#55504a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    neat: `<path d="M150,94 Q176,96 194,112 M156,102 Q176,106 188,118" stroke="#55504a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    bangs: `<path d="M120,104 Q148,94 176,98" stroke="#55504a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  };
  // 服のしわ
  const folds = `<path d="M92,400 Q102,372 96,346 M214,400 Q206,372 212,346" stroke="rgba(0,0,0,0.28)" stroke-width="3" fill="none" stroke-linecap="round"/>`;

  // ---------- 組み立て ----------
  // o.small = true：地図や一覧用。顔に寄せ、柄や細かい線を省いて小さくても読めるようにする
  function bust(o) {
    o = Object.assign({ dir: 'L', hair: 'spiky', garment: 'gakuran', over: null, head: null, mood: 'normal', color: SHU, clan: 'azabu', bg: 'seigaiha', str: 60 }, o);
    const isFemaleHair = ['long', 'pony', 'bob'].includes(o.hair);
    const frontKey = isFemaleHair ? 'bangs' : o.hair;
    const art = `
      ${backHair[o.hair] || ''}
      ${body(o)}
      ${o.small ? '' : folds}
      ${neck}${neckShadow}
      ${o.female ? faceF : face}
      ${shadows(o.female)}
      ${frontHair[frontKey]}
      ${o.small ? '' : hairShine[frontKey] + kegaki}
      ${headgear(o)}
      ${expression(o)}
      ${kumadori(o)}
      ${glasses(o)}`;
    const flip = o.dir === 'R' ? 'translate(200,0) scale(-1,1)' : '';
    const frame = o.small ? 'translate(-65,-48) scale(1.1)' : 'translate(-5,-32) scale(0.7)';
    let bg = '';
    if (o.small) bg = `<rect width="200" height="220" fill="${shade(o.color, 1.5)}"/><rect width="200" height="220" fill="${KINARI}" opacity="0.55"/>`;
    else if (o.bg !== 'none') bg = `<rect width="200" height="220" fill="url(#${o.bg})"/><rect width="200" height="84" fill="url(#bokashi)" opacity="0.75"/>`;
    return `<svg viewBox="0 0 200 220" aria-hidden="true">${bg}
      <g transform="${flip}"><g transform="${frame}">${art}</g></g>
    </svg>`;
  }

  // くじ引き：ランダムな武将
  const CLAN_COLORS = { azabu: SHU, kaisei: '#22406b', tsukukoma: '#5d8a4a', hibiya: GOLD, waseda: '#6b3a5e', nishi: '#3a4a6a' };
  function randomBust() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const female = Math.random() < 0.4;
    const clan = pick(Object.keys(CLAN_COLORS));
    const str = 40 + Math.floor(Math.random() * 55);
    return {
      o: {
        dir: pick(['L', 'R']), female, clan, color: CLAN_COLORS[clan], str,
        hair: female ? pick(['long', 'pony', 'bob']) : pick(['spiky', 'neat']),
        garment: female ? 'sailor' : 'gakuran',
        over: pick(['kataginu', 'haori', 'haori', null]),
        tasuki: female && Math.random() < 0.4,
        head: pick(['hachimaki', 'hachigane', null, null]),
        glasses: Math.random() < 0.25,
        kuma: str >= 80,
        mood: pick(['normal', 'normal', 'smile', 'smile', 'laugh', 'angry', 'surprise', 'frustrated']),
        bg: pick(['seigaiha', 'asanoha', 'ichimatsu']),
      },
    };
  }

  // 胸像を、別の SVG の中の好きな位置・大きさに置く
  function bustAt(o, x, y, w) {
    return bust(o).replace('<svg viewBox="0 0 200 220"', `<svg x="${x}" y="${y}" width="${w}" height="${(w * 220) / 200}" viewBox="0 0 200 220"`);
  }

  return { bust, bustAt, crest, randomBust, flushPatterns, CLAN_COLORS };
})();
