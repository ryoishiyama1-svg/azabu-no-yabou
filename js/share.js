// 共有用の一枚絵（錦絵風のカード）。天下統一・遊んでいる途中の勢力を、縦長の画像にして保存・共有する
// 絵は SVG で描いて画像にし、文字はそのあと canvas に書く（SVG の画像の中では Web フォントが使えないため）
const CARD_W = 1080, CARD_H = 1350;

// カードに載せる中身
function cardData(s) {
  // 当主がいなければ（家督の決まる前など）、いちばん格の高い家臣を描く
  const lord = lordOf(s) || bestBy(gensOf(s, PLAYER).filter((g) => g.loc), (g) => g.str + g.pol + g.cha + g.int);
  const mine = castlesOf(s, PLAYER).length, all = MAP.nodes.length;
  const head = s.result === 'win' ? '天下統一' : s.result === 'lose' ? '落 日' : mine / all >= 0.75 ? '天下目前' : mine / all >= 0.5 ? '天下の半ば' : '群雄割拠';
  const big = (s.saga || []).filter((e) => e.weight >= 70).sort((a, b) => b.weight - a.weight).slice(0, 3).sort((a, b) => a.turn - b.turn);
  const meiba = Object.keys(s.meiba || {}).map((k) => MEIBA[k] && MEIBA[k].name).filter(Boolean);
  return {
    lord, head, big, meiba, lordTitle: lordOf(s) ? '当主' : '筆頭家臣',
    house: CLANS[PLAYER].name, color: CLANS[PLAYER].color,
    place: `${EDITIONS[edOf(s.scenario)].name}・${SCENARIOS[s.scenario].name}`,
    stats: [['城', `${mine}/${all}`], ['季', `${s.turn}`], ['当主', `${(s.lords || []).length || 1}代`], ['家臣', `${gensOf(s, PLAYER).filter((g) => g.loc).length}人`]],
    date: dateLabel(s.turn),
  };
}

// 絵の部分（文字なし）
function cardArt(d) {
  const K = '#1c1a17', P = '#f1e6cc';
  const defs = (document.getElementById('ukiyo-defs') || {}).innerHTML || '';
  const at = (svg, x, y, w) => svg.replace(/^<svg /, `<svg x="${x}" y="${y}" `).replace(/width="\d+" height="\d+"/, `width="${w}" height="${w}"`);
  const waves = Array.from({ length: 16 }, (_, i) => Array.from({ length: 4 }, (_, j) => {
    const x = i * 72 + (j % 2) * 36, y = 1170 + j * 36;
    return `<g transform="translate(${x},${y})" fill="none" stroke="${P}" stroke-width="4" opacity=".75"><path d="M-36,36 A36,36 0 0,1 36,36 M-24,36 A24,24 0 0,1 24,36 M-12,36 A12,12 0 0,1 12,36"/></g>`;
  }).join('')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
    <defs>${defs}<linearGradient id="cardsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9a3a8"/><stop offset=".45" stop-color="#f6e6cf"/><stop offset="1" stop-color="#f1e6cc"/></linearGradient></defs>
    <rect width="${CARD_W}" height="${CARD_H}" fill="url(#cardsky)"/>
    <circle cx="800" cy="330" r="250" fill="#c8372d"/><circle cx="788" cy="318" r="250" fill="none" stroke="${K}" stroke-width="10"/>
    <g fill="#e0a526" stroke="${K}" stroke-width="5">
      <path d="M60,300 q50,-36 100,0 q40,-30 80,0 q-36,26 -90,16 q-54,14 -90,-16z"/><path d="M820,120 q60,-40 120,0 q46,-32 92,0 q-40,30 -104,18 q-64,16 -108,-18z"/></g>
    <rect x="70" y="330" width="560" height="640" fill="${d.color}" stroke="${K}" stroke-width="10"/>
    ${d.lord ? at(portrait(d.lord, 540, d.head === '落 日' ? 'frustrated' : 'laugh'), 80, 340, 540) : at(crestBadge(PLAYER, 360), 170, 460, 360)}
    <rect x="80" y="340" width="540" height="620" fill="none" stroke="${P}" stroke-width="12"/>
    ${d.lord ? at(crestBadge(PLAYER, 120), 520, 850, 120) : ''}
    <rect x="0" y="1130" width="${CARD_W}" height="${CARD_H - 1130}" fill="#22406b"/>${waves}
    <rect x="18" y="18" width="${CARD_W - 36}" height="${CARD_H - 36}" fill="none" stroke="${K}" stroke-width="12"/>
  </svg>`;
}

// 文字を書く
async function cardText(ctx, d) {
  try { await document.fonts.ready; } catch (e) {}
  const K = '#1c1a17', P = '#f1e6cc';
  const brush = '"Yuji Boku", serif', mincho = '"Shippori Mincho B1", serif', goth = '"Zen Maru Gothic", sans-serif';
  ctx.textBaseline = 'alphabetic';
  // 題
  ctx.fillStyle = K; ctx.font = `128px ${brush}`; ctx.textAlign = 'left';
  ctx.fillText('麻布の野望', 70, 180);
  ctx.font = `800 34px ${mincho}`; ctx.fillText(d.place, 76, 240);
  // 大見出し（右の朱の日輪の上）
  // 日輪の幅に収まるように（4文字でもはみ出さない）
  ctx.textAlign = 'center'; ctx.font = `150px ${brush}`;
  ctx.fillStyle = K; ctx.fillText(d.head, 806, 392, 470);
  ctx.fillStyle = '#f3d27a'; ctx.fillText(d.head, 800, 386, 470);
  // 家と当主
  ctx.fillStyle = K; ctx.textAlign = 'left';
  ctx.font = `800 52px ${mincho}`; ctx.fillText(d.house, 670, 520);
  if (d.lord) { ctx.font = `64px ${brush}`; ctx.fillText(d.lord.name, 670, 600); ctx.font = `700 28px ${goth}`; ctx.fillStyle = '#5a4a36'; ctx.fillText(`${d.lordTitle}　${d.date}`, 674, 644); }
  // 数字の札
  d.stats.forEach(([l, v], i) => {
    const x = 670 + (i % 2) * 190, y = 700 + Math.floor(i / 2) * 120;
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(x, y, 175, 100); ctx.strokeStyle = K; ctx.lineWidth = 5; ctx.strokeRect(x, y, 175, 100);
    ctx.fillStyle = K; ctx.fillRect(x, y, 44, 100);
    ctx.fillStyle = P; ctx.font = `34px ${brush}`; ctx.textAlign = 'center'; ctx.fillText(l.length > 1 ? l[0] : l, x + 22, y + 62);
    ctx.fillStyle = K; ctx.font = `900 40px ${goth}`; ctx.fillText(v, x + 110, y + 64);
  });
  // 大きな出来事
  ctx.textAlign = 'left';
  const lines = d.big.map((e) => `${dateLabel(e.turn)}　${e.head}`);
  if (d.meiba.length) lines.push(`名場面：${d.meiba.join('・')}`);
  ctx.font = `800 30px ${mincho}`;
  lines.slice(0, 4).forEach((t, i) => {
    let s = t;
    while (ctx.measureText(s).width > 940 && s.length > 4) s = s.slice(0, -2) + '…';
    ctx.fillStyle = i === 3 && d.meiba.length ? '#c8372d' : K;
    ctx.fillText(s, 76, 1012 + i * 42);
  });
  // 末尾
  // 波の上に墨の帯を敷いてから
  ctx.fillStyle = K; ctx.fillRect(CARD_W / 2 - 260, 1250, 520, 70);
  ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 4; ctx.strokeRect(CARD_W / 2 - 252, 1258, 504, 54);
  ctx.fillStyle = '#f3d27a'; ctx.font = `44px ${brush}`; ctx.textAlign = 'center';
  ctx.fillText('名門高校国盗り絵巻', CARD_W / 2, 1301);
}

// 画像（Blob）を作る
function makeCard(s) {
  const d = cardData(s);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const cv = document.createElement('canvas');
      cv.width = CARD_W; cv.height = CARD_H;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await cardText(ctx, d);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png');
    };
    img.onerror = () => reject(new Error('絵を読み込めませんでした'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardArt(d))}`;
  });
}

// 画面：できた絵を見せて、共有か保存
async function showShareCard(back) {
  openModal('<h2>絵にして残す</h2><p class="hint" style="text-align:center">絵師が筆を走らせている……</p>');
  let blob;
  try { blob = await makeCard(S); } catch (e) {
    openModal(`<h2>絵にして残す</h2><p class="warn">${esc(e.message)}</p><button class="btn plain" data-close>閉じる</button>`);
    return;
  }
  const url = URL.createObjectURL(blob);
  const file = new File([blob], `azabu-${S.scenario}-${S.turn}.png`, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  openModal(`<h2>絵にして残す</h2>
    <img class="share-img" src="${url}" alt="${esc(CLANS[PLAYER].name)}の一枚絵">
    ${canShare ? '<button class="btn red" id="sh-share">共有する</button>' : ''}
    <a class="btn ${canShare ? 'plain' : 'red'} sh-dl" id="sh-dl" href="${url}" download="${file.name}">画像を保存</a>
    ${back ? '<button class="btn plain" id="sh-back">戻る</button>' : '<button class="btn plain" data-close>閉じる</button>'}`);
  if ($('sh-share')) $('sh-share').onclick = async () => {
    Sound.tap();
    try { await navigator.share({ files: [file], title: '麻布の野望', text: `${CLANS[PLAYER].name}の天下取り` }); } catch (e) {}
  };
  if ($('sh-back')) $('sh-back').onclick = () => { Sound.tap(); URL.revokeObjectURL(url); back(); };
}
