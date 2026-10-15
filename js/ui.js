// 画面の表示と操作
const SVGNS = 'http://www.w3.org/2000/svg';
const SEASON_WORDS = ['桜 舞 う', '青 葉 茂 る', '紅 葉 燃 ゆ', '雪 降 り 積 む'];

const $ = (id) => document.getElementById(id);
const mapwrap = $('mapwrap');
const svg = $('map');
const panel = $('panel');
const modal = $('modal');
const modalBody = $('modal-body');

let S = null;          // ゲームの状態
let selected = null;   // 選んでいる城
let mode = null;       // null | { kind: 'attack' | 'move' | 'gen', from, gid }
let scale = 1;
let CELLS = null;

// ---------- 保存（今遊んでいる枠に自動で保存） ----------
migrateOldSave();
function save() {
  // 学校図鑑：新しく治めた学校を載せる（初めての学校だけ知らせる）。数えた印ごと保存するため、先に調べる
  const fresh = zukanSync(S);
  writeSlot(currentSlot, S);
  if (fresh.length && typeof toast === 'function') toast(`📖 学校図鑑に${fresh.length > 2 ? `${fresh.length}校` : fresh.map((id) => `「${MAP.byId[id] ? MAP.byId[id].name : id}」`).join('')}が載った`);
}
function clearSave() { deleteSlot(currentSlot); }
function anySave() {
  for (let n = 1; n <= SLOT_COUNT; n++) if (slotSummary(n)) return true;
  return false;
}

const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const clanChip = (k) => `<span class="chip" style="--c:${CLANS[k].color}">${crestBadge(k, 18)}${CLANS[k].name}</span>`;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function openModal(html) { modalBody.innerHTML = html; modal.hidden = false; modalBody.scrollTop = 0; }
function closeModal() { modal.hidden = true; }

// ゲーム内の確認画面。ブラウザ標準の confirm / alert は、ホーム画面から起動したアプリなどで
// 表示されずに「いいえ」扱いになることがあるため使わない
function askConfirm(message, { ok = 'はい', cancel = 'やめる', danger = true } = {}) {
  return new Promise((resolve) => {
    const box = $('confirm');
    $('confirm-body').innerHTML = `<p class="confirm-msg">${esc(message).replace(/\n/g, '<br>')}</p>
      <button class="btn ${danger ? 'red' : 'plain'}" id="cf-ok">${ok}</button>
      ${cancel ? `<button class="btn plain" id="cf-no">${cancel}</button>` : ''}`;
    box.hidden = false;
    const done = (v) => { box.hidden = true; resolve(v); };
    $('cf-ok').onclick = () => { Sound.tap(); done(true); };
    if ($('cf-no')) $('cf-no').onclick = () => { Sound.tap(); done(false); };
  });
}
const askAlert = (message) => askConfirm(message, { ok: 'OK', cancel: null, danger: false });

let toastTimer;
function toast(html) {
  const t = $('toast');
  t.innerHTML = html;
  t.hidden = false;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// 武将の表示
function statLine(g) {
  return `統${g.str} 政${g.pol} 魅${g.cha} 知${g.int}`;
}
function skillTag(g) {
  return g.skill ? `<span class="skill" title="${SKILLS[g.skill].desc}">${SKILLS[g.skill].name}</span>` : '';
}
function gradeTag(g) {
  return g.grade ? `<span class="grade g${g.grade}">${g.grade}年</span>` : '';
}
// 忠誠度（自分の家臣だけ表示。当主は表示しない）
function loyalTag(g) {
  if (g.clan !== PLAYER || g.lord || g.loyal === undefined) return '';
  const cls = g.loyal < LOYAL.rebelBelow ? 'danger' : g.loyal < LOYAL.leaveBelow ? 'low' : g.loyal >= 80 ? 'high' : '';
  return `<span class="loyal ${cls}">忠${g.loyal}</span>`;
}
function genCard(g, { acted = false, extra = '' } = {}) {
  return `<div class="gcard ${acted ? 'acted' : ''} ${isLegend(g) && g.clan === PLAYER ? 'kira' : ''}" data-gid="${g.id}">
    ${portrait(g, 46)}
    <div class="gi">
      <div class="gn">${esc(g.name)}${g.lord ? '<span class="lord">当主</span>' : ''}${g.treasure && TREASURES[g.treasure] ? `<span class="ttag">${TREASURE_KINDS[TREASURES[g.treasure].kind].icon}</span>` : ''}${loyalTag(g)}</div>
      <div class="gt">${gradeTag(g)}${nickOf(g) ? `<span class="nick">「${esc(nickOf(g))}」</span>` : esc(g.title)} ${skillTag(g)}</div>
      <div class="gs">${statLine(g)}</div>
    </div>${extra}
  </div>`;
}

// ---------- 舞い散るもの ----------
function petals(el, season, count) {
  if (el.dataset.season === String(season)) return;
  el.dataset.season = season;
  el.className = `petals s${season}`;
  el.innerHTML = Array.from({ length: count }, () => {
    const left = Math.random() * 100, dur = 7 + Math.random() * 7, delay = -Math.random() * 14;
    const size = 0.7 + Math.random() * 0.6;
    return `<i style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;transform:scale(${size})"></i>`;
  }).join('');
}

// ---------- タイトル ----------
$('title-art').innerHTML = titleArt();
$('title-crest').innerHTML = crestBadge(PLAYER, 84);
petals($('title-petals'), realSeason(), 18);

// タイトルの音楽：iPhoneは画面に触れるまで音を出せないので、最初のタッチで流し始める
function titleMusic() {
  $('title-sound').textContent = Sound.on ? '♪' : '✕';
  if (Sound.ready && Sound.on && !$('title').hidden) Sound.bgmStart('title');
}
['touchend', 'click'].forEach((ev) => $('title').addEventListener(ev, (e) => {
  if (e.target.closest('#title-sound')) return;
  Sound.unlock();
  titleMusic();
}, true));
$('title-sound').onclick = () => {
  Sound.unlock();
  Sound.toggle();
  titleMusic();
};

function showTitle() {
  Sound.bgmStop(0.6);
  $('game').hidden = true;
  $('title').hidden = false;
  titleMusic();
  const canResume = anySave();
  $('btn-resume').hidden = !canResume;
  $('btn-resume').className = 'btn fuda red';
  $('btn-new').className = canResume ? 'btn fuda' : 'btn fuda red';
}

$('btn-new').onclick = () => { Sound.unlock(); Sound.tap(); showSlots('new'); };
$('btn-resume').onclick = () => { Sound.unlock(); Sound.tap(); showSlots('load'); };

function resumeSlot(n) {
  const data = readSlot(n);
  if (!data) return;
  currentSlot = n;
  S = migrate(data);
  closeModal();
  startGame(false);
  if (S.pendingDefense.length) afterDefenses();
  else if (S.pending.length) runEvents(() => {});
}

// ---------- セーブ枠の一覧 ----------
// mode: 'load' = つづきから / 'new' = どの枠で始めるか
function showSlots(mode) {
  const rows = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const n = i + 1;
    const sm = slotSummary(n);
    const info = sm
      ? `<div class="slot-head">${crestBadge(sm.clan, 30)}<div><b>${CLANS[sm.clan].name}</b> <span class="p-sub">${sm.scenario}・${sm.diff}</span>
          <small>${dateLabel(sm.turn)}・城 ${sm.owned}/${sm.total}・${sm.generation}代目 ${esc(sm.lord)}</small></div></div>`
      : '<div class="slot-head empty">― 空き ―</div>';
    const btns = mode === 'new'
      ? `<button class="btn red" data-new="${n}">${sm ? 'この枠に上書きして始める' : 'この枠で始める'}</button>`
      : sm
        ? `<button class="btn red" data-load="${n}">続ける</button>
           <div class="slot-sub"><button class="btn plain" data-export="${n}">書き出し</button><button class="btn plain" data-del="${n}">消す</button></div>`
        : `<button class="btn plain" data-import="${n}">この枠に読み込む</button>`;
    return `<div class="slot"><div class="slot-no">枠${n}</div>${info}${btns}</div>`;
  }).join('');
  openModal(`<h2>${mode === 'new' ? 'どの枠で始める？' : 'つづきから'}</h2>
    ${rows}
    ${mode === 'load' ? '<p class="hint">「書き出し」でセーブをコードにして、機種変更のときなどに持ち運べます。</p>' : ''}
    <button class="btn plain" data-close>もどる</button>`);
  modalBody.querySelectorAll('[data-load]').forEach((b) => { b.onclick = () => { Sound.tap(); resumeSlot(+b.dataset.load); }; });
  modalBody.querySelectorAll('[data-new]').forEach((b) => {
    b.onclick = async () => {
      const n = +b.dataset.new;
      if (slotSummary(n) && !(await askConfirm(`枠${n}のセーブは消えて、新しいゲームになります。\nよろしいですか？`, { ok: '上書きして始める' }))) return;
      Sound.tap();
      currentSlot = n;
      showSetup();
    };
  });
  modalBody.querySelectorAll('[data-export]').forEach((b) => { b.onclick = () => { Sound.tap(); showExport(+b.dataset.export, () => showSlots(mode)); }; });
  modalBody.querySelectorAll('[data-import]').forEach((b) => { b.onclick = () => { Sound.tap(); showImport(+b.dataset.import, () => showSlots(mode)); }; });
  modalBody.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const n = +b.dataset.del;
      if (!(await askConfirm(`枠${n}のセーブを消しますか？\n（元に戻せません）`, { ok: '消す' }))) return;
      Sound.tap();
      deleteSlot(n);
      showTitle();
      if (anySave()) showSlots(mode); else closeModal();
    };
  });
}

// ---------- 書き出し ----------
async function showExport(n, back) {
  openModal('<h2>書き出し</h2><p style="text-align:center">コードを作っています…</p>');
  let code;
  try { code = await encodeBundle(exportBundle(n)); } catch (e) {
    openModal(`<h2>書き出し</h2><p>うまく作れませんでした：${esc(e.message)}</p><button class="btn plain" id="ex-back">もどる</button>`);
    $('ex-back').onclick = back;
    return;
  }
  const sm = slotSummary(n);
  openModal(`<h2>書き出し</h2>
    <p>枠${n}（${sm ? `${CLANS[sm.clan].name}・${dateLabel(sm.turn)}` : ''}）のセーブと、実績・戦績をコードにしました。<br>
    別の端末の「つづきから」→ 空き枠の「この枠に読み込む」で貼り付けると、続きから遊べます。</p>
    <textarea class="code" id="ex-code" readonly>${code}</textarea>
    <p class="hint">${code.length.toLocaleString()}文字</p>
    <div class="slot-sub">
      <button class="btn red" id="ex-copy">コピー</button>
      <button class="btn plain" id="ex-file">ファイルで保存</button>
    </div>
    ${navigator.share ? '<button class="btn plain" id="ex-share">共有（メモ・LINEなど）</button>' : ''}
    <button class="btn plain" id="ex-back">もどる</button>`);
  $('ex-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(code); toast('コピーしました'); $('ex-copy').textContent = 'コピーしました ✔'; } catch (e) {
      const ta = $('ex-code'); ta.focus(); ta.select(); document.execCommand('copy'); $('ex-copy').textContent = 'コピーしました ✔';
    }
  };
  $('ex-file').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    a.download = `azabu-save-${n}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  if ($('ex-share')) $('ex-share').onclick = () => navigator.share({ title: `${gameTitle()} セーブ`, text: code }).catch(() => {});
  $('ex-back').onclick = () => { Sound.tap(); back(); };
}

// ---------- 読み込み ----------
function showImport(n, back) {
  openModal(`<h2>読み込み</h2>
    <p>書き出したコードを貼り付けるか、保存したファイルを選んでください。<b>枠${n}</b>に読み込みます。実績・戦績は今のものと合わせて残ります。</p>
    <textarea class="code" id="im-code" placeholder="AZABU1:… で始まるコード"></textarea>
    <label class="btn plain file-btn">ファイルを選ぶ<input type="file" id="im-file" accept=".txt,text/plain"></label>
    <p class="warn" id="im-err" hidden></p>
    <button class="btn red" id="im-go">読み込む</button>
    <button class="btn plain" id="im-back">もどる</button>`);
  $('im-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) $('im-code').value = (await f.text()).trim();
  };
  $('im-back').onclick = () => { Sound.tap(); back(); };
  $('im-go').onclick = async () => {
    const err = $('im-err');
    try {
      const bundle = await decodeBundle($('im-code').value);
      if (bundle.save && readSlot(n) && !(await askConfirm(`枠${n}のセーブは上書きされます。\nよろしいですか？`, { ok: '上書きして読み込む' }))) return;
      if (bundle.save) writeSlot(n, bundle.save);
      mergeRecords(bundle.records);
      Sound.win();
      showTitle();
      openModal(`<h2>読み込み完了</h2>
        <p>${bundle.save ? `枠${n}にセーブを読み込みました。` : 'セーブは入っていませんでした。'}実績・戦績も反映しました。</p>
        ${bundle.save ? `<button class="btn red" id="im-play">このまま続ける</button>` : ''}
        <button class="btn plain" data-close>閉じる</button>`);
      if ($('im-play')) $('im-play').onclick = () => resumeSlot(n);
    } catch (e) {
      err.hidden = false;
      err.textContent = `読み込めませんでした：${e.message}`;
    }
  };
}
$('btn-help').onclick = () => { Sound.unlock(); Sound.tap(); showHelp(); };
$('btn-zukan').onclick = () => { Sound.unlock(); Sound.tap(); showZukan(); };
$('btn-names').onclick = () => { Sound.unlock(); Sound.tap(); showNameEditor(); };

// ---------- 籠城戦：包囲の命令 ----------
// 何季で開城しそうか（城兵が季ごとに減って、囲む兵の6割を切るまで。最短でも2季）
function siegeEta(troops, n, ratio = SIEGE.surrenderRatio) {
  let t = troops, k = 0;
  while (k < 20 && (k < SIEGE.surrenderAfter || t >= n * ratio)) { t *= 1 - SIEGE.starve; k++; }
  return k >= 20 ? null : k;
}
function openSiege(from, to) {
  const c = S.castles[to];
  const gens = idleGensAt(S, from).sort((a, b) => b.str - a.str);
  if (!gens.length) { mode = null; render(); return; }
  let gid = gens[0].id;
  const max = readyTroops(S, from);
  let n = Math.min(max, Math.round((max * 0.8) / 10) * 10 || max);
  const helpers = MAP.adj[to].filter((id) => c.owner !== 'none' && S.castles[id].owner === c.owner && S.castles[id].troops >= 400);
  const draw = () => {
    const eta = siegeEta(c.troops, n, siegeRatio(S, to));
    openModal(`<h2>${MAP.byId[to].name} 包囲</h2>
      <p style="text-align:center;margin:0 0 6px">${clanChip(c.owner)}<br>城兵 <b>${fmt(c.troops)}</b> ・ 防御 <b>${c.def.toFixed(1)}</b></p>
      <h3>囲む大将</h3>
      <div class="glist pick">${gens.map((g) => genCard(g, { extra: g.id === gid ? '<span class="check">✔</span>' : '' })).join('')}</div>
      <h3>囲む兵（${MAP.byId[from].short}）</h3>
      <div class="slider-row"><input type="range" id="sg-n" min="10" max="${max}" step="10" value="${n}"><b id="sg-v">${fmt(n)}</b></div>
      <div class="siege-plan">
        <p><b>兵糧攻め</b>季ごとに城兵が${Math.round(SIEGE.starve * 100)}%減り、防御が${SIEGE.defLoss}下がる。囲まれた城の収入は止まる</p>
        <p><b>開城</b>${SIEGE.surrenderAfter}季を過ぎ、城兵が囲む兵の${Math.round(siegeRatio(S, to) * 100)}%を切ると門を開くことがある${isCapital(to, c.owner) ? "（家の本拠は粘る）" : ""}<span id="sg-eta">${eta ? `（見込み：およそ${eta}季）` : '（この兵では開城まで遠い）'}</span></p>
        ${helpers.length ? `<p class="warn-line"><b>後詰め</b>となりの${helpers.map((id) => MAP.byId[id].short).join('・')}から救援が来ることがある</p>` : ''}
        <p><b>総攻め</b>いつでも囲む兵でそのまま攻めかかれる</p>
      </div>
      <button class="btn red" id="sg-go">包囲する</button>
      <button class="btn plain" data-close>やめる</button>`);
    modalBody.querySelectorAll('.glist.pick .gcard').forEach((cd) => { cd.onclick = () => { Sound.tap(); gid = cd.dataset.gid; draw(); }; });
    $('sg-n').oninput = (e) => {
      n = +e.target.value;
      $('sg-v').textContent = fmt(n);
      const k = siegeEta(c.troops, n, siegeRatio(S, to));
      $('sg-eta').textContent = k ? `（見込み：およそ${k}季）` : '（この兵では開城まで遠い）';
    };
    $('sg-go').onclick = () => {
      Sound.taiko(0, 1); Sound.horagai();
      startSiege(S, from, to, n, gid);
      mode = null; selected = to;
      closeModal(); save(); render();
      toast(`🏯 ${esc(S.gens[gid].name)}が${MAP.byId[to].short}を囲んだ`);
    };
  };
  draw();
}
// ---------- 評定：季のはじめに、家臣が顔をそろえて献策する ----------
// 守り（援兵）・攻め・褒美・開発・外交から、いま意味のある献策を三つまで。採用すると献策した家臣の忠誠が上がり、その場で行う
function hyojoProposals() {
  const out = [], used = new Set();
  const all = gensOf(S, PLAYER).filter((g) => g.loc && !g.lord);
  const take = (pool, key) => { const g = pool.filter((x) => !used.has(x.id)).sort((a, b) => b[key] - a[key])[0]; if (g) used.add(g.id); return g; };
  const rp = castlesOf(S, PLAYER).map((id) => reinforcePlan(S, id)).filter(Boolean).sort((a, b) => a.before - b.before)[0];
  if (rp) { const g = take(all, 'int'); if (g) out.push({ kind: 'reinforce', g, plan: rp, title: `${MAP.byId[rp.to].short}に援兵を`, text: `${MAP.byId[rp.to].name}の守りが危うい。${MAP.byId[rp.from].short}から${fmt(rp.amount)}の兵を送りましょう`, sub: `守り切る見込み 約${pctOf(rp.before)}% → 約${pctOf(rp.after)}%` }); }
  const ch = attackChances(S)[0];
  if (ch) {
    const g = S.gens[ch.gid] && !used.has(ch.gid) ? S.gens[ch.gid] : take(all, 'str');
    if (g) { used.add(g.id); out.push({ kind: 'attack', g, plan: ch, title: `${MAP.byId[ch.to].short}を攻める`, text: `${MAP.byId[ch.to].name}は手薄。この私に攻めさせてくだされ`, sub: `勝つ見込み 約${pctOf(ch.p)}%` }); }
  }
  const low = all.filter((g) => g.loyal < LOYAL.leaveBelow && canReward(S, g)).sort((a, b) => a.loyal - b.loyal)[0];
  if (low) { used.add(low.id); const g = take(all.filter((x) => x !== low), 'cha'); if (g) out.push({ kind: 'reward', g, target: low, title: `${low.name.split(' ')[1] || low.name}に褒美を`, text: `${low.name}の心が離れかけております。褒美で引き留めては`, sub: `金${LOYAL.rewardCost}・忠誠が上がる` }); }
  if (out.length < 3) {
    const dev = castlesOf(S, PLAYER).filter((id) => !S.delegate[id] && idleGensAt(S, id).some((g) => !used.has(g.id)) && canDevelop(S, id)).sort((a, b) => S.castles[a].eco - S.castles[b].eco)[0];
    if (dev) { const g = take(idleGensAt(S, dev), 'pol'); if (g) out.push({ kind: 'develop', g, castle: dev, title: `${MAP.byId[dev].short}を開発`, text: `${MAP.byId[dev].name}の町を育てれば、年貢が増えまする`, sub: `金${RULES.developCost}・経済が上がる` }); }
  }
  if (out.length < 3 && !hasCh(S, 'nodiplo') && !S.encircle) {
    const k = aiClans().filter((x) => S.rel[x] && !S.rel[x].truce && !S.rel[x].ally && S.rel[x].friend >= 45).sort((a, b) => S.rel[b].friend - S.rel[a].friend)[0];
    if (k) { const g = take(all, 'cha'); if (g) out.push({ kind: 'diplo', g, clan: k, title: `${CLANS[k].name}と和を`, text: `${CLANS[k].name}とは話が通じます。停戦を結べば、背後が安らぎましょう`, sub: '外交の画面へ' }); }
  }
  return out.slice(0, 3);
}
function adoptProposal(p) {
  changeLoyal(p.g, 3);
  if (p.kind === 'reinforce') { doReinforce(p.plan.to); return; }
  if (p.kind === 'attack') { selected = p.plan.to; openAttack(null, p.plan.to, p.plan); return; }
  if (p.kind === 'reward') { showReward([p.target], '褒美（評定の献策）'); return; }
  if (p.kind === 'develop') {
    develop(S, p.castle, p.g); S.acted[p.g.id] = true; save(); render();
    toast(`${esc(p.g.name)}が${MAP.byId[p.castle].short}を開発した`); return;
  }
  if (p.kind === 'diplo') showDiplomacy();
}
function showHyojo(force) {
  const props = hyojoProposals();
  if (!props.length) { if (force) toast('評定：いま申し上げることはございませぬ'); return; }
  const lord = lordOf(S);
  let box = $('hyojo');
  if (!box) { box = document.createElement('div'); box.id = 'hyojo'; box.className = 'kime hyojo'; document.body.appendChild(box); }
  box.innerHTML = `<div class="hy-hall">
      <div class="hy-head"><span>評　定</span><small>${dateLabel(S.turn)}・${esc(pName())}</small></div>
      ${lord ? `<div class="hy-lord">${portrait(lord, 76, 'think')}<b>${esc(lord.name)}</b></div>` : ''}
      <div class="hy-list">${props.map((p, i) => `<button class="hy-card" data-hy="${i}" style="animation-delay:${(0.25 + i * 0.15).toFixed(2)}s">
        ${portrait(p.g, 64, 'smile')}<div><small>${esc(p.g.name)}の献策</small><b>${esc(p.title)}</b><p>「${esc(p.text)}」</p><em>${esc(p.sub)}</em></div><i class="hy-stamp">採用</i></button>`).join('')}</div>
      <button class="btn plain hy-close" id="hy-close">評定を終える</button>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(2); Sound.taiko(0.3, 0.8);
  box.onclick = null;
  $('hy-close').onclick = (e) => { e.stopPropagation(); Sound.tap(); box.hidden = true; render(); };
  box.querySelectorAll('[data-hy]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      if (box.dataset.busy) return;
      box.dataset.busy = '1';
      b.classList.add('adopted');
      Sound.stamp(0);
      setTimeout(() => { delete box.dataset.busy; box.hidden = true; adoptProposal(props[+b.dataset.hy]); }, 700);
    };
  });
}
// 季のはじめに評定を開くか（設定：毎季・年に一度（春）・開かない）
function maybeHyojo() {
  const m = getSettings().hyojo;
  if (!S || S.result || m === 'off' || (m === 'year' && S.turn % 4 !== 0)) return;
  if (S.hyojoTurn === S.turn) return;
  S.hyojoTurn = S.turn;
  showHyojo(false);
}

// ---------- 茶の湯：家臣を招いて茶会を開く ----------
function teaRoom(guests, lord) {
  // 茶室：畳・炉・茶碗と、向かい合う当主と客
  const K = '#1c1a17';
  return `<div class="tea-room">
    <svg viewBox="0 0 340 120" class="tea-bg" aria-hidden="true"><rect width="340" height="120" fill="#e8dcc0"/>
      <rect y="70" width="340" height="50" fill="#c9b77a"/><g stroke="#8f7d48" stroke-width="2">${[0, 85, 170, 255, 340].map((x) => `<line x1="${x}" y1="70" x2="${x}" y2="120"/>`).join('')}<line x1="0" y1="95" x2="340" y2="95"/></g>
      <rect x="20" y="10" width="60" height="56" fill="#f4efe2" stroke="${K}" stroke-width="2"/><path d="M50,14 V62" stroke="${K}" stroke-width="1.5"/>
      <rect x="150" y="80" width="40" height="22" fill="#5a3a22" stroke="${K}" stroke-width="2"/><path d="M158,82 q12,-14 24,0" fill="#6b7a4a" stroke="${K}" stroke-width="2"/>
      <path d="M160,60 q2,-12 -4,-20 M172,58 q4,-12 -2,-22" stroke="#bfb6a6" stroke-width="2" fill="none" opacity=".8"/></svg>
    <div class="tea-people">${lord ? `<div>${portrait(lord, 70, 'smile', 'R')}<small>${esc(lord.name)}</small></div>` : ''}<span class="tea-bowl">🍵</span>${guests.map((g) => `<div>${portrait(g, 70, 'smile')}<small>${esc(g.name)}</small></div>`).join('')}</div>
  </div>`;
}
function showTea() {
  if (!canTea(S)) { toast(S.teaTurn === S.turn ? 'この季の茶会はもう開いた' : `茶会には金${TEA.cost}がいる`); return; }
  const cands = gensOf(S, PLAYER).filter((g) => g.loc && !g.lord).sort((a, b) => a.loyal - b.loyal);
  const pickd = new Set();
  let topic = 'shi';
  const draw = () => {
    openModal(`<h2>茶の湯</h2>
      <p class="hint">家臣を一人か二人、茶室に招く（金${TEA.cost}・季に一度）。忠誠の低い者ほど、本音を話して心を開く</p>
      <h3>招く家臣（${pickd.size}/2）</h3>
      <div class="glist pick tea-pick">${cands.map((g) => genCard(g, { extra: pickd.has(g.id) ? '<span class="check">✔</span>' : '' })).join('')}</div>
      <h3>話題</h3>
      <div class="tactics">${Object.entries(TEA_TOPICS).map(([k, t]) => `<button data-topic="${k}" class="${k === topic ? 'on' : ''}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>
      <button class="btn red" id="tea-go" ${pickd.size ? '' : 'disabled'}>茶会を開く</button>
      <button class="btn plain" data-close>やめる</button>`);
    modalBody.querySelectorAll('.tea-pick .gcard').forEach((c) => {
      c.onclick = () => {
        Sound.tap();
        const id = c.dataset.gid;
        if (pickd.has(id)) pickd.delete(id); else if (pickd.size < 2) pickd.add(id);
        const top = modalBody.scrollTop; draw(); modalBody.scrollTop = top;
      };
    });
    modalBody.querySelectorAll('[data-topic]').forEach((b) => { b.onclick = () => { Sound.tap(); topic = b.dataset.topic; const top = modalBody.scrollTop; draw(); modalBody.scrollTop = top; }; });
    $('tea-go').onclick = () => {
      const guests = [...pickd].map((id) => S.gens[id]);
      const r = teaParty(S, [...pickd], topic);
      save(); render();
      Sound.hyoshigi(1); Sound.kira();
      openModal(`<h2>茶の湯　<small class="tea-topic">${TEA_TOPICS[topic].name}</small></h2>
        ${teaRoom(guests, lordOf(S))}
        <div class="tea-talk">${r.lines.map((l) => `<p><b>${esc(S.gens[l.gid].name)}</b>「${esc(l.text)}」</p>`).join('')}</div>
        <ul class="tea-eff">${r.effects.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        <button class="btn red" data-close>茶会を終える</button>`);
    };
  };
  draw();
}

// 後詰め：囲まれた自分の城へ、となりの自分の城から救援を出す
function openRelief(to) {
  const sg = siegeOf(S, to);
  if (!sg) return;
  const srcs = MAP.adj[to].filter((id) => S.castles[id].owner === PLAYER && !S.delegate[id] && readyTroops(S, id) > 0 && idleGensAt(S, id).length);
  if (!srcs.length) { toast('となりに、後詰めを出せる城がない'); return; }
  let src = srcs.reduce((a, b) => (readyTroops(S, a) >= readyTroops(S, b) ? a : b));
  let gid = null, n = 0;
  const draw = () => {
    const gens = idleGensAt(S, src).sort((a, b) => b.str - a.str);
    if (!gens.find((g) => g.id === gid)) gid = gens[0].id;
    const max = readyTroops(S, src);
    n = Math.min(max, n || Math.round((max * 0.8) / 10) * 10 || max);
    const g = S.gens[gid], sgGen = S.gens[sg.gid];
    const p = winChance((n * atkMult(g)) / Math.max(1, sg.n * defMult(sgGen)));
    openModal(`<h2>後詰め</h2>
      <p style="text-align:center;margin:0 0 6px">${MAP.byId[to].name}を囲む${CLANS[siegeClan(sg)].name}の陣<br>${sgGen ? esc(sgGen.name) : ''}・<b>${fmt(sg.n)}</b>兵</p>
      ${srcs.length > 1 ? `<h3>出す城</h3><div class="src-list">${srcs.map((id) => `<button data-src="${id}" class="${id === src ? 'on' : ''}"><span>${MAP.byId[id].name}</span><span>兵 ${fmt(readyTroops(S, id))}</span></button>`).join('')}</div>` : ''}
      <h3>大将</h3>
      <div class="glist pick">${gens.map((x) => genCard(x, { extra: x.id === gid ? '<span class="check">✔</span>' : '' })).join('')}</div>
      <h3>兵（${MAP.byId[src].short}）</h3>
      <div class="slider-row"><input type="range" id="rl-n" min="10" max="${max}" step="10" value="${n}"><b id="rl-v">${fmt(n)}</b></div>
      <p class="hint" id="rl-odds">囲みを破る見込み 約${pctOf(p)}%（勝てば囲みは解け、負ければ陣の兵が減る）</p>
      <button class="btn red" id="rl-go">後詰めに出る</button>
      <button class="btn plain" data-close>やめる</button>`);
    modalBody.querySelectorAll('[data-src]').forEach((b) => { b.onclick = () => { Sound.tap(); src = b.dataset.src; n = 0; draw(); }; });
    modalBody.querySelectorAll('.glist.pick .gcard').forEach((cd) => { cd.onclick = () => { Sound.tap(); gid = cd.dataset.gid; draw(); }; });
    $('rl-n').oninput = (e) => {
      n = +e.target.value; $('rl-v').textContent = fmt(n);
      $('rl-odds').textContent = `囲みを破る見込み 約${pctOf(winChance((n * atkMult(S.gens[gid])) / Math.max(1, sg.n * defMult(sgGen))))}%（勝てば囲みは解け、負ければ陣の兵が減る）`;
    };
    $('rl-go').onclick = () => {
      Sound.taiko(0, 1); Sound.clash(0.3);
      const r = reliefSiege(S, sg, src, n, gid);
      closeModal(); save(); render();
      toast(r.won ? `🛡️ 後詰めが${MAP.byId[to].short}の囲みを破った！` : `後詰めは押し返された……（陣の兵は残り${fmt(r.siegeLeft)}）`);
    };
  };
  draw();
}

// 総攻め：囲んでいた兵で、そのまま合戦へ
function siegeAssault(to) {
  const sg = mySiege(S, to);
  if (!sg) return;
  const o = assaultFromSiege(S, sg);
  const B = startBattle(S, { ...o, tactic: { a: pick(Object.keys(TACTICS)), d: aiTactic(S, to) }, playerSide: 'a' });
  mode = null;
  closeModal();
  runBattle(B, {
    auto: getSettings().attackMode === 'auto',
    onClose: (r) => { selected = r.won ? to : o.from; render(); achievementToast(checkAchievements(S)); if (S.result) showEnding(); },
  });
}

// ---------- 名前の編集（学校・家） ----------
// 版ごとに、家の名と学校の名（正式名・地図の名）を書き換える。架空の名前にする切り替えも。保存すると読み込み直して当てる
let NAME_ED = 'tokyo';
function showNameEditor(ed = NAME_ED, draft = null) {
  NAME_ED = ed;
  const edits = draft || loadNameEdits();
  edits.schools = edits.schools || {}; edits.houses = edits.houses || {};
  // 入力欄は、この画面を描いたときの切り替え（架空か実名か）の名前で埋まっている。手で変えたかどうかは、その名前と比べる
  const drawnFict = !!edits.fictional;
  const base = (id) => (drawnFict ? FICT_NAMES[id] : BASE_NAMES.schools[id]);
  const ids = zukanIds(ed);
  const houses = [...new Set(scenariosOf(ed).flatMap(scenarioClans))];
  const tabs = Object.entries(EDITIONS).map(([k, e]) => `<button data-ned="${k}" class="${k === ed ? 'on' : ''}" style="--c:${e.color || CLANS[e.lead].color}"><b>${e.mark}</b><span>${e.name}</span></button>`).join('');
  openModal(`<h2>名前の編集</h2>
    <label class="check-row ne-fict"><input type="checkbox" id="ne-fict" ${edits.fictional ? 'checked' : ''}> 学校と家をすべて架空の名前にする<small>（手で変えた名前はそのまま）</small></label>
    <div class="zk-tabs ne-tabs">${tabs}</div>
    <input class="name-input ne-search" id="ne-search" placeholder="学校名や地名でさがす" autocomplete="off">
    <h3>家</h3>
    <div class="ne-list">${houses.map((k) => `<div class="ne-row house">${crestBadge(k, 26)}<input data-house="${k}" maxlength="8" value="${esc(edits.houses[k] || (edits.fictional && FICT_NAMES[k] ? `${FICT_NAMES[k][1]}家` : BASE_NAMES.houses[k]))}"></div>`).join('')}</div>
    <h3>学校（正式名・地図の名）</h3>
    <div class="ne-list" id="ne-schools">${ids.map((id) => {
      const r = SCHOOL_ROWS.find((x) => x[0] === id), cur = edits.schools[id] || base(id);
      return `<div class="ne-row" data-key="${esc(`${BASE_NAMES.schools[id][0]} ${r[3]} ${r[7] || '東京'} ${cur[0]}`)}"><small>${esc(r[7] || '東京')}・${esc(r[3])}</small>
        <input data-sname="${id}" maxlength="12" value="${esc(cur[0])}"><input class="short" data-sshort="${id}" maxlength="5" value="${esc(cur[1])}"></div>`;
    }).join('')}</div>
    <button class="btn red" id="ne-save">保存して反映する</button>
    <button class="btn plain" id="ne-reset">すべて元の名前に戻す</button>
    <button class="btn plain" data-close>やめる</button>
    <p class="hint">保存すると画面を読み込み直します（遊んでいる途中のゲームは保存されます）</p>`);
  // 入力を下書きに集める（版を切り替えても消えないように）
  const collect = () => {
    modalBody.querySelectorAll('[data-house]').forEach((i) => {
      const k = i.dataset.house, v = i.value.trim();
      const def = drawnFict && FICT_NAMES[k] ? `${FICT_NAMES[k][1]}家` : BASE_NAMES.houses[k];
      if (v && v !== def) edits.houses[k] = v; else delete edits.houses[k];
    });
    modalBody.querySelectorAll('[data-sname]').forEach((i) => {
      const id = i.dataset.sname, n = i.value.trim(), s = modalBody.querySelector(`[data-sshort="${id}"]`).value.trim();
      const def = base(id);
      if (n && s && (n !== def[0] || s !== def[1])) edits.schools[id] = [n, s]; else delete edits.schools[id];
    });
    edits.fictional = $('ne-fict').checked; // 比べ終えてから切り替える
    return edits;
  };
  modalBody.querySelectorAll('[data-ned]').forEach((b) => { b.onclick = () => { Sound.tap(); showNameEditor(b.dataset.ned, collect()); }; });
  $('ne-fict').onchange = () => { Sound.tap(); const e = collect(); showNameEditor(NAME_ED, e); };
  $('ne-search').oninput = (ev) => {
    const q = ev.target.value.trim();
    modalBody.querySelectorAll('#ne-schools .ne-row').forEach((row) => { row.hidden = !!q && !row.dataset.key.includes(q); });
  };
  const reloadWith = (e) => {
    saveNameEdits(e);
    if (S && !$('game').hidden) save();
    location.reload();
  };
  $('ne-save').onclick = () => { Sound.tap(); reloadWith(collect()); };
  $('ne-reset').onclick = async () => {
    Sound.tap();
    if (await askConfirm('学校と家の名前を、すべて元に戻しますか？', { ok: '元に戻す' })) reloadWith({});
  };
}

// ---------- 当主の年表（巻物） ----------
// an = chronicleOf(S) か、戦績に残った年表。当主の代ごとに帯を引き、その代の出来事を季の順に並べる
function showChronicle(an, back) {
  const sc = SCENARIOS[an.scenario] || SCENARIOS.tokyo;
  const lords = an.lords.length ? an.lords : [{ name: '（当主不在）', from: 0, kakun: 'cha' }];
  const eras = lords.map((l, i) => ({ ...l, to: i + 1 < lords.length ? lords[i + 1].from : an.turn + 1 }));
  const color = CLANS[an.player] ? CLANS[an.player].color : '#857b6c';
  const seal = an.result === 'win' ? '天下<br>統一' : an.result === 'lose' ? '落日' : '戦<br>半ば';
  const body = eras.map((e, i) => {
    const evs = an.events.filter((x) => x.turn >= e.from && x.turn < e.to);
    return `<div class="cr-era">
      <div class="cr-lord"><span>${['初', '二', '三', '四', '五', '六', '七', '八', '九', '十'][i] || i + 1}代</span><b>${esc(e.name)}</b>
        <small>${KAKUN[e.kakun] ? `家訓「${KAKUN[e.kakun].name}」・` : ''}${dateLabel(e.from)}〜${dateLabel(Math.max(e.from, e.to - 1))}</small></div>
      ${evs.length ? evs.map((x) => `<div class="cr-ev ${x.big ? 'big' : ''}"><time>${dateLabel(x.turn)}</time><p><b>${esc(x.head)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</p></div>`).join('')
        : '<p class="cr-quiet">この代は、静かに力を蓄えた</p>'}
    </div>`;
  }).join('');
  openModal(`<div class="chronicle" style="--c:${color}">
      <div class="cr-head">${CLANS[an.player] ? crestBadge(an.player, 46) : ''}<div><h2>${esc(an.house)}の年表</h2>
        <small>${EDITIONS[edOf(an.scenario)].name}・${sc.name}・${an.turn}季</small></div><span class="cr-seal">${seal}</span></div>
      <div class="cr-scroll">${body}</div>
    </div>
    ${back ? '<button class="btn plain" id="cr-back">戻る</button>' : ''}
    <button class="btn plain" data-close>閉じる</button>`);
  if (back) $('cr-back').onclick = () => { Sound.tap(); back(); };
}

// ---------- 学校図鑑 ----------
// 版の札で切り替え。治めた学校は札に校風と名物、まだの学校は「？」と土地だけ
let ZUKAN_ED = 'tokyo';
function showZukan(ed = ZUKAN_ED) {
  ZUKAN_ED = ed;
  const rec = loadRecords();
  const z = rec.zukan || {};
  const total = zukanAll().length, got = zukanAll().filter((id) => z[id]).length;
  const rowOf = (id) => SCHOOL_ROWS.find((r) => r[0] === id);
  const ids = zukanIds(ed);
  const have = ids.filter((id) => z[id]).length;
  const full = have === ids.length;
  const tabs = Object.entries(EDITIONS).map(([k, e]) => {
    const all = zukanIds(k), n = all.filter((id) => z[id]).length;
    return `<button data-zed="${k}" class="${k === ed ? 'on' : ''}" style="--c:${e.color || CLANS[e.lead].color}"><b>${e.mark}</b><span>${n}/${all.length}</span>${n === all.length ? '<i>制</i>' : ''}</button>`;
  }).join('');
  const card = (id) => {
    const r = rowOf(id), e = z[id];
    if (!e) return `<div class="zk-card no"><b>？</b><small>${esc(r[7] || '東京')}・${esc(r[3])}</small></div>`;
    const house = CLANS[id] && r[6] === id;
    return `<button class="zk-card" data-zid="${id}">${house ? crestBadge(id, 22) : ''}<b>${esc(r[2])}</b><small>${esc(r[3])}</small>${e.n > 1 ? `<em>×${e.n}</em>` : ''}</button>`;
  };
  openModal(`<h2>学校図鑑</h2>
    <p class="zk-total">収録 <b>${got}</b> / ${total}校<span class="zk-bar"><i style="width:${(got / total * 100).toFixed(1)}%"></i></span></p>
    <div class="zk-tabs">${tabs}</div>
    <p class="zk-head">${EDITIONS[ed].name}　<b>${have}</b> / ${ids.length}校 ${full ? '<span class="zk-seal">全校<br>制覇</span>' : ''}</p>
    <div class="zk-grid">${ids.map(card).join('')}</div>
    <p class="hint">自分の家が治めた学校が載ります（版をまたいで集まります）。札をタップすると校風と名物</p>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-zed]').forEach((b) => { b.onclick = () => { Sound.tap(); showZukan(b.dataset.zed); }; });
  modalBody.querySelectorAll('[data-zid]').forEach((b) => { b.onclick = () => { Sound.tap(); showZukanEntry(b.dataset.zid); }; });
}
function showZukanEntry(id) {
  const r = SCHOOL_ROWS.find((x) => x[0] === id), e = (loadRecords().zukan || {})[id];
  const lo = schoolLore(id), tr = TRAITS[traitOf(id)];
  const house = CLANS[id] && r[6] === id;
  const d = new Date(e.at);
  openModal(`<div class="zk-entry">
      <div class="zk-plate" style="--c:${house ? CLANS[id].color : '#857b6c'}">${house ? crestBadge(id, 54) : `<svg viewBox="-30 -36 60 60" width="54" height="54" class="zk-castle" style="--c:#857b6c">${castleMarkup(false)}</svg>`}
        <div><b>${esc(r[1])}</b><small>${esc(r[7] || '東京')}・${esc(r[3])}${house ? `・${CLANS[id].name}の本拠` : ''}</small></div></div>
      <p class="zk-motto"><span>校風</span>「${esc(lo.motto)}」</p>
      ${lo.sight ? `<p class="zk-line"><span>名物</span>${esc(lo.sight)}</p>` : ''}
      <p class="zk-line"><span>特色</span>${esc(tr.name)}：${esc(tr.desc)}</p>
      <p class="zk-line"><span>記録</span>${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日に初めて治める・${e.n}度の旗揚げで治めた</p>
    </div>
    <button class="btn plain" id="zk-back">図鑑へ戻る</button>`);
  $('zk-back').onclick = () => { Sound.tap(); showZukan(); };
}
$('btn-records').onclick = () => { Sound.unlock(); Sound.tap(); showRecords(); };

// シナリオ・家・当主の名前・難易度を決める
const TUT_KEY = 'azabu-tut-done';
function tutDone() { try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; } }

// シナリオの顔ぶれ：学校の数と、家として動く家
function scenarioClans(scKey) {
  const sc = SCENARIOS[scKey];
  return Object.keys(CLANS).filter((k) => k !== 'none' && (!sc.clans || sc.clans.includes(k)) && SCHOOL_ROWS.some((r) => r[0] === k && r[6] === k && sc.filter(r)));
}
const scenarioSize = (scKey) => SCHOOL_ROWS.filter(SCENARIOS[scKey].filter).length;

function showSetup() {
  const rec = loadRecords();
  const st = { diff: 'normal', ed: 'tokyo', scenario: tutDone() ? 'tokyo' : 'toshin', clan: 'azabu', name: '', ch: new Set() };
  const pickList = (attr, keys, obj, cur, label) => `<div class="diff-list">${keys.map((k) => { const d = obj[k];
    return `<button data-${attr}="${k}" class="${k === cur ? 'on' : ''}"><b>${d.name}</b>${label(d, k)}<small>${d.desc}</small></button>`; }).join('')}</div>`;
  // 版の札：大きな一文字と、学校・家の数
  const edCards = () => `<div class="ed-pick">${Object.entries(EDITIONS).map(([k, e]) => {
    const scs = scenariosOf(k);
    const big = scs.reduce((a, s) => (scenarioSize(s) > scenarioSize(a) ? s : a), scs[0]);
    const lead = CLANS[e.lead];
    return `<button data-ed="${k}" class="${k === st.ed ? 'on' : ''}" style="--c:${e.color || lead.color}">
      <span class="ed-mark">${e.mark}</span><b>${e.name}</b><small>${e.desc}</small>
      <em>最大${scenarioSize(big)}校・${scenarioClans(big).length}家${scs.length > 1 ? `・${scs.length}つの戦い` : ''}</em></button>`;
  }).join('')}</div>`;
  const scList = () => pickList('sc', scenariosOf(st.ed), SCENARIOS, st.scenario, (d, k) => `<span class="lv">${d.level}</span><span class="sc-size">${scenarioSize(k)}校・${scenarioClans(k).length}家</span>`);
  const clanList = () => {
    const lead = EDITIONS[st.ed].lead;
    return `<div class="clan-pick">${scenarioClans(st.scenario).map((k) => {
      // 版の主役の家はいつでも。ほかの家は一度でも天下統一すると遊べる
      const locked = k !== lead && !rec.unlocked.includes(k) && rec.unlocked.length <= 1;
      return `<button data-clan="${k}" class="${k === st.clan ? 'on' : ''}" ${locked ? 'disabled' : ''}>
        ${crestBadge(k, 36)}<b>${CLANS[k].name.replace('家', '')}</b>
        <small>${locked ? '🔒 天下統一で解放' : '★'.repeat(CLANS[k].stars) + '☆'.repeat(5 - CLANS[k].stars)}</small></button>`;
    }).join('')}</div><p class="hint" id="clan-note">${CLANS[st.clan].note}</p>`;
  };
  const defaultName = () => `${CLANS[st.clan].name.replace('家', '').replace('・', '')} 一郎`;
  const step = (n, t) => `<h3 class="setup-h"><span>${n}</span>${t}</h3>`;
  openModal(`<h2>旗 揚 げ</h2>
    ${step('一', '版を選ぶ')}
    <div id="ed-box">${edCards()}</div>
    ${step('二', '戦いを選ぶ')}
    <div id="sc-box">${scList()}</div>
    ${step('三', '率いる家')}
    <div id="clan-box">${clanList()}</div>
    ${step('四', '当主の名前')}
    <input class="name-input" id="lord-name" maxlength="10" value="${defaultName()}" autocomplete="off">
    ${step('五', '家の志')}
    <div class="ts-pick"><button data-ts="" class="on"><b>家訓にまかせる</b><small>当主の家訓から志が決まる</small></button>${Object.entries(TAISHI).map(([k, t]) => `<button data-ts="${k}"><span class="ts-motto">${t.motto}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>
    ${step('六', '難易度')}
    ${pickList('diff', Object.keys(DIFFICULTY), DIFFICULTY, st.diff, () => '')}
    ${step('七', '挑戦状（えらばなくてもよい）')}
    <div class="ch-pick">${Object.entries(CHALLENGES).map(([k, c]) => `<button data-ch="${k}"><span>${c.mark}</span><b>${c.name}</b><small>${c.desc}</small>${(rec.challenges || {})[k] ? '<i>済</i>' : ''}</button>`).join('')}</div>
    <label class="check-row"><input type="checkbox" id="tut" ${tutDone() ? '' : 'checked'}> 軍師の手ほどき（チュートリアル）を受ける</label>
    <button class="btn red" id="setup-go">出 陣</button>
    <button class="btn plain" data-close>やめる</button>`);
  const bindPick = (attr, set) => modalBody.querySelectorAll(`[data-${attr}]`).forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      set(b.dataset[attr]);
      modalBody.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle('on', x === b));
    };
  });
  const bindClans = () => bindPick('clan', (v) => {
    const input = $('lord-name');
    const wasDefault = input.value === defaultName();
    st.clan = v;
    if (wasDefault) input.value = defaultName();
    $('clan-note').textContent = CLANS[v].note;
  });
  // シナリオを変えたら、その地図にいない家は選べないので、版の主役の家に戻す
  const setScenarioPick = (v) => {
    const input = $('lord-name');
    const wasDefault = input.value === defaultName();
    st.scenario = v;
    if (!scenarioClans(v).includes(st.clan)) st.clan = EDITIONS[st.ed].lead;
    if (wasDefault) input.value = defaultName();
    $('clan-box').innerHTML = clanList();
    bindClans();
  };
  const bindScenarios = () => bindPick('sc', setScenarioPick);
  bindPick('ed', (v) => {
    st.ed = v;
    const scs = scenariosOf(v);
    // 版の中で、いちばん大きな戦いを最初に選んでおく（東京版は、はじめての人には「都心の陣」）
    const first = v === 'tokyo' ? (tutDone() ? 'tokyo' : 'toshin') : scs[scs.length - 1];
    st.scenario = first;
    $('sc-box').innerHTML = scList();
    bindScenarios();
    setScenarioPick(first);
  });
  bindScenarios();
  bindClans();
  bindPick('diff', (v) => { st.diff = v; });
  bindPick('ts', (v) => { st.taishi = v; });
  // 挑戦状：いくつでも重ねられる（押すたびに付け外し）
  modalBody.querySelectorAll('[data-ch]').forEach((b) => { b.onclick = () => { Sound.tap(); const k = b.dataset.ch; if (st.ch.has(k)) st.ch.delete(k); else st.ch.add(k); b.classList.toggle('on', st.ch.has(k)); }; });
  $('setup-go').onclick = () => {
    const name = $('lord-name').value.trim() || defaultName();
    S = newGame({ lordName: name, diff: st.diff, scenario: st.scenario, clan: st.clan, tutorial: $('tut').checked, challenges: [...st.ch] });
    if (st.taishi) { S.playerTaishi = st.taishi; S.taishi = {}; }
    save();
    closeModal();
    startGame(true);
  };
}

function startGame(isNew) {
  $('title').hidden = true;
  $('game').hidden = false;
  selected = null;
  mode = null;
  if (!S.mark) S.mark = seasonMark(); // 季節の瓦版で増減を測る起点
  fusuma();
  drawMap();
  render();
  centerOn(PLAYER);
  $('zoom-home').textContent = pShort()[0];
  Sound.bgmStart('map');
  if (isNew) showPrologue();
}

// ---------- 序章：旗揚げの絵巻（三枚。タップで次へ） ----------
const PROLOGUE_CRY = {
  str: '力をもって道を切り拓く！ 皆の者、ついてまいれ！',
  pol: '豊かな家こそ強い家。まずは足元を固め、それから天下だ',
  cha: '一人ひとりが、この家の宝だ。皆で天下を取ろう！',
  int: '戦は始まる前に決まる。策をもって天下を取る',
};
function showPrologue() {
  const lord = lordOf(S);
  const rivals = aiClans();
  const retainers = gensOf(S, PLAYER).filter((g) => !g.lord);
  const G = GOALS[0];
  const ring = rivals.map((k, i) => {
    const a = (i / rivals.length) * Math.PI * 2 - Math.PI / 2;
    return `<span style="left:${(50 + Math.cos(a) * 40).toFixed(1)}%;top:${(50 + Math.sin(a) * 40).toFixed(1)}%;animation-delay:${(0.5 + i * 0.12).toFixed(2)}s">${crestBadge(k, 40)}<small>${CLANS[k].name.replace('家', '')}</small></span>`;
  }).join('');
  const panels = [
    () => `<div class="pr-kicker">${esc(SCENARIOS[S.scenario].name)}</div>
      <div class="kime-title">時は${dateLabel(0)}</div>
      <div class="pr-ring">${ring}<div class="pr-me">${crestBadge(PLAYER, 92)}</div></div>
      <p class="pr-text">この地には<b>${MAP.nodes.length}校</b>がひしめき、<b>${rivals.map((k) => CLANS[k].name.replace('家', '')).join('・')}</b>の各家が覇をねらう。</p>`,
    () => `<div class="pr-kicker">旗 揚 げ</div>
      <div class="kime-frame">${portrait(lord, 300, 'angry')}
        <div class="kime-name"><span>${esc(lord.name)}</span><small>${pName()}当主</small></div>
        <div class="kime-seal">${esc(pShort())}<br>之印</div></div>
      <p class="kime-line">「${esc((REGION_VOICE[HOUSE_REGION[PLAYER]] || {}).catch || PROLOGUE_CRY[S.kakun] || PROLOGUE_CRY.cha)}」</p>
      <p class="pr-text">${esc(MAP.byId[PLAYER].ward)}の地に、${pName()}が旗を揚げる。家訓は「${KAKUN[S.kakun].name}」──${KAKUN[S.kakun].desc}</p>`,
    () => `<div class="pr-kicker">家 臣 団</div>
      <div class="pr-band">${retainers.map((g, i) => `<div style="animation-delay:${(0.2 + i * 0.15).toFixed(2)}s">${portrait(g, 64, 'smile')}<b>${esc(g.name.split(' ')[1] || g.name)}</b><small>${esc(g.title)}</small></div>`).join('')}</div>
      <p class="pr-text">頼れる家臣は${retainers.length}人。城を落として武将を登用し、天下を統一せよ。</p>
      <div class="goal-card pr-goal"><span class="gk">目標</span><div><small>旗揚げの章 一／四</small><b>${esc(G.name)}</b><p>${esc(goalText(S, G))}</p><em>褒美：${esc(G.reward)}</em></div></div>
      <p class="pr-hint">難易度：${diffOf(S).name}・最初の${graceTurns(S)}季は他家も様子見<br>当主も3年生の春には卒業する。後継者を育てておこう</p>
      <button class="btn red pr-go" id="pr-go">出陣じゃ！</button>`,
  ];
  let box = $('prologue');
  if (!box) { box = document.createElement('div'); box.id = 'prologue'; box.className = 'kime prologue'; document.body.appendChild(box); }
  let i = 0, ready = false;
  const finish = () => { Sound.tap(); box.hidden = true; render(); };
  const draw = () => {
    box.innerHTML = `<div class="kime-card pr-card">${panels[i]()}
      <div class="pr-dots">${panels.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      ${i < panels.length - 1 ? '<p class="kime-tap">画面をタップ</p>' : ''}</div>`;
    ready = false;
    setTimeout(() => { ready = true; }, 600);
    if (i === 0) { Sound.horagai(); } else { Sound.hyoshigi(i === 1 ? 2 : 1); if (i === 1) Sound.taiko(0.4, 1); }
    const go = $('pr-go');
    if (go) go.onclick = (e) => { e.stopPropagation(); finish(); };
  };
  box.onclick = () => { if (!ready || i >= panels.length - 1) return; Sound.tap(); i++; draw(); };
  box.hidden = false;
  draw();
}

// 遊び方：章ごとの絵巻。上の札で章を選ぶ
let HELP_CH = 0;
function helpChapters() {
  const me = S ? pName() : '自分の家';
  const li = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  return [
    { k: '始', t: 'はじめ', name: 'はじめに', body: `
      <p class="help-lead">${me}を率いて、地図上のすべての学校を制覇すれば<b>天下統一</b>。城がすべて奪われると敗北です。</p>
      <h3>一季の流れ</h3>
      <ol class="help-flow">
        <li><b>城を選ぶ</b>：地図の城をタップして、そこにいる武将に命令します</li>
        <li><b>命令する</b>：武将1人につき1季1回。武将のいない城は何もできません</li>
        <li><b>ターン終了</b>：他家が動き、季節が進み、<b>学園瓦版</b>で出来事がわかります</li>
      </ol>
      <h3>命令</h3>
      ${li([
        `<b>出陣</b>：道でつながった敵城を攻める。攻め先のとなりの城から<b>援軍</b>も出せます`,
        `<b>輸送</b>：となりの自分の城へ兵を送る。送られた兵は<b>その季は動けません</b>`,
        `<b>移動</b>：武将をとなりの自分の城へ移す`,
        `<b>徴兵</b>（金${RULES.recruitCost}）・<b>開発</b>（金${RULES.developCost}）・<b>築城</b>（金${RULES.fortifyCost}）`,
        `城を<b>委任</b>にすると、ターン終了時に自動で命令します。「全城で徴兵／開発」でまとめて命令も`,
        `地図の<b>「危」</b>の札は、となりの敵が総がかりで来ると守り切れない城、<b>「注」</b>は油断できない城です。城のパネルや軍議の<b>「援兵」</b>で、となりの城から兵を一押しで送れます`,
      ])}
      <h3>学校の特色と施設</h3>
      ${li([
        `学校の<b>特色</b>：${Object.values(TRAITS).map((t) => `<b>${t.name}</b>（${t.desc}）`).join('、')}`,
        `「城下町」の区画に<b>施設</b>を建てる（町が育つと区画が増え、最大${FAC_SLOTS + 3}つ）：${Object.values(FACILITIES).map((f) => `${f.name}（${f.desc}）`).join('、')}`,
        `特色と施設は、城を落とすとそのまま引き継げます`,
      ])}` },
    { k: '将', t: '武将', name: '武将', body: `
      ${li([
        `能力：<b>統率</b>＝合戦の強さ、<b>政治</b>＝開発、<b>魅力</b>＝徴兵・登用、<b>知略</b>＝守り・作戦を読む`,
        `命令をこなすと、能力が少しずつ上がります`,
        `城を落とすと、敵の武将を<b>捕らえる</b>ことがあります。登用すれば家臣に`,
      ])}
      <h3>忠誠と褒美</h3>
      ${li([
        `家臣の<b>忠誠度</b>は季節ごとに少しずつ下がります（当主の魅力が高いと下がりにくい）`,
        `<b>褒美</b>（金${LOYAL.rewardCost}）や合戦の勝利、合宿・文化祭で上がります`,
        `忠誠${LOYAL.leaveBelow}未満で<b>出奔</b>、${LOYAL.rebelBelow}未満で城ごと<b>謀反</b>のおそれ`,
      ])}
      <h3>部活</h3>
      <p>武将はみな部活に入っていて、合戦で効き目があります。</p>
      <div class="help-grid">${Object.values(CLUBS).map((c) => `<div><b>${c.name}</b><span>${c.desc}</span></div>`).join('')}</div>
      <h3>卒業と家督相続</h3>
      ${li([
        `毎年春、<b>3年生は卒業</b>し、各校に<b>新入生</b>が入ります`,
        `<b>当主が卒業</b>すると、家臣から後継者を選びます。当主の得意な能力で<b>家訓</b>が決まります`,
        `選ばれなかった実力者は、家を去ることもあります`,
      ])}` },
    { k: '戦', t: '合戦', name: '合戦', body: `
      <h3>出陣の作戦</h3>
      <p><b>突撃</b>は奇襲に、<b>奇襲</b>は籠城に、<b>籠城</b>は突撃に強い。読み勝つと最初の士気が上がります。知略の高い大将は敵の作戦を読めることも。</p>
      <h3>采配</h3>
      ${li([
        `1合ずつ<b>攻撃・突撃・守り・計略・退却</b>から選びます（最大8合）`,
        `<b>突撃は計略に、計略は守りに、守りは突撃に強い</b>。計略が決まると敵は1合動けません`,
        `兵が残っていても<b>士気が0で総崩れ</b>。敵の兵か士気を0にすれば落城`,
        `特技を持つ武将は<b>戦法</b>（一番槍・火計・鼓舞など）を1度だけ使えます`,
        `<b>天気</b>で合戦が変わります：${Object.values(WEATHER).map((w) => `${w.name}（${w.desc}）`).join('、')}`,
        `家の本拠をめぐる合戦は<b>決戦</b>。守る側の士気が高く、大将どうしの一騎打ちが必ず起こります`,
        `「おまかせで決着」「結果まで飛ばす」で省略も。設定でいつもおまかせにもできます`,
      ])}
      <h3>一騎打ち</h3>
      ${li([
        `<b>斬る</b>は払うに、<b>払う</b>は受けるに、<b>受ける</b>は斬るに強い。<b>溜める</b>と気合+${DUEL.kiCharge}（ただし攻められると深手）`,
        `気合が満ちると<b>必殺技</b>。特技ごとに技が違います`,
        `勝ったら相手を<b>捕らえる・説得する・見逃す</b>から選べます`,
      ])}
      <h3>コツ</h3>
      <p>守る側は「兵力×防御×守将」で戦います。出陣の画面に<b>勝つ見込み</b>が出るので、<b>勝算大</b>（9割以上）と出るまで兵や援軍を集めましょう。敵の構えを読めたら、それに強い作戦を選ぶと見込みが上がります。</p>` },
    { k: '謀', t: '計略', name: '計略・舌戦', body: `
      <h3>計略</h3>
      ${li([
        `城の命令「計略」で、道${SCHEME_RANGE}本先までの城に仕掛けられます`,
        `<b>流言</b>：敵城の兵と守りを減らす ／ <b>離間</b>：敵の武将の忠誠を下げる`,
        `<b>引き抜き</b>：敵の武将を寝返らせる。忠誠が低い相手ほど成功しやすい`,
        `<b>調略</b>：独立校を戦わずに味方にする`,
        `他家も計略を仕掛けてきます。忠誠の低い家臣は引き抜かれやすいので注意`,
      ])}
      <h3>舌戦</h3>
      <p>敵の城を選んで「舌戦」。となりの城の、知略と魅力のいちばん高い武将が使者になり、<b>${DEBATE.rounds}回の論</b>で説得します。ゲージを満たせば<b>無血開城</b>。</p>
      <div class="help-grid">${Object.entries(DEBATE_ARGS).map(([k, a]) => `<div><b><i class="hk db-${k}">${a.name}</i>${a.full}</b><span>${a.desc}。「${a.foe}」な相手に効く</span></div>`).join('')}</div>
      ${li([
        `守将の<b>弱点</b>の論は2倍、反対の論は半分、同じ論のくり返しは弱まります`,
        `使者の知略が高いほど、相手の弱点を見抜けます`,
        `本拠と、当主のいる城は開城しません。断られた城には4季のあいだ仕掛けられません`,
      ])}` },
    { k: '交', t: '外交', name: '外交', body: `
      ${li([
        `各家との<b>友好度</b>を「贈答」で上げ、<b>停戦</b>や<b>同盟</b>を申し込めます`,
        `申し込みは<b>会談</b>。使者（魅力の高い武将）が1人行動します`,
        `停戦・同盟の相手とはおたがいに攻め合いません。破棄すると他の家からの信用も失います`,
        `城の${Math.round(DIPLO.encircleShare * 100)}%以上を持つと、諸家が<b>包囲網</b>を結成します`,
        `各家には<b>性格</b>があります（${Object.entries(CLAN_PERSONA).filter(([k]) => k !== PLAYER).map(([k, p]) => `${CLANS[k].name.replace('家', '')}＝${PERSONAS[p].name}`).join('、')}）`,
        `他家どうしも停戦・同盟を結び、ときには裏切ります`,
      ])}` },
    { k: '伝', t: '物語', name: '武将の物語', body: `
      <p class="help-lead">戦いを重ねるほど、武将に物語が生まれます。</p>
      <h3>列伝と異名</h3>
      ${li([
        `武将ごとに戦いの記録（<b>列伝</b>）が残り、手柄に応じて「鬼の〜」などの<b>異名</b>がつきます`,
        `名を上げた武将は卒業すると<b>卒業生の列伝</b>に名を残します（武将一覧から見られます）`,
        `当主や名のある武将は、カードがきらきらと<b>雲母摺り</b>になります`,
      ])}
      <h3>家宝</h3>
      <p>名刀や軍配などの家宝を持たせると、その武将に効き目があります。敵の武将を捕らえると奪えることも。持ち主が卒業すると後輩に受け継がれます。</p>
      <div class="help-grid">${Object.values(TREASURE_KINDS).map((t) => `<div><b>${t.name}</b><span>${t.desc}</span></div>`).join('')}</div>
      <h3>絆</h3>
      <p>自分の家の武将どうしに<b>絆</b>が生まれます。同じ学年で同じ城に長くいると<b>親友</b>、学年の違う二人なら<b>師弟</b>、いっしょに出陣を重ねると<b>戦友</b>。絆の相手と並んで戦うと士気が上がり、卒業のときには別れの場面があります。</p>
      <div class="help-grid">${Object.values(BOND_TYPES).map((t) => `<div><b>${t.name}</b><span>${t.desc}</span></div>`).join('')}</div>
      <h3>因縁</h3>
      <p>同じ相手と${RIVAL_AT}度ぶつかると<b>宿敵</b>に。宿敵どうしの合戦では一騎打ちが起こりやすくなります。</p>
      <h3>決め絵</h3>
      <p>家督相続や一騎打ちの勝利、決戦、無血開城など、ここいちばんの場面では武将の<b>決め絵</b>が刷り上がります。</p>
      <h3>他家と実績</h3>
      <p>一度天下統一すると、他の家でも遊べます。「戦績・実績」で記録を見られます。</p>` },
  ];
}
function showHelp(ch = HELP_CH) {
  const chs = helpChapters();
  HELP_CH = clamp(ch, 0, chs.length - 1);
  const c = chs[HELP_CH];
  openModal(`<h2>遊び方</h2>
    <div class="help-tabs">${chs.map((x, i) => `<button class="${i === HELP_CH ? 'on' : ''}" data-ch="${i}"><i>${x.k}</i>${x.t}</button>`).join('')}</div>
    <div class="help-page"><div class="help-seal">${c.k}</div><h3 class="help-title">${c.name}</h3>${c.body}</div>
    <div class="help-nav">
      <button class="btn plain" data-ch="${HELP_CH - 1}" ${HELP_CH === 0 ? 'disabled' : ''}>← 前の章</button>
      <button class="btn plain" data-ch="${HELP_CH + 1}" ${HELP_CH === chs.length - 1 ? 'disabled' : ''}>次の章 →</button>
    </div>
    <p class="hint">※実在の学校名を使ったフィクションです。武将・能力値・家紋はすべて架空です。</p>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-ch]').forEach((b) => { b.onclick = () => { Sound.tap(); showHelp(+b.dataset.ch); }; });
}

// ---------- 地図 ----------
function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

let CELLS_SC = null;
function drawMap() {
  if (CELLS_SC !== MAP_SCENARIO) { CELLS = buildCells(); CELLS_SC = MAP_SCENARIO; }
  const scn = SCENARIOS[MAP_SCENARIO].scenery;
  const lands = scn && scn.lands; // 島の地図：領地の色を陸だけに塗る
  svg.setAttribute('viewBox', `0 0 ${MAP.width} ${MAP.height}`);
  svg.innerHTML = `<defs>
      <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a4a52" stop-opacity="0.55"/><stop offset="1" stop-color="#4a4a52" stop-opacity="0"/>
      </linearGradient>
      <pattern id="waves" width="36" height="18" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#f1e6cc" stroke-opacity="0.7" stroke-width="1.6">
          <path d="M0,18 A18,18 0 0,1 36,18 M6,18 A12,12 0 0,1 30,18 M12,18 A6,6 0 0,1 24,18"/>
          <path d="M-18,9 A18,18 0 0,1 18,9 M18,9 A18,18 0 0,1 54,9" stroke-opacity="0.3"/>
        </g>
      </pattern>
      <filter id="inkwash" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="4"/></filter>
      <pattern id="kinpaku" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#e3b94e"/><rect width="7" height="7" fill="#ecc660"/><rect x="7" y="7" width="7" height="7" fill="#d9ad3f"/>
      </pattern>
      ${lands ? `<clipPath id="landclip">${lands.map((l) => `<path d="${pathFrom(l.map(([la, lo]) => MAP.geo(la, lo)), true)}"/>`).join('')}</clipPath>` : ''}
    </defs>
    <g>${sceneryMarkup()}</g>
    <g id="territory" filter="url(#inkwash)" ${lands ? 'clip-path="url(#landclip)"' : ''}>${MAP.nodes.map((n) => `<path class="cell" data-id="${n.id}" d="${CELLS[n.id]}"/>`).join('')}</g>
    <g id="roads"></g>
    <g id="castles"></g>
    <g id="world-fx"></g>`;
  applyScale();

  const roads = $('roads');
  MAP.edges.forEach(([a, b]) => {
    const A = MAP.byId[a], B = MAP.byId[b];
    const sea = seaRoute(a, b); // 海の道：青い破線と小舟
    el('line', { class: sea ? 'road sea' : 'road', x1: A.x, y1: A.y + 8, x2: B.x, y2: B.y + 8, 'data-a': a, 'data-b': b, 'data-sea': sea ? '1' : '' }, roads);
    if (sea) {
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + 8, flip = B.x < A.x ? -1 : 1;
      const boat = el('g', { class: 'boat', transform: `translate(${mx.toFixed(0)},${my.toFixed(0)}) scale(${flip},1)` }, roads);
      boat.innerHTML = '<path class="hull" d="M-11,0 L11,0 L7,6 L-8,6Z"/><path class="mast" d="M0,0 V-14"/><path class="sail" d="M1,-13 L10,-4 L1,-3Z"/>';
    }
  });

  const layer = $('castles');
  MAP.nodes
    .slice()
    .sort((a, b) => a.y - b.y) // 手前の城を上に重ねる
    .forEach((n) => {
      const g = el('g', { class: 'castle', 'data-id': n.id, transform: `translate(${n.x},${n.y})` }, layer);
      const w = n.short.length * 12 + 12;
      g.innerHTML = `
        <circle class="hit" r="34" cy="8"/>
        <ellipse class="ring" cx="0" cy="14" rx="27" ry="10"/>
        ${townMarkup()}
        <g class="keep">${castleMarkup(n.clan !== 'none')}</g>
        <g class="plate" transform="translate(0,27)">
          <rect x="${-w / 2}" y="-8.5" width="${w}" height="17"/>
          <rect class="bar" x="${-w / 2}" y="-8.5" width="4" height="17"/>
          <text x="2">${n.short}</text>
        </g>
        <g class="deleg" transform="translate(${-w / 2 - 7},27)"><circle r="7.5"/><text>委</text></g>
        <g class="gbadge" transform="translate(17,-19)"><circle r="8"/><text></text></g>
        <g class="danger" transform="translate(-19,-16) rotate(-8)"><rect x="-9" y="-9" width="18" height="18"/><text>危</text></g>
        <g class="chance" transform="translate(-19,-16) rotate(-8)" style="display:none"><rect x="-9" y="-9" width="18" height="18"/><text>攻</text></g>
        <g class="siegemark" style="display:none">${[200, 240, 280, 320, 340, 20].map((a) => { const r = (a * Math.PI) / 180, x = (Math.cos(r) * 34).toFixed(0), y = (8 + Math.sin(r) * 22).toFixed(0); return `<g transform="translate(${x},${y})"><path class="pole" d="M0,6 V-12"/><rect class="flag" x="0.5" y="-12" width="6" height="9"/></g>`; }).join("")}<g class="sg-tag" transform="translate(0,-40)"><rect x="-17" y="-8" width="34" height="16"/><text></text></g></g>
        <text class="facmark" x="-14" y="-22"></text>
        <text class="troops" y="48"></text>`;
      g.addEventListener('click', () => onCastleTap(n.id));
    });
}

function applyScale() {
  svg.setAttribute('width', Math.round(MAP.width * scale));
  svg.setAttribute('height', Math.round(MAP.height * scale));
}

function zoomAt(newScale, cxScreen, cyScreen) {
  const rect = mapwrap.getBoundingClientRect();
  const sx = cxScreen === undefined ? mapwrap.clientWidth / 2 : cxScreen - rect.left;
  const sy = cyScreen === undefined ? mapwrap.clientHeight / 2 : cyScreen - rect.top;
  const mx = (mapwrap.scrollLeft + sx) / scale;
  const my = (mapwrap.scrollTop + sy) / scale;
  // 引きは、地図の横幅が画面に収まるところまで（首都圏版のような大きな地図でも全体を見渡せる）
  const minScale = Math.max(0.2, Math.min(0.4, mapwrap.clientWidth / MAP.width));
  scale = Math.min(1.8, Math.max(minScale, newScale));
  applyScale();
  mapwrap.scrollLeft = mx * scale - sx;
  mapwrap.scrollTop = my * scale - sy;
}

function centerOn(id) {
  const n = MAP.byId[id];
  mapwrap.scrollLeft = n.x * scale - mapwrap.clientWidth / 2;
  mapwrap.scrollTop = n.y * scale - mapwrap.clientHeight / 2;
}

$('zoom-in').onclick = () => { Sound.tap(); zoomAt(scale * 1.25); };
$('zoom-out').onclick = () => { Sound.tap(); zoomAt(scale * 0.8); };
$('zoom-home').onclick = () => {
  Sound.tap();
  const lord = lordOf(S);
  const mine = castlesOf(S, PLAYER);
  centerOn(selected && S.castles[selected].owner === PLAYER ? selected : lord && lord.loc ? lord.loc : mine[0]);
};

// 2本指でつまんで拡大・縮小
(() => {
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  mapwrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches), s: scale };
  }, { passive: true });
  mapwrap.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [cx, cy] = mid(e.touches);
    zoomAt(pinch.s * (dist(e.touches) / pinch.d), cx, cy);
  }, { passive: false });
  mapwrap.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });
  // Safari のページ全体の拡大を止める
  ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
})();

// ---------- 表示の更新 ----------
function render() {
  const mine = castlesOf(S, PLAYER);
  $('hud-crest').innerHTML = crestBadge(PLAYER, 30);
  const wx = WEATHER[S.weather] || WEATHER.sun;
  $('hud-date').innerHTML = `${dateLabel(S.turn)}<button class="hud-wx" id="hud-wx" aria-label="天気：${wx.name}">${wx.icon}</button>`;
  $('hud-wx').onclick = () => { Sound.tap(); toast(`${wx.icon} 今季の天気は「${wx.name}」<br><b>${wx.desc}</b>`); };
  $('hud-gold').textContent = fmt(S.gold[PLAYER]);
  $('hud-castles').textContent = `${mine.length}/${MAP.nodes.length}`;
  $('btn-sound').textContent = Sound.on ? '♪' : '✕';
  petals($('map-petals'), S.turn % 4, 12);
  mapwrap.dataset.season = S.turn % 4; // 地図の季節の色と飾り
  const sky = $('map-sky'); if (sky) { sky.dataset.season = S.turn % 4; sky.dataset.wx = S.weather || 'sun'; } // 地図の空：天気と季節の光

  document.querySelectorAll('#territory .cell').forEach((p) => {
    const owner = S.castles[p.dataset.id].owner;
    p.setAttribute('fill', owner === 'none' ? 'transparent' : CLANS[owner].color);
  });

  const targets = modeTargets();
  const chances = mode ? [] : attackChances(S).map((pl) => pl.to); // 攻め口（命令を選んでいる間は出さない）
  document.querySelectorAll('#map .castle').forEach((g) => {
    const id = g.dataset.id;
    const c = S.castles[id];
    const own = c.owner === PLAYER;
    const idle = own ? idleGensAt(S, id).length : 0;
    const total = own ? gensAt(S, id).length : 0;
    g.style.setProperty('--c', CLANS[c.owner].color);
    g.querySelector('.troops').textContent = fmt(c.troops);
    g.querySelector('.facmark').textContent = (c.fac || []).map((f) => FACILITIES[f].name[0]).join('');
    g.classList.toggle('acted', own && (idle === 0 || !!S.delegate[id]));
    g.classList.toggle('selected', id === selected);
    g.classList.toggle('delegated', own && !!S.delegate[id]);
    const badge = g.querySelector('.gbadge');
    badge.style.display = own && total ? '' : 'none';
    badge.classList.toggle('none-left', idle === 0);
    badge.querySelector('text').textContent = idle;
    // 危うい城：攻められたら守り切れる見込みが低い
    const th = own ? dangerOf(S, id, winChance) : null;
    const dz = g.querySelector('.danger');
    const lvl = th && th.keep < 0.5 ? 'hi' : th && th.keep < 0.85 ? 'mid' : '';
    dz.style.display = lvl ? '' : 'none';
    dz.setAttribute('class', `danger ${lvl}`);
    dz.querySelector('text').textContent = lvl === 'hi' ? '危' : '注';
    g.querySelector('.chance').style.display = chances.includes(id) ? '' : 'none';
    // 包囲の陣：囲んでいる城のまわりに、自分の家の旗と季の数
    const sgm = g.querySelector('.siegemark'), sgo = siegeOf(S, id);
    sgm.style.display = sgo ? '' : 'none';
    if (sgo) { sgm.style.setProperty('--sc', CLANS[siegeClan(sgo)].color); sgm.querySelector('text').textContent = `${'〇一二三四五六七八九十'[Math.min(10, sgo.turns)] || sgo.turns}季`; }
    // 城下町：経済の段階に合わせて町並みを見せる。段階が上がったら、新しく建ったものが跳ねて現れる
    const lv = townLevel(c.eco), was = g.dataset.town;
    if (String(lv) !== was) {
      g.dataset.town = lv;
      g.querySelectorAll('.town [data-lv]').forEach((t) => {
        const need = +t.dataset.lv;
        const show = t.classList.contains('field') ? lv === 0 : lv >= need;
        t.style.display = show ? '' : 'none';
        t.classList.toggle('pop', show && was !== undefined && need > +was);
      });
      if (was !== undefined && lv > +was && own) toast(`🏮 ${MAP.byId[id].short}が「${TOWN_LEVELS[lv].name}」に育った`);
    }
    g.classList.toggle('front', !!th);
    const ring = g.querySelector('.ring');
    const kind = mode && (['attack', 'scheme', 'siege'].includes(mode.kind) ? 'target' : 'friend');
    ring.setAttribute('class', 'ring ' + (targets.includes(id) ? kind : id === selected ? 'sel' : ''));
  });

  document.querySelectorAll('#map .road').forEach((l) => {
    const a = l.dataset.a, b = l.dataset.b;
    const hot = mode && ((a === mode.from && targets.includes(b)) || (b === mode.from && targets.includes(a)));
    const lit = !mode && selected && (a === selected || b === selected);
    l.setAttribute('class', 'road' + (l.dataset.sea ? ' sea' : '') + (hot ? ' hot' : lit ? ' lit' : ''));
  });

  const banner = $('mode-banner');
  if (mode) {
    const label = mode.kind === 'attack' ? '⚔ 攻める城を選べ'
      : mode.kind === 'siege' ? '🏯 囲む城を選べ'
      : mode.kind === 'move' ? '🐎 兵を送る城を選べ'
      : mode.kind === 'scheme' ? `🎭 計略「${SCHEMES[mode.scheme].name}」の相手を選べ`
      : `🚶 ${esc(S.gens[mode.gid].name)}の移動先を選べ`;
    banner.hidden = false;
    banner.innerHTML = `<span>${label}</span><button id="mode-cancel">やめる</button>`;
    $('mode-cancel').onclick = () => { Sound.tap(); mode = null; render(); };
  } else {
    banner.hidden = true;
  }
  renderPanel();
  renderCoach();
  scheduleGoalCheck();
}

function modeTargets() {
  if (!mode) return [];
  if (mode.kind === 'scheme') return schemeTargets(S, mode.from, mode.scheme);
  if (mode.kind === 'siege') return hostileNeighbors(S, mode.from).filter((t) => canSiege(S, mode.from, t));
  return mode.kind === 'attack' ? hostileNeighbors(S, mode.from) : ownNeighbors(S, mode.from);
}

// 敵の城を攻められる自分の城
function attackSources(target) {
  if (atPeace(S, PLAYER, S.castles[target].owner)) return [];
  return MAP.adj[target].filter((id) => S.castles[id].owner === PLAYER && !S.delegate[id] &&
    readyTroops(S, id) > 0 && idleGensAt(S, id).length > 0);
}

function relIcon(k) {
  const r = S.rel[k];
  if (!r) return '';
  return (r.sister ? '🌸' : r.ally > 0 ? '🤝' : r.truce > 0 ? '🕊️' : '') + (r.trade > 0 ? '💰' : '');
}

function renderPanel() {
  if (!selected) return renderCouncil();
  const n = MAP.byId[selected];
  const c = S.castles[selected];
  const own = c.owner === PLAYER;
  const gens = gensAt(S, selected).sort((a, b) => (b.lord ? 1 : 0) - (a.lord ? 1 : 0) || b.str - a.str);
  const head = `<div class="p-head">${crestBadge(c.owner, 30)}<h2>${n.name}</h2>
      ${own ? `<label class="switch"><input type="checkbox" id="c-deleg" ${S.delegate[selected] ? 'checked' : ''}><span>委任</span></label>` : `<span class="p-sub">${n.ward}</span>`}</div>
    <div class="stats">
      <div class="stat"><span class="n">${fmt(c.troops)}</span><span class="l">兵 力</span></div>
      <div class="stat"><span class="n">${c.def.toFixed(1)}</span><span class="l">防 御</span></div>
      <div class="stat"><span class="n">${c.eco}</span><span class="l">経 済</span><small class="town-name">${TOWN_LEVELS[townLevel(c.eco)].name}${townLevel(c.eco) < TOWN_LEVELS.length - 1 ? `・次は${TOWN_LEVELS[townLevel(c.eco) + 1].eco}` : ''}</small></div>
    </div>
    ${(() => {
      if (!own) return '';
      const th = dangerOf(S, selected, winChance);
      if (!th) return '<p class="threat safe">後方の城：となりに敵の城はない</p>';
      const k = th.keep, pct = Math.min(99, Math.max(1, Math.round(k * 20) * 5));
      const plan = reinforcePlan(S, selected);
      const btn = plan ? `<button class="reinforce" onclick="doReinforce('${selected}')"><b>援兵</b>${MAP.byId[plan.from].short}から${fmt(plan.amount)}兵を送る<small>見込み 約${pctOf(plan.before)}% → 約${pctOf(plan.after)}%${plan.enough ? '' : '（これでもまだ足りない）'}</small></button>` : '';
      return `<p class="threat ${k < 0.5 ? 'hi' : k < 0.85 ? 'mid' : 'ok'}">前線：となりの敵が総がかりで来ても、守り切る見込み 約${pct}%${k < 0.85 && !plan ? '。となりから送れる兵がない。徴兵か築城を' : ''}</p>${btn}`;
    })()}
    ${(() => {
      // 他家に囲まれている自分の城：兵糧の残りと、後詰め
      const sg = own && siegeOf(S, selected);
      if (!sg || siegeClan(sg) === PLAYER) return '';
      const eta = siegeEta(c.troops, sg.n, siegeRatio(S, selected));
      return `<div class="siege-card under"><span class="sk">囲</span><div><b>${CLANS[siegeClan(sg)].name}に囲まれている（${sg.turns}季目）</b>
        <small>${fmt(sg.n)}兵が囲む・城兵は季ごとに${Math.round(SIEGE.starve * 100)}%減る${eta ? `・このままでは あと${Math.max(0, eta - sg.turns)}季で開城のおそれ` : ''}</small></div></div>
        <button class="btn red" id="c-relief">後詰めを送る（となりの城から囲みを破る）</button>`;
    })()}
    <p class="motto">${(() => { const lo = schoolLore(selected); return `<b>校風</b>「${lo.motto}」${lo.sight ? `<small>名物：${lo.sight}</small>` : ""}`; })()}</p>
    <p class="facline"><span class="trait t-${traitOf(selected)}" title="${TRAITS[traitOf(selected)].desc}">${TRAITS[traitOf(selected)].name}</span>
      ${(c.fac || []).map((f) => `<span class="fac">${FACILITIES[f].name}</span>`).join('')}
      <span class="facnote">${TRAITS[traitOf(selected)].desc}${own && (c.fac || []).length < facSlots(S, selected) ? `・区画の空き ${facSlots(S, selected) - (c.fac || []).length}` : ''}</span></p>
    ${gens.length ? `<p class="glabel">武将 ${gens.length}人${own ? `（命令できる ${gens.filter((g) => !S.acted[g.id]).length}人）` : ''}<span class="scroll-hint">${gens.length > 2 ? '横にスクロール →' : ''}</span></p>` : ''}
    <div class="glist">${gens.length ? gens.map((g) => genCard(g, { acted: own && !!S.acted[g.id] })).join('') : '<p class="hint">この城に武将はいない</p>'}</div>`;

  let body;
  if (own) {
    const deleg = !!S.delegate[selected];
    const idle = idleGensAt(S, selected);
    const can = idle.length > 0 && !deleg;
    const dis = (ok) => (!can || !ok ? 'disabled' : '');
    const arrived = arrivedTroops(S, selected);
    const hint = [deleg ? '委任中：ターン終了時に自動で命令します。'
      : !gens.length ? '武将がいないため命令できません。「移動」で武将を送りましょう。'
      : !idle.length ? 'この城の武将は、今季の命令を終えました。' : '',
    arrived ? `🚚 到着したばかりの兵 ${fmt(arrived)}：今季は出陣・輸送に使えません（守りには加わります）` : ''].filter(Boolean).join('<br>');
    body = `${hint ? `<p class="hint">${hint}</p>` : ''}
      <div class="cmds">
        <button class="btn red" id="c-attack" ${dis(hostileNeighbors(S, selected).length && readyTroops(S, selected) > 0)}><span class="k">攻</span>出陣<small>敵城を攻める</small></button>
        <button class="btn" id="c-siege" ${dis(hostileNeighbors(S, selected).some((t) => canSiege(S, selected, t)) && readyTroops(S, selected) > 0)}><span class="k">囲</span>包囲<small>兵糧攻め</small></button>
        <button class="btn" id="c-move" ${dis(ownNeighbors(S, selected).length && readyTroops(S, selected) > 0)}><span class="k">送</span>輸送<small>兵を送る</small></button>
        <button class="btn" id="c-gen" ${dis(ownNeighbors(S, selected).length)}><span class="k">移</span>移動<small>武将を移す</small></button>
        <button class="btn" id="c-recruit" ${dis(canRecruit(S, selected))}><span class="k">兵</span>徴兵<small>金${RULES.recruitCost}</small></button>
        <button class="btn" id="c-develop" ${dis(canDevelop(S, selected))}><span class="k">商</span>開発<small>金${RULES.developCost}</small></button>
        <button class="btn" id="c-fortify" ${dis(canFortify(S, selected))}><span class="k">城</span>築城<small>金${RULES.fortifyCost}</small></button>
        <button class="btn" id="c-build"><span class="k">町</span>城下町<small>区画に施設を建てる</small></button>
        <button class="btn" id="c-reward" ${gens.some((g) => canReward(S, g)) ? '' : 'disabled'}><span class="k">賞</span>褒美<small>金${LOYAL.rewardCost}・忠誠+</small></button>
        <button class="btn" id="c-scheme" ${dis(S.gold[PLAYER] >= 150)}><span class="k">謀</span>計略<small>流言・引き抜き…</small></button>
        <button class="btn plain wide" id="c-close">閉じる</button>
      </div>`;
  } else {
    const srcs = attackSources(selected);
    const peace = atPeace(S, PLAYER, c.owner);
    const why = peace ? `${CLANS[c.owner].name}とは${relLabel(S, c.owner)}のため攻められません`
      : srcs.length ? 'となりの城から出陣できます' : `となりに命令できる${pName()}の城と武将がいません`;
    const plan = attackPlan(S, selected);
    const planHtml = !plan ? '' : (() => {
      const g = S.gens[plan.gid];
      const sup = plan.support.length ? `、${plan.support.map((p) => MAP.byId[p.from].short).join('・')}の援軍と合わせて` : 'が';
      const lvl = plan.p >= GOOD_ODDS ? 'ok' : plan.p >= 0.5 ? 'mid' : 'hi';
      const back = plan.leftKeep < 0.5 ? `。ただし出陣すると${MAP.byId[plan.weak].short}の守りが約${pctOf(plan.leftKeep)}%に` : '';
      return `<p class="threat ${lvl}">攻め：${MAP.byId[plan.from].short}から${esc(g.name)}${sup}${fmt(plan.total)}兵で攻めれば、勝つ見込み 約${pctOf(plan.p)}%${plan.p < 0.5 ? '。今は分が悪い。兵を集めてから' : ''}${back}</p>
        <button class="reinforce strike" id="c-plan"><b>出陣</b>この案で攻める<small>${oddsLabel(plan.p)[0]}・総勢 ${fmt(plan.total)} 兵${isCapital(selected, c.owner) ? '・本拠を落とせば残る城が降ることも' : ''}</small></button>`;
    })();
    body = `${S.rel[c.owner] ? `<p class="hint">${clanChip(c.owner)} ${relLabel(S, c.owner)}・友好度 ${S.rel[c.owner].friend}・性格「${personaOf(c.owner).name}」</p>` : ''}
      ${(() => {
        const sw = gensOf(S, PLAYER).filter((g) => g.shi && !g.shi.done && ['bokou', 'castle'].includes(g.shi.kind) && g.shi.target === selected);
        return sw.length ? `<p class="shi-hint"><b>志</b>${sw.map((g) => esc(g.name)).join('・')}が、この城を落とすと誓っている（大将にすると士気+${SHI_MORALE}）</p>` : '';
      })()}
      ${(() => {
        // 包囲している城：兵糧攻めの進み具合と、総攻め・囲みを解く
        const sg = mySiege(S, selected);
        if (!sg) return '';
        const g = S.gens[sg.gid], eta = siegeEta(c.troops, sg.n, siegeRatio(S, selected));
        return `<div class="siege-card"><span class="sk">囲</span><div><b>包囲 ${sg.turns}季目</b>
          <small>${g ? esc(g.name) : ''}の${fmt(sg.n)}兵が囲む・城兵は季ごとに${Math.round(SIEGE.starve * 100)}%減る${eta ? `・開城の見込み あと${Math.max(0, eta - sg.turns)}季` : ''}</small></div></div>
          <div class="siege-btns"><button class="btn red" id="c-assault">総攻め</button><button class="btn plain" id="c-lift">囲みを解く</button></div>`;
      })()}
      ${planHtml}
      <div class="cmds">
        <button class="btn red wide" id="c-strike" ${srcs.length ? '' : 'disabled'}><span class="k">攻</span>この城を攻める<small>${why}</small></button>
        ${(() => {
          const envoy = canDebate(S, selected) ? debateEnvoy(S, selected) : null;
          const why2 = isCapital(selected, c.owner) ? '本拠は言葉では落ちない'
            : gensAt(S, selected).some((g) => g.lord) ? '当主のいる城は開城しない'
            : S.debateCd && S.debateCd[selected] > S.turn ? 'しばらく舌戦には応じない'
            : !envoy ? 'となりに命令できる武将がいない'
            : `使者：${esc(envoy.name)}（知略${envoy.int}・魅力${envoy.cha}）`;
          return atPeace(S, PLAYER, c.owner) ? '' : `<button class="btn wide debate-btn" id="c-debate" ${envoy ? '' : 'disabled'}><span class="k">舌</span>舌戦で開城を迫る<small>${why2}</small></button>`;
        })()}
        <button class="btn plain wide" id="c-close">閉じる</button>
      </div>`;
  }
  panel.innerHTML = head + body;
  bindPanel();
}

let dangerIdx = -1; // 「危うい城」ボタンで、次に見せる城
let attackIdx = -1; // 「攻め口」ボタンで、次に見せる城
// 軍議：家の様子（数字の札・天下と勢力図）と、今季の献策（やるべきことの札。タップでその城や画面へ）
let idleIdx = -1;   // 「命令の残る城」の札で、次に見せる城
let shiIdx = -1;    // 「志の城」の札で、次に見せる城
let siegeIdx = -1;  // 「包囲中の城」の札で、次に見せる城
function councilAgenda() {
  const items = []; // { id, kind, k: 札の字, title, sub, ids?: 順に見せる城 }
  const risky = castlesOf(S, PLAYER).map((id) => [id, dangerOf(S, id, winChance)]).filter(([, t]) => t && t.keep < 0.5)
    .sort((a, b) => a[1].keep - b[1].keep).map(([id]) => id);
  const names = (ids) => `${ids.slice(0, 3).map((id) => MAP.byId[id].short).join('・')}${ids.length > 3 ? ' ほか' : ''}`;
  if (risky.length) items.push({ id: 'danger-warn', kind: 'danger', k: '危', title: `守りの危うい城 ${risky.length}`, sub: names(risky), ids: risky });
  const ch = attackChances(S).map((pl) => pl.to);
  if (ch.length) items.push({ id: 'attack-warn', kind: 'attack', k: '攻', title: `勝算のある攻め口 ${ch.length}`, sub: names(ch), ids: ch });
  // 包囲中の城：兵糧攻めの進み具合（総攻めの頃合いを見る）
  const sieges = (S.sieges || []).filter((sg) => siegeClan(sg) === PLAYER);
  // 囲まれている自分の城：兵糧が尽きる前に後詰めを（いちばん急ぐ献策）
  const besieged = (S.sieges || []).filter((sg) => siegeClan(sg) !== PLAYER && S.castles[sg.to].owner === PLAYER);
  if (besieged.length) items.unshift({ id: 'besieged-warn', kind: 'danger', k: '囲', title: `囲まれている城 ${besieged.length}`, sub: besieged.map((sg) => `${MAP.byId[sg.to].short}（${CLANS[siegeClan(sg)].name.replace('家', '')} ${sg.turns}季目）`).join('・'), ids: besieged.map((sg) => sg.to) });
  if (sieges.length) items.push({ id: 'siege-warn', kind: 'siege', k: '囲', title: `包囲中の城 ${sieges.length}`, sub: sieges.map((sg) => `${MAP.byId[sg.to].short} ${sg.turns}季目`).join('・'), ids: sieges.map((sg) => sg.to) });
  // 志の城：誓いの城が、いま攻められるところにある武将
  const sworn = gensOf(S, PLAYER).filter((g) => g.loc && g.shi && !g.shi.done && ['bokou', 'castle'].includes(g.shi.kind) && attackSources(g.shi.target).length);
  if (sworn.length) {
    const ids = [...new Set(sworn.map((g) => g.shi.target))];
    items.push({ id: 'shi-warn', kind: 'shi', k: '志', title: `志の城に手が届く ${sworn.length}人`, sub: sworn.slice(0, 2).map((g) => `${g.name.split(' ')[1] || g.name}→${MAP.byId[g.shi.target].short}`).join('・'), ids });
  }
  const low = gensOf(S, PLAYER).filter((g) => !g.lord && g.loc && g.loyal < LOYAL.leaveBelow).length;
  if (low) items.push({ id: 'loyal-warn', kind: 'loyal', k: '忠', title: `忠誠の低い家臣 ${low}人`, sub: '出奔や謀反のおそれ。褒美で引き留める' });
  const idle = castlesOf(S, PLAYER).filter((id) => !S.delegate[id] && idleGensAt(S, id).length);
  if (idle.length) items.push({ id: 'idle-warn', kind: 'idle', k: '令', title: `命令の残る城 ${idle.length}`, sub: `${names(idle)}（武将 ${idle.reduce((a, id) => a + idleGensAt(S, id).length, 0)}人）`, ids: idle });
  return items;
}
function renderCouncil() {
  const counts = Object.keys(CLANS)
    .map((k) => [k, castlesOf(S, k).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => (a[0] === PLAYER ? -1 : b[0] === PLAYER ? 1 : a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : b[1] - a[1]));
  const mine = castlesOf(S, PLAYER);
  const gens = gensOf(S, PLAYER).filter((g) => g.loc);
  const idleGens = gens.filter((g) => !S.acted[g.id] && !S.delegate[g.loc]).length;
  const delegCount = mine.filter((id) => S.delegate[id]).length;
  const troops = mine.reduce((a, id) => a + S.castles[id].troops, 0);
  const lord = lordOf(S);
  const all = MAP.nodes.length;
  const agenda = councilAgenda();
  const R = S.finale && S.finale.rally;
  const alarm = R && rallyOn(S, R.head)
    ? `<p class="warn rally-warn">🔥 最後の大連合（盟主 ${CLANS[R.head].name}）の大反攻：あと${R.until - S.turn}季。前線の守りを固めよ</p>`
    : S.encircle ? `<p class="warn">🔥 ${pShort()}包囲網：諸家が手を結んで${pName()}を狙っている</p>` : '';
  const tile = (k, v, sub) => `<div class="cn-tile"><span class="l">${k}</span><span class="n">${v}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  panel.innerHTML = `<div class="council">
    <div class="cn-head">
      ${lord ? portrait(lord, 48) : crestBadge(PLAYER, 48)}
      <div class="cn-who"><h2>軍議<small>${dateLabel(S.turn)}</small></h2>
        <p class="kakun">${S.lords.length}代目 ${esc((lord || {}).name || '（当主不在）')}・家訓「${KAKUN[S.kakun].name}」<small>${KAKUN[S.kakun].desc}</small></p>
        ${taishiLine(S, PLAYER)}${nemesisChip(S)}
        ${(S.challenges || []).length ? `<p class="cn-ch">${S.challenges.map((c) => `<span title="${CHALLENGES[c].desc}">${CHALLENGES[c].mark}</span>`).join("")}<small>挑戦状${hasCh(S, "speed") ? `・天下の期限まで あと${Math.max(0, CHALLENGES.speed.limit - S.turn)}季` : ""}</small></p>` : ""}</div>
      ${S.debug ? '<b class="dbg">DEBUG</b>' : ''}
    </div>
    <div class="cn-tiles">
      ${tile('金', fmt(S.gold[PLAYER]), `季 +${fmt(income(S, PLAYER))}`)}
      ${tile('兵', fmt(troops), `${mine.length}城`)}
      ${tile('令', `${idleGens}<i>/${gens.length}</i>`, delegCount ? `委任 ${delegCount}城` : '命令できる武将')}
      ${tile('城', `${mine.length}<i>/${all}</i>`, SCENARIOS[S.scenario].name)}
    </div>
    ${alarm}
    <div class="tenka"><span>天下</span><div class="tk-bar"><i style="width:${(mine.length / all * 100).toFixed(1)}%"></i>${FINALE.marks.map((m) => `<em style="left:${m * 100}%" class="${mine.length / all >= m ? 'on' : ''}"></em>`).join('')}</div><b>あと${all - mine.length}校</b></div>
    <button class="cn-power" id="cn-power" aria-label="勢力図（タップで外交）">
      <span class="cn-bar">${counts.map(([k, n]) => `<i style="flex:${n};--c:${k === 'none' ? '#b9b09c' : CLANS[k].color}" class="${k === PLAYER ? 'me' : ''}"></i>`).join('')}</span>
      <span class="cn-legend">${counts.filter(([k]) => k !== 'none').map(([k, n]) => `<span>${crestBadge(k, 16)}${n}${relIcon(k)}</span>`).join('')}${counts.some(([k]) => k === 'none') ? `<span class="nn">独立 ${castlesOf(S, 'none').length}</span>` : ''}</span>
    </button>
    ${S.goal !== undefined && S.goal < GOALS.length ? (() => {
      const G = GOALS[S.goal];
      return `<div class="goal-card"><span class="gk">目標</span><div><small>旗揚げの章 ${['一', '二', '三', '四'][S.goal]}／四</small><b>${esc(G.name)}</b><p>${esc(goalText(S, G))}</p><em>褒美：${esc(G.reward)}</em></div>
        <span class="gdots">${GOALS.map((_, i) => `<i class="${i < S.goal ? 'on' : i === S.goal ? 'now' : ''}"></i>`).join('')}</span></div>`;
    })() : ''}
    <h3 class="cn-h">今季の献策</h3>
    <div class="cn-agenda">
      ${agenda.length ? agenda.map((a) => `<button class="ks ks-${a.kind}" id="${a.id}" ${a.ids ? `data-ids="${a.ids.join(',')}"` : ''}><span class="ks-k">${a.k}</span><span class="ks-t"><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span><span class="ks-a">›</span></button>`).join('')
        : '<p class="cn-calm">静かな季節。命令はすべて済んだ。ターンを終えて次の季へ</p>'}
      ${agenda.some((a) => a.kind === 'danger') && mine.some((id) => reinforcePlan(S, id)) ? '<button class="reinforce" onclick="bulkReinforce()"><b>援兵</b>危うい城へ、となりから送れるだけ兵を送る<small>送る側が危うくならない分だけ。輸送役の武将が1人ずつ動く</small></button>' : ''}
    </div>
    <div class="bulk">
      <button class="btn" id="bulk-recruit" ${S.gold[PLAYER] >= RULES.recruitCost && idleGens ? '' : 'disabled'}>全城で徴兵</button>
      <button class="btn" id="bulk-develop" ${S.gold[PLAYER] >= RULES.developCost && idleGens ? '' : 'disabled'}>全城で開発</button>
      <button class="btn" id="btn-diplo">外 交</button>
    </div>
    <div class="cn-duo"><button class="btn tea-btn" id="btn-hyojo">📜 評定<small>家臣の献策を聞く</small></button>
    <button class="btn tea-btn" id="btn-tea" ${canTea(S) ? "" : "disabled"}>🍵 茶の湯<small>${S.teaTurn === S.turn ? "この季の茶会は済んだ" : `家臣を招いて本音を聞く・金${TEA.cost}`}</small></button></div>
    <button class="btn red end-btn" id="btn-end">ターン終了</button></div>`;
  $('btn-end').onclick = onEndTurn;
  $('btn-tea').onclick = () => { Sound.tap(); showTea(); };
  $('btn-hyojo').onclick = () => { Sound.tap(); showHyojo(true); };
  $('bulk-recruit').onclick = () => bulk('recruit');
  $('bulk-develop').onclick = () => bulk('develop');
  $('btn-diplo').onclick = () => { Sound.tap(); showDiplomacy(); };
  $('cn-power').onclick = () => { Sound.tap(); showDiplomacy(); };
  // 城を順に見せる札（押すたびに次の城へ）
  const cycle = (id, getIdx, setIdx) => {
    const b = $(id);
    if (!b) return;
    b.onclick = () => {
      Sound.tap();
      const ids = b.dataset.ids.split(',');
      const i = (getIdx() + 1) % ids.length;
      setIdx(i);
      selected = ids[i];
      render();
      centerOn(selected);
    };
  };
  cycle('danger-warn', () => dangerIdx, (i) => { dangerIdx = i; });
  cycle('attack-warn', () => attackIdx, (i) => { attackIdx = i; });
  cycle('shi-warn', () => shiIdx, (i) => { shiIdx = i; });
  cycle('idle-warn', () => idleIdx, (i) => { idleIdx = i; });
  cycle('siege-warn', () => siegeIdx, (i) => { siegeIdx = i; });
  cycle('besieged-warn', () => siegeIdx, (i) => { siegeIdx = i; });
  if ($('loyal-warn')) $('loyal-warn').onclick = () => { Sound.tap(); showReward(gensOf(S, PLAYER).filter((g) => g.loc), '褒美（忠誠の低い順）'); };
}

// ---------- 軍師の手ほどき（チュートリアル） ----------
const SENSEI = { look: 4242, female: false, str: 40, pol: 70, cha: 60, int: 95, clan: PLAYER };
const TUT = {
  1: { text: '殿、軍師でございます。まずは地図の真ん中に見えている、わが家の<b>本拠地の城</b>をタップしてくだされ。', done: () => selected && S.castles[selected].owner === PLAYER },
  2: { text: '下に城の兵力と<b>武将</b>が出ております。命令は武将1人につき1季に1回。さっそく<b>「出陣」</b>を押してみましょう。', done: () => mode && mode.kind === 'attack' },
  3: { text: '<b>赤く光る城</b>が攻められる城です。兵の少ない城をタップしてくだされ。' },
  4: { text: '大将と兵の数を決めて「出陣！」。<b>勝算大</b>と出ていれば、まず負けませぬ。' },
  5: { text: '初陣、お見事でした！ 城を落とすと敵の武将を捕らえることがあり、<b>登用</b>すれば家臣になります。残った武将で<b>徴兵</b>や<b>開発</b>もできますぞ。', next: true },
  6: { text: '命令が済んだら、下の<b>「ターン終了」</b>を押してくだされ。季節が変わり、他家も動きます。', done: () => S.turn >= 1 },
  7: { text: '季節ごとに行事が起こり、<b>外交</b>で他家と手を結ぶこともできます。この先、新しい場面が来たら拙者が<b>献策</b>いたします。迷ったら目録の<b>遊び方</b>も。では殿、天下統一を！', next: true, last: true },
};

function tutAdvance(to) {
  if (S && S.tut && S.tut < to) { S.tut = to; save(); renderCoach(); }
}
function endTutorial() {
  S.tut = 0;
  save();
  try { localStorage.setItem(TUT_KEY, '1'); } catch (e) {}
  renderCoach();
}
function renderCoach() {
  const box = $('coach');
  const step = S && TUT[S.tut];
  if (!step) {
    const tip = currentTip();
    if (!tip) { box.hidden = true; return; }
    box.hidden = false;
    box.className = 'tip';
    box.innerHTML = `${portrait(SENSEI, 44)}<div class="ct"><b>軍師の献策</b><p>${typeof tip.text === 'function' ? tip.text() : tip.text}</p>
      <div class="cb"><button class="go" id="coach-next">心得た</button><button id="coach-skip">献策はもう要らぬ</button></div></div>`;
    $('coach-next').onclick = () => { Sound.tap(); markTip(tip.id); renderCoach(); };
    $('coach-skip').onclick = () => { Sound.tap(); markTip(tip.id); setSetting('tips', 'off'); renderCoach(); toast('献策は「設定」からまた受けられます'); };
    return;
  }
  box.className = '';
  if (step.done && step.done()) { S.tut++; save(); renderCoach(); return; }
  box.hidden = false;
  box.innerHTML = `${portrait(SENSEI, 44)}<div class="ct"><b>軍師</b><p>${step.text}</p>
    <div class="cb">${step.next ? `<button class="go" id="coach-next">${step.last ? '心得た' : '次へ'}</button>` : ''}<button id="coach-skip">手ほどきを終える</button></div></div>`;
  const next = $('coach-next');
  if (next) next.onclick = () => { Sound.tap(); if (step.last) endTutorial(); else { S.tut++; save(); renderCoach(); } };
  $('coach-skip').onclick = () => { Sound.tap(); endTutorial(); };
}


// ---------- 軍師の献策（その場面が初めて来たときに一度だけ教える） ----------
const TIPS_KEY = 'azabu-tips';
function tipsSeen() { try { return JSON.parse(localStorage.getItem(TIPS_KEY)) || {}; } catch (e) { return {}; } }
function markTip(id) { const t = tipsSeen(); t[id] = 1; try { localStorage.setItem(TIPS_KEY, JSON.stringify(t)); } catch (e) {} }
const mineGens = () => gensOf(S, PLAYER);
const TIPS = [
  { id: 'debate', when: () => selected && S.castles[selected].owner !== PLAYER && canDebate(S, selected) && debateEnvoy(S, selected),
    text: 'この城、<b>舌戦</b>で落とせるやもしれませぬ。知略と魅力の高い者を使者に立て、理・情・利・威の論で開城を迫るのです。守将の<b>弱点の論</b>を見抜くのが肝心ですぞ。' },
  { id: 'treasure', when: () => S.turn >= 1 && mineGens().some((g) => g.treasure),
    text: 'わが家には<b>家宝</b>がございます。武将をタップして詳しく見ると、持たせ替えができますぞ。名刀は一騎打ちに、軍配は攻めに、兜は守りに効きまする。' },
  { id: 'club', when: () => S.turn >= 2,
    text: '武将はみな<b>部活</b>に入っております。剣道部は一騎打ち、野球部は攻撃、吹奏楽部は士気…。合戦の大将選びの参考になされませ。' },
  { id: 'weather', when: () => S.weather && S.weather !== 'sun',
    text: () => `今季の空は<b>${WEATHER[S.weather].name}</b>。${WEATHER[S.weather].desc}。上の天気の印をタップすると、いつでも確かめられますぞ。` },
  { id: 'loyal', when: () => mineGens().some((g) => !g.lord && g.loyal < 50),
    text: '<b>忠誠</b>の低い家臣がおります。放っておくと出奔や謀反のおそれが。家臣団の画面から<b>褒美</b>を与えなされ。' },
  { id: 'graduate', when: () => S.turn % 4 === 3 && mineGens().some((g) => g.grade >= 3),
    text: () => `この冬が明ければ<b>3年生は卒業</b>いたします。${lordOf(S) && lordOf(S).grade >= 3 ? '殿もご卒業。<b>後継ぎ</b>となる者を育てておかれませ。' : '城の守りに穴が空かぬよう、備えておきましょう。'}` },
  { id: 'delegate', when: () => castlesOf(S, PLAYER).length >= 6,
    text: '城が増えてまいりました。前線から遠い城は<b>委任</b>にすれば、季節の終わりに自ら動きます。<b>全城で徴兵／開発</b>もお使いなされ。' },
  { id: 'rival', when: () => Object.keys(S.rivalBook || {}).length > 0,
    text: '幾度もぶつかった相手は<b>宿敵</b>となりました。宿敵どうしの合戦では、一騎打ちが起こりやすくなりますぞ。' },
  { id: 'bond', when: () => Object.keys(S.bonds || {}).length > 0,
    text: '家臣のあいだに<b>絆</b>が生まれましたな。絆の相手を<b>援軍</b>に連れて出陣する、あるいは同じ城で守らせると、士気が上がりまするぞ。武将をタップすると、誰と結ばれているか分かります。' },
  { id: 'hall', when: () => (S.hall || []).length > 0,
    text: '卒業した者の戦いぶりは<b>卒業生の列伝</b>に残ります。目録の家臣団から読めますぞ。名を上げた者は天下統一の絵巻にも載りまする。' },
  { id: 'danger', when: () => castlesOf(S, PLAYER).some((id) => { const t = dangerOf(S, id, winChance); return t && t.keep < 0.5; }),
    text: '地図に<b>「危」</b>の札が立った城は、となりの敵が総がかりで来ると守り切れませぬ。<b>「注」</b>は油断ならぬ城。兵を送るか築城で備えなされ。軍議の赤い札をタップすると、危うい城を順に見られますぞ。' },
  { id: 'encircle', when: () => !S.encircle && castlesOf(S, PLAYER).length / MAP.nodes.length >= DIPLO.encircleShare - 0.12,
    text: () => `殿、勢いがつきすぎております。城の${Math.round(DIPLO.encircleShare * 100)}%を超えると、諸家が<b>包囲網</b>を結んで一斉に攻めてまいります。守りを固めてから進まれませ。` },
];
function currentTip() {
  if (!S || S.tut || S.result || getSettings().tips === 'off') return null;
  const seen = tipsSeen();
  return TIPS.find((t) => !seen[t.id] && t.when()) || null;
}

// ---------- 外交 ----------
function showDiplomacy(message) {
  if (hasCh(S, 'nodiplo')) { toast('挑戦状「外交禁止」：他家と言葉を交わすことはできない'); return; }
  const envoy = envoyOf(S);
  const alive = aiClans().filter((k) => castlesOf(S, k).length);
  const rows = alive.map((k) => {
    const r = S.rel[k];
    const peace = r.ally > 0 || r.truce > 0 || r.sister || r.trade > 0;
    const off = !envoy || (S.encircle && !r.sister);
    return `<div class="diplo-row ${r.sister ? 'sister' : ''}">
      <div class="dr-head">${clanChip(k)}${k === S.nemesis ? '<b class="nemesis-tag">宿敵</b>' : ''}<span>${relLabel(S, k)}</span><span class="p-sub">城 ${castlesOf(S, k).length}</span></div>
      ${(() => { const lo = aiLordOf(S, k); return lo ? `<div class="dr-lord">${portrait(lo, 48, r.friend >= 60 ? "smile" : r.friend < 30 ? "angry" : null)}<div><small>当主</small><b>${esc(lo.name)}</b>${lordVoice(k).catch ? `<i>「${lordVoice(k).catch}」</i>` : ""}</div></div>` : ""; })()}
      ${taishiLine(S, k)}
      <p class="persona"><b>性格「${personaOf(k).name}」</b>${personaOf(k).desc}</p>
      ${(() => {
        const rs = aiRelations(S, k);
        const allies = rs.filter((x) => x.ally).map((x) => CLANS[x.clan].name);
        const truces = rs.filter((x) => x.truce && !x.ally).map((x) => CLANS[x.clan].name);
        return allies.length || truces.length
          ? `<p class="persona rel">${allies.length ? `🤝 同盟：${allies.join('・')}` : ''}${allies.length && truces.length ? '　' : ''}${truces.length ? `🕊️ 停戦：${truces.join('・')}` : ''}</p>`
          : '';
      })()}
      ${S.joint && S.joint.ally === k ? `<p class="persona rel">⚔️ 共同出兵：${CLANS[S.joint.target].name}を攻撃中（残り${S.joint.turns}季）</p>` : ''}
      ${r.trade > 0 ? `<p class="persona rel">💰 通商：毎季 金+${tradeIncome(S, k)}</p>` : ''}
      <div class="friend"><span>友好度</span><i><b style="width:${r.friend}%"></b></i><em>${r.friend}</em></div>
      <div class="dr-btns">
        <button class="btn plain" data-act="gift" data-clan="${k}" ${off || S.gold[PLAYER] < DIPLO.giftCost ? 'disabled' : ''}>贈答<small>金${DIPLO.giftCost}</small></button>
        <button class="btn red" data-act="talk" data-clan="${k}" ${off ? 'disabled' : ''}>会談<small>申し出を選ぶ</small></button>
        ${peace ? `<button class="btn" data-act="break" data-clan="${k}">破棄<small>信用を失う</small></button>` : ''}
      </div>
    </div>`;
  }).join('');
  const logN = (S.diploLog || []).length;
  openModal(`<h2>外 交</h2>
    ${message ? `<p class="result">${message}</p>` : ''}
    <p class="hint" style="text-align:center">${envoy ? `使者：<b>${esc(envoy.name)}</b>（魅力${envoy.cha}）が向かいます` : '使者に出せる武将がいません（全員が命令ずみ）'}</p>
    ${S.encircle ? `<p class="warn">${pShort()}包囲網の最中のため、諸家は交渉に応じません${alive.some((k) => S.rel[k].sister) ? '（姉妹校をのぞく）' : ''}</p>` : ''}
    ${rows || '<p>交渉できる家はもうない。</p>'}
    <p class="hint">停戦・同盟・姉妹校の相手とはおたがいに攻め合いません。破棄すると他の家からの信用も失います。</p>
    <button class="btn plain" id="dp-log">外交の記録<small class="sub">${logN ? `${logN}件` : 'まだ何もない'}</small></button>
    <button class="btn plain" data-close>閉じる</button>`);
  $('dp-log').onclick = () => { Sound.tap(); showDiploLog(); };
  modalBody.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = async () => {
      const k = b.dataset.clan, act = b.dataset.act;
      let msg;
      if (act === 'break') {
        if (!(await askConfirm(`${CLANS[k].name}との約束を破棄しますか？\n他の家からの信用も失います。`, { ok: '破棄する' }))) return;
        msg = diploBreak(S, k);
        Sound.lose();
      } else if (act === 'gift') {
        msg = diploGift(S, k, envoyOf(S));
        Sound.tap();
      } else {
        Sound.tap();
        showProposals(k);
        return;
      }
      save();
      render();
      showDiplomacy(msg);
    };
  });
}

// 会談で何を申し出るか選ぶ
function showProposals(k) {
  const envoy = envoyOf(S);
  if (!envoy) return;
  const list = Object.entries(PROPOSALS).map(([id, P]) => {
    const av = P.avail(S, k);
    const pct = av === true ? Math.round(P.chance(S, k, envoy) * 100) : 0;
    return `<button class="scheme-row" data-prop="${id}" ${av === true ? '' : 'disabled'}>
      <b>${P.icon} ${P.name}</b><span class="cost">${av === true ? `見込み ${pct}%` : ''}</span>
      <small>${P.desc}</small>${av === true ? '' : `<em>${av}</em>`}</button>`;
  }).join('');
  openModal(`<h2>${CLANS[k].name}との会談</h2>
    <p class="hint" style="text-align:center">使者：<b>${esc(envoy.name)}</b>（魅力${envoy.cha}・知略${envoy.int}）<br>見込みは、会談での話しぶりで上下します</p>
    <div class="scheme-list">${list}</div>
    <button class="btn plain" id="pp-back">もどる</button>`);
  modalBody.querySelectorAll('[data-prop]').forEach((b) => {
    b.onclick = () => { Sound.tap(); openMeeting(k, b.dataset.prop); };
  });
  $('pp-back').onclick = () => { Sound.tap(); showDiplomacy(); };
}

// 外交の記録（新しい順）
function showDiploLog() {
  const log = (S.diploLog || []).slice().reverse();
  const icon = { good: '🤝', bad: '💢', ai: '📜', info: '・' };
  let last = null;
  const items = log.map((e) => {
    const head = e.turn !== last ? `<li class="dl-date">${dateLabel(e.turn)}</li>` : '';
    last = e.turn;
    return `${head}<li class="dl-${e.kind || 'info'}"><span>${icon[e.kind] || '・'}</span>${esc(e.text)}</li>`;
  }).join('');
  openModal(`<h2>外交の記録</h2>
    <ul class="diplo-log">${items || '<li>まだ記録はない。</li>'}</ul>
    <button class="btn plain" id="dl-back">もどる</button>`);
  $('dl-back').onclick = () => { Sound.tap(); showDiplomacy(); };
}

// ---------- 会談 ----------
// 使者のセリフ（話題ごと）
function envoyTopicLine(s, M, topic) {
  const t = threatTo(s, M.clan);
  return {
    enemy: t ? `${CLANS[t].name}の勢い、捨ておけぬのではありませんか` : '近ごろ、どこも物騒になりましたな',
    favor: s.rel[M.clan].friend >= 50 ? 'これまでのよしみ、お忘れではないでしょう' : '以前の件は、水に流していただきたい',
    gift: 'つまらぬものですが、お納めください',
    might: `わが${pShort()}はいまや${castlesOf(s, PLAYER).length}城。その意味はおわかりでしょう`,
    praise: 'ご当主の采配、かねがね感服しております',
  }[topic];
}

function openMeeting(clan, proposal) {
  const envoy = envoyOf(S);
  if (!envoy) return;
  const M = startMeeting(S, clan, proposal, envoy);
  M.say = { who: 'host', text: hostLine(S, M, 'greet') };
  Sound.bgmStart('meeting');
  drawMeeting(M);
}

function drawMeeting(M) {
  const envoy = S.gens[M.envoy];
  const host = S.gens[M.host];
  const hostSchool = host && host.loc ? MAP.byId[host.loc].name : CLANS[M.clan].name;
  const phase = M.over ? 'over' : M.condition ? 'condition' : M.rounds >= M.maxRounds || M.toMain ? 'propose' : 'talk';
  const imp = M.impression;
  const impLabel = imp >= 70 ? '上々' : imp >= 50 ? 'まずまず' : imp >= 30 ? '渋い' : '険悪';
  const hints = meetingHints(S, M);
  let actions = '';
  if (phase === 'talk') {
    actions = `<p class="mt-q">どの話題を切り出す？<small>あと ${M.maxRounds - M.rounds} 回</small></p>
      <div class="mt-choices">${Object.entries(TOPICS).map(([k, t]) => `<button class="btn plain" data-topic="${k}"
        ${M.used[k] || (t.cost && S.gold[PLAYER] < t.cost) ? 'disabled' : ''}>${t.name}<small>${t.desc}</small></button>`).join('')}</div>
      <button class="btn" id="mt-main">本題に入る</button>`;
  } else if (phase === 'propose') {
    actions = `<p class="mt-q">いよいよ本題。「${PROPOSALS[M.proposal].name}」をどう切り出す？</p>
      <div class="mt-choices">${Object.entries(STANCES).map(([k, t]) => `<button class="btn ${k === 'equal' ? 'red' : 'plain'}" data-stance="${k}">${t.name}
        <small>${t.desc}・見込み ${Math.round(meetingChance(S, M, k) * 100)}%</small></button>`).join('')}</div>`;
  } else if (phase === 'condition') {
    const g = M.condition.gold;
    actions = `<p class="mt-q">条件：<b>金 ${g}</b>（所持金 ${fmt(S.gold[PLAYER])}）</p>
      <div class="mt-choices">
        <button class="btn red" data-ans="accept" ${S.gold[PLAYER] < g ? 'disabled' : ''}>条件を飲む<small>金${g}を払って${PROPOSALS[M.proposal].name}を結ぶ</small></button>
        ${M.haggled ? '' : `<button class="btn plain" data-ans="haggle">値切る<small>魅力しだい。失敗すると話は流れる</small></button>`}
        <button class="btn plain" data-ans="refuse">断る<small>会談は決裂する</small></button>
      </div>`;
  } else {
    actions = `${M.result ? `<p class="result">${esc(M.result)}</p>` : ''}<button class="btn red" id="mt-end">外交に戻る</button>`;
  }
  const bubble = M.say
    ? `<div class="mt-say ${M.say.who}">${M.say.envoy ? `<p class="mt-envoy">${esc(envoy.name)}「${esc(M.say.envoy)}」</p>` : ''}<p>${M.say.who === 'host' && host ? `<b>${esc(host.name)}</b>` : ''}「${esc(M.say.text)}」</p></div>`
    : '';
  openModal(`<div class="meeting" data-lock>
      <p class="mt-place">${esc(hostSchool)} 生徒会室 ・ ${PROPOSALS[M.proposal].name}の会談</p>
      <div class="mt-stage">
        ${meetingRoom(M.clan)}
        <div class="mt-p left">${portrait(envoy, 84, M.over === 'deal' ? 'happy' : M.over ? 'think' : null, 'R')}<span>${esc(envoy.name)}<small>${pName()}の使者</small></span></div>
        ${host ? `<div class="mt-p right">${portrait(host, 84, M.mood)}<span>${esc(host.name)}<small>${CLANS[M.clan].name}・${personaOf(M.clan).name}</small></span></div>` : ''}
        ${M.over ? `<div class="mt-stamp ${M.over}">${M.over === 'deal' ? '締 結' : '決 裂'}</div>` : ''}
        ${M.delta ? `<div class="mt-delta ${M.delta > 0 ? 'up' : 'down'}">${M.delta > 0 ? '+' : ''}${M.delta}</div>` : ''}
      </div>
      ${bubble}
      <div class="mt-gauge"><span>心証</span><i><b style="width:${imp}%"></b></i><em>${impLabel}</em></div>
      ${hints.length && phase !== 'over' ? `<p class="mt-hint">📜 使者の見立て：${hints.map(esc).join('／')}</p>` : ''}
    </div>
    ${actions}
    ${phase === 'talk' || phase === 'propose' ? '<button class="btn plain" id="mt-leave">席を立つ<small>何も決めずに帰る</small></button>' : ''}`);
  M.delta = 0;
  const redraw = () => { save(); render(); drawMeeting(M); };
  modalBody.querySelectorAll('[data-topic]').forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      const topic = b.dataset.topic;
      const r = useTopic(S, M, topic);
      M.delta = r.v;
      M.say = { who: 'host', envoy: envoyTopicLine(S, M, topic), text: r.line };
      if (r.v >= 10) Sound.taiko(0, 0.35);
      redraw();
    };
  });
  const main = $('mt-main');
  if (main) main.onclick = () => { Sound.tap(); M.toMain = true; M.say = { who: 'host', text: 'して、本題は何だ？' }; redraw(); };
  modalBody.querySelectorAll('[data-stance]').forEach((b) => {
    b.onclick = () => {
      const res = propose(S, M, b.dataset.stance);
      M.say = { who: 'host', envoy: stanceLine(M), text: M.lines[M.lines.length - 1] };
      meetingSound(res);
      redraw();
    };
  });
  modalBody.querySelectorAll('[data-ans]').forEach((b) => {
    b.onclick = () => {
      const ans = b.dataset.ans;
      const res = answerCondition(S, M, ans);
      M.say = {
        who: 'host',
        envoy: ans === 'accept' ? '承知しました。お納めください' : ans === 'haggle' ? 'もう少し、手心を加えていただけませんか' : 'その条件は飲めません',
        text: M.lines[M.lines.length - 1],
      };
      meetingSound(res);
      redraw();
    };
  });
  const leave = $('mt-leave');
  if (leave) leave.onclick = () => {
    Sound.tap();
    S.acted[M.envoy] = true;
    save(); render();
    Sound.bgmStart('map');
    showDiplomacy(`${esc(envoy.name)}は何も決めずに帰ってきた`);
  };
  const end = $('mt-end');
  if (end) end.onclick = () => {
    Sound.tap();
    Sound.bgmStart('map');
    showDiplomacy(M.over === 'deal'
      ? M.result || `${CLANS[M.clan].name}と${PROPOSALS[M.proposal].name}を結んだ！`
      : `${CLANS[M.clan].name}との会談は決裂した…`);
  };
}

// 使者の道のりを示す小さな地図：相手の城とこちらの城を色分けし、出発地から本陣へ矢印
function originMap(clan, from, home) {
  const xs = MAP.nodes.map((n) => n.x), ys = MAP.nodes.map((n) => n.y);
  const x0 = Math.min(...xs) - 30, y0 = Math.min(...ys) - 30;
  const w = Math.max(...xs) + 30 - x0, h = Math.max(...ys) + 30 - y0;
  const dots = MAP.nodes.map((n) => {
    const o = S.castles[n.id].owner;
    const c = o === clan ? CLANS[clan].color : o === PLAYER ? CLANS[PLAYER].color : '#d3c7a8';
    const r = o === clan || o === PLAYER ? 34 : 14;
    return `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${c}" ${o === clan || o === PLAYER ? 'stroke="#fff" stroke-width="6"' : ''}/>`;
  }).join('');
  const a = MAP.byId[from], b = MAP.byId[home];
  return `<svg class="eo-map" viewBox="${x0} ${y0} ${w} ${h}" aria-hidden="true">
    <defs><marker id="eo-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#b8262f"/></marker></defs>
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f6eed8"/>
    ${dots}
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#b8262f" stroke-width="18" stroke-dasharray="36 18" marker-end="url(#eo-arrow)"/>
    <circle cx="${b.x}" cy="${b.y}" r="56" fill="none" stroke="#b8262f" stroke-width="12"/>
  </svg>`;
}

// 他家の使者が、こちらの生徒会室にやって来る場面
function envoyScene(ev, title, mood, line, stamp = null) {
  const p = ev.p;
  const lord = lordOf(S);
  const g = p.gid && S.gens[p.gid] && S.gens[p.gid].clan === p.clan ? S.gens[p.gid] : null;
  const home = lord && lord.loc && S.castles[lord.loc].owner === PLAYER ? lord.loc : homeCastle(S);
  // 使者の出発地：相手の城のうち、こちらの本陣にいちばん近い城
  const theirs = castlesOf(S, p.clan);
  const dist = (id) => Math.hypot(MAP.byId[id].x - MAP.byId[home].x, MAP.byId[id].y - MAP.byId[home].y);
  const from = theirs.length ? theirs.reduce((a, b) => (dist(a) <= dist(b) ? a : b)) : null;
  const capital = theirs.includes(p.clan) ? p.clan : from;
  return `<div class="meeting" data-lock>
      <div class="ev-origin">
        ${crestBadge(p.clan, 40)}
        <div class="eo-text">
          <b>${CLANS[p.clan].name}からの使者</b>
          <small>${capital ? `本拠 ${esc(MAP.byId[capital].name)}（${esc(MAP.byId[capital].ward)}）` : ''}・城 ${theirs.length}</small>
          <small>${from ? `${esc(MAP.byId[from].name)}から` : ''} → わが本陣 ${esc(MAP.byId[home].name)}へ</small>
        </div>
        ${from ? originMap(p.clan, from, home) : ''}
      </div>
      <p class="mt-place">${esc(MAP.byId[home].name)} 生徒会室にて ・ ${esc(title)}</p>
      <div class="mt-stage">
        ${meetingRoom(PLAYER)}
        ${lord ? `<div class="mt-p left">${portrait(lord, 84, stamp === 'deal' ? 'happy' : null, 'R')}<span>${esc(lord.name)}<small>${pName()}当主</small></span></div>` : ''}
        ${g ? `<div class="mt-p right">${portrait(g, 84, mood)}<span>${esc(g.name)}<small>${CLANS[p.clan].name}の使者</small></span></div>` : ''}
        ${stamp ? `<div class="mt-stamp ${stamp}">${stamp === 'deal' ? '締 結' : p.kind === 'tribute' ? '拒 絶' : '謝 絶'}</div>` : ''}
      </div>
      <div class="mt-say"><p>${g ? `<b>${esc(g.name)}</b>` : `<b>${CLANS[p.clan].name}の使者</b>`}「${esc(line)}」</p></div>
      <div class="mt-gauge"><span>${CLANS[p.clan].name}との友好度</span><i><b style="width:${S.rel[p.clan].friend}%"></b></i><em>${S.rel[p.clan].friend}</em></div>
    </div>`;
}

function stanceLine(M) {
  const obj = { truce: '停戦を', ally: '同盟を', trade: '通商協定を', sister: '姉妹校の契りを', aid: '援軍を', joint: '共同での出兵を' }[M.proposal];
  const equal = {
    truce: 'おたがいのために、停戦を結びませんか', ally: 'おたがいのために、同盟を結びませんか',
    trade: '通商協定を結びませんか。互いに潤うはずです', sister: '我らの絆を、姉妹校の契りとしませんか',
    aid: '盟友として、援軍をお願いしたい', joint: '盟友として、ともに兵を挙げませんか',
  }[M.proposal];
  return {
    humble: `どうか、${obj}お願いできないでしょうか`,
    equal,
    bold: `${obj}受けていただこう。断ればどうなるか、おわかりでしょう`,
  }[M.stance];
}

function meetingSound(res) {
  if (res === 'deal') { Sound.win(); Sound.stamp(0.35); }
  else if (res === 'fail') { Sound.lose(); Sound.stamp(0.35); }
  else Sound.taiko(0, 0.5);
}

// ---------- 新しい仲間の登場 ----------
// 転校生の名乗り（いちばん高い能力で口ぶりが変わる）
function transferLine(g) {
  const best = ['str', 'int', 'pol', 'cha'].reduce((a, b) => (g[b] > g[a] ? b : a));
  const from = MAP.byId[g.school] ? MAP.byId[g.school].short : '';
  return {
    str: `${from}から来た${g.name}だ。腕っぷしなら誰にも負けん！`,
    int: `${from}より参りました${g.name}です。策ならお任せを`,
    pol: `${from}から転校してきました。帳簿と予算はわたしが預かります`,
    cha: `${from}から来ました！ みんなと仲良くなれたらうれしいな`,
  }[best];
}
// この春、わが家に入った新入生
function freshmen() {
  const ids = (S.grad && S.grad.joinedIds) || [];
  return ids.map((id) => S.gens[id]).filter((g) => g && g.clan === PLAYER);
}
const FRESH_LINES = ['よろしくお願いします！', '先輩、ご指導お願いします！', 'がんばります！', '早く戦に出たいです！', '部活と両立します！', '天下、取りましょう！'];
// 入学式：新入生の顔ぶれと、いちばん期待の新星
function showFreshmen(then) {
  const list = freshmen().sort((a, b) => genPower(b) - genPower(a));
  const star = list[0];
  const rest = list.slice(1, 9);
  const club = (g) => (g.club && CLUBS[g.club] ? CLUBS[g.club].name : '');
  openModal(`<div class="fresh" data-lock>
      <div class="fresh-head"><span>入学式</span><small>${dateLabel(S.turn)}・${pName()}に${list.length}人が入った</small></div>
      <div class="fresh-star">
        <div class="fs-pic">${portrait(star, 120, 'smile')}<span class="fs-tag">期待の新星</span></div>
        <div class="fs-info"><b>${esc(star.name)}</b><small>${MAP.byId[star.loc] ? MAP.byId[star.loc].short : ''}・${club(star)}</small>
          <div class="fs-stats">統${star.str} 政${star.pol} 魅${star.cha} 知${star.int}</div>
          <p>「${esc(pick(FRESH_LINES))}」</p></div>
      </div>
      ${rest.length ? `<div class="fresh-row">${rest.map((g) => `<div>${portrait(g, 52, Math.random() < 0.5 ? 'smile' : null)}<b>${esc(g.name)}</b><small>${club(g)}</small></div>`).join('')}</div>` : ''}
      ${list.length > 9 ? `<p class="hint">ほか${list.length - 9}人</p>` : ''}
    </div>
    <button class="btn red" id="fresh-ok">迎え入れる</button>`);
  Sound.sakura();
  $('fresh-ok').onclick = () => { Sound.tap(); then(); };
}

// ---------- 絆の場面（二枚続きの錦絵） ----------
// 背景の柄が二人の後ろに通しで見えるよう、似顔の地の柄を外す
function bondPortrait(g, mood, dir) {
  return portrait(g, 260, mood, dir).replace(/<rect width="200" height="220" fill="url\(#\w+\)"\/><rect width="200" height="84" fill="url\(#bokashi\)" opacity="0.75"\/>/, '');
}
const BOND_KNOT = `<svg class="bd-knot" viewBox="0 0 120 70" aria-hidden="true"><g fill="none" stroke-linecap="round">
  <path d="M0,40 C25,40 30,18 50,18 C66,18 70,34 60,42 C50,50 38,40 46,30 C54,20 72,22 80,34 C88,46 100,40 120,40" stroke="#1c1a17" stroke-width="9"/>
  <path d="M0,40 C25,40 30,18 50,18 C66,18 70,34 60,42 C50,50 38,40 46,30 C54,20 72,22 80,34 C88,46 100,40 120,40" stroke="#c8372d" stroke-width="5"/>
  <path d="M58,44 L50,66 M64,44 L72,66" stroke="#1c1a17" stroke-width="7"/><path d="M58,44 L50,66 M64,44 L72,66" stroke="#c8372d" stroke-width="3.5"/></g></svg>`;
function showBond(ev, then) {
  const p = ev.p, T = BOND_TYPES[p.type];
  const a = S.gens[p.a], b = S.gens[p.b];
  if (!a || !b) { then(); return; }
  const bye = ev.id === 'farewell';
  const [la, lb] = (bye ? T.bye : T.lines)[p.line || 0];
  let box = $('bond');
  if (!box) { box = document.createElement('div'); box.id = 'bond'; box.className = 'kime bond'; document.body.appendChild(box); }
  const eff = bye
    ? (p.gift ? `${esc(b.name)}は師の教えを受け継いだ（${{ str: '統率', int: '知略', pol: '政治', cha: '魅力' }[p.gift]}+3）` : `${esc(a.name)}、卒業。絆は胸に残る`)
    : `${T.name}の契り：${T.desc}`;
  box.innerHTML = `<div class="bond-card">
      <div class="bd-title"><span>${bye ? '別' : '絆'}</span><b>${bye ? `${T.name}の別れ` : T.name}</b></div>
      <div class="bd-pair m-${T.motif}">
        <div class="bd-panel l">${bondPortrait(a, bye ? 'smile' : 'smile', 'R')}<div class="bd-name">${esc(a.name)}${p.type === 'shitei' ? '<small>師</small>' : ''}</div></div>
        <div class="bd-panel r">${bondPortrait(b, bye ? 'think' : 'happy', 'L')}<div class="bd-name">${esc(b.name)}${p.type === 'shitei' ? '<small>弟子</small>' : ''}</div></div>
        ${BOND_KNOT}
      </div>
      <p class="bd-line l"><b>${esc(a.name.split(' ')[1] || a.name)}</b>「${esc(la)}」</p>
      <p class="bd-line r"><b>${esc(b.name.split(' ')[1] || b.name)}</b>「${esc(lb)}」</p>
      <p class="bd-eff">${eff}</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  if (bye) Sound.lose(); else { Sound.hyoshigi(1); Sound.kira(); }
  let closed = false;
  box.onclick = null;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 700);
}

// ---------- 名門校の落城（本拠を落としたときの一枚絵） ----------
function conquestArt(id, loser) {
  const lc = CLANS[loser] ? CLANS[loser].color : '#857b6c';
  const pc = CLANS[PLAYER].color;
  const banner = (x, y, col, rot, crestKey) => `<g transform="translate(${x},${y}) rotate(${rot})">
    <path d="M0,0 L0,-96" stroke="#1c1a17" stroke-width="3.5"/>
    <rect x="2" y="-94" width="26" height="62" fill="${col}" stroke="#1c1a17" stroke-width="2"/>
    <g transform="translate(15,-63)">${UKIYO.crest(crestKey, 0, 0, 9)}</g></g>`;
  return `<svg viewBox="0 0 340 210" class="conq-art" aria-hidden="true">
    <defs><linearGradient id="cq-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8372d"/><stop offset=".55" stop-color="#e8a05a"/><stop offset="1" stop-color="#f6dcb0"/></linearGradient></defs>
    <rect width="340" height="210" fill="url(#cq-sky)"/>
    <circle cx="170" cy="92" r="58" fill="#f1e6cc" opacity=".35"/>
    <path d="M0,150 Q60,128 120,146 Q180,120 240,142 Q300,126 340,140 L340,210 L0,210Z" fill="#6b5a40" stroke="#1c1a17" stroke-width="3"/>
    <g class="conq-castle" transform="translate(170,132) scale(3.2)" style="--c:${lc}">${castleMarkup(true)}</g>
    <path d="M10,60 q20,-14 40,0 q16,-12 32,0 q-14,10 -36,6 q-22,6 -36,-6z M250,40 q20,-14 40,0 q16,-12 32,0 q-14,10 -36,6 q-22,6 -36,-6z" fill="#e0a526" stroke="#1c1a17" stroke-width="2"/>
    ${banner(70, 196, pc, -6, PLAYER)}${banner(276, 196, pc, 5, PLAYER)}
    ${banner(236, 206, lc, 38, loser)}
    <rect x="2" y="2" width="336" height="206" fill="none" stroke="#1c1a17" stroke-width="4"/>
  </svg>`;
}
function showConquest(B, then) {
  const id = B.to, loser = B.defender;
  const lore = schoolLore(id);
  const dg = B.dgid && S.gens[B.dgid];
  let box = $('conq');
  if (!box) { box = document.createElement('div'); box.id = 'conq'; box.className = 'kime conq'; document.body.appendChild(box); }
  box.innerHTML = `<div class="conq-card">
      <div class="conq-title"><span>${esc(MAP.byId[id].name)}</span><b>落 城</b></div>
      <div class="conq-frame">${conquestArt(id, loser)}
      </div>
      <p class="conq-motto"><b>校風</b>「${esc(lore.motto)}」</p>
      ${dg ? `<div class="conq-cry">${portrait(dg, 56, 'frustrated')}<p><b>${esc(dg.name)}</b>「${esc(lore.cry || '無念……')}」</p></div>` : ''}
      <p class="conq-gain">${CLANS[loser].name}の本拠${lore.sight ? `・${esc(lore.sight)}` : ''}は、${pName()}のものとなった</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(3); Sound.taiko(0.7, 1.2); Sound.stamp(1.0);
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 900);
}

// ---------- 他家の当主からの書状 ----------
// 巻紙に縦書きの文と、相手の家の落款。右上に当主の顔
function showLetter(ev, then) {
  const p = ev.p, k = p.clan;
  const lord = S.gens[p.lord];
  const text = p.text || lordVoice(k).letters[p.i];
  if (!lord || !text) { then(); return; }
  let box = $('letter');
  if (!box) { box = document.createElement('div'); box.id = 'letter'; box.className = 'kime letter'; document.body.appendChild(box); }
  const mood = p.mood || (CLAN_PERSONA[k] === 'diplomatic' ? 'think' : p.i === 2 ? 'smile' : 'angry');
  box.innerHTML = `<div class="letter-card">
      <div class="lt-head">${portrait(lord, 64, mood)}<div><small>${CLANS[k].name}当主より</small><b>${esc(lord.name)}</b><span>${p.sub || `${p.n}度目の合戦を経て`}</span></div></div>
      <div class="lt-paper" style="--c:${CLANS[k].color}">
        <p class="lt-body">${esc(pName())}　殿<br><br>${esc(text)}</p>
        <div class="lt-sign"><span>${esc(lord.name)}</span><i>${CLANS[k].name.replace('家', '')}<br>之印</i></div>
        ${p.gift ? `<p class="lt-gift">${esc(p.gift)}</p>` : ''}
      </div>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(1); Sound.stamp(0.9);
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 800);
}

// ---------- 序盤の目標：果たしたら軍師が褒めて褒美 ----------
// render のあと少し待ち、ほかの画面（合戦の結果・場面・地図の再生）が開いていないときだけ出す
let goalTimer = null;
function scheduleGoalCheck() {
  const goalsLeft = S && S.goal !== undefined && S.goal < GOALS.length;
  const meiba = S && S.meibaQueue && S.meibaQueue.length;
  if (!goalsLeft && !meiba) return;
  clearTimeout(goalTimer);
  goalTimer = setTimeout(() => {
    const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || document.querySelector('.world-cover') || mode;
    if (busy) return;
    // 戦国の名場面が待っていれば、そちらを先に
    if (S.meibaQueue && S.meibaQueue.length) {
      const m = S.meibaQueue.shift();
      if (!S.debugUsed) { const rec = loadRecords(); rec.meiba = rec.meiba || {}; if (!rec.meiba[m.id]) rec.meiba[m.id] = Date.now(); saveRecords(rec); }
      save();
      showMeiba(m);
      return;
    }
    if (!goalsLeft) return;
    const done = goalCheck(S);
    if (!done) return;
    save();
    showGoalScene(done);
  }, 500);
}
// ---------- 戦国の名場面：一枚絵 ----------
function meibaArt(id, p) {
  const K = '#1c1a17';
  const banners = (n, x0, y, col, dx, flip) => Array.from({ length: n }, (_, i) => {
    const x = x0 + i * dx, h = 34 + (i % 3) * 6;
    return `<path d="M${x},${y} V${y - h}" stroke="${K}" stroke-width="2"/><rect x="${flip ? x - 12 : x}" y="${y - h}" width="12" height="20" fill="${col}" stroke="${K}" stroke-width="1.4"/>`;
  }).join('');
  const me = CLANS[PLAYER].color, foe = p.foe && CLANS[p.foe] ? CLANS[p.foe].color : '#6f6a60';
  let body = '';
  if (id === 'okehazama') {
    // 雨の夜、丘を駆け下りる少数の軍勢と、谷の大軍の陣幕
    body = `<rect width="340" height="200" fill="#2d3346"/>
      <path d="M0,120 Q90,60 170,110 L170,200 L0,200Z" fill="#3a3a32" stroke="${K}" stroke-width="3"/>
      <path d="M150,170 Q250,150 340,165 L340,200 L150,200Z" fill="#4a4636" stroke="${K}" stroke-width="3"/>
      ${banners(4, 60, 112, me, 22)}${banners(9, 190, 168, '#857b6c', 16)}
      <g stroke="#cfd8e8" stroke-width="1.2" opacity=".7">${Array.from({ length: 36 }, (_, i) => `<line x1="${(i * 37) % 340}" y1="${(i * 23) % 200}" x2="${(i * 37) % 340 - 6}" y2="${(i * 23) % 200 + 16}"/>`).join('')}</g>`;
  } else if (id === 'nagashino') {
    // 馬防柵と鉄砲の煙、押し寄せる大軍
    body = `<rect width="340" height="200" fill="#e8c27a"/><rect y="130" width="340" height="70" fill="#7a6a40"/>
      ${banners(10, 190, 150, foe, 14)}
      <g stroke="${K}" stroke-width="3">${Array.from({ length: 12 }, (_, i) => `<line x1="${40 + i * 10}" y1="120" x2="${46 + i * 10}" y2="160"/>`).join('')}<line x1="34" y1="132" x2="160" y2="132"/><line x1="34" y1="148" x2="160" y2="148"/></g>
      ${banners(3, 30, 175, me, 30)}
      <g fill="#f4efe2" stroke="${K}" stroke-width="1.5">${[[150, 112], [168, 118], [140, 124], [176, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10"/>`).join('')}</g>`;
  } else if (id === 'honnoji') {
    // 夜の寺が燃える
    body = `<rect width="340" height="200" fill="#1c1420"/>
      <path d="M90,150 L250,150 L250,110 L90,110Z" fill="#3a2a22" stroke="${K}" stroke-width="3"/>
      <path d="M70,112 L170,70 L270,112Z" fill="#2a2a32" stroke="${K}" stroke-width="3"/>
      <g fill="#e8553f" stroke="#f3d27a" stroke-width="2">${[[112, 58], [170, 34], [228, 56]].map(([x, y]) => `<path transform="translate(${x},${y}) scale(0.8) translate(${-x},${-y})" d="M${x},${y + 40} q-18,-20 -4,-44 q4,14 12,10 q-2,-22 14,-34 q-4,22 10,32 q8,-6 6,-18 q18,26 -2,54Z"/>`).join('')}</g>
      <rect y="150" width="340" height="50" fill="#2a1a14"/>`;
  } else if (id === 'hiboshi') {
    // 夜、三日月の下で城を幾重にも囲む陣と篝火
    body = `<rect width="340" height="200" fill="#1e2438"/><path d="M262,30 a22,22 0 1 0 14,40 a18,18 0 1 1 -14,-40Z" fill="#f3d27a"/>
      <rect y="150" width="340" height="50" fill="#2a2a20"/>
      <g transform="translate(170,138) scale(2.2)" style="--c:${foe}">${castleMarkup(false).replace(/class="roof"/g, `fill="${foe}" stroke="${K}" stroke-width="1.6" class="roof"`).replace(/class="wall"/g, 'fill="#cfc4a8" stroke="#1c1a17" stroke-width="1.6" class="wall"').replace(/class="stone"/g, 'fill="#6f6a60" stroke="#1c1a17" class="stone"').replace(/class="window"/g, 'fill="#1c1a17" class="window"').replace(/class="snow"[^/]*\/>/g, '').replace(/class="(shadow|stone-line|clock)"/g, 'fill="none" stroke="none" class="$1"')}</g>
      ${banners(6, 20, 182, me, 22)}${banners(6, 212, 182, me, 22)}
      <g fill="#e8553f">${[[60, 166], [150, 172], [250, 168], [310, 174]].map(([x, y]) => `<path d="M${x},${y} q-6,-8 0,-16 q6,8 0,16Z"/>`).join('')}</g>`;
  } else if (id === 'dannoura') {
    // 荒れた海に、両家の船団
    const ship = (x, y, col, s, f) => `<g transform="translate(${x},${y}) scale(${f * s},${s})"><path d="M-30,0 L30,0 L22,14 L-24,14Z" fill="#5a3a22" stroke="${K}" stroke-width="2.5"/>
      <path d="M0,0 V-46" stroke="${K}" stroke-width="3"/><rect x="2" y="-44" width="22" height="30" fill="${col}" stroke="${K}" stroke-width="2"/></g>`;
    body = `<rect width="340" height="200" fill="#e8b878"/><circle cx="270" cy="56" r="34" fill="#c8372d"/>
      <rect y="110" width="340" height="90" fill="#22406b"/>
      <g fill="none" stroke="#f1e6cc" stroke-width="2.5" opacity=".8">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 40 - 10},${140 + (i % 3) * 16} q10,-12 20,0 q10,-12 20,0"/>`).join('')}</g>
      ${ship(70, 128, me, 1, 1)}${ship(130, 150, me, 0.8, 1)}${ship(250, 132, foe, 0.9, -1)}${ship(300, 154, foe, 0.7, -1)}`;
  } else {
    // 関ヶ原：霧の野で向き合う両軍と、二つの家紋
    body = `<rect width="340" height="200" fill="#c9cfc6"/><rect y="140" width="340" height="60" fill="#6b7a4a"/>
      ${banners(7, 20, 160, me, 14)}${banners(7, 320, 160, foe, -14, true)}
      <g fill="rgba(255,255,255,.55)">${[60, 150, 250].map((x, i) => `<ellipse cx="${x}" cy="${130 + i * 6}" rx="90" ry="14"/>`).join('')}</g>
      <g transform="translate(60,40)">${crestBadge(PLAYER, 64)}</g>
      ${p.foe ? `<g transform="translate(216,40)">${crestBadge(p.foe, 64)}</g>` : ''}
      <text x="170" y="86" text-anchor="middle" font-family="serif" font-size="30" fill="${K}">対</text>`;
  }
  return `<svg viewBox="0 0 340 200" class="mb-art" aria-hidden="true">${body}<rect x="2" y="2" width="336" height="196" fill="none" stroke="${K}" stroke-width="4"/></svg>`;
}
function showMeiba(m) {
  const M = MEIBA[m.id], p = m.p || {};
  const g = p.gid && S.gens[p.gid];
  const foeLord = p.lord && S.gens[p.lord];
  const where = p.to && MAP.byId[p.to] ? MAP.byId[p.to].name : '';
  const line = m.id === 'okehazama' ? `${where}を、${fmt(p.a)}の兵で${fmt(p.d)}の大軍から奪い取った。${g ? `${g.name}の統率が3上がった` : ''}`
    : m.id === 'nagashino' ? `${where}に押し寄せた${fmt(p.a)}の大軍を、${fmt(p.d)}の兵で退けた。${g ? `${g.name}の知略が3上がった` : ''}`
    : m.id === 'hiboshi' ? `${p.turns}季にわたる包囲の末、兵糧の尽きた${where}が門を開いた。${g ? `囲み続けた${g.name}、見事` : ''}`
    : m.id === 'dannoura' ? `${g ? g.name : '船団'}が海を越えて攻め寄せ、${CLANS[p.foe] ? CLANS[p.foe].name : ''}の本拠・${where}を落とした`
    : m.id === 'honnoji' ? `${g ? g.name : '家臣'}が${where}ごと${pName()}に背いた。「敵は、身内にあり」`
    : `${pName()}と${CLANS[p.foe] ? CLANS[p.foe].name : '最後の一家'}。${foeLord ? `${foeLord.name}「この一戦で、すべてが決まる」` : 'この戦いで、すべてが決まる'}`;
  let box = $('meiba');
  if (!box) { box = document.createElement('div'); box.id = 'meiba'; box.className = 'kime meiba'; document.body.appendChild(box); }
  box.innerHTML = `<div class="kime-card mb-card">
      <div class="mb-kicker">戦国の名場面</div>
      <div class="kime-title">${M.name}</div>
      <div class="mb-frame">${meibaArt(m.id, p)}</div>
      <p class="mb-sub">${M.sub}</p>
      <p class="kime-line mb-line">${esc(line)}</p>
      <p class="mb-book">名場面帖に収められた</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(3); Sound.taiko(0.5, 1.2); if (m.id === 'honnoji') Sound.fire(); else Sound.horagai();
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; render(); }; }, 1200);
}

function showGoalScene(done) {
  const G = GOALS[done.i], next = GOALS[done.i + 1];
  const newcomer = done.gid && S.gens[done.gid];
  let box = $('goal');
  if (!box) { box = document.createElement('div'); box.id = 'goal'; box.className = 'kime goal'; document.body.appendChild(box); }
  box.innerHTML = `<div class="kime-card">
      <div class="gl-step">旗揚げの章 ${['一', '二', '三', '四'][done.i]}／四</div>
      <div class="kime-title">${esc(G.name)}、成る</div>
      <div class="gl-sensei">${portrait(SENSEI, 120, 'laugh')}<p><b>軍師</b>「${esc(G.praise)}」</p></div>
      <div class="gl-reward"><span>褒美</span>${newcomer ? portrait(newcomer, 40, 'happy') : ''}<b>${esc(newcomer ? `${newcomer.name}（統${newcomer.str} 知${newcomer.int}）が仕官した` : G.reward)}</b></div>
      ${next ? `<p class="gl-next">次なる目標「${esc(next.name)}」：${esc(goalText(S, next))}</p>` : '<p class="gl-next">旗揚げの章、完。ここからは天下取りの本番</p>'}
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(2); Sound.win(); Sound.kira();
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; render(); }; }, 900);
}

// ---------- 卒業生（OB・OG）の来訪 ----------
const OB_LINES = {
  engun: ['後輩の危機と聞いて、黙ってはおれぬ！', '大学の仲間を連れてきた。存分に使え', '母校の旗は、まだ折らせんぞ'],
  keiko: ['どれ、腕を見てやろう', '俺の若い頃にそっくりだ。鍛えがいがある', '型は教えた。あとは自分で磨け'],
  sashiire: ['皆で食べてくれ。腹が減っては戦はできぬ', 'バイト代が入ったのでな。遠慮はいらん', '後輩たちの活躍、遠くから見ているぞ'],
};
function showOB(ev, then) {
  const p = ev.p, h = (S.hall || [])[p.hi];
  if (!h) { then(); return; }
  const g = { ...h, clan: PLAYER, grade: 3 };
  const og = h.female ? 'OG' : 'OB';
  const kohai = p.gid && S.gens[p.gid];
  const eff = p.kind === 'engun' ? `${esc(MAP.byId[p.to].short)}に ${fmt(p.n)} の援兵が加わった`
    : p.kind === 'keiko' && kohai ? `${esc(kohai.name)}の${STAT_NAMES[p.stat]}が 3 上がった`
    : `金 ${fmt(p.gold || 0)} が届いた`;
  let box = $('ob');
  if (!box) { box = document.createElement('div'); box.id = 'ob'; box.className = 'kime ob'; document.body.appendChild(box); }
  box.innerHTML = `<div class="kime-card">
      <div class="kime-title"><span class="ob-latin">${og}</span>、参上</div>
      <div class="kime-frame">
        ${portrait(g, 300, p.kind === 'engun' ? 'angry' : 'laugh')}
        <div class="kime-name"><span>${esc(h.name)}</span>${h.nick ? `<small>「${esc(h.nick)}」</small>` : ''}</div>
        <div class="ob-badge"><span class="ob-latin">${og}</span><small>${dateLabel(h.until)}卒</small></div>
      </div>
      <p class="kime-line">「${esc(pick(OB_LINES[p.kind] || OB_LINES.sashiire))}」</p>
      <div class="ob-eff">${kohai && p.kind === 'keiko' ? portrait(kohai, 40, 'happy') : ''}<span>${eff}</span></div>
      ${h.visits > 1 ? `<p class="ob-visits">${h.visits}度目の帰校</p>` : ''}
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(1); Sound.taiko(0.4, 0.9); Sound.kira();
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 900);
}

// ---------- 天下目前：節目の一枚絵と、最後の大連合 ----------
const MILESTONES = {
  0.5: { title: '天下の半ば', lines: ['ようやく半ばか。だが、ここからが本当の戦いだ', '皆の者、天下の半分はわが手にあるぞ！'] },
  0.75: { title: '天下に王手', lines: ['天下は、もう手の届くところにある', '気を抜くな。追いつめられた者ほど手強いものだ'] },
  0.9: { title: '天下目前', lines: ['あと一息。最後まで、誰ひとり欠けるでないぞ', '天下統一の日は近い。いざ、仕上げにかかる！'] },
};
// 天下絵図：すべての城を家の色の升目で並べる（自分の家が先、残りは家ごと）
function tenkaGrid(s) {
  const order = (k) => (k === PLAYER ? 0 : k === 'none' ? 2 : 1);
  const ids = Object.keys(s.castles).sort((a, b) => order(s.castles[a].owner) - order(s.castles[b].owner) || s.castles[a].owner.localeCompare(s.castles[b].owner));
  return `<div class="tk-grid">${ids.map((id, i) => {
    const o = s.castles[id].owner;
    return `<i class="${o === PLAYER ? 'me' : ''}" style="--c:${o === 'none' ? '#857b6c' : CLANS[o].color};animation-delay:${(0.4 + i * 0.018).toFixed(2)}s"></i>`;
  }).join('')}</div>`;
}
function showMilestone(ev, then) {
  const M = MILESTONES[ev.p.mark];
  const lord = lordOf(S);
  const rest = aiClans().filter((k) => castlesOf(S, k).length);
  const left = MAP.nodes.length - castlesOf(S, PLAYER).length;
  let box = $('milestone');
  if (!box) { box = document.createElement('div'); box.id = 'milestone'; box.className = 'kime milestone'; document.body.appendChild(box); }
  box.innerHTML = `<div class="ms-card">
      <div class="ms-title">${M.title}</div>
      <div class="ms-frame">${tenkaGrid(S)}
        <div class="ms-count"><b>${castlesOf(S, PLAYER).length}</b><span>／${MAP.nodes.length}校</span></div>
      </div>
      ${lord ? `<div class="conq-cry">${portrait(lord, 56, ev.p.mark >= 0.9 ? 'laugh' : 'smile')}<p><b>${esc(lord.name)}</b>「${esc(pick(M.lines))}」</p></div>` : ''}
      <p class="ms-rest">${left ? `残るは${left}校` : ''}${rest.length ? `　${rest.map((k) => crestBadge(k, 22)).join('')}` : ''}</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(2); Sound.taiko(0.5, 1); Sound.taiko(0.8, 1.1); Sound.kira();
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 1200);
}
function showRally(ev, then) {
  const p = ev.p, head = p.head;
  const lord = S.gens[p.lord];
  let box = $('rally');
  if (!box) { box = document.createElement('div'); box.id = 'rally'; box.className = 'kime rally'; document.body.appendChild(box); }
  box.innerHTML = `<div class="kime-card">
      <div class="kime-title">最後の大連合</div>
      <div class="rl-crests">${p.clans.map((k, i) => `<span style="animation-delay:${(0.5 + i * 0.15).toFixed(2)}s">${crestBadge(k, 38)}</span>`).join('')}</div>
      ${lord ? `<div class="kime-frame" style="--c:${CLANS[head].color}">
        ${portrait(lord, 300, 'angry')}
        <div class="kime-name"><span>${esc(lord.name)}</span><small>連合の盟主</small></div>
        <div class="kime-seal">${esc(CLANS[head].name.replace('家', ''))}<br>之印</div>
      </div>` : ''}
      <p class="kime-line">「${esc(pName())}よ、天下はまだ渡さぬ！ 我ら${p.clans.length}家、いまこそ一つとなって総攻撃を仕掛ける！」</p>
      <p class="rl-sub">${FINALE.rallyTurns}季のあいだ、連合が大反攻に出る。連合の前線の城には兵が集まった</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.horagai(); Sound.taiko(0.9, 1.2); Sound.taiko(1.2, 1.2);
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 1300);
}

// ---------- イベント ----------
function runEvents(done) {
  if (!S.pending || !S.pending.length) { closeModal(); done(); return; }
  const ev = S.pending[0];
  if (ev.id === 'ob') {
    closeModal();
    showOB(ev, () => { if (S.pending[0] === ev) S.pending.shift(); save(); render(); runEvents(done); });
    return;
  }
  if (ev.id === 'shi') {
    // 志、成就：覚醒の決め絵
    const g = S.gens[ev.p.gid];
    const next = () => { if (S.pending[0] === ev) S.pending.shift(); save(); runEvents(done); };
    if (!g || !g.shi) { next(); return; }
    closeModal();
    const D = SHI[g.shi.kind];
    const boost = ['str', 'int', 'pol', 'cha'].map((k) => `${STAT_NAMES[k]}+${k === ev.p.best ? SHI_BOOST.main : SHI_BOOST.rest}`).join(' ');
    showKime(g, '志、成就', D.line, next, 'laugh', `<div class="shi-done"><span>志</span><b>${esc(D.name)}</b><small>${esc(shiText(S, g))}</small></div>
      <p class="shi-eff">覚醒！ ${boost}<br>人呼んで「${esc(g.shi.title)}」</p>`);
    Sound.kira();
    return;
  }
  if (ev.id === 'milestone' || ev.id === 'rally') {
    closeModal();
    (ev.id === 'rally' ? showRally : showMilestone)(ev, () => { if (S.pending[0] === ev) S.pending.shift(); save(); runEvents(done); });
    return;
  }
  if (ev.id === 'letter') {
    closeModal();
    showLetter(ev, () => { if (S.pending[0] === ev) S.pending.shift(); save(); runEvents(done); });
    return;
  }
  if (ev.id === 'bond' || ev.id === 'farewell') {
    closeModal();
    showBond(ev, () => { if (S.pending[0] === ev) S.pending.shift(); save(); runEvents(done); });
    return;
  }
  const v = eventView(S, ev);
  const era = !!(EVENTS[ev.id] && EVENTS[ev.id].era);
  if (era && !ev.cut) { ev.cut = true; inkCut('時代が動く', v.title); Sound.horagai(); } // 時代の出来事は墨の一閃から
  Sound.taiko(0, 0.7);
  const choiceHtml = v.choiceGens
    // 後継者選びなど：武将のカードをそのまま選択肢にする
    ? v.choices.map((c, i) => `<button class="choice-gen" data-ci="${i}">${genCard(S.gens[v.choiceGens[i]])}<small>${c.sub}</small></button>`).join('')
    : v.choices.map((c, i) => `<button class="btn ${i === 0 ? 'red' : 'plain'}" data-ci="${i}" ${c.disabled ? 'disabled' : ''}>${c.label}${c.sub ? `<small class="sub">${c.sub}</small>` : ''}</button>`).join('');
  if (v.scene) {
    // 使者の来訪：こちらの生徒会室で会う
    Sound.bgmStart('meeting');
    openModal(`${envoyScene(ev, v.title, ev.p.kind === 'tribute' ? 'angry' : ev.p.kind === 'plea' ? 'think' : null, v.text)}${choiceHtml}`);
  } else {
    openModal(`<div class="event${era ? ' era' : ''}" data-lock>${era ? '<p class="era-tag">時代が動く</p>' : ''}
      ${v.art ? `<div class="ev-art">${seasonArt(v.art)}<span class="ev-art-title ${v.title.length > 5 ? 'long' : ''}">${v.title}</span></div>` : `<div class="ev-icon">${v.icon}</div>`}
      ${v.art ? "" : `<h2>${v.title}</h2>`}
      ${v.gid ? `<div class="glist pick">${genCard(S.gens[v.gid])}</div>` : ''}
      <p class="ev-text">${esc(v.text)}</p>
    </div>
    ${choiceHtml}`);
  }
  modalBody.querySelectorAll('[data-ci]').forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      if (S.pending[0] !== ev) return; // 二重に押されたとき
      const result = resolveEvent(S, ev, +b.dataset.ci);
      S.pending.shift();
      save();
      render();
      if (ev.id === 'succession') Sound.win();
      if (ev.id === 'treasure' && result.includes('蔵に納めた')) Sound.kira();
      achievementToast(checkAchievements(S));
      if (ev.id === 'spring' && freshmen().length) { showFreshmen(() => runEvents(done)); return; }
      if (!result) { runEvents(done); return; }
      if (v.scene) {
        const yes = +b.dataset.ci === 0;
        const reply = yes ? pick(['かたじけない。主にしかと伝えます', 'ありがたき幸せ。これで話がまとまりました'])
          : ev.p.kind === 'tribute' ? '……後悔なさいますな' : pick(['……さようですか。残念です', '主にはそのように伝えましょう']);
        openModal(`${envoyScene(ev, v.title, yes ? 'happy' : ev.p.kind === 'tribute' ? 'angry' : 'think', reply, yes ? 'deal' : 'fail')}
          <p class="result">${esc(result)}</p>
          <button class="btn red" id="ev-next">承 知</button>`);
        if (yes) Sound.win(); else Sound.lose();
      } else {
        openModal(`<div class="event" data-lock>${v.art ? `<div class="ev-art">${seasonArt(v.art)}</div>` : `<div class="ev-icon">${v.icon}</div>`}<p class="ev-text">${esc(result)}</p></div>
        <button class="btn red" id="ev-next">承 知</button>`);
      }
      $('ev-next').onclick = () => {
        Sound.tap();
        if (v.scene && !(S.pending[0] && S.pending[0].id === 'envoy')) Sound.bgmStart('map');
        runEvents(done);
      };
      // 家督相続：新しい当主の決め絵を、結果の上に重ねて見せる
      if (ev.id === 'succession' && lordOf(S)) {
        showKime(lordOf(S), `${S.lords.length}代目当主、見参`,
          pick(['先代の志、しかと受け継いだ', 'この家、必ず天下に導いてみせる', '皆の者、ついてまいれ！']));
      }
      // 転校生が加わった：名乗りの決め絵
      if (['transfer', 'genius'].includes(ev.id) && S.gens[ev.p.gid] && S.gens[ev.p.gid].clan === PLAYER) {
        const g = S.gens[ev.p.gid];
        showKime(g, ev.id === 'genius' ? '天才転校生、参上' : '転校生、参上', transferLine(g));
      }
    };
  });
}

function bulk(kind) {
  Sound.tap();
  const n = bulkCommand(S, kind);
  save();
  render();
  toast(n ? `${n}城で${kind === 'recruit' ? '徴兵' : '開発'}しました` : '命令できる城がありません');
}

// ---------- 建設 ----------
// ---------- 城下町の普請：町の絵の区画をタップして、施設を建てる ----------
// 区画は町が育つと開く（facSlots）。建った施設はその区画に絵で立つ。取り壊して建て直すこともできる
const TOWN_PLOTS = [[84, 132], [276, 132], [62, 196], [298, 196], [180, 214]];
function townScene(id, pick = -1) {
  const c = S.castles[id], fac = c.fac || [], slots = facSlots(S, id), lv = townLevel(c.eco);
  const color = CLANS[c.owner] ? CLANS[c.owner].color : '#8a8170';
  const plots = TOWN_PLOTS.map(([x, y], i) => {
    const f = fac[i];
    const open = i < slots;
    const needLv = i < FAC_SLOTS ? 0 : i - FAC_SLOTS + 2;
    const body = f ? `<g transform="translate(0,6)">${facArt(f, color)}</g><text class="tp-name" y="20">${FACILITIES[f].name}</text>`
      : open ? '<text class="tp-plus" y="-2">＋</text><text class="tp-name" y="14">空き地</text>'
        : `<text class="tp-lock" y="-2">🔒</text><text class="tp-name" y="14">${TOWN_LEVELS[needLv].name}で開く</text>`;
    return `<g class="tplot ${f ? 'built' : open ? 'open' : 'locked'} ${i === pick ? 'pick' : ''}" data-plot="${i}" transform="translate(${x},${y})">
      <rect class="tp-lot" x="-40" y="-30" width="80" height="58" rx="3"/>${body}</g>`;
  }).join('');
  const people = Array.from({ length: 2 + lv * 2 }, (_, i) => `<circle class="tp-walker" r="2.6" cx="${172 + (i % 3) * 7}" cy="0" style="animation-delay:-${(i * 1.7).toFixed(1)}s; --c:${['#c8372d', '#2d5fb4', '#e0a526', '#2f8a55'][i % 4]}"/>`).join('');
  return `<svg class="town-scene" viewBox="0 0 360 250" aria-hidden="true">
    <rect width="360" height="250" fill="#efe3c4"/>
    <path d="M0,70 Q60,30 120,58 Q180,22 240,56 Q300,30 360,62 L360,96 L0,96 Z" fill="#9db08a" stroke="#1c1a17" stroke-width="1.6"/>
    <rect y="92" width="360" height="158" fill="#e3d3ab"/>
    <path d="M166,92 L194,92 L240,250 L120,250 Z" fill="#cdb98c" stroke="#8d7550" stroke-width="1.2"/>
    <path d="M150,180 L210,180 M140,215 L220,215" stroke="#b49c6c" stroke-width="1.4"/>
    <g transform="translate(180,90) scale(1.5)" class="zk-castle" style="--c:${color}">${castleMarkup(isCapital(id, c.owner))}</g>
    <g class="tp-people">${people}</g>
    ${plots}
  </svg>`;
}
function showBuild(id, pick = -1) {
  const c = S.castles[id];
  const g = bestBy(idleGensAt(S, id), 'pol');
  const lv = townLevel(c.eco), next = TOWN_LEVELS[lv + 1];
  const slots = facSlots(S, id), fac = c.fac || [];
  const prev = TOWN_LEVELS[lv].eco;
  const grow = next ? `<span class="tp-grow"><u style="width:${clamp(((c.eco - prev) / (next.eco - prev)) * 100, 0, 100)}%"></u></span><small>経済 ${c.eco}／${next.eco}で「${next.name}」</small>` : '<small>これ以上は育たない、天下の大都</small>';
  let sheet = '';
  if (pick >= 0 && fac[pick]) {
    const f = fac[pick];
    sheet = `<div class="tp-sheet"><b>${FACILITIES[f].name}</b><small>${FACILITIES[f].desc}</small>
      <button class="btn plain" id="tp-demolish">取り壊す<small>区画を空ける（費用は戻らない）</small></button></div>`;
  } else if (pick >= 0) {
    sheet = `<div class="tp-sheet"><p class="hint">この区画に建てる施設 ${g ? `── 担当：${esc(g.name)}（政治${g.pol}）` : '── 命令できる武将がいません'}</p><div class="scheme-list">${Object.entries(FACILITIES).map(([k, f]) => {
      const built = hasFac(S, id, k);
      const ok = g && canBuild(S, id, k);
      const why = built ? '建設済み' : S.gold[PLAYER] < f.cost ? '金が足りない' : '';
      return `<button class="scheme-row" data-fac="${k}" ${ok ? '' : 'disabled'}><b>${f.name}</b><span class="cost">${built ? '✔' : `金${f.cost}`}</span><small>${f.desc}</small>${why ? `<em>${why}</em>` : ''}</button>`;
    }).join('')}</div></div>`;
  }
  openModal(`<h2>城 下 町</h2>
    <p class="tp-head"><b>${MAP.byId[id].name}</b>・${TOWN_LEVELS[lv].name}（区画 ${fac.length}／${slots}）${grow}</p>
    <div class="town-wrap">${townScene(id, pick)}</div>
    ${sheet || `<p class="hint" style="text-align:center">区画をタップして普請する。町は「開発」で経済を上げると育ち、区画が開いていく</p>`}
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-plot]').forEach((p) => {
    const i = +p.dataset.plot;
    if (i >= slots) return;
    p.onclick = () => { Sound.tap(); showBuild(id, i === pick ? -1 : Math.min(i, fac.length)); };
  });
  if ($('tp-demolish')) $('tp-demolish').onclick = () => { Sound.tap(); demolish(S, id, fac[pick]); save(); render(); showBuild(id); };
  modalBody.querySelectorAll('[data-fac]').forEach((b) => {
    b.onclick = () => {
      const f = b.dataset.fac;
      build(S, id, f, g);
      Sound.win();
      save();
      render();
      showBuild(id);
      const n = (S.castles[id].fac || []).length - 1;
      const lot = modalBody.querySelector(`[data-plot="${n}"]`);
      if (lot) lot.classList.add('just');
      toast(`${portrait(g, 30)}<span>${esc(g.name)}：${FACILITIES[f].name}を建てた！<br><b>${FACILITIES[f].desc}</b></span>`);
    };
  });
}

// ---------- 計略 ----------
// 仕掛ける武将：その計略に向いた能力がいちばん高い、命令できる武将
function schemeAgent(from, kind) {
  return bestBy(idleGensAt(S, from), SCHEMES[kind].stat);
}

function showSchemeMenu(from) {
  const rows = Object.entries(SCHEMES).map(([k, sc]) => {
    const g = schemeAgent(from, k);
    const targets = schemeTargets(S, from, k);
    const ok = g && targets.length && S.gold[PLAYER] >= sc.cost;
    const why = !g ? '命令できる武将がいない' : !targets.length ? '近くに相手がいない' : S.gold[PLAYER] < sc.cost ? '金が足りない' : `${esc(g.name)}（${STAT_NAMES[sc.stat]}${g[sc.stat]}）が仕掛ける・相手 ${targets.length}城`;
    return `<button class="scheme-row" data-sch="${k}" ${ok ? '' : 'disabled'}>
      <b>${sc.name}</b><span class="cost">金${sc.cost}</span><small>${sc.desc}</small><em>${why}</em></button>`;
  }).join('');
  openModal(`<h2>計 略</h2>
    <p class="hint" style="text-align:center">${MAP.byId[from].name}から、道${SCHEME_RANGE}本先までの城に仕掛けられます</p>
    <div class="scheme-list">${rows}</div>
    <button class="btn plain" data-close>やめる</button>`);
  modalBody.querySelectorAll('[data-sch]').forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      const kind = b.dataset.sch;
      closeModal();
      mode = { kind: 'scheme', scheme: kind, from, gid: schemeAgent(from, kind).id };
      render();
    };
  });
}

// 相手の城を選んだあと
function openSchemeTarget(to) {
  const { scheme: kind, from, gid } = mode;
  const g = S.gens[gid];
  const sc = SCHEMES[kind];
  const c = S.castles[to];
  const head = `<h2>計略「${sc.name}」</h2>
    <p style="text-align:center;margin:0 0 6px">${clanChip(c.owner)} <b>${MAP.byId[to].name}</b><br>兵 ${fmt(c.troops)} ・ 防御 ${c.def.toFixed(1)}</p>
    <div class="glist pick">${genCard(g)}</div>`;
  if (kind === 'lure') {
    // 引き抜く武将を選ぶ
    const cands = gensAt(S, to).filter((x) => !x.lord);
    openModal(`${head}
      <h3>誰を引き抜く？（金${sc.cost}）</h3>
      <div class="glist pick">${cands.map((x) => genCard(x, {
        extra: `<span class="lure-p"><small>忠${x.loyal}</small><b>${Math.round(schemeChance(S, kind, g, to, x) * 100)}%</b></span>`,
      })).join('')}</div>
      <p class="hint">忠誠が低い武将ほど、寝返りやすい。</p>
      <button class="btn plain" id="sch-back">やめる</button>`);
    modalBody.querySelectorAll('.glist.pick .gcard[data-gid]').forEach((el) => {
      if (el.dataset.gid === gid) return;
      el.onclick = () => doScheme(kind, g, to, S.gens[el.dataset.gid]);
    });
  } else {
    const p = Math.round(schemeChance(S, kind, g, to) * 100);
    openModal(`${head}
      <p>${sc.desc}。</p>
      <p class="odds">成功率 ${p}%</p>
      <button class="btn red" id="sch-go">仕掛ける（金${sc.cost}）</button>
      <button class="btn plain" id="sch-back">やめる</button>`);
    $('sch-go').onclick = () => doScheme(kind, g, to);
  }
  $('sch-back').onclick = () => { Sound.tap(); closeModal(); mode = null; render(); };
}

function doScheme(kind, g, to, target) {
  const r = runScheme(S, kind, g, to, target);
  mode = null;
  selected = kind === 'subvert' && r.ok ? to : g.loc;
  checkWin(S);
  save();
  render();
  if (r.ok) Sound.win(); else Sound.lose();
  openModal(`<div class="event">
      <div class="ev-icon">${r.ok ? '成' : '敗'}</div>
      <h2>${SCHEMES[kind].name}${r.ok ? '成功' : '失敗'}</h2>
      <p class="ev-text">${esc(r.text)}</p>
    </div>
    <button class="btn red" data-close>承 知</button>`);
  achievementToast(checkAchievements(S));
  if (S.result) showEnding();
}

// ---------- 褒美 ----------
// gens の中から誰に褒美を与えるか選ぶ。忠誠の低い順に並べる
function showReward(gens, title, back) {
  const list = gens.filter((g) => g.clan === PLAYER && !g.lord).sort((a, b) => a.loyal - b.loyal);
  const low = list.filter((g) => g.loyal < 50 && canReward(S, g));
  openModal(`<h2>${title}</h2>
    <p class="hint" style="text-align:center">金${LOYAL.rewardCost}で忠誠+${LOYAL.rewardGain}。1人につき1季に1回。命令の回数は使いません。<br>所持金 ${fmt(S.gold[PLAYER])}</p>
    ${low.length > 1 ? `<button class="btn red" id="rw-low">忠誠50未満の ${low.length}人 にまとめて褒美（金${fmt(low.length * LOYAL.rewardCost)}）</button>` : ''}
    <div class="glist pick">${list.map((g) => genCard(g, {
      extra: canReward(S, g) ? `<button class="rw-btn" data-rw="${g.id}">褒美</button>` : `<span class="rw-done">${S.rewarded[g.id] ? '済' : ''}</span>`,
    })).join('') || '<p class="hint">褒美を与えられる家臣はいない</p>'}</div>
    <button class="btn plain" id="rw-back">${back ? 'もどる' : '閉じる'}</button>`);
  const again = (msg) => { save(); render(); showReward(gens, title, back); if (msg) toast(msg); };
  modalBody.querySelectorAll('[data-rw]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      Sound.tap();
      const g = S.gens[b.dataset.rw];
      const gain = reward(S, g.id);
      again(`${esc(g.name)}に褒美を与えた。忠誠+${gain}`);
    };
  });
  if ($('rw-low')) $('rw-low').onclick = () => {
    Sound.win();
    let n = 0;
    low.forEach((g) => { if (canReward(S, g)) { reward(S, g.id); n++; } });
    again(`${n}人に褒美を与えた`);
  };
  $('rw-back').onclick = () => { Sound.tap(); if (back) back(); else closeModal(); };
}

// 担当の武将を自動で選んで内政
function act(fn, stat, label) {
  const g = bestBy(idleGensAt(S, selected), stat);
  const r = fn(S, selected, g);
  S.acted[g.id] = true;
  Sound.tap();
  save();
  render();
  toast(`${portrait(g, 30)}<span>${esc(g.name)}：${label} ${r.text}${r.grew ? `<br><b>${STAT_NAMES[r.grew]}が上がった！</b>` : ''}</span>`);
}

function bindPanel() {
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('c-close', () => { Sound.tap(); selected = null; render(); });
  on('c-attack', () => { Sound.taiko(0, 0.6); mode = { kind: 'attack', from: selected }; render(); });
  on('c-move', () => { Sound.tap(); mode = { kind: 'move', from: selected }; render(); });
  on('c-siege', () => { Sound.taiko(0, 0.5); mode = { kind: 'siege', from: selected }; render(); });
  on('c-assault', () => { Sound.taiko(0, 1); siegeAssault(selected); });
  on('c-relief', () => { Sound.tap(); openRelief(selected); });
  on('c-lift', () => { Sound.tap(); const sg = mySiege(S, selected); if (sg) { liftSiege(S, sg); save(); render(); toast('囲みを解き、兵を引き上げた'); } });
  on('c-gen', () => { Sound.tap(); chooseGeneralToMove(selected); });
  on('c-recruit', () => act(recruit, 'cha', '徴兵'));
  on('c-develop', () => act(develop, 'pol', '開発'));
  on('c-fortify', () => act(fortify, 'int', '築城'));
  on('c-reward', () => { Sound.tap(); showReward(gensAt(S, selected), '褒美'); });
  on('c-scheme', () => { Sound.tap(); showSchemeMenu(selected); });
  on('c-build', () => { Sound.tap(); showBuild(selected); });
  on('c-strike', () => { Sound.tap(); openAttack(null, selected); });
  on('c-plan', () => { Sound.tap(); const pl = attackPlan(S, selected); if (pl) openAttack(null, selected, pl); });
  on('c-debate', () => { Sound.tap(); openDebate(selected); });
  const d = $('c-deleg');
  if (d) d.onchange = () => {
    Sound.tap();
    if (d.checked) S.delegate[selected] = true; else delete S.delegate[selected];
    save();
    render();
  };
  // 武将のカードをタップすると詳細
  panel.querySelectorAll('.gcard').forEach((c) => { c.onclick = () => showGeneral(c.dataset.gid); });
}

// ---------- 舌戦 ----------
function openDebate(id) {
  const envoy = debateEnvoy(S, id);
  if (!envoy || !canDebate(S, id)) return;
  const Dt = startDebate(S, id, envoy);
  save();
  Sound.bgmStart('debate');
  drawDebate(Dt);
}

function drawDebate(Dt) {
  const g = S.gens[Dt.envoy];
  const dg = Dt.dg ? S.gens[Dt.dg] : null;
  const pct = Math.min(100, Math.round((Dt.gauge / Dt.need) * 100));
  const sayLine = (l) => `<p>${l.who === 'me' ? `<b class="me">${esc(g.name)}</b>` : `<b>${dg ? esc(dg.name) : '城兵'}</b>`}「${esc(l.text)}」</p>`;
  const say = Dt.lines.length ? Dt.lines.map(sayLine).join('')
    : `<p><b>${dg ? esc(dg.name) : '城兵'}</b>「${dg ? pick(['何をしに来た。話だけは聞いてやろう', '開城だと？ 笑わせるな', 'ほう、口で城を落とす気か']) : '……誰だ。用件を言え'}」</p>`;
  const read = Dt.read.level === 'clear' ? `🔍 見抜いた！ 相手は「${DEBATE_ARGS[Dt.read.weak].foe}」。「${DEBATE_ARGS[Dt.read.weak].name}」が効く`
    : Dt.read.level === 'guess' ? `🔍 たぶん「${DEBATE_ARGS[Dt.read.weak].foe}」……「${DEBATE_ARGS[Dt.read.weak].name}」が効きそうだ`
    : '🔍 相手の心は読めない';
  const actions = Dt.done
    ? `<button class="btn red" id="db-end">${Dt.done === 'win' ? '開城させる' : '引き上げる'}</button>`
    : `<p class="mt-q">どの論で迫る？<small>あと ${DEBATE.rounds - Dt.round} 回</small></p>
      <div class="mt-choices">${Object.entries(DEBATE_ARGS).map(([k, a]) => `<button class="btn db-arg db-${k}" data-arg="${k}"
        ${k === 'gain' && S.gold[PLAYER] < DEBATE.gainCost ? 'disabled' : ''}><b>${a.name}</b> ${a.full}<small>${a.desc}${Dt.used[k] ? '・二度目は弱い' : ''}</small></button>`).join('')}</div>`;
  openModal(`<div class="meeting debate" data-lock>
      <p class="mt-place">${esc(MAP.byId[Dt.id].name)} 門前 ・ 舌戦</p>
      <div class="mt-stage">
        ${meetingRoom(Dt.owner === 'none' ? PLAYER : Dt.owner)}
        <div class="mt-p left">${portrait(g, 84, Dt.done === 'win' ? 'happy' : Dt.mood.me, 'R')}<span>${esc(g.name)}<small>${pName()}の使者</small></span></div>
        ${dg ? `<div class="mt-p right">${portrait(dg, 84, Dt.done === 'win' ? 'frustrated' : Dt.mood.foe)}<span>${esc(dg.name)}<small>${MAP.byId[Dt.id].short}の守将</small></span></div>` : ''}
        ${Dt.done ? `<div class="mt-stamp ${Dt.done === 'win' ? 'deal' : 'fail'}">${Dt.done === 'win' ? '開 城' : '決 裂'}</div>` : ''}
      </div>
      <div class="mt-say">${say}</div>
      <div class="mt-gauge db-gauge"><span>説得</span><i><b style="width:${pct}%"></b></i><em>${pct}%</em></div>
      ${Dt.done ? '' : `<p class="mt-hint">${read}</p>`}
    </div>
    ${actions}`);
  modalBody.querySelectorAll('[data-arg]').forEach((b) => {
    b.onclick = () => {
      const r = debateStep(S, Dt, b.dataset.arg);
      Sound.debateHit(r.kind);
      if (Dt.done === 'win') Sound.win();
      if (Dt.done === 'lose') Sound.lose();
      if (Dt.done) Sound.stamp(0.35);
      save();
      drawDebate(Dt);
    };
  });
  const end = $('db-end');
  if (end) end.onclick = () => {
    Sound.tap();
    const msg = endDebate(S, Dt);
    save();
    Sound.bgmStart('map');
    closeModal();
    selected = Dt.id;
    render();
    if (Dt.done === 'win') {
      showKime(g, '無血開城', pick(['言葉は刃より強し', '一兵も失わずに済んだな', 'これぞ知の戦よ']), () => toast(esc(msg)), 'smile');
      achievementToast(checkAchievements(S));
    } else toast(esc(msg));
  };
}

// ---------- 決め絵：ここぞの場面で、武将の大きな一枚絵を出す。タップで閉じる ----------
function showKime(g, title, line, then, mood = 'smile', extra = '') {
  if (!g) { if (then) then(); return; }
  let box = $('kime');
  if (!box) {
    box = document.createElement('div');
    box.id = 'kime';
    box.className = 'kime';
    document.body.appendChild(box);
  }
  const nick = nickOf(g);
  box.innerHTML = `<div class="kime-card">
      <div class="kime-title">${esc(title)}</div>
      <div class="kime-frame">
        ${portrait(g, 300, mood)}
        <div class="kime-name"><span>${esc(g.name)}</span>${nick ? `<small>「${esc(nick)}」</small>` : ''}</div>
        <div class="kime-seal">${esc(CLANS[g.clan] ? CLANS[g.clan].name.replace('家', '') : '浪人')}<br>之印</div>
      </div>
      ${line ? `<p class="kime-line">「${esc(line)}」</p>` : ''}${extra}
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(2); Sound.taiko(0.46, 1); Sound.slash(0.5, true);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    box.hidden = true;
    if (then) then();
  };
  setTimeout(() => { box.onclick = () => { Sound.tap(); close(); }; }, 600); // 出てすぐの誤タップを防ぐ
}

// 雲母摺りの札にする武将：当主と、手柄の多い武将
function isLegend(g) {
  if (!g) return false;
  const r = recOf(g);
  return !!g.lord || !!(g.shi && g.shi.done) || r.w + r.cap + r.dw * 2 + r.def >= 10;
}

// 家宝の欄：持っている家宝と、蔵の家宝を持たせるボタン
function treasureBox(g) {
  const mine = g.clan === PLAYER;
  const t = g.treasure && TREASURES[g.treasure];
  const vault = (S.vault || []).filter((id) => TREASURES[id]);
  if (!t && !(mine && vault.length)) return '';
  const kind = (id) => TREASURE_KINDS[TREASURES[id].kind];
  return `<div class="tbox">
    <h3>家宝</h3>
    ${t ? `<div class="titem"><span class="ticon">${kind(g.treasure).icon}</span><div><b>${t.name}</b><small>${kind(g.treasure).desc}</small></div>
      ${mine ? '<button class="btn plain tbtn" id="gd-unequip">外す</button>' : ''}</div>` : ''}
    ${mine && vault.length ? `<p class="hint">蔵の家宝を持たせる：</p>
      <div class="tvault">${vault.map((id) => `<button class="btn tbtn" data-equip="${id}">${TREASURES[id].name}<small class="sub">${kind(id).desc}</small></button>`).join('')}</div>` : ''}
  </div>`;
}

// 列伝：戦歴の番付
function chronicleTable(g, until) {
  const r = recOf(g);
  const seasons = Math.max(0, (until !== undefined ? until : S.turn) - (g.since || 0));
  const cell = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
  return `<div class="chron">
    <h3>列伝</h3>
    <div class="chron-grid">
      ${cell('合戦', `${r.w}勝${r.l}敗`)}${cell('落とした城', r.cap)}${cell('守り抜いた城', r.def)}${cell('一騎打ち', `${r.dw}勝${r.dl}敗`)}
    </div>
    <p class="hint">${seasons ? `在籍 ${Math.floor(seasons / 4) ? `${Math.floor(seasons / 4)}年` : ''}${seasons % 4 ? `${seasons % 4}季` : ''}` : 'この季に入学'}</p>
    ${sagaScroll(g)}
  </div>`;
}

// 卒業生の列伝
function showHall(back) {
  const hall = (S.hall || []).slice().reverse();
  const card = (h) => {
    const g = { ...h, id: 'hall', clan: PLAYER, origin: PLAYER, grade: 3, title: '卒業生', rec: h.rec };
    return `<div class="hall-row">
      ${portrait(g, 56, 'smile')}
      <div>
        <b>${esc(h.name)}${h.lord ? '<span class="lord">当主</span>' : ''}</b>
        ${h.nick ? `<span class="nick">「${esc(h.nick)}」</span>` : ''}
        <small>${dateLabel(h.since)}〜${dateLabel(h.until)}・合戦${h.rec.w}勝${h.rec.l}敗・落城${h.rec.cap}・一騎打ち${h.rec.dw}勝${h.visits ? `・<b class="ob-count">帰校 ${h.visits}回</b>` : ''}</small>
        <em>「${esc(h.words)}」</em>
      </div>
    </div>`;
  };
  openModal(`<h2>卒業生の列伝</h2>
    ${hall.length ? `<div class="hall">${hall.map(card).join('')}</div>` : '<p class="hint" style="text-align:center">まだ卒業生はいない。春が来るたびに、3年生がここに名を残す。</p>'}
    <button class="btn plain" id="hall-back">もどる</button>`);
  $('hall-back').onclick = () => { Sound.tap(); (back || closeModal)(); };
}

// 志の札：何を誓ったか、どこまで来たか
function shiBox(g) {
  const h = g.shi;
  if (!h || !SHI[h.kind]) return '';
  const [cur, need] = shiProgress(g);
  const dots = need > 1 && !h.done ? `<span class="shi-dots">${Array.from({ length: need }, (_, i) => `<i class="${i < cur ? 'on' : ''}"></i>`).join('')}</span>` : '';
  return `<div class="shi-box ${h.done ? 'done' : ''}"><span>志</span><div><b>${esc(SHI[h.kind].name)}${h.done ? '<em>成就</em>' : ''}</b>
    <small>${esc(shiText(S, g))}</small>${dots}${!h.done && ['bokou', 'castle'].includes(h.kind) ? '<small class="shi-tip">この城を大将として攻めると、士気が上がる</small>' : ''}</div></div>`;
}

function showGeneral(gid) {
  const g = S.gens[gid];
  Sound.tap();
  openModal(`<div class="gdetail">
      ${portrait(g, 96)}
      <h2>${esc(g.name)}</h2>
      ${nickOf(g) ? `<p class="nick-big">「${esc(nickOf(g))}」</p>` : ''}
      ${shiBox(g)}
      ${(() => { const rv = rivalOf(S, g); return rv ? `<p class="rival-line">宿敵：<b>${esc(rv.g.name)}</b>（${CLANS[rv.g.clan] ? CLANS[rv.g.clan].name : '浪人'}・${rv.n}度の対決）</p>` : ''; })()}
      ${bondsOf(S, g).map((bd) => { const o = S.gens[bd.other]; return o ? `<p class="bond-line"><span>${BOND_TYPES[bd.type].name}</span><b>${esc(o.name)}</b>${bd.type === 'shitei' ? (bd.a === g.id ? '（弟子）' : '（師）') : ''}<small>${BOND_TYPES[bd.type].desc}</small></p>` : ''; }).join('')}
      <p class="hint">${esc(g.title)}（${MAP.byId[g.school].name}出身）${g.lord ? `・${pName()}当主` : ''}</p>
      <p class="hint">${gradeTag(g)}${g.grade >= 3 ? '次の春に卒業' : `卒業まであと${4 - g.grade}回の春`}</p>
      <div class="gstats">
        ${['str', 'pol', 'cha', 'int'].map((k) => `<div><span>${STAT_NAMES[k]}</span><i style="width:${g[k]}%"></i><b>${g[k]}</b></div>`).join('')}
      </div>
      ${g.clan === PLAYER && !g.lord ? `<div class="gstats"><div><span>忠誠</span><i class="loyal-bar ${g.loyal < LOYAL.leaveBelow ? 'low' : ''}" style="width:${g.loyal}%"></i><b>${g.loyal}</b></div></div>
        <p class="hint">${g.loyal < LOYAL.rebelBelow ? '謀反を起こすおそれがある！' : g.loyal < LOYAL.leaveBelow ? '出奔するおそれがある' : g.loyal >= 80 ? '忠義に厚い' : 'まずまずの忠誠'}</p>` : ''}
      ${g.club && CLUBS[g.club] ? `<p><span class="club">${CLUBS[g.club].name}</span> ${CLUBS[g.club].desc}</p>` : ''}
      ${g.skill ? `<p><span class="skill">${SKILLS[g.skill].name}</span> ${SKILLS[g.skill].desc}</p>` : '<p class="hint">特技なし</p>'}
      ${g.skill && ARTS[g.skill] ? `<p class="hint">戦法「${ARTS[g.skill].name}」：${ARTS[g.skill].desc}</p>` : ''}
      ${treasureBox(g)}
      ${chronicleTable(g)}
    </div>
    ${canReward(S, g) ? `<button class="btn red" id="gd-reward">褒美を与える（金${LOYAL.rewardCost}）</button>` : ''}
    ${g.clan === PLAYER ? '<button class="btn plain" id="gd-rename">名を改める</button>' : ''}
    <button class="btn plain" data-close>閉じる</button>`);
  if ($('gd-rename')) $('gd-rename').onclick = () => {
    Sound.tap();
    openModal(`<h2>名を改める</h2>
      <p style="text-align:center">${portrait(g, 72)}</p>
      <input class="name-input" id="rn-name" maxlength="10" value="${esc(g.name)}" autocomplete="off">
      <p class="hint">姓と名のあいだは空白（例：山田 太郎）</p>
      <button class="btn red" id="rn-ok">改める</button>
      <button class="btn plain" id="rn-back">やめる</button>`);
    $('rn-back').onclick = () => { Sound.tap(); showGeneral(gid); };
    $('rn-ok').onclick = () => {
      const v = $('rn-name').value.trim();
      if (v) {
        if (g.lord && S.lords && S.lords.length && S.lords[S.lords.length - 1].name === g.name) S.lords[S.lords.length - 1].name = v; // 歴代当主の記録も
        g.name = v;
        save(); render();
      }
      Sound.tap();
      showGeneral(gid);
    };
  };
  modalBody.querySelectorAll('[data-equip]').forEach((b) => {
    b.onclick = () => {
      Sound.kira();
      equipTreasure(S, gid, b.dataset.equip);
      save(); render(); showGeneral(gid);
      toast(`${esc(g.name)}に「${TREASURES[g.treasure].name}」を持たせた`);
    };
  });
  if ($('gd-unequip')) $('gd-unequip').onclick = () => {
    Sound.tap();
    unequipTreasure(S, gid);
    save(); render(); showGeneral(gid);
  };
  if ($('gd-reward')) $('gd-reward').onclick = () => {
    const gain = reward(S, gid);
    save();
    render();
    showGeneral(gid);
    toast(`${esc(g.name)}に褒美を与えた。忠誠+${gain}`);
  };
}

// ---------- タップ ----------
function onCastleTap(id) {
  Sound.unlock();
  Sound.tap();
  if (mode) {
    if (modeTargets().includes(id)) {
      if (mode.kind === 'attack') openAttack(mode.from, id);
      else if (mode.kind === 'siege') openSiege(mode.from, id);
      else if (mode.kind === 'scheme') openSchemeTarget(id);
      else if (mode.kind === 'move') openMove(mode.from, id);
      else doMoveGeneral(mode.gid, id);
    } else {
      mode = null;
      selected = id;
      render();
    }
    return;
  }
  selected = selected === id ? null : id;
  render();
}

// ---------- 武将の移動 ----------
function chooseGeneralToMove(from) {
  const gens = idleGensAt(S, from);
  if (gens.length === 1) { mode = { kind: 'gen', from, gid: gens[0].id }; render(); return; }
  openModal(`<h2>誰を移す？</h2>
    <div class="glist pick">${gens.map((g) => genCard(g)).join('')}</div>
    <button class="btn plain" data-close>やめる</button>`);
  modalBody.querySelectorAll('.gcard').forEach((c) => {
    c.onclick = () => { Sound.tap(); closeModal(); mode = { kind: 'gen', from, gid: c.dataset.gid }; render(); };
  });
}

function doMoveGeneral(gid, to) {
  moveGeneral(S, gid, to);
  S.acted[gid] = true;
  mode = null;
  selected = to;
  save();
  render();
  toast(`${portrait(S.gens[gid], 30)}<span>${esc(S.gens[gid].name)}が${MAP.byId[to].short}へ移った</span>`);
}

// ---------- 出陣 ----------
// 兵力比から、おまかせで戦ったときの勝つ見込み（多くの合戦を試して測った値をつないだもの）
const ODDS_CURVE = [[0.4, 0.02], [0.6, 0.1], [0.7, 0.16], [0.8, 0.32], [0.9, 0.48], [1.0, 0.7], [1.1, 0.85], [1.2, 0.89], [1.3, 0.96], [1.4, 0.98], [1.5, 0.995]];
function winChance(ratio) {
  const c = ODDS_CURVE;
  if (ratio <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (ratio <= c[i][0]) {
      const [x0, y0] = c[i - 1], [x1, y1] = c[i];
      return y0 + ((y1 - y0) * (ratio - x0)) / (x1 - x0);
    }
  }
  return c[c.length - 1][1];
}
function oddsLabel(p) {
  if (p >= 0.93) return ['勝算大', 'var(--wakatake)'];
  if (p >= 0.8) return ['勝算あり', '#6f8f2e'];
  if (p >= 0.6) return ['やや有利', 'var(--gold)'];
  if (p >= 0.4) return ['五分五分', '#c46a1a'];
  if (p >= 0.2) return ['不利', 'var(--red)'];
  return ['勝ち目うすし', '#8c1c18'];
}
// ---------- 危うい城への援兵 ----------
// 守り切る見込みが85%に届くよう、となりの自分の城から兵を送る案を作る
const SAFE_KEEP = 0.85;
const SAFE_RATIO = 0.683; // winChance(この比) ≒ 0.15
// その城の兵1人あたりの守りの力（兵が0でも測れるよう、仮に1000人で測る）
function defPerTroop(s, id) {
  const c = s.castles[id], t = c.troops;
  c.troops = 1000;
  const p = defensePower(s, id) / 1000;
  c.troops = t;
  return p;
}
// 見込みを85%にするのに要る兵（今より何人多く要るか。足りていれば0以下）
function troopsShort(s, id) {
  const th = dangerOf(s, id, winChance);
  if (!th) return -Infinity;
  const attack = th.ratio * Math.max(1, defensePower(s, id));
  return Math.ceil(attack / SAFE_RATIO / defPerTroop(s, id)) - s.castles[id].troops;
}
function reinforcePlan(s, id) {
  const th = dangerOf(s, id, winChance);
  if (!th || th.keep >= SAFE_KEEP) return null;
  const need = troopsShort(s, id);
  const room = RULES.troopCap - s.castles[id].troops;
  const donors = MAP.adj[id].filter((n) => s.castles[n].owner === PLAYER && !s.delegate[n] && idleGensAt(s, n).length && readyTroops(s, n) > 0)
    .map((n) => {
      // 送る側も、送ったあと危うくならない分だけ出す
      const short = troopsShort(s, n);
      const spare = short === -Infinity ? readyTroops(s, n) : Math.min(readyTroops(s, n), -short);
      return { from: n, spare: Math.floor(spare / 10) * 10 };
    }).filter((d) => d.spare >= 10);
  if (!donors.length) return null;
  const best = donors.reduce((a, b) => (a.spare >= b.spare ? a : b));
  const amount = Math.min(best.spare, room, Math.ceil(need / 10) * 10);
  if (amount < 10) return null;
  const c = s.castles[id];
  c.troops += amount;
  const after = dangerOf(s, id, winChance).keep;
  c.troops -= amount;
  if (amount < need && after < th.keep + 0.08) return null; // ほとんど変わらない案は出さない
  return { from: best.from, to: id, amount, before: th.keep, after, enough: amount >= need };
}
const pctOf = (p) => Math.min(99, Math.max(1, Math.round(p * 20) * 5));

// ---------- 攻めの提案 ----------
// 敵の城を、となりの自分の城から攻める案。兵と大将は出陣画面の初めの値と同じ（兵の8割・統率の一番高い武将）
// 勝算あり（8割）に届かなければ、となりの城から援軍を足していく。送り出したあとの自分の城の守りも測る
const GOOD_ODDS = 0.8;
function attackPlan(s, to) {
  const c = s.castles[to];
  if (c.owner === PLAYER) return null;
  const srcs = attackSources(to);
  if (!srcs.length) return null;
  const power = Math.max(1, defensePower(s, to));
  const sendOf = (id) => { const max = readyTroops(s, id); return Math.min(max, Math.round((max * 0.8) / 10) * 10 || max); };
  const plans = srcs.map((from) => {
    const g = bestBy(idleGensAt(s, from), 'str');
    const n = sendOf(from);
    const mult = atkMult(g) * atkKakun(s, PLAYER) * seaPower(from, to, g); // 海越えは見込みも下がる
    const support = [];
    let total = n;
    const sups = supportCastles(s, PLAYER, to, from).filter((id) => !s.delegate[id])
      .map((id) => ({ from: id, n: Math.floor(readyTroops(s, id) * 0.8), gid: bestBy(idleGensAt(s, id), 'str').id }))
      .sort((a, b) => b.n - a.n);
    for (const sp of sups) {
      if (winChance((total * mult) / power) >= GOOD_ODDS) break;
      support.push(sp);
      total += sp.n;
    }
    const p = winChance((total * mult) / power);
    // 出陣したあと、送り出した城がどれだけ危うくなるか（いちばん危うい城）
    let leftKeep = 1, weak = null;
    [{ from, n }, ...support].forEach((part) => {
      const pc = s.castles[part.from];
      pc.troops -= part.n;
      const th = dangerOf(s, part.from, winChance);
      pc.troops += part.n;
      if (th && th.keep < leftKeep) { leftKeep = th.keep; weak = part.from; }
    });
    return { to, from, gid: g.id, n, support, total, p, leftKeep, weak };
  });
  // 勝てる見込みの高い案。並ぶなら、援軍の少ない・後ろが危うくならない案
  return plans.reduce((a, b) => (b.p > a.p + 0.01 || (Math.abs(b.p - a.p) <= 0.01 && (b.support.length < a.support.length || (b.support.length === a.support.length && b.leftKeep > a.leftKeep))) ? b : a));
}
// 勝算があり、送り出しても自分の城が危うくならない攻め口（本拠・勝算・経済の順）
const goodAttack = (pl) => pl && pl.p >= GOOD_ODDS && pl.leftKeep >= 0.5;
function attackChances(s) {
  return Object.keys(s.castles).filter((id) => s.castles[id].owner !== PLAYER).map((id) => attackPlan(s, id)).filter(goodAttack)
    .sort((a, b) => (isCapital(b.to, s.castles[b.to].owner) - isCapital(a.to, s.castles[a.to].owner)) || (b.p - a.p) || (s.castles[b.to].eco - s.castles[a.to].eco));
}
// 危うい城すべてに、送れるだけ援兵を送る（危うい順）
function bulkReinforce() {
  Sound.tap();
  const ids = castlesOf(S, PLAYER).map((id) => [id, dangerOf(S, id, winChance)]).filter(([, t]) => t && t.keep < SAFE_KEEP)
    .sort((a, b) => a[1].keep - b[1].keep).map(([id]) => id);
  const done = [];
  ids.forEach((id) => {
    const plan = reinforcePlan(S, id);
    if (!plan) return;
    const g = idleGensAt(S, plan.from).sort((a, b) => a.str - b.str)[0];
    moveTroops(S, plan.from, plan.to, plan.amount);
    S.arrived = S.arrived || {};
    S.arrived[plan.to] = (S.arrived[plan.to] || 0) + plan.amount;
    S.acted[g.id] = true;
    done.push(`${MAP.byId[plan.to].short}へ${fmt(plan.amount)}`);
  });
  save();
  render();
  toast(done.length ? `援兵を送った：${done.join('・')}` : '送れる兵がなかった');
}
function doReinforce(id) {
  const plan = reinforcePlan(S, id);
  if (!plan) return;
  Sound.tap();
  const g = idleGensAt(S, plan.from).sort((a, b) => a.str - b.str)[0];
  moveTroops(S, plan.from, plan.to, plan.amount);
  S.arrived = S.arrived || {};
  S.arrived[plan.to] = (S.arrived[plan.to] || 0) + plan.amount;
  S.acted[g.id] = true;
  save();
  render();
  toast(`${esc(g.name)}が${MAP.byId[plan.from].short}から${fmt(plan.amount)}兵を送った<br><b>守り切る見込み 約${pctOf(plan.before)}% → 約${pctOf(plan.after)}%</b>`);
}

// plan：攻めの提案（attackPlan）から来たときは、その出陣元・大将・援軍を選んだ状態で開く
function openAttack(from, to, plan = null) {
  tutAdvance(4);
  const srcs = from ? [from] : attackSources(to);
  let src = plan ? plan.from : srcs.reduce((a, b) => (readyTroops(S, a) >= readyTroops(S, b) ? a : b));
  let gid = plan ? plan.gid : null;
  let amount = 0;
  let support = {}; // 援軍 { castleId: true }
  if (plan) plan.support.forEach((p) => { support[p.from] = true; });
  let tactic = 'auto';
  const t = S.castles[to];
  const power = defensePower(S, to);
  const dg = defLeader(S, to);
  const enemyTactic = aiTactic(S, to); // 守る側の作戦はこの時点で決まっている
  const guesses = {};                  // 大将ごとの「読み」（開き直しても変わらないように）
  const guessOf = (g) => (g.id in guesses ? guesses[g.id] : (guesses[g.id] = readTactic(S, g, to, enemyTactic)));
  const atkLabel = (k) => TACTICS[k].atkName || TACTICS[k].name;

  function supportList() {
    return supportCastles(S, PLAYER, to, src).filter((id) => !S.delegate[id]);
  }
  function supportParts() {
    return supportList().filter((id) => support[id]).map((id) => ({
      from: id, n: Math.floor(readyTroops(S, id) * 0.8), gid: bestBy(idleGensAt(S, id), 'str').id,
    }));
  }

  function update() {
    const g = S.gens[gid];
    const total = amount + supportParts().reduce((a, p) => a + p.n, 0);
    const ratio = (total * atkMult(g) * atkKakun(S, PLAYER) * seaPower(src, to, g)) / Math.max(1, power);
    // 作戦：読みが当たっている前提で、読み勝ちなら有利、読み負けなら不利に見積もる
    const gs = guessOf(g);
    const tr = tactic !== 'auto' && gs ? tacticResult(tactic, gs) : 0;
    const p = winChance(ratio + (tr > 0 ? 0.15 : tr < 0 ? -0.1 : 0));
    const odds = oddsLabel(p);
    $('amt-v').textContent = fmt(amount);
    $('total-v').textContent = fmt(total);
    $('odds').innerHTML = `<span class="o-lab" style="color:${odds[1]}">${odds[0]}</span>
      <span class="o-bar"><i style="width:${Math.round(p * 100)}%;background:${odds[1]}"></i></span>
      <small>おまかせで戦ったときの見込み 約${Math.min(99, Math.max(1, Math.round(p * 20) * 5))}%${tr > 0 ? "（読みどおりなら作戦で有利）" : tr < 0 ? "（この作戦は敵の構えに弱い）" : ""}</small>`;
  }

  function draw() {
    const max = readyTroops(S, src);
    amount = Math.min(max, Math.round((max * 0.8) / 10) * 10 || max);
    const gens = idleGensAt(S, src).sort((a, b) => b.str - a.str);
    // 志の城：この城を落とすと誓った武将（いれば、はじめから大将に選んでおく）
    const sworn = (g) => g.shi && !g.shi.done && ['bokou', 'castle'].includes(g.shi.kind) && g.shi.target === to;
    if (!gens.find((g) => g.id === gid)) gid = (gens.find(sworn) || gens[0]).id;
    const sup = supportList();
    openModal(`<h2>${MAP.byId[to].name} 攻め</h2>
      <p style="text-align:center;margin:0 0 6px">${clanChip(t.owner)}<br>守備 <b>${fmt(t.troops)}</b> 兵 × 防御 <b>${t.def.toFixed(1)}</b><br>
      守将：${dg ? `<b>${esc(dg.name)}</b>（統${dg.str} 知${dg.int}${dg.skill ? '・' + SKILLS[dg.skill].name : ''}）` : 'なし'}</p>
      ${srcs.length > 1 ? `<h3>出陣する城</h3><div class="src-list">${srcs.map((id) =>
        `<button data-src="${id}" class="${id === src ? 'on' : ''}"><span>${MAP.byId[id].name}</span><span>兵 ${fmt(readyTroops(S, id))}</span></button>`).join('')}</div>` : ''}
      ${arrivedTroops(S, src) ? `<p class="hint">🚚 ${MAP.byId[src].short}に到着したばかりの ${fmt(arrivedTroops(S, src))} 兵は、今季は出陣できません</p>` : ''}
      <h3>大将</h3>
      <div class="glist pick">${gens.map((g) => genCard(g, { extra: (sworn(g) ? '<span class="shi-tag">志</span>' : '') + (g.id === gid ? '<span class="check">✔</span>' : '') })).join('')}</div>
      ${seaRoute(src, to) ? `<p class="sea-hint"><b>海</b>${hasSuigun(S.gens[gid]) ? `${esc(S.gens[gid].name)}は水軍の将。海を越える攻めで、かえって有利（士気+${SEA.suigunMorale}）` : `海を越える攻め。攻め手は不利（士気-${SEA.morale}）。水軍の特技を持つ大将なら有利になる`}</p>` : ''}
      ${sworn(S.gens[gid]) ? `<p class="shi-hint"><b>志</b>${esc(S.gens[gid].name)}が「${esc(shiText(S, S.gens[gid]))}」と誓った城。士気+${SHI_MORALE}、落とせば覚醒</p>` : ''}
      <h3>出陣する兵（${MAP.byId[src].short}）</h3>
      <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v"></b></div>
      ${sup.length ? `<h3>援軍</h3><div class="src-list">${sup.map((id) => {
        const bg = bestBy(idleGensAt(S, id), 'str');
        return `<button data-sup="${id}" class="${support[id] ? 'on' : ''}"><span>${support[id] ? '☑' : '☐'} ${MAP.byId[id].short}（${esc(bg.name)}）</span><span>兵 ${fmt(Math.floor(readyTroops(S, id) * 0.8))}</span></button>`;
      }).join('')}</div>` : ''}
      <h3>作戦</h3>
      <div class="tactics">${[...Object.keys(TACTICS), 'auto'].map((k) => `<button data-tac="${k}" class="${k === tactic ? 'on' : ''}">
        <b>${k === 'auto' ? 'おまかせ' : atkLabel(k)}</b><small>${k === 'auto' ? '運を天に任せる' : `${TACTICS[TACTICS[k].beats].name}に強い`}</small></button>`).join('')}</div>
      <p class="guess">${(() => {
        const gs = guessOf(S.gens[gid]);
        return gs ? `🔍 ${esc(S.gens[gid].name)}の読み：敵は<b>「${TACTICS[gs].name}」</b>の構えのようです`
          : '敵の作戦は読めない（知略の高い大将なら読めることがある）';
      })()}</p>
      <p class="total">総勢 <b id="total-v"></b> 兵</p>
      <div class="odds" id="odds"></div>
      ${S.tut === 4 ? `<div class="tut-hint">${portrait(SENSEI, 32)}<span>${TUT[4].text}</span></div>` : ''}
      <button class="btn red" id="go">出 陣 ！</button>
      <button class="btn plain" data-close>やめる</button>`);
    // 選び直しても、スクロール位置と兵の数はそのまま
    const redraw = () => { const top = modalBody.scrollTop; const a = amount; draw(); amount = a; $('amt').value = a; update(); modalBody.scrollTop = top; };
    modalBody.querySelectorAll('[data-src]').forEach((b) => { b.onclick = () => { Sound.tap(); src = b.dataset.src; support = {}; draw(); }; });
    modalBody.querySelectorAll('[data-sup]').forEach((b) => {
      b.onclick = () => { Sound.tap(); support[b.dataset.sup] = !support[b.dataset.sup]; redraw(); };
    });
    modalBody.querySelectorAll('.glist.pick .gcard').forEach((c) => {
      c.onclick = () => { Sound.tap(); gid = c.dataset.gid; redraw(); };
    });
    modalBody.querySelectorAll('[data-tac]').forEach((b) => {
      b.onclick = () => { Sound.tap(); tactic = b.dataset.tac; redraw(); };
    });
    $('amt').oninput = (e) => { amount = +e.target.value; update(); };
    update();
    $('go').onclick = () => {
      const a = tactic === 'auto' ? pick(Object.keys(TACTICS)) : tactic;
      const B = startBattle(S, { from: src, to, n: amount, gid, support: supportParts(), tactic: { a, d: enemyTactic }, playerSide: 'a' });
      mode = null;
      closeModal();
      runBattle(B, {
        auto: getSettings().attackMode === 'auto',
        onClose: (r) => {
          selected = r.won ? to : src;
          render();
          tutAdvance(5);
          achievementToast(checkAchievements(S));
          if (S.result) showEnding();
        },
      });
    };
  }
  draw();
}

// ---------- 設定 ----------
const SETTINGS_KEY = 'azabu-settings';
function getSettings() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) {}
  return Object.assign({ attackMode: 'command', defenseMode: 'command', speed: 'normal', tips: 'on', hyojo: 'season' }, v);
}
function setSetting(k, v) {
  const s = getSettings();
  s[k] = v;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}

function showSettings() {
  const st = getSettings();
  const row = (key, label, opts, note) => `<h3>${label}</h3>
    <div class="seg-row">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" class="${st[key] === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="hint">${note}</p>`;
  openModal(`<h2>設 定</h2>
    ${row('attackMode', '攻める合戦', [['command', '采配する'], ['auto', 'おまかせ']], '「おまかせ」にすると、出陣したあとは自動で決着します。')}
    ${row('defenseMode', '守りの合戦', [['command', '采配する'], ['auto', 'おまかせ']], '「采配する」にすると、敵に攻められたとき「敵襲！」として迎え撃てます。委任中の城は自動で守ります。')}
    ${row('speed', '合戦の演出', [['normal', 'ふつう'], ['fast', '速い']], '')}
    ${row('hyojo', '評定', [['season', '毎季'], ['year', '年に一度'], ['off', '開かない']], '季のはじめに家臣がそろって献策します。軍議の「評定」からいつでも開けます。')}
    ${row('tips', '軍師の献策', [['on', '受ける'], ['off', '受けない']], '新しい場面が来たとき、軍師が一度だけ心得を教えます。')}
    <button class="btn plain" id="tips-reset">献策をはじめから聞き直す</button>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-set]').forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      setSetting(b.dataset.set, b.dataset.v);
      modalBody.querySelectorAll(`[data-set="${b.dataset.set}"]`).forEach((x) => x.classList.toggle('on', x === b));
      if (S) renderCoach();
    };
  });
  $('tips-reset').onclick = () => {
    Sound.tap();
    try { localStorage.removeItem(TIPS_KEY); } catch (e) {}
    setSetting('tips', 'on');
    modalBody.querySelectorAll('[data-set="tips"]').forEach((x) => x.classList.toggle('on', x.dataset.v === 'on'));
    toast('献策をはじめから聞き直します');
    if (S) renderCoach();
  };
}

// ---------- 合戦（1合ずつ采配する） ----------
// B = startBattle() で作った合戦。auto = おまかせで進める
// 墨の一閃：合戦のはじまりに、太い筆の一画が画面を横切り「合戦」と城の名
// hero を渡すと、その武将の大首絵が滑り込み、名乗りを上げる（自分の家の合戦）
function inkCut(title, sub, hero = null, line = '') {
  const d = document.createElement('div');
  d.className = hero ? 'ink-cut hero' : 'ink-cut';
  d.innerHTML = `<svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path class="ink-band" d="M-10,70 C60,40 120,52 200,46 C280,40 340,30 410,44 L410,92 C330,78 270,96 200,94 C120,92 60,104 -10,96Z"/></svg>
    ${hero ? `<div class="ic-hero">${portrait(hero, 128, 'angry', 'R')}</div>` : ''}
    <div class="ic-text"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${hero && line ? `<p>${esc(hero.name)}「${esc(line)}」</p>` : ''}</div>`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), hero ? 2100 : 1500);
}
function runBattle(B, { auto = false, onClose } = {}) {
  {
    // 自分の家の合戦なら、こちらの大将が名乗りを上げる
    const heroG = B.playerSide === 'a' ? S.gens[B.gid] : B.playerSide === 'd' && B.dgid ? S.gens[B.dgid] : null;
    inkCut(B.decisive ? '決　戦' : '合　戦', MAP.byId[B.to] ? MAP.byId[B.to].name : '', heroG, heroG ? duelCall(heroG) : '');
  }
  const box = $('battle');
  const me = B.playerSide, foe = me === 'a' ? 'd' : 'a';
  const fast = getSettings().speed === 'fast';
  const wait = (ms) => (fast ? ms * 0.45 : ms);
  const g = S.gens[B.gid], dg = B.dgid ? S.gens[B.dgid] : null;
  const defense = me === 'd';
  const supNames = (B.support || []).map((p) => S.gens[p.gid].name);
  const tac = B.tactic
    ? `<div class="b-tactic">${shortName(B.attacker)}「${TACTICS[B.tactic.a].atkName || TACTICS[B.tactic.a].name}」 対 ${shortName(B.defender)}「${TACTICS[B.tactic.d].name}」
       <b class="${B.tr > 0 ? 'good' : B.tr < 0 ? 'bad' : ''}">${B.tr > 0 ? '── 読み勝った！' : B.tr < 0 ? '── 読まれていた…' : '── 互角'}</b></div>`
    : '';
  const sideHtml = (sd) => {
    const gen = sd === 'a' ? g : dg;
    const clan = B[sd].clan;
    const info = gen
      ? `${sd === 'd' ? '' : portrait(gen, 40, null, 'R')}<div><b>${esc(gen.name)}</b><small>統率${gen.str}${gen.club && CLUBS[gen.club] ? `・${CLUBS[gen.club].name}` : ''}${sd === 'a' && supNames.length ? `・援軍${supNames.length}` : ''}</small></div>${sd === 'd' ? portrait(gen, 40) : ''}`
      : '<div><b>守将なし</b><small>&nbsp;</small></div>';
    return `<div class="b-side ${sd === 'a' ? 'left' : 'right'}" style="--c:${CLANS[clan].color}">
      <div class="b-gen">${info}</div>
      <div class="bar"><i id="bar-${sd}" style="width:100%"></i></div>
      <div class="b-nums"><span class="num" id="num-${sd}">${fmt(B[sd].troops)}</span><span class="st" id="st-${sd}"></span></div>
      <div class="bar morale"><i id="mbar-${sd}"></i></div>
      <small class="mtxt" id="mor-${sd}"></small>
    </div>`;
  };
  box.innerHTML = `
    <div class="b-head"><div class="b-title ${B.decisive ? 'decisive' : ''}">${B.decisive ? '決 戦' : defense ? '籠 城 戦' : '合 戦'}</div>
      <div class="b-sub">${MAP.byId[B.to].name}の戦い${defense ? `（${pShort()}の守り）` : ''}
        <span class="b-wx" title="${WEATHER[B.weather].desc}">${WEATHER[B.weather].icon} ${WEATHER[B.weather].name}</span></div>${tac}${B.bond && B.bond.side === me ? `<div class="b-tactic b-bond">絆の力：${esc(B.bond.a)}と${esc(B.bond.b)}（${BOND_TYPES[B.bond.type].name}）が並ぶ！ 士気+${BOND_MORALE}</div>` : ''}${B.shi && me === 'a' ? `<div class="b-tactic b-shi">志の城：${esc(B.shi.name)}が誓いの城に挑む！ 士気+${SHI_MORALE}</div>` : ''}${B.sea ? `<div class="b-tactic b-sea">${B.sea.suigun ? `水軍：${esc(B.sea.name)}の船団が海を越えて攻め寄せる！ 攻め手の士気+${SEA.suigunMorale}` : `渡海：海を越えての攻め。攻め手の士気-${SEA.morale}`}</div>` : ''}</div>
    <div class="b-field">
      ${battleScene(B, S.turn)}
      <div class="b-cut" id="b-cut"></div>
      <div class="spark" id="spark"></div>
      <div class="stamp" id="stamp"></div>
    </div>
    <div class="b-bars">${sideHtml('a')}${sideHtml('d')}</div>
    <p class="b-round" id="round">いざ、尋常に勝負！</p>
    <div class="b-report" id="b-report"></div>
    <div class="b-cmds" id="b-cmds"></div>
    <div class="b-foot" id="b-foot">
      <button class="btn plain" id="b-auto">おまかせで決着</button>
      <button class="btn plain" id="b-skip">結果まで飛ばす</button>
    </div>
    <div class="duel" id="duel" hidden></div>`;
  box.hidden = false;
  Sound.horagai();
  Sound.bgmStart('battle');

  const fall = (id, ratio) => {
    const sols = [...document.querySelectorAll(`#${id} .sol`)];
    const alive = Math.ceil(sols.length * ratio);
    sols.forEach((el, k) => el.classList.toggle('down', k >= alive));
  };
  const updateBars = () => {
    ['a', 'd'].forEach((sd) => {
      const x = B[sd];
      $(`bar-${sd}`).style.width = `${(x.troops / x.start) * 100}%`;
      $(`num-${sd}`).textContent = fmt(x.troops);
      $(`mbar-${sd}`).style.width = `${x.morale}%`;
      $(`mbar-${sd}`).classList.toggle('low', x.morale < 30);
      $(`mor-${sd}`).textContent = `士気 ${x.morale}`;
      const tags = [];
      if (x.confused > 0) tags.push('混乱');
      if (x.wall > 0) tags.push('守り固め');
      if (x.starve > 0) tags.push('兵糧不足');
      $(`st-${sd}`).textContent = tags.join('・');
    });
    fall('army-a', B.a.troops / B.a.start);
    fall('army-d', B.d.troops / B.d.start);
  };
  const replay = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
  const report = (lines) => { $('b-report').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join(''); };
  // 兵の動き：両軍が間合いを詰めてぶつかり、討たれた数が浮かび、押した側へ前線が動く
  // front：前線のずれ（＋は守り手の城の側へ押している）。合ごとに積み重なる
  let front = 0;
  const FRONT_A = 150, GAP = 70; // 攻め手の先頭の x と、両軍の先頭のあいだ
  const place = (A, D, da, dd) => { A.style.transform = `translateX(${da.toFixed(1)}px)`; D.style.transform = `translateX(${dd.toFixed(1)}px)`; };
  const animate = (prev = { a: B.a.troops, d: B.d.troops }, act = {}) => {
    const A = $('army-a'), D = $('army-d');
    const kind = (sd) => { const c = act[sd] || ''; return c.startsWith('art:') ? 'art' : c; };
    const reach = (sd) => ({ charge: 58, art: 48, attack: 40, scheme: 22, guard: 10, confused: 6 })[kind(sd)] || 30;
    const ra = reach('a'), rd = reach('d');
    const da = front + (GAP * ra) / (ra + rd), dd = front - (GAP * rd) / (ra + rd);
    const meet = FRONT_A + da + 6; // ぶつかる所
    const lossA = Math.max(0, prev.a - B.a.troops), lossD = Math.max(0, prev.d - B.d.troops);
    // 1) 間合いを詰める（足軽が小走りに揺れる）
    [A, D].forEach((x) => x.classList.add('march'));
    place(A, D, da, dd);
    $('bf-arrows').innerHTML = arrowVolley(B.round % 2 === 1);
    // 2) ぶつかる：火花・土煙・討たれた数
    setTimeout(() => {
      if (!A.isConnected) return;
      $('bf-arrows').insertAdjacentHTML('beforeend', meleeMarkup(meet, lossA, lossD, FRONT_A - 45 + da, 280 + dd));
      const dust = $('bf-dust');
      dust.style.transform = `translateX(${(meet - 192).toFixed(1)}px)`;
      replay(dust, 'go');
      replay($('spark'), 'go');
      replay(box, 'shake');
      Sound.clash(0.02);
      updateBars();
    }, wait(420));
    // 3) 押した側へ前線が動き、にらみ合いの間合いに戻る
    setTimeout(() => {
      if (!A.isConnected || B.over) return;
      front = clamp(front + clamp(((lossD / Math.max(1, B.d.start)) - (lossA / Math.max(1, B.a.start))) * 260, -18, 18), -48, 48);
      [A, D].forEach((x) => x.classList.remove('march'));
      place(A, D, front + 14, front - 14);
      const fl = $('bf-front');
      if (fl) {
        fl.setAttribute('transform', `translate(${(FRONT_A + 41 + front).toFixed(1)},0)`);
        fl.dataset.push = front > 6 ? 'a' : front < -6 ? 'd' : '';
      }
    }, wait(950));
  };
  // 決着の動き：勝てば城へなだれ込み、負ければ退く
  const settle = (won) => {
    const A = $('army-a'), D = $('army-d');
    if (!A) return;
    A.classList.remove('march');
    A.style.transition = 'transform 1.2s ease-in, opacity 1.2s';
    if (won) { A.style.transform = `translateX(${front + 110}px)`; D.style.opacity = '0.25'; }
    else { A.style.transform = `translateX(${front - 80}px)`; A.style.opacity = '0.35'; }
  };
  updateBars();
  const openLines = [defense
    ? `${CLANS[B.attacker].name}の${g.name}が攻めてきた！ 城を守り抜け！`
    : `${g.name}が${fmt(B.a.start)}兵を率いて出陣！`];
  if (B.weather !== 'sun') openLines.push(`${WEATHER[B.weather].icon} ${WEATHER[B.weather].name}：${WEATHER[B.weather].desc}`);
  if (B.decisive) {
    // 決戦：本拠を守る大将の名乗り
    const lordD = dg ? dg.name : '城兵';
    const isLord = dg && aiLordOf(S, B.defender) === dg;
    openLines.unshift(isLord ? `${CLANS[B.defender].name}当主・${lordD}「${lordVoice(B.defender).guard}」` : `${lordD}「ここは${CLANS[B.defender].name}の本拠・${MAP.byId[B.to].short}！ 一歩たりとも通さぬ！」`);
    const cutIn = () => setTimeout(() => {
      const cut = $('b-cut');
      cut.textContent = '天下分け目の決戦';
      cut.className = 'b-cut go decisive';
      Sound.horagai();
      setTimeout(() => Sound.horagai(), 900);
    }, 300);
    // 自分が本拠を攻めるときは、大将の決め絵から始める
    if (!defense && !auto) showKime(g, '天下分け目の決戦', `${CLANS[B.defender].name}の本拠・${MAP.byId[B.to].short}、もらい受ける！`, cutIn, 'angry');
    else cutIn();
  }
  report(openLines);

  let busy = false;
  let timer = null;
  let fxSeq = 0;
  let carry = []; // 決着の直前に出た文（一騎打ちの結果など）を、決着の画面にも残す

  // 命令のボタン
  // 陣形を兵の並びに映す
  function showForm() {
    if (!B.form) return;
    ['a', 'd'].forEach((sd) => {
      const el = $(`army-${sd}`);
      if (!el || !B.form[sd]) return;
      const n = el.querySelectorAll('.sol').length;
      el.innerHTML = jinkeiArmy(sd, n, CLANS[B[sd].clan].color, B.form[sd]);
    });
    updateBars();
  }
  function setForm(k) {
    B.form[me] = k;
    showForm();
    const edge = jinkeiEdge(B.form.a, B.form.d) * (me === 'a' ? 1 : -1);
    const cut = $('b-cut');
    cut.textContent = `${JINKEI[B.form[me]].name}　対　${JINKEI[B.form[foe]].name}`;
    cut.className = `b-cut go ${edge > 0 ? 'me' : edge < 0 ? 'foe' : ''}`;
    report([`${shortName(B[me].clan)}は「${JINKEI[k].name}」の陣を敷いた。${shortName(B[foe].clan)}は「${JINKEI[B.form[foe]].name}」！`,
      edge > 0 ? '陣形で優位に立った！' : edge < 0 ? '陣形で後れを取った…' : '陣形は互角']);
    Sound.taiko(0, 0.8); Sound.taiko(0.18, 0.8);
  }
  function renderCmds() {
    const el = $('b-cmds');
    if (B.over) { el.innerHTML = ''; return; }
    if (B.form && !B.form[me]) {
      if (auto) { setForm(autoJinkei(B.formRead)); }
      else {
        const rd = B.formRead || { level: 'none' };
        const scout = rd.level === 'clear' ? `🔍 物見の報せ：敵は「${JINKEI[rd.k].name}」の構え`
          : rd.level === 'guess' ? `🔍 たぶん「${JINKEI[rd.k].name}」……確かではない` : '🔍 敵の陣形は見えない';
        el.innerHTML = `<div class="jk-pick"><p class="jk-head"><b>陣 立 て</b><span>${scout}</span></p><div class="jk-grid">${Object.entries(JINKEI).map(([k, J]) => {
          const good = rd.level !== 'none' && J.beats === rd.k, bad = rd.level !== 'none' && JINKEI[rd.k].beats === k;
          return `<button class="jk-card ${good ? 'good' : bad ? 'bad' : ''}" data-jk="${k}">${jinkeiIcon(k, CLANS[B[me].clan].color)}<b>${J.name}</b><small>${J.desc}</small>${good ? '<i>◎ 有利</i>' : bad ? '<i>× 不利</i>' : ''}</button>`;
        }).join('')}</div><p class="hint">${Object.values(JINKEI).map((J) => J.name).join('→')}→${JINKEI.hoshi.name}：それぞれ次の陣に強い</p></div>`;
        el.querySelectorAll('[data-jk]').forEach((b) => { b.onclick = () => { Sound.tap(); setForm(b.dataset.jk); renderCmds(); }; });
        return;
      }
    }
    if (auto) {
      el.innerHTML = '<div class="b-autonote">おまかせで進めています… <button id="b-manual">采配に戻る</button></div>';
      $('b-manual').onclick = () => { Sound.tap(); auto = false; clearTimeout(timer); renderCmds(); };
      return;
    }
    const cmds = ['attack', 'charge', 'guard', 'scheme'].concat(defense ? [] : ['retreat']);
    const arts = B[me].arts.filter((id) => !B[me].used[id]);
    el.innerHTML = `<div class="cmd-grid">${cmds.map((c) =>
      `<button class="btn ${c === 'retreat' ? 'plain' : ''}" data-cmd="${c}"><b>${COMMANDS[c].name}</b><small>${COMMANDS[c].desc}</small></button>`).join('')}
      ${arts.map((id) => `<button class="btn red art" data-cmd="art:${id}"><b>戦法「${ARTS[S.gens[id].skill].name}」</b><small>${esc(S.gens[id].name)}：${ARTS[S.gens[id].skill].desc}</small></button>`).join('')}</div>`;
    el.querySelectorAll('[data-cmd]').forEach((b) => {
      b.onclick = () => { if (!busy) { Sound.tap(); doRound(b.dataset.cmd); } };
    });
  }

  function afterRound() {
    if (B.duel) { openDuel(); return; }
    if (B.over) { finish(); return; }
    busy = false;
    renderCmds();
    if (auto) timer = setTimeout(() => doRound(aiCommand(S, B, me)), wait(900));
  }

  function doRound(cmd) {
    if (B.form && !B.form[me]) setForm(autoJinkei(B.formRead));
    busy = true;
    carry = [];
    $('b-cmds').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const cmds = {};
    cmds[me] = cmd;
    cmds[foe] = aiCommand(S, B, foe);
    const prev = { a: B.a.troops, d: B.d.troops };
    const rep = stepBattle(S, B, cmds);
    $('round').textContent = `第 ${'一二三四五六七八'[B.round - 1] || B.round} 合`;
    const lead = playBattleFx(rep.act || {});
    setTimeout(() => { report(rep.lines); animate(prev, rep.act || cmds); }, lead);
    timer = setTimeout(afterRound, wait(1100) + lead);
  }

  // 命令・戦法ごとの演出。戦法は名前を大きく出してから。演出が始まるまでの時間を返す
  function playBattleFx(act) {
    const fx = $('bf-fx');
    if (!fx || B.over === 'retreat') return 0;
    const kindOf = (sd) => {
      const c = act[sd];
      if (!c) return null;
      if (c === 'confused') return 'confused';
      if (c.startsWith('art:')) return S.gens[c.slice(4)].skill;
      return c;
    };
    const arts = ['a', 'd'].filter((sd) => act[sd] && act[sd].startsWith('art:'));
    let lead = 0;
    const seq = ++fxSeq;
    if (arts.length) {
      const cut = $('b-cut');
      cut.textContent = arts.map((sd) => `${ARTS[S.gens[act[sd].slice(4)].skill].name}`).join('　×　');
      cut.className = `b-cut go ${arts.includes(me) ? 'me' : 'foe'}`;
      Sound.kiai();
      lead = fast ? 450 : 800;
    }
    setTimeout(() => {
      if (seq !== fxSeq) return;
      fx.innerHTML = '';
      ['a', 'd'].forEach((sd) => {
        const k = kindOf(sd);
        if (!k) return;
        fx.insertAdjacentHTML('beforeend', battleFx(k, sd));
        if (k === 'charge') Sound.hooves();
        if (k === 'guard' || k === 'chikujou') { Sound.taiko(0, 0.5); Sound.taiko(0.15, 0.5); }
        if (k === 'scheme') Sound.charge();
        if (k === 'totsugeki') Sound.slash(0, true);
        if (k === 'teppeki') { Sound.clash(0); Sound.taiko(0.1, 0.8); }
        if (k === 'shinsan') Sound.fire();
        if (k === 'jinbou') Sound.season();
        if (k === 'shousai') Sound.taiko(0, 0.6);
      });
      setTimeout(() => { if (seq === fxSeq && fx.isConnected) fx.innerHTML = ''; }, 1500);
    }, lead);
    return lead;
  }

  // ---------- 一騎打ち ----------
  function openDuel() {
    const d = $('duel');
    const mineChallenges = B.duel.challenger === me;
    const myGen = me === 'a' ? g : dg, foeGen = me === 'a' ? dg : g;
    if (auto) {
      const lines = autoDuel(S, B);
      carry = lines;
      report(lines);
      updateBars();
      timer = setTimeout(afterRound, wait(1300));
      return;
    }
    d.hidden = false;
    const du = { myGen, foeGen, mood: {}, say: null, busy: false, calls: [duelCallVs(S, myGen, foeGen), duelCallVs(S, foeGen, myGen)], rival: areRivals(S, myGen, foeGen) };
    drawDuel(du, mineChallenges);
    Sound.taiko(0, 0.8);
    Sound.taiko(0.25, 0.8);
  }

  // 一騎打ちの画面。du.offer のあいだは「受けるか」を聞き、始まったら手を選ぶ
  function drawDuel(du, offer = null) {
    const d = $('duel');
    const D = B.duel;
    const started = !!(D && D.hp);
    const { myGen, foeGen } = du;
    const my = me, fo = foe;
    const stat = (sd, gen) => {
      const hp = started ? D.hp[sd] : DUEL.hp;
      const ki = started ? D.ki[sd] : 0;
      return `<div class="du-stat ${sd === my ? 'me' : 'foe'}">
        <b>${esc(gen.name)}</b><small>統率${gen.str}・知略${gen.int}</small>
        <div class="du-hp"><span>体</span>${Array.from({ length: DUEL.hp }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join('')}</div>
        <div class="du-ki ${ki >= DUEL.kiMax ? 'full' : ''}"><span>気合</span><em><i style="width:${ki}%"></i></em><small>${ki >= DUEL.kiMax ? '必殺！' : ki}</small></div>
      </div>`;
    };
    const roundName = started ? `第${'一二三四五六七'[Math.min(D.turn, 6)]}合` : '';
    let body = '';
    if (!started) {
      // 名乗りと、受けるかどうか
      body = `<div class="du-say"><p><b>${esc(myGen.name)}</b>「${esc(du.calls[0])}」</p><p><b class="foe">${esc(foeGen.name)}</b>「${esc(du.calls[1])}」</p></div>
        <p class="du-note">${offer ? `敵将${esc(foeGen.name)}に一騎打ちを挑みますか？` : `敵将${esc(foeGen.name)}が一騎打ちを挑んできた！`}<br>
        勝てば敵の士気が大きく下がり、敵将を捕らえることも。負ければ味方の士気が下がる。${offer ? '' : '断ると士気が少し下がる。'}</p>
        <div class="du-moves two"><button class="btn red" id="du-yes">${offer ? '挑む' : '受けて立つ'}</button>
        <button class="btn plain" id="du-no">${offer ? 'やめておく' : '断る'}</button></div>`;
    } else if (D.done) {
      const won = D.done === my;
      // 勝ったら、敗れた敵将をどうするか選ぶ（敵の当主は捕らえられない）
      const fate = won && !foeGen.lord
        ? `<p class="du-q">敗れた${esc(foeGen.name)}を、どうする？</p>
          <div class="du-moves">
            <button class="btn" data-fate="capture"><b>捕らえる</b><small>${D.hp[fo] <= 0 ? '深手を負わせた。確実に捕らえる' : '6割で捕らえる'}</small></button>
            <button class="btn" data-fate="persuade"><b>説得する</b><small>見込み ${Math.round(persuadeChance(myGen, foeGen) * 100)}%・成功すれば家臣に</small></button>
            <button class="btn du-sp" data-fate="spare"><b>見逃す</b><small>相手の家の友好度+8・魅力が伸びる</small></button>
          </div>`
        : `<button class="btn red" id="du-end">${won ? '勝ち名乗りを上げる' : '決着'}</button>`;
      body = `${du.say ? `<div class="du-say">${du.say}</div>` : ''}${fate}`;
    } else {
      const read = D.read || { level: 'none' };
      const readText = read.level === 'clear' ? `🔍 見えた！ 次は「${DUEL_MOVES[read.move] ? DUEL_MOVES[read.move].name : DUEL_SPECIALS[duelSpecialOf(foeGen)].name}」で来る`
        : read.level === 'guess' ? `🔍 たぶん「${DUEL_MOVES[read.move] ? DUEL_MOVES[read.move].name : '必殺技'}」で来る……？`
        : '🔍 相手の構えは読めない';
      const sp = DUEL_SPECIALS[duelSpecialOf(myGen)];
      const canSp = D.ki[my] >= DUEL.kiMax;
      body = `<div class="du-say">${du.say || `<p>${esc(pick(['間合いをはかる……', '風が止んだ……', '両者、じりじりと詰め寄る']))}</p>`}
          <p class="du-read ${read.level}">${readText}</p>
          ${D.ki[fo] >= DUEL.kiMax ? `<p class="du-warn">⚠ ${esc(foeGen.name)}の気合が満ちている！ 必殺技に気をつけろ</p>` : ''}</div>
        <div class="du-moves">${['slash', 'sweep', 'block', 'charge'].map((k) => `<button class="btn" data-mv="${k}"><b>${DUEL_MOVES[k].name}</b><small>${DUEL_MOVES[k].desc}</small></button>`).join('')}
          <button class="btn red du-sp" data-mv="special" ${canSp ? '' : 'disabled'}><b>必殺「${sp.name}」</b><small>${canSp ? sp.desc : `気合${DUEL.kiMax}で使える`}</small></button></div>`;
    }
    d.innerHTML = `<div class="duel-box du2">
      <div class="du-title">一 騎 打 ち${du.rival ? `<span class="du-rival">宿 命 の 対 決</span>` : ""}${started ? `<small>${roundName}／${DUEL.maxTurns}合</small>` : ""}</div>
      <div class="du-stage" id="du-stage">
        ${duelScene(B[my].clan, B[fo].clan)}
        <div class="du-p left ${du.entered ? '' : 'enter'}" id="du-pL">${portrait(myGen, 84, du.mood[my] || null, 'R')}</div>
        <div class="du-p right ${du.entered ? '' : 'enter'}" id="du-pR">${portrait(foeGen, 84, du.mood[fo] || null)}</div>
        <svg class="du-fx" id="du-fx" viewBox="0 0 320 160" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="du-flash" id="du-flash"></div>
        <div class="du-cut" id="du-cut"></div>
        ${du.dmg ? ['a', 'd'].filter((sd) => du.dmg[sd]).map((sd) => `<div class="du-dmg ${sd === my ? 'left' : 'right'}">−${du.dmg[sd]}</div>`).join('') : ''}
        ${started && D.done ? `<div class="du-stamp ${D.done === my ? 'win' : 'lose'}">${D.done === my ? '勝' : '負'}</div>` : ''}
      </div>
      <div class="du-stats">${stat(my, myGen)}${stat(fo, foeGen)}</div>
      ${body}
    </div>`;
    du.dmg = null;
    du.entered = true;
    if (!started) {
      $('du-yes').onclick = () => {
        Sound.tap();
        Sound.bgmStart('duel');
        startDuel(B, S);
        prepareDuelTurn();
        du.say = null;
        drawDuel(du);
      };
      $('du-no').onclick = () => {
        Sound.tap();
        const line = offer ? (B.duel = null, '一騎打ちは見送った') : declineDuel(B, me);
        d.hidden = true;
        report([line]);
        updateBars();
        afterRound();
      };
      return;
    }
    if (D.done) {
      const finishDuel = (choice) => {
        Sound.tap();
        Sound.bgmStart('battle');
        const won = D.done === me;
        const lines = endDuel(S, B, choice);
        d.hidden = true;
        carry = lines;
        report(lines);
        updateBars();
        // 一騎打ちに勝ったら、勝者の決め絵を見せてから合戦に戻る
        if (won) {
          const say = choice === 'spare' ? '行け。次は戦場で会おう' : choice === 'persuade' ? 'ともに天下を目指そう' : pick(['この勝負、もらった！', `${foeGen.name}、敗れたり！`, 'わが刃に一片の曇りなし']);
          showKime(myGen, choice === 'spare' ? '情けの一太刀' : '討ち取ったり！', say, afterRound, choice === 'spare' ? 'smile' : 'laugh');
        } else afterRound();
      };
      if ($('du-end')) $('du-end').onclick = () => finishDuel(null);
      d.querySelectorAll('[data-fate]').forEach((b) => { b.onclick = () => finishDuel(b.dataset.fate); });
      return;
    }
    d.querySelectorAll('[data-mv]').forEach((b) => {
      b.onclick = () => {
        if (du.busy) return;
        du.busy = true;
        d.querySelectorAll('[data-mv]').forEach((x) => { x.disabled = true; });
        const moves = {};
        moves[me] = b.dataset.mv;
        moves[foe] = D.next[foe];
        const r = duelStep(S, B, moves);
        const spName = (sd) => DUEL_SPECIALS[duelSpecialOf(sd === me ? myGen : foeGen)].name;
        const fxTime = playDuelFx(r, myGen, foeGen);
        setTimeout(() => {
          du.dmg = r.dmg;
          ['a', 'd'].forEach((sd) => {
            du.mood[sd] = r.dmg[sd] ? 'angry' : r.dmg[other(sd)] ? 'happy' : 'think';
          });
          const lines = r.text.split('\n').map((l) => `<p>${esc(l)}</p>`).join('');
          const mvName = (sd) => (r.moves[sd] === 'special' ? `必殺「${spName(sd)}」` : DUEL_MOVES[r.moves[sd]].name);
          du.say = `<p class="du-mv">${esc(myGen.name)}：${mvName(me)}　／　${esc(foeGen.name)}：${mvName(foe)}</p>${lines}`;
          if (B.duel.done) {
            const won = B.duel.done === me;
            du.mood[me] = won ? 'happy' : 'think';
            du.mood[foe] = won ? 'think' : 'happy';
            setTimeout(() => (won ? Sound.win() : Sound.lose()), 300);
          } else prepareDuelTurn();
          du.busy = false;
          drawDuel(du);
        }, fxTime);
      };
    });
  }

  // 技ごとの演出を再生し、終わるまでの時間（ミリ秒）を返す
  function playDuelFx(r, myGen, foeGen) {
    const fx = $('du-fx');
    const sideOf = (sd) => (sd === me ? 'L' : 'R');
    const pEl = (sd) => $(sideOf(sd) === 'L' ? 'du-pL' : 'du-pR');
    const genOf = (sd) => (sd === me ? myGen : foeGen);
    const kindOf = (sd) => (r.moves[sd] === 'special' ? duelSpecialOf(genOf(sd)) : r.moves[sd]);
    const attacking = (k) => ['slash', 'sweep', 'totsugeki', 'shinsan', 'konshin'].includes(k);
    const add = (svg) => fx.insertAdjacentHTML('beforeend', svg);
    const box = $('duel').querySelector('.duel-box');
    let t = 0;
    // ① 必殺技は、名前を大きく出してから
    if (r.specials.length) {
      const cut = $('du-cut');
      cut.textContent = r.specials.map((sd) => DUEL_SPECIALS[duelSpecialOf(genOf(sd))].name).join('　×　');
      cut.className = `du-cut go ${r.specials.includes(me) ? 'me' : 'foe'}`;
      Sound.kiai();
      t = 800;
    }
    // ② 両者の技
    setTimeout(() => {
      ['a', 'd'].forEach((sd) => {
        const k = kindOf(sd);
        add(duelFx(k, sideOf(sd)));
        const el = pEl(sd);
        if (attacking(k)) replay(el, sideOf(sd) === 'L' ? 'atk-l' : 'atk-r');
        if (k === 'charge') replay(el, 'charging');
      });
      const kinds = ['a', 'd'].map(kindOf);
      if (kinds.includes('konshin')) { Sound.taiko(0, 1.2); Sound.slash(0.05, true); }
      if (kinds.includes('totsugeki')) Sound.slash(0, true);
      if (kinds.includes('shinsan')) { Sound.slash(0.35); Sound.slash(0.5); }
      if (kinds.includes('teppeki')) { Sound.taiko(0, 0.9); Sound.clash(0.1); }
      if (kinds.includes('slash') || kinds.includes('sweep')) Sound.slash();
      if (kinds.includes('block')) Sound.clash(0.18);
      if (kinds.includes('charge')) Sound.charge();
    }, t);
    t += r.specials.length ? 650 : 330;
    // ③ 当たった側に火花とのけぞり。どちらも無傷なら鍔ぜりの火花
    setTimeout(() => {
      const hurt = ['a', 'd'].filter((sd) => r.dmg[sd] > 0);
      if (!hurt.length && !['a', 'd'].every((sd) => r.moves[sd] === 'charge')) { add(duelClashFx()); Sound.clash(0); }
      hurt.forEach((sd) => {
        add(duelImpact(sideOf(sd), r.dmg[sd] >= 2));
        replay(pEl(sd), sideOf(sd) === 'L' ? 'hurt-l' : 'hurt-r');
      });
      if (hurt.length) {
        replay($('du-flash'), 'go');
        replay(box, ['a', 'd'].some((sd) => kindOf(sd) === 'konshin') || hurt.some((sd) => r.dmg[sd] >= 2) ? 'hit-big' : 'hit');
        Sound.taiko(0, hurt.some((sd) => r.dmg[sd] >= 2) ? 1 : 0.6);
      }
    }, t);
    return t + 420;
  }

  // 次の合の、相手の手（先に決めておくので「読み」が本当の手を指す）
  function prepareDuelTurn() {
    const D = B.duel;
    D.next = { [foe]: aiDuelMove(S, B, foe) };
    D.read = duelRead(S, B, me);
  }

  // ---------- 決着 ----------
  function finish() {
    clearTimeout(timer);
    busy = true;
    const log = [];
    const r = endBattle(S, B, log);
    checkWin(S);
    save();
    render();
    updateBars();
    $('b-cmds').innerHTML = '';
    $('b-foot').innerHTML = '';
    Sound.bgmStop(0.5);
    const good = defense ? !r.won : r.won; // プレイヤーにとって良い結果か
    const stamp = $('stamp');
    stamp.textContent = r.won ? '落城' : defense ? '撃退' : '撤退';
    stamp.className = 'stamp go ' + (good ? 'win' : 'lose');
    Sound.stamp(0.3);
    if (r.won) {
      fall('army-d', 0);
      $('bf-fire').classList.add('on');
      document.querySelector('.bf-castle').style.setProperty('--c', CLANS[B.attacker].color);
    }
    settle(r.won);
    $('round').textContent = defense
      ? (r.won ? `${MAP.byId[B.to].short}は落城した…` : `${MAP.byId[B.to].short}を守り抜いた！`)
      : (r.won ? `${MAP.byId[B.to].short}、落城！` : '攻略ならず…');
    const lines = [...carry];
    if (!defense) lines.push(r.won ? `残った ${fmt(r.left)} 兵が入城した` : `残った ${fmt(r.left)} 兵は退いた`);
    if (r.won && B.defender !== 'none' && castlesOf(S, B.defender).length === 0) lines.push(`${CLANS[B.defender].name}は滅亡した！`);
    if (r.grew && B.attacker === PLAYER) lines.push(`${g.name}の統率が上がった！`);
    lines.push(...log);
    report(lines);
    setTimeout(() => (good ? Sound.win() : Sound.lose()), 350);
    $('b-foot').innerHTML = '<button class="btn red" id="b-close">閉じる</button>';
    $('b-close').onclick = () => {
      Sound.tap();
      box.hidden = true;
      Sound.bgmStart('map');
      const next = () => handleCaptives(r.captured || [], () => { if (onClose) onClose(r); });
      // 名門校（家の本拠）を落としたら、落城の一枚絵
      if (r.won && !defense && B.attacker === PLAYER && CLANS[B.defender] && B.to === B.defender) showConquest(B, next); else next();
    };
  }

  $('b-auto').onclick = () => {
    Sound.tap();
    auto = true;
    renderCmds();
    if (!busy) doRound(aiCommand(S, B, me));
  };
  $('b-skip').onclick = () => {
    Sound.tap();
    clearTimeout(timer);
    if (B.form && !B.form[me]) B.form[me] = autoJinkei(B.formRead);
    $('duel').hidden = true;
    autoBattle(S, B);
    finish();
  };

  renderCmds();
  if (auto) timer = setTimeout(() => doRound(aiCommand(S, B, me)), wait(1400));
}

// ---------- 敵襲（守りの合戦） ----------
function processDefenses(done) {
  const q = S.pendingDefense || [];
  if (!q.length) { done(); return; }
  const p = q.shift();
  save();
  if (S.castles[p.to].owner !== PLAYER || !S.gens[p.gid]) { processDefenses(done); return; }
  const ag = S.gens[p.gid];
  const total = p.n + (p.support || []).reduce((a, sp) => a + sp.n, 0);
  const c = S.castles[p.to];
  const dg = defLeader(S, p.to);
  openModal(`<div class="event" data-lock>
      <div class="ev-icon">襲</div>
      <h2>敵 襲 ！</h2>
      <p class="ev-text">${CLANS[p.attacker].name}の${esc(ag.name)}が、${fmt(total)}兵で<b>${MAP.byId[p.to].name}</b>に攻めてきた！\n守備 ${fmt(c.troops)} 兵 ・ 防御 ${c.def.toFixed(1)}</p>
      <div class="glist pick">${genCard(ag)}</div>
      <p class="hint">守将：${dg ? esc(dg.name) : 'なし（士気が下がりやすい）'}</p>
      ${(() => {
        // 守り切る見込み：攻め手の勝つ見込みの裏返し
        const keep = 1 - winChance((total * atkMult(ag) * atkKakun(S, p.attacker)) / Math.max(1, defensePower(S, p.to)));
        const lab = oddsLabel(keep);
        return `<div class="odds" id="odds"><span class="o-lab" style="color:${lab[1]}">${keep >= 0.93 ? '守り堅し' : keep >= 0.6 ? '守れる見込みあり' : keep >= 0.4 ? '五分五分' : '危うし'}</span>
          <span class="o-bar"><i style="width:${Math.round(keep * 100)}%;background:${lab[1]}"></i></span>
          <small>おまかせで守ったときの見込み 約${Math.min(99, Math.max(1, Math.round(keep * 20) * 5))}%${keep < 0.6 ? '・采配で巻き返そう' : ''}</small></div>`;
      })()}
    </div>
    <button class="btn red" id="df-cmd">采配で迎え撃つ</button>
    <button class="btn plain" id="df-auto">おまかせで守る</button>
    <button class="btn plain" id="df-skip">結果だけ見る</button>`);
  Sound.horagai();
  const go = (auto, skip) => {
    closeModal();
    const B = startBattle(S, { from: p.from, to: p.to, n: p.n, gid: p.gid, support: p.support || [], attacker: p.attacker, playerSide: 'd', committed: true });
    runBattle(B, { auto, onClose: () => processDefenses(done) });
    if (skip) $('b-skip').click();
  };
  $('df-cmd').onclick = () => { Sound.tap(); go(false); };
  $('df-auto').onclick = () => { Sound.tap(); go(true); };
  $('df-skip').onclick = () => { Sound.tap(); go(true, true); };
}

// ---------- 捕虜 ----------
// ---------- 敵の当主を捕らえたとき ----------
// 家臣にする（難しい）／身代金を取って帰す／情けをかけて帰し、停戦を結ぶ
function lordCaptiveOf(gid) {
  const k = Object.keys(S.aiLords || {}).find((c) => S.aiLords[c] === gid);
  return k && castlesOf(S, k).length ? k : null;
}
function returnLord(g, k) {
  g.clan = k;
  g.loc = castlesOf(S, k).includes(k) ? k : castlesOf(S, k)[0];
  delete g.capturedAt;
}
function handleLordCaptive(g, k, rest, done) {
  const p = Math.round(recruitChance(S, g) * 50);
  const ransom = Math.min(Math.max(0, Math.floor(S.gold[k] * 0.6)), 300 + castlesOf(S, k).length * 60);
  const next = () => { closeModal(); render(); handleCaptives(rest, done); };
  openModal(`<div class="lordcap" data-lock>
      <p class="news">敵将捕縛</p>
      <div class="lc-pic" style="--c:${CLANS[k].color}">${portrait(g, 150, 'frustrated')}<span class="lc-crest">${crestBadge(k, 40)}</span></div>
      <h2>${CLANS[k].name}当主　${esc(g.name)}</h2>
      <p class="lc-line">「${esc(lordCaptured(k))}」</p>
      <p class="hint">敵の当主を捕らえた。扱いひとつで、${CLANS[k].name}との先行きが変わる。</p>
    </div>
    <button class="btn red" id="lc-recruit">家臣にする<small class="sub">成功率 ${p}%・失敗すると去っていく</small></button>
    <button class="btn" id="lc-ransom" ${ransom < 50 ? 'disabled' : ''}>身代金を取って帰す<small class="sub">${CLANS[k].name}から金 ${fmt(ransom)}・友好度は下がる</small></button>
    <button class="btn plain" id="lc-truce">情けをかけて帰す<small class="sub">${CLANS[k].name}と${DIPLO.truceTurns}季の停戦・友好度+15</small></button>`);
  Sound.hyoshigi(2);
  const result = (html, good) => {
    if (good) Sound.win(); else Sound.lose();
    save();
    openModal(`<div class="gdetail" data-lock>${portrait(g, 72, good ? 'smile' : 'angry')}<p>${html}</p></div><button class="btn red" id="lc-next">次へ</button>`);
    $('lc-next').onclick = () => { Sound.tap(); next(); };
  };
  $('lc-recruit').onclick = () => {
    Sound.tap();
    const ok = Math.random() < p / 100;
    if (ok && S.castles[g.capturedAt] && S.castles[g.capturedAt].owner === PLAYER) {
      g.clan = PLAYER; g.loc = g.capturedAt; g.loyal = randInt(30, 45); g.title = `元${CLANS[k].name.replace('家', '')}当主`;
      S.stats.recruited++;
      addNews(S, `${CLANS[k].name}当主・${g.name}、${pName()}に降る`, '敵将が味方に', 60);
      result(`「……負けは負けだ。${pName()}の天下、この目で見届けよう」<br><b>${esc(g.name)}が家臣になった！</b>`, true);
    } else {
      releaseCaptive(S, g.id);
      result(`「誰が仕えるものか！」<br>${esc(g.name)}は去っていった…`, false);
    }
  };
  $('lc-ransom').onclick = () => {
    Sound.tap();
    S.gold[k] -= ransom; S.gold[PLAYER] += ransom;
    if (S.rel[k]) changeFriend(S, k, -10);
    returnLord(g, k);
    addDebt(S, k, g.id, 'ransom');
    result(`${CLANS[k].name}は金 ${fmt(ransom)} を差し出した。<br>「この屈辱、忘れはせぬぞ……」`, true);
  };
  $('lc-truce').onclick = () => {
    Sound.tap();
    returnLord(g, k);
    addDebt(S, k, g.id, 'mercy');
    if (S.rel[k]) { changeFriend(S, k, 15); S.rel[k].truce = Math.max(S.rel[k].truce || 0, DIPLO.truceTurns); }
    addDiploLog(S, `${CLANS[k].name}の当主・${g.name}を情けをもって帰し、停戦を結んだ`, 'good');
    result(`「……この恩、いつか必ず返す」<br>${CLANS[k].name}と${DIPLO.truceTurns}季の停戦を結んだ。`, true);
  };
}

function handleCaptives(list, done) {
  if (!list.length) { done(); return; }
  const [gid, ...rest] = list;
  const g = S.gens[gid];
  const lordClan = lordCaptiveOf(gid);
  if (lordClan) { handleLordCaptive(g, lordClan, rest, done); return; }
  const p = Math.round(recruitChance(S, g) * 100);
  openModal(`<div class="gdetail" data-lock>
      <p class="news">捕 縛</p>
      ${portrait(g, 96)}
      <h2>${esc(g.name)}</h2>
      <p class="hint">${esc(g.title)}（${MAP.byId[g.school].name}）</p>
      <div class="gstats">
        ${['str', 'pol', 'cha', 'int'].map((k) => `<div><span>${STAT_NAMES[k]}</span><i style="width:${g[k]}%"></i><b>${g[k]}</b></div>`).join('')}
      </div>
      ${g.skill ? `<p><span class="skill">${SKILLS[g.skill].name}</span> ${SKILLS[g.skill].desc}</p>` : ''}
      <p>「……好きにするがいい」</p>
    </div>
    <button class="btn red" id="cap-yes">登用する（成功率 ${p}%）</button>
    <button class="btn plain" id="cap-no">解放する</button>`);
  $('cap-yes').onclick = () => {
    const ok = tryRecruitCaptive(S, gid);
    save();
    render();
    if (ok) Sound.win(); else Sound.lose();
    openModal(`<div class="gdetail" data-lock>${portrait(g, 72)}
        <p>${ok ? `「……よかろう。${pName()}のために働こう」<br><b>${esc(g.name)}が家臣になった！</b>` : `「断る！」<br>${esc(g.name)}は去っていった…`}</p></div>
      <button class="btn red" id="cap-next">次へ</button>`);
    $('cap-next').onclick = () => { Sound.tap(); closeModal(); handleCaptives(rest, done); };
  };
  $('cap-no').onclick = () => {
    Sound.tap();
    releaseCaptive(S, gid);
    save();
    closeModal();
    handleCaptives(rest, done);
  };
}

// ---------- 輸送 ----------
function openMove(from, to) {
  const max = readyTroops(S, from);
  let amount = Math.round(max / 2 / 10) * 10 || max;
  const g = idleGensAt(S, from).sort((a, b) => a.str - b.str)[0];
  openModal(`<h2>輸 送</h2>
    <p style="text-align:center">${MAP.byId[from].name} → ${MAP.byId[to].name}<br><span class="hint">担当：${esc(g.name)}</span></p>
    <div class="slider-row"><input type="range" id="amt" min="10" max="${max}" step="10" value="${amount}"><b id="amt-v">${fmt(amount)}</b></div>
    <p class="hint">送った兵は、着いた季節のうちは出陣・輸送に使えません（守りには加わります）</p>
    <button class="btn red" id="go">送 る</button>
    <button class="btn plain" data-close>やめる</button>`);
  $('amt').oninput = (e) => { amount = +e.target.value; $('amt-v').textContent = fmt(amount); };
  $('go').onclick = () => {
    Sound.tap();
    moveTroops(S, from, to, amount);
    S.arrived = S.arrived || {};
    S.arrived[to] = (S.arrived[to] || 0) + amount;
    S.acted[g.id] = true;
    mode = null;
    selected = to;
    save();
    closeModal();
    render();
  };
}

// ---------- 武将一覧 ----------
// 歴代当主の一覧
function lordsHistory() {
  return `<ol class="lords">${S.lords.map((l, i) => {
    const until = S.lords[i + 1] ? dateLabel(S.lords[i + 1].from) : '現在';
    return `<li><b>${i + 1}代</b> ${esc(l.name)}<small>${dateLabel(l.from)}〜${until}・家訓「${KAKUN[l.kakun].name}」</small></li>`;
  }).join('')}</ol>`;
}

// 家臣団：並べかえの札つき
let ROSTER_SORT = 'grade';
const ROSTER_SORTS = { grade: '学年', str: '統率', int: '知略', pol: '政治', cha: '魅力', loyal: '忠誠' };
function showRoster() {
  const by = ROSTER_SORT;
  const key = (g) => (by === 'grade' ? g.grade * 1000 - (g.loc || '').charCodeAt(0) : by === 'loyal' ? -g.loyal : g[by]);
  const gens = gensOf(S, PLAYER).sort((a, b) => (b.lord ? 1 : 0) - (a.lord ? 1 : 0) || key(b) - key(a));
  const seniors = gens.filter((g) => g.grade >= 3).length;
  const retainers = gens.filter((g) => !g.lord);
  const avgLoyal = retainers.length ? Math.round(retainers.reduce((a, g) => a + g.loyal, 0) / retainers.length) : 0;
  const treasures = gens.filter((g) => g.treasure).length + (S.vault || []).length;
  openModal(`<h2>家臣団</h2>
    <div class="stats four"><div class="stat"><span class="n">${gens.length}</span><span class="l">武将</span></div>
      <div class="stat"><span class="n">${seniors}</span><span class="l">春に卒業</span></div>
      <div class="stat"><span class="n ${avgLoyal < 50 ? 'bad' : ''}">${avgLoyal}</span><span class="l">平均忠誠</span></div>
      <div class="stat"><span class="n">${treasures}</span><span class="l">家宝</span></div></div>
    <div class="sort-row">${Object.entries(ROSTER_SORTS).map(([k, t]) => `<button data-sort="${k}" class="${k === by ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="hint" style="text-align:center">タップするとその城へ</p>
    <div class="glist roster">${gens.map((g) => genCard(g, {
      acted: !!S.acted[g.id],
      extra: `<span class="where">${MAP.byId[g.loc].short}</span>`,
    })).join('')}</div>
    <button class="btn" id="roster-reward">褒美を与える（忠誠の低い順）</button>
    <h3>歴代当主</h3>
    ${lordsHistory()}
    <button class="btn" id="roster-hall">卒業生の列伝<small class="sub">${(S.hall || []).length}人</small></button>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-sort]').forEach((b) => { b.onclick = () => { Sound.tap(); ROSTER_SORT = b.dataset.sort; showRoster(); }; });
  $('roster-hall').onclick = () => { Sound.tap(); showHall(showRoster); };
  $('roster-reward').onclick = () => { Sound.tap(); showReward(gensOf(S, PLAYER).filter((g) => g.loc), '褒美（忠誠の低い順）', showRoster); };
  modalBody.querySelectorAll('.gcard').forEach((c) => {
    c.onclick = () => {
      Sound.tap();
      const loc = S.gens[c.dataset.gid].loc;
      closeModal();
      selected = loc;
      mode = null;
      render();
      centerOn(loc);
    };
  });
}

// ---------- ターン終了 ----------
// 墨の円相（一筆で描く円）と、季節の色の落款
const ENSO = `<svg class="enso" viewBox="0 0 300 300" aria-hidden="true">
  <path class="enso-stroke" pathLength="100" d="M214,58 C266,96 274,180 230,230 C186,280 104,282 62,236 C20,190 26,110 76,68 C116,34 172,30 206,52"/>
  <path class="enso-drip" d="M206,52 q8,6 4,14 q-6,-4 -4,-14Z"/></svg>`;
function showSeason(turn, then) {
  const box = $('season');
  box.className = `s${turn % 4}`;
  // 墨絵の季節がわり：円相を一筆で描き、その中に季節の一字
  if (!box.querySelector('.enso')) box.insertAdjacentHTML('afterbegin', ENSO);
  const inner = box.querySelector('.season-inner');
  if (inner && !inner.querySelector('.season-seal')) inner.insertAdjacentHTML('beforeend', '<span class="season-seal"></span>');
  const seal = box.querySelector('.season-seal');
  if (seal) seal.textContent = ['春', '夏', '秋', '冬'][turn % 4] + '之印';
  const enso = box.querySelector('.enso');
  if (enso) { enso.style.animation = 'none'; void enso.offsetWidth; enso.style.animation = ''; }
  $('season-year').textContent = `${2026 + Math.floor(turn / 4)}年`;
  $('season-kanji').textContent = SEASONS[turn % 4];
  $('season-word').textContent = SEASON_WORDS[turn % 4];
  box.hidden = false;
  // アニメーションをやり直す
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  const k = $('season-kanji');
  k.style.animation = 'none'; void k.offsetWidth; k.style.animation = '';
  Sound.season();
  setTimeout(() => { box.hidden = true; then(); }, 1900);
}

// ---------- 世界が動く地図：ターン終了のあいだの合戦を、地図の上で順に見せる ----------
// owners0 = ターン前の城の持ち主。矢が伸びて、落ちた城は攻め手の色に塗り替わる。タップで飛ばせる
function playWorld(owners0, moves, done) {
  const fx = $('world-fx');
  const list = (moves || []).filter((m) => MAP.byId[m.to] && (!m.from || MAP.byId[m.from]));
  if (!fx || !list.length) { done(); return; }
  const paint = (id, owner) => {
    const col = owner === 'none' ? 'transparent' : CLANS[owner].color;
    const cell = document.querySelector(`#territory .cell[data-id="${id}"]`);
    if (cell) cell.setAttribute('fill', col);
    const g = document.querySelector(`#map .castle[data-id="${id}"]`);
    if (g) g.style.setProperty('--c', CLANS[owner].color);
  };
  Object.entries(owners0).forEach(([id, o]) => { if (S.castles[id] && S.castles[id].owner !== o) paint(id, o); });
  // カメラ：動きのあった城がすべて入るように引く（終わったら元に戻す）
  const view = { scale, left: mapwrap.scrollLeft, top: mapwrap.scrollTop };
  const pts = list.flatMap((m) => [m.to, m.from].filter(Boolean)).map((id) => MAP.byId[id]);
  const x0 = Math.min(...pts.map((p) => p.x)) - 90, x1 = Math.max(...pts.map((p) => p.x)) + 90;
  const y0 = Math.min(...pts.map((p) => p.y)) - 90, y1 = Math.max(...pts.map((p) => p.y)) + 90;
  zoomAt(Math.min(1.1, mapwrap.clientWidth / (x1 - x0), mapwrap.clientHeight / (y1 - y0)));
  mapwrap.scrollLeft = ((x0 + x1) / 2) * scale - mapwrap.clientWidth / 2;
  mapwrap.scrollTop = ((y0 + y1) / 2) * scale - mapwrap.clientHeight / 2;
  // 見出しと、飛ばすための覆い
  const area = mapwrap.parentElement;
  const cover = document.createElement('div');
  cover.className = 'world-cover';
  cover.innerHTML = `<div class="world-banner"><b>諸国の動き</b><span id="wb-n"></span><button>飛ばす ›</button></div>`;
  area.appendChild(cover);
  const step = Math.max(260, Math.min(700, 5000 / list.length));
  let i = 0, timer = null, over = false;
  const finish = () => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    cover.remove();
    fx.innerHTML = '';
    scale = view.scale; applyScale();
    mapwrap.scrollLeft = view.left; mapwrap.scrollTop = view.top;
    render();
    done();
  };
  cover.onclick = () => { Sound.tap(); finish(); };
  const next = () => {
    if (over) return;
    if (i >= list.length) { timer = setTimeout(finish, 700); return; }
    const m = list[i++];
    $('wb-n').textContent = `${i} / ${list.length}`;
    const B = MAP.byId[m.to], col = CLANS[m.att] ? CLANS[m.att].color : '#857b6c';
    const mine = m.def === PLAYER || m.att === PLAYER;
    let html = '';
    if (m.from) {
      // 弓なりの矢：始点から少し離して、終点の手前で止める
      const A = MAP.byId[m.from];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      const sx = A.x + (dx / d) * 22, sy = A.y + (dy / d) * 22, ex = B.x - (dx / d) * 26, ey = B.y - (dy / d) * 26;
      const cx = (sx + ex) / 2 - (dy / d) * d * 0.22, cy = (sy + ey) / 2 + (dx / d) * d * 0.22;
      const ang = (Math.atan2(ey - cy, ex - cx) * 180) / Math.PI;
      html += `<path class="wf-arrow ${m.kind === 'fall' ? 'fall' : ''}" pathLength="100" d="M${sx.toFixed(0)},${sy.toFixed(0)} Q${cx.toFixed(0)},${cy.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}" style="--c:${col};animation-duration:${(step * 0.55).toFixed(0)}ms"/>
        <path class="wf-head" d="M0,0 L-13,-7 L-9,0 L-13,7Z" transform="translate(${ex.toFixed(0)},${ey.toFixed(0)}) rotate(${ang.toFixed(0)})" style="--c:${col};animation-delay:${(step * 0.5).toFixed(0)}ms"/>`;
    }
    const at = (step * (m.from ? 0.58 : 0.1)).toFixed(0);
    const word = m.kind === 'kijun' ? '帰順' : m.kind === 'fall' ? '降伏' : m.won ? '落' : '退';
    html += `<g transform="translate(${B.x},${B.y - 6})"><g class="wf-stamp ${m.won ? 'won' : 'lost'} ${mine ? 'mine' : ''}" style="--c:${col};animation-delay:${at}ms">
      <circle r="${word.length > 1 ? 21 : 16}"/><text>${word}</text></g></g>`;
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.innerHTML = html;
    fx.appendChild(grp);
    timer = setTimeout(() => {
      if (over) return;
      if (m.won) { paint(m.to, m.att); Sound.stamp(0); }
      timer = setTimeout(() => { grp.classList.add('fade'); next(); }, step * 0.42);
    }, +at);
  };
  next();
}

function onEndTurn() {
  Sound.unlock();
  selected = null;
  mode = null;
  const before = S.gold[PLAYER];
  S.deferDefense = getSettings().defenseMode === 'command';
  const owners0 = {};
  Object.keys(S.castles).forEach((id) => { owners0[id] = S.castles[id].owner; });
  const log = endTurn(S);
  const moves = S.moves;
  S.moves = null;
  save();
  render();
  const gain = S.gold[PLAYER] - before;
  const news = (S.news || []).slice();
  S.news = [];
  save();
  playWorld(owners0, moves, () => showSeason(S.turn, () => {
    showNewspaper(news, log, gain);
    $('ok').onclick = () => {
      Sound.tap();
      closeModal();
      afterDefenses();
    };
  }));
}

// ---------- 学園新聞 ----------
// その季の出来事を、新聞の一面のように見せる
const NEWS_FILLER = [
  ['春の陽気、各校に活気', '新入生を迎え、どの家も力をたくわえる'],
  ['夏の日差し、嵐の前の静けさ', '各家は合宿で力を磨く'],
  ['秋風立つ、決戦の気配', '文化祭の裏で、諸家の思惑が交錯する'],
  ['冬ざれの学び舎、静かな攻防', '受験を前に、各家は守りを固める'],
];
// 季節の総括：前の瓦版からの増減を測るための印（瓦版を出すたびに付け直す）
function seasonMark() {
  const cnt = {};
  Object.keys(CLANS).forEach((k) => { if (k !== 'none') cnt[k] = castlesOf(S, k).length; });
  const rec = {};
  gensOf(S, PLAYER).forEach((g) => { const r = recOf(g); rec[g.id] = { w: r.w, cap: r.cap, def: r.def, dw: r.dw }; });
  return { cnt, rec, troops: castlesOf(S, PLAYER).reduce((a, id) => a + S.castles[id].troops, 0), gens: gensOf(S, PLAYER).filter((g) => g.loc).length };
}
// 今季の働き頭：前の印から戦歴がいちばん伸びた自分の家の武将
function seasonMvp(M) {
  if (!M) return null;
  let best = null, bestScore = 0;
  gensOf(S, PLAYER).filter((g) => g.loc).forEach((g) => {
    const r = recOf(g), o = M.rec[g.id] || { w: 0, cap: 0, def: 0, dw: 0 };
    const d = { w: r.w - o.w, cap: r.cap - o.cap, def: r.def - o.def, dw: r.dw - o.dw };
    const score = d.w + d.cap * 2 + d.def * 2 + d.dw * 2 + (g.shi && g.shi.done && g.shi.at >= S.turn - 1 ? 4 : 0);
    if (score > bestScore) { best = { g, d }; bestScore = score; }
  });
  if (!best) return null;
  const { g, d } = best;
  const feats = [d.cap && `城を${d.cap}つ落とす`, d.def && `城を${d.def}度守り抜く`, d.dw && `一騎打ち${d.dw}勝`, !d.cap && d.w && `合戦${d.w}勝`,
    g.shi && g.shi.done && g.shi.at >= S.turn - 1 && `志「${SHI[g.shi.kind].name}」成就`].filter(Boolean);
  return { g, feats };
}

function showNewspaper(news, log, gain) {
  const M = S.mark || null;
  const delta = (k) => (M && M.cnt[k] !== undefined ? castlesOf(S, k).length - M.cnt[k] : 0);
  const sign = (n) => (n > 0 ? `<i class="up">▲${fmt(n)}</i>` : n < 0 ? `<i class="down">▼${fmt(-n)}</i>` : '');
  const mvp = seasonMvp(M);
  const nowTroops = castlesOf(S, PLAYER).reduce((a, id) => a + S.castles[id].troops, 0);
  const nowGens = gensOf(S, PLAYER).filter((g) => g.loc).length;
  const nextEv = EVENTS[['spring', 'summer', 'autumn', 'winter'][(S.turn + 1) % 4]];
  const mine = [
    ['城', castlesOf(S, PLAYER).length, M ? castlesOf(S, PLAYER).length - M.cnt[PLAYER] : 0],
    ['兵', fmt(nowTroops), M ? nowTroops - M.troops : 0],
    ['金', `${gain >= 0 ? '+' : ''}${fmt(gain)}`, 0],
    ['家臣', nowGens, M ? nowGens - M.gens : 0],
  ];
  S.mark = seasonMark();
  const sorted = news.slice().sort((a, b) => b.weight - a.weight);
  const [top, ...rest] = sorted;
  const head = top || { head: NEWS_FILLER[S.turn % 4][0], sub: NEWS_FILLER[S.turn % 4][1] };
  const wx = WEATHER[S.weather] || WEATHER.sun;
  const ranks = Object.keys(CLANS).filter((k) => k !== 'none' && castlesOf(S, k).length)
    .sort((a, b) => castlesOf(S, b).length - castlesOf(S, a).length);
  const maxN = Math.max(1, ...ranks.map((k) => castlesOf(S, k).length));
  // 挿絵：見出しが自分の家のことなら当主の顔（負けた話なら悔しがる顔）、そうでなければ家紋
  const lord = lordOf(S);
  const aboutMe = head.head.includes(pName());
  const lost = /奪う|破棄|包囲網/.test(head.head) && aboutMe;
  const pic = lord && (aboutMe || !top)
    ? portrait(lord, 92, lost ? 'frustrated' : top ? 'laugh' : null)
    : crestBadge(ranks[0] || PLAYER, 80);
  const caption = lord && (aboutMe || !top) ? `${esc(lord.name)}${lost ? ' 無念' : top ? ' 大手柄' : ''}` : '諸国の動き';
  // 瓦版：右から左へ、縦書きで読む
  openModal(`<div class="paper kawaraban" data-lock>
      <div class="kb-top">
        <div class="kb-mast"><b>学園瓦版</b><small>第${S.turn}号<br>${dateLabel(S.turn)}</small></div>
        <div class="kb-head"><h2>${esc(head.head)}</h2>${head.sub ? `<p>${esc(head.sub)}</p>` : ''}</div>
        <div class="kb-side">
          <div class="kb-pic">${pic}<span>${caption}</span></div>
          ${rest.length ? `<div class="kb-cols">${rest.slice(0, 3).map((n) => `<p><b>${esc(n.head)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</p>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="np-row">
        <div class="np-box np-wx"><em>天気予報</em><span class="np-wxi">${wx.icon}</span><b>${wx.name}</b><small>${wx.desc}</small></div>
        <div class="np-box np-rank"><em>勢力番付</em>${ranks.slice(0, 6).map((k, i) => `<div class="np-r ${k === PLAYER ? 'me' : ''}">
          <span>${i + 1}</span>${crestBadge(k, 14)}<i style="width:${(castlesOf(S, k).length / maxN) * 100}%;background:${CLANS[k].color}"></i><b>${castlesOf(S, k).length}${sign(delta(k))}</b></div>`).join('')}</div>
      </div>
      <div class="np-row np-row2">
        <div class="np-box np-mvp"><em>今季の働き頭</em>${mvp
          ? `${portrait(mvp.g, 46, 'laugh')}<div><b>${esc(mvp.g.name)}</b>${nickOf(mvp.g) ? `<small>「${esc(nickOf(mvp.g))}」</small>` : ''}<p>${mvp.feats.map(esc).join('・')}</p></div>`
          : '<p class="np-quiet">今季は大きな手柄なし。<br>次の季こそ</p>'}</div>
        <div class="np-box np-home"><em>${esc(pName())}の一季</em>
          <div class="np-nums">${mine.map(([l, v, d]) => `<div><span>${l}</span><b>${v}</b>${l === '金' ? '' : sign(typeof d === 'number' && Math.abs(d) >= (l === '兵' ? 10 : 1) ? (l === '兵' ? Math.round(d) : d) : 0)}</div>`).join('')}</div>
          <p class="np-next">来季の行事：<b>${nextEv ? esc(nextEv.title) : ''}</b>　収入 ${fmt(income(S, PLAYER))}/季</p></div>
      </div>
      <details class="np-log"><summary>諸国の動きをすべて見る（${log.length}件）</summary>
        <ul class="log">${log.length ? log.map((l) => `<li>${esc(l)}</li>`).join('') : '<li>諸国に大きな動きはなかった。</li>'}</ul></details>
      <div class="kb-seal">瓦版<br>之印</div>
    </div>
    <button class="btn red" id="ok">承 知</button>`);
}

// 敵襲の合戦をすべて終えてから、勝ち負けを調べて季節の出来事へ
function afterDefenses() {
  processDefenses(() => {
    checkWin(S);
    save();
    render();
    if (S.result) showEnding();
    else runEvents(() => { achievementToast(checkAchievements(S)); maybeHyojo(); });
  });
}

// エンディング：その回の戦いを絵巻にして振り返る（名場面・功労者・宿敵・数字）
const fameOf = (r) => (r ? r.w + r.cap + r.dw * 2 + r.def : 0);
function endingSaga() {
  const saga = (S.saga || []).slice();
  const top = saga.slice().sort((a, b) => b.weight - a.weight).slice(0, 10);
  const scenes = saga.filter((e) => top.includes(e)); // 時の流れの順に戻す
  const first = S.lords[0];
  const rows = [{ turn: first ? first.from : 0, head: `${pName()}、天下へ名乗りを上げる`, sub: `初代当主 ${first ? first.name : ''}`, weight: 60 }, ...scenes];
  const end = S.result === 'win'
    ? { turn: S.turn, head: '天下統一', sub: `${MAP.nodes.length}校をすべて制覇`, weight: 99 }
    : { turn: S.turn, head: '落日', sub: '最後の城が落ちる', weight: 99 };
  rows.push(end);
  return rows.map((e, i) => `<li class="${e.weight >= 88 ? 'big' : ''}" style="--d:${i * 0.08}s">
      <span class="em-date">${dateLabel(e.turn).replace(' ', '<br>')}</span>
      <div><b>${esc(e.head)}</b>${e.sub ? `<small>${esc(e.sub)}</small>` : ''}</div></li>`).join('');
}
function endingHeroes() {
  const alive = gensOf(S, PLAYER).map((g) => ({ g, r: recOf(g), nick: nickOf(g) }));
  const past = (S.hall || []).map((h) => ({ g: h, r: h.rec, nick: h.nick, grad: true }));
  const list = [...alive, ...past].filter((x) => fameOf(x.r) > 0).sort((a, b) => fameOf(b.r) - fameOf(a.r)).slice(0, 3);
  if (!list.length) return '';
  const rank = ['一', '二', '三'];
  return `<h3>功労者</h3><div class="em-heroes">${list.map((x, i) => `<div class="em-hero ${i === 0 ? 'first' : ''}">
      <span class="em-rank">${rank[i]}</span>${portrait(x.g, 60)}
      <div><b>${esc(x.g.name)}</b>${x.nick ? `<i>「${esc(x.nick)}」</i>` : ''}
      <small>勝${x.r.w}・攻略${x.r.cap}・守り${x.r.def}・一騎打ち${x.r.dw}勝${x.grad ? '・卒業' : ''}</small></div></div>`).join('')}</div>`;
}
function endingRival() {
  const book = Object.values(S.rivalBook || {}).sort((a, b) => b.n - a.n)[0];
  if (!book) return '';
  const me = S.gens[book.meId], foe = S.gens[book.foeId];
  const pic = (g, dir) => (g ? portrait(g, 56, 'angry', dir) : '<span class="em-gone">卒</span>');
  return `<h3>宿敵</h3><div class="em-rival">
      <div>${pic(me, 'R')}<b>${esc(book.me)}</b></div>
      <div class="em-vs"><span>対</span><small>${book.n}度の激突</small></div>
      <div>${pic(foe, 'L')}<b>${esc(book.foe)}</b><small>${CLANS[book.foeClan] ? CLANS[book.foeClan].name : ''}</small></div></div>`;
}
function endingNumbers() {
  const st = S.stats || {};
  const tr = gensOf(S, PLAYER).filter((g) => g.treasure).length + (S.vault || []).length;
  const n = [['合戦の勝利', st.battlesWon || 0], ['一騎打ち', st.duelWins || 0], ['舌戦の開城', st.debateWins || 0], ['家宝', tr], ['当主', S.lords.length], ['家臣', gensOf(S, PLAYER).length]];
  return `<div class="stats em-nums">${n.map(([l, v]) => `<div class="stat"><span class="n">${v}</span><span class="l">${l}</span></div>`).join('')}</div>`;
}
// ---------- 天下統一の大団円 ----------
// 金箔の空に朱の日輪、当主の大首絵を、すべての家の紋がぐるりと囲む
const FINALE_LINES = ['皆の者、よくぞここまでついてきてくれた！', 'この天下、皆で掴んだものだ', '学び舎に、泰平の世を', '先代たちよ、見ておられますか'];
function showFinale(then) {
  const lord = lordOf(S) || Object.values(S.gens).find((g) => g.lord && g.clan === PLAYER);
  const clans = Object.keys(CLANS).filter((k) => k !== 'none' && MAP.byId[k] && MAP.byId[k].clan === k); // このシナリオで家として出た家だけ
  const ring = clans.map((k, i) => {
    const a = (i / clans.length) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 44;
    return `<span class="fn-crest ${k === PLAYER ? 'me' : ''}" style="left:${x}%;top:${y}%;animation-delay:${0.6 + i * 0.12}s">${crestBadge(k, 40)}</span>`;
  }).join('');
  let box = $('finale');
  if (!box) { box = document.createElement('div'); box.id = 'finale'; box.className = 'kime finale'; document.body.appendChild(box); }
  box.innerHTML = `<div class="fn-card">
      <div class="fn-title">天下統一</div>
      <div class="fn-stage">
        <div class="fn-sun"></div>
        ${ring}
        <div class="fn-lord">${lord ? portrait(lord, 220, 'laugh') : crestBadge(PLAYER, 160)}</div>
      </div>
      ${lord ? `<p class="fn-line"><b>${esc(lord.name)}</b>「${esc(pick(S.lords.length > 1 ? FINALE_LINES : FINALE_LINES.slice(0, 3)))}」</p>` : ''}
      <p class="fn-sub">${dateLabel(S.turn)}　${pName()} ${S.lords.length}代目当主　${MAP.nodes.length}校を平定</p>
      <p class="kime-tap">画面をタップ</p>
    </div>`;
  box.hidden = false;
  Sound.hyoshigi(3); Sound.taiko(0.7, 1.2); Sound.taiko(0.95, 1.2); Sound.kira();
  box.onclick = null;
  let closed = false;
  setTimeout(() => { box.onclick = () => { if (closed) return; closed = true; Sound.tap(); box.hidden = true; then(); }; }, 1500);
}

// ---------- 勢力図の移り変わり ----------
// 季ごとの城の持ち主（S.hist）を、金屏風の上の地図で再生する。家ごとの城の数の帯も一緒に動く
function replayFrames(s) {
  const keys = Object.keys(CLANS);
  const out = [];
  let cur = null;
  (s.hist || []).forEach((h) => {
    if (h.f) cur = [...h.f].map((ch) => keys[parseInt(ch, 36)] || 'none');
    if (cur) out.push({ t: h.t, own: cur });
  });
  const last = MAP.nodes.map((n) => s.castles[n.id].owner);
  if (!out.length || out[out.length - 1].t !== s.turn) out.push({ t: s.turn, own: last });
  return out;
}
function showReplay(back) {
  const frames = replayFrames(S);
  const scn = SCENARIOS[MAP_SCENARIO].scenery, lands = scn && scn.lands;
  const clans = [...new Set(frames.flatMap((f) => f.own))].filter((k) => k !== 'none');
  const col = (k) => (k === 'none' ? '#cfc4a8' : CLANS[k].color);
  openModal(`<h2>勢力図の移り変わり</h2>
    <div class="replay">
      <svg class="rp-map" viewBox="0 0 ${MAP.width} ${MAP.height}" preserveAspectRatio="xMidYMid meet">
        <g>${sceneryMarkup()}</g>
        <g ${lands ? 'clip-path="url(#landclip)"' : ''}>${MAP.nodes.map((n) => `<path class="rp-cell" data-i="${MAP.nodes.indexOf(n)}" d="${CELLS[n.id]}"/>`).join('')}</g>
        <g>${MAP.nodes.map((n, i) => `<circle class="rp-dot" data-i="${i}" cx="${n.x}" cy="${n.y}" r="9"/>`).join('')}</g>
      </svg>
      <div class="rp-date" id="rp-date"></div>
    </div>
    <div class="rp-bar" id="rp-bar"></div>
    <div class="rp-ctl"><button class="btn" id="rp-play">▶ 再生</button><input type="range" id="rp-seek" min="0" max="${frames.length - 1}" value="0"></div>
    <p class="rp-legend">${clans.map((k) => `<span><i style="background:${col(k)}"></i>${CLANS[k].name}</span>`).join('')}</p>
    <button class="btn plain" id="rp-back">もどる</button>`);
  const cells = [...modalBody.querySelectorAll('.rp-cell')], dots = [...modalBody.querySelectorAll('.rp-dot')];
  let i = 0, timer = null;
  const show = (k) => {
    i = k;
    const f = frames[k], prev = frames[k - 1];
    f.own.forEach((o, n) => {
      cells[n].style.fill = col(o);
      dots[n].style.fill = col(o);
      dots[n].classList.toggle('flip', !!prev && prev.own[n] !== o); // この季に持ち主が変わった城
    });
    $('rp-date').textContent = dateLabel(f.t);
    $('rp-seek').value = k;
    const count = {};
    f.own.forEach((o) => { count[o] = (count[o] || 0) + 1; });
    $('rp-bar').innerHTML = Object.entries(count).sort((a, b) => (a[0] === PLAYER ? -1 : b[0] === PLAYER ? 1 : b[1] - a[1]))
      .map(([o, c]) => `<i style="flex:${c};background:${col(o)}" title="${o === 'none' ? '独立' : CLANS[o].name} ${c}"></i>`).join('');
  };
  const stop = () => { clearInterval(timer); timer = null; $('rp-play').textContent = '▶ 再生'; };
  const play = () => {
    if (i >= frames.length - 1) show(0);
    $('rp-play').textContent = '❚❚ 止める';
    timer = setInterval(() => {
      if (!$('rp-seek')) { clearInterval(timer); return; }
      if (i >= frames.length - 1) { stop(); return; }
      show(i + 1);
      if (frames[i].own.some((o, n) => frames[i - 1] && frames[i - 1].own[n] !== o)) Sound.tap();
    }, frames.length > 60 ? 260 : 420);
  };
  $('rp-play').onclick = () => (timer ? stop() : play());
  $('rp-seek').oninput = (e) => { stop(); show(+e.target.value); };
  $('rp-back').onclick = () => { stop(); Sound.tap(); back(); };
  show(0);
  setTimeout(() => { if ($('rp-seek')) play(); }, 600);
}

function showEnding() {
  const win = S.result === 'win';
  // 天下統一なら、まず大団円の一枚絵
  if (win && !S.finaleShown) { S.finaleShown = true; closeModal(); Sound.bgmStart('win'); showFinale(showEnding); return; }
  Sound.bgmStart(win ? 'win' : 'lose');
  const { got, unlockedNow } = recordEnding(S);
  save();
  const lord = lordOf(S) || Object.values(S.gens).find((g) => g.lord);
  openModal(`<div class="ending ${win ? 'win' : 'lose'}" data-lock>
      ${lord ? portrait(lord, 84, win ? 'laugh' : 'frustrated') : crestBadge(PLAYER, 72)}
      <div class="big">${win ? '天下統一' : '落 日'}</div>
      <p>${win
        ? `${dateLabel(S.turn)}、${pName()} ${S.lords.length}代目当主 ${esc(lord ? lord.name : S.lords[S.lords.length - 1].name)} は${MAP.nodes.length}校をすべて制覇した！`
        : S.failReason === 'speed' ? `${dateLabel(S.turn)}、挑戦状「二十季の天下」の期限が尽きた。天下はまだ遠い…` : `${dateLabel(S.turn)}、${pName()}の城はすべて奪われた…`}</p>
      <p class="hint">${SCENARIOS[S.scenario].name} ・ 難易度：${diffOf(S).name} ・ ${S.turn}季${S.debugUsed ? '<br>（デバッグを使ったため記録されません）' : ''}</p>
    </div>
    ${unlockedNow ? '<p class="result">🔓 すべての家で遊べるようになった！</p>' : ''}
    ${got.length ? `<h3>新しい実績</h3><div class="seal-grid">${got.map((a) => achSeal(a, true)).join('')}</div>` : ''}
    <h3>${pShort()}${win ? "天下" : "興亡"}絵巻</h3>
    <ol class="emaki">${endingSaga()}</ol>
    ${endingHeroes()}
    ${endingRival()}
    <h3>数字で見る</h3>
    ${endingNumbers()}
    <h3>歴代当主</h3>
    ${lordsHistory()}
    ${(S.hist || []).length > 1 ? '<button class="btn red" id="see-replay">勢力図の移り変わりを見る</button>' : ''}
    <button class="btn" id="see-card">絵にして残す</button>
    <button class="btn" id="see-annals">年表を見る</button>
    <button class="btn red" id="again">もう一度</button>
    <button class="btn plain" id="to-title">タイトルへ</button>`);
  $('again').onclick = () => { clearSave(); closeModal(); showSetup(); };
  $('see-annals').onclick = () => { Sound.tap(); showChronicle(chronicleOf(S), showEnding); };
  if ($('see-replay')) $('see-replay').onclick = () => { Sound.tap(); showReplay(showEnding); };
  $('see-card').onclick = () => { Sound.tap(); showShareCard(showEnding); };
  $('to-title').onclick = () => { clearSave(); closeModal(); showTitle(); };
}

// ---------- 実績と戦績 ----------
// 実績の印：取れたものは朱の落款、まだのものは空の枠
function achSeal(a, done) {
  return `<div class="aseal ${done ? 'done' : ''}"><span class="as-stamp">${done ? a.icon : ''}</span>
    <b>${done ? a.name : '？？？'}</b><small>${a.desc}</small></div>`;
}
function achCard(a, done = true) {
  return `<div class="ach ${done ? '' : 'locked'}"><span class="ai">${done ? a.icon : '？'}</span>
    <div><b>${done ? a.name : '？？？'}</b><small>${a.desc}</small></div></div>`;
}

let achTimer;
function achievementToast(list) {
  if (!list || !list.length) return;
  const t = $('ach-toast');
  t.innerHTML = list.map((a) => `<div>🏆 実績「<b>${a.name}</b>」を達成！</div>`).join('');
  t.hidden = false;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  Sound.stamp(); Sound.stamp(0.12);
  clearTimeout(achTimer);
  achTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function showRecords() {
  const rec = loadRecords();
  const got = ACHIEVEMENTS.filter((a) => rec.ach[a.id]).length;
  // 版ごとにまとめる：最短記録の表に版の見出し、家ごとの勝利も版ごとに
  const best = Object.entries(EDITIONS).map(([ek, e]) => `<tr class="ed-row"><th colspan="${Object.keys(DIFFICULTY).length + 1}">${e.name}</th></tr>` + scenariosOf(ek).map((sk) => {
    const cells = Object.entries(DIFFICULTY).map(([dk]) => {
      const t = rec.best[`${sk}/${dk}`];
      return `<td>${t ? `${t}季` : '―'}</td>`;
    }).join('');
    return `<tr><th>${SCENARIOS[sk].name}</th>${cells}</tr>`;
  }).join('')).join('');
  const seen = new Set();
  const clans = Object.entries(EDITIONS).map(([ek, e]) => {
    const ks = [...new Set(scenariosOf(ek).flatMap(scenarioClans))].filter((k) => !seen.has(k));
    ks.forEach((k) => seen.add(k));
    return ks.length ? `<p class="cw-ed">${e.name}</p><div class="clan-wins">${ks.map((k) => `<div class="cw ${rec.clanWins[k] ? 'won' : ''}" style="--c:${CLANS[k].color}">${crestBadge(k, 34)}<b>${CLANS[k].name.replace('家', '')}</b><span>${rec.clanWins[k] || 0}勝</span></div>`).join('')}</div>` : '';
  }).join('');
  openModal(`<h2>戦績・実績</h2>
    <div class="stats"><div class="stat"><span class="n">${rec.wins}</span><span class="l">天下統一</span></div>
      <div class="stat"><span class="n">${rec.plays}</span><span class="l">遊んだ回数</span></div>
      <div class="stat"><span class="n">${got}/${ACHIEVEMENTS.length}</span><span class="l">実績</span></div></div>
    <h3>最短の天下統一</h3>
    <table class="best"><tr><th></th>${Object.values(DIFFICULTY).map((d) => `<th>${d.name}</th>`).join('')}</tr>${best}</table>
    <h3>家ごとの勝利</h3>
    ${clans}
    <p class="hint">${rec.unlocked.length > 1 ? '🔓 すべての家で遊べます' : '🔒 一度天下統一すると、他の家でも遊べるようになります'}</p>
    ${(rec.annals || []).length ? `<h3>天下取りの年表</h3><div class="an-list">${rec.annals.map((a, i) => `<button class="an-row" data-ann="${i}">${CLANS[a.player] ? crestBadge(a.player, 26) : ''}<b>${esc(a.house)}</b><small>${(SCENARIOS[a.scenario] || SCENARIOS.tokyo).name}・${a.turn}季・${new Date(a.at).getMonth() + 1}/${new Date(a.at).getDate()}</small><i class="${a.result}">${a.result === 'win' ? '統一' : '落日'}</i></button>`).join('')}</div>` : ''}
    <h3>挑戦状</h3>
    <div class="ch-seals">${Object.entries(CHALLENGES).map(([k, c]) => { const done = (rec.challenges || {})[k] || []; return `<div class="ch-seal ${done.length ? 'got' : ''}"><span>${c.mark}</span><b>${c.name}</b><small>${done.length ? done.map((sc) => (SCENARIOS[sc] || {}).name).join('・') : c.desc}</small></div>`; }).join('')}</div>
    <h3>名場面帖</h3>
    <div class="mb-book-grid">${Object.entries(MEIBA).map(([id, m]) => (rec.meiba || {})[id] ? `<div class="mb-slot got"><b>${m.name}</b><small>${m.sub}</small></div>` : `<div class="mb-slot"><b>？？？</b><small>${m.desc.split("。")[0]}…</small></div>`).join("")}</div>
    <h3>実績の印</h3>
    <div class="ach-meter"><i style="width:${Math.round((got / ACHIEVEMENTS.length) * 100)}%"></i><span>${got} / ${ACHIEVEMENTS.length}</span></div>
    <div class="seal-grid">${ACHIEVEMENTS.map((a) => achSeal(a, !!rec.ach[a.id])).join('')}</div>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll("[data-ann]").forEach((b) => { b.onclick = () => { Sound.tap(); showChronicle(rec.annals[+b.dataset.ann], showRecords); }; });
}

// ---------- デバッグモード（テスト用の隠し機能） ----------
// タイトルの家紋を5回続けてタップすると、切りかわる
const DEBUG_KEY = 'azabu-debug';
function debugOn() { try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch (e) { return false; } }
let crestTaps = 0, crestTimer;
$('title-crest').addEventListener('click', () => {
  crestTaps++;
  clearTimeout(crestTimer);
  crestTimer = setTimeout(() => { crestTaps = 0; }, 1500);
  if (crestTaps >= 5) {
    crestTaps = 0;
    const on = !debugOn();
    try { localStorage.setItem(DEBUG_KEY, on ? '1' : '0'); } catch (e) {}
    Sound.tap();
    askAlert(on ? 'デバッグモード：ON\n（ゲーム中の目録に「デバッグ」が出ます）' : 'デバッグモード：OFF');
  }
});

function showDebug() {
  const lord = lordOf(S);
  openModal(`<h2>デバッグ</h2>
    <p class="hint">テスト用の機能です。使ったゲームは戦績・実績に記録されません。</p>
    <div class="dbg-grid">
      <button class="btn plain" data-dbg="gold">金 +5000</button>
      <button class="btn plain" data-dbg="refresh">全武将の命令を回復</button>
      <button class="btn plain" data-dbg="troops">自分の城の兵 +2000</button>
      <button class="btn plain" data-dbg="spring">次の春まで進める</button>
      <button class="btn plain" data-dbg="senior">当主を3年生にする</button>
      <button class="btn plain" data-dbg="freeze">敵の動きを${S.debugFreeze ? '再開' : '止める'}</button>
      <button class="btn plain" data-dbg="win">勝利エンディングへ</button>
      <button class="btn plain" data-dbg="lose">敗北エンディングへ</button>
      <button class="btn plain" data-dbg="unlock">全家を解放</button>
      <button class="btn plain" data-dbg="reset">戦績・実績を消す</button>
    </div>
    <p class="hint">当主：${lord ? `${esc(lord.name)}（${lord.grade}年）` : 'なし'} ／ ${dateLabel(S.turn)}</p>
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-dbg]').forEach((b) => {
    b.onclick = async () => {
      Sound.tap();
      const k = b.dataset.dbg;
      if (k === 'reset' && !(await askConfirm('戦績・実績・家の解放をすべて消しますか？', { ok: '消す' }))) return;
      S.debugUsed = true;
      S.debug = true;
      if (k === 'gold') S.gold[PLAYER] += 5000;
      if (k === 'refresh') S.acted = {};
      if (k === 'troops') castlesOf(S, PLAYER).forEach((id) => { S.castles[id].troops = Math.min(RULES.troopCap, S.castles[id].troops + 2000); });
      if (k === 'senior' && lord) lord.grade = 3;
      if (k === 'freeze') S.debugFreeze = !S.debugFreeze;
      if (k === 'unlock') { const r = loadRecords(); r.unlocked = Object.keys(CLANS).filter((c) => c !== 'none'); saveRecords(r); }
      if (k === 'reset') { try { localStorage.removeItem(RECORD_KEY); } catch (e) {} }
      if (k === 'win' || k === 'lose') {
        S.result = k;
        save();
        closeModal();
        showEnding();
        return;
      }
      if (k === 'spring') {
        // 次の春まで進める（途中の季節の出来事は省略。敵の攻撃はその場で決着させる）
        S.deferDefense = false;
        do {
          endTurn(S);
          if (S.turn % 4 !== 0) S.pending = [];
        } while (S.turn % 4 !== 0 && !S.result);
        save();
        render();
        closeModal();
        if (S.result) showEnding(); else runEvents(() => {});
        return;
      }
      save();
      render();
      showDebug();
    };
  });
}

// ---------- メニュー・音 ----------
$('btn-menu').onclick = () => {
  Sound.tap();
  openModal(`<h2>目 録</h2>
    <button class="btn plain" id="m-roster">家臣団（武将一覧・歴代当主）</button>
    <button class="btn plain" id="m-diplo">外交</button>
    <button class="btn plain" id="m-settings">設定（合戦のおまかせ・速さ）</button>
    <button class="btn plain" id="m-records">戦績・実績</button>
    <button class="btn plain" id="m-annals">年表（この天下取りのあゆみ）</button>
    <button class="btn plain" id="m-card">いまの勢力を絵にする（共有・保存）</button>
    <button class="btn plain" id="m-zukan">学校図鑑</button>
    <button class="btn plain" id="m-names">名前の編集（学校・家）</button>
    <button class="btn plain" id="m-export">セーブの書き出し（枠${currentSlot}）</button>
    <button class="btn plain" id="m-help">遊び方</button>
    ${debugOn() ? '<button class="btn plain" id="m-debug">🛠 デバッグ</button>' : ''}
    <button class="btn plain" id="m-title">タイトルへ（自動で保存されます）</button>
    <button class="btn plain" data-close>閉じる</button>`);
  $('m-roster').onclick = () => { Sound.tap(); showRoster(); };
  $('m-diplo').onclick = () => { Sound.tap(); showDiplomacy(); };
  $('m-records').onclick = () => { Sound.tap(); showRecords(); };
  $('m-zukan').onclick = () => { Sound.tap(); save(); showZukan(edOf(S.scenario)); };
  $('m-annals').onclick = () => { Sound.tap(); showChronicle(chronicleOf(S)); };
  $('m-names').onclick = () => { Sound.tap(); showNameEditor(edOf(S.scenario)); };
  $('m-card').onclick = () => { Sound.tap(); showShareCard(); };
  $('m-settings').onclick = () => { Sound.tap(); showSettings(); };
  $('m-export').onclick = () => { Sound.tap(); save(); showExport(currentSlot, closeModal); };
  $('m-help').onclick = () => { Sound.tap(); showHelp(); };
  if ($('m-debug')) $('m-debug').onclick = () => { Sound.tap(); showDebug(); };
  $('m-title').onclick = () => { closeModal(); showTitle(); };
};
$('btn-sound').onclick = () => {
  Sound.toggle();
  $('btn-sound').textContent = Sound.on ? '♪' : '✕';
  if (Sound.on && !$('game').hidden && $('battle').hidden && S && !S.result) Sound.bgmStart('map');
};

modal.addEventListener('click', (e) => {
  const locked = !!modalBody.querySelector('[data-lock]');
  if ((e.target === modal && !locked) || e.target.closest('[data-close]')) {
    if (e.target.closest('[data-close]')) Sound.tap();
    closeModal();
  }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

showTitle();

// ---------- 読み込み画面：筆文字が揃ったら（長くても2.5秒で）幕を上げる ----------
(() => {
  const ld = $('loader');
  if (!ld) return;
  const t0 = Date.now();
  let done = false;
  const lift = () => {
    if (done) return;
    done = true;
    setTimeout(() => { ld.classList.add('out'); setTimeout(() => { ld.hidden = true; }, 600); }, Math.max(0, 600 - (Date.now() - t0)));
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(lift, lift);
  setTimeout(lift, 2500);
})();

// ---------- 襖の場面転換：左右の襖が開いて、地図があらわれる ----------
function fusuma() {
  const f = document.createElement('div');
  f.className = 'fusuma';
  f.innerHTML = '<i class="fs-l"></i><i class="fs-r"></i>';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

// ---------- 題と落款：架空の名前のときは「学園の野望」に ----------
(() => {
  const t = gameTitle(), sl = gameSeal();
  document.title = t;
  const h = document.querySelector('.title-tanzaku');
  if (h) h.textContent = t;
  document.querySelectorAll('#title .seal, .ld-seal').forEach((e) => { e.innerHTML = `${sl}<br>之印`; });
  const dis = document.querySelector('.disclaimer');
  if (dis && loadNameEdits().fictional) dis.textContent = '※登場する学校・家・人物はすべて架空のものです。';
})();

// ---------- 和紙の地：繊維と墨のしみを一度だけ描いて、地図の下に敷く ----------
(() => {
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 320;
    const c = cv.getContext('2d');
    const r = seeded(20261015);
    for (let i = 0; i < 26; i++) { // 墨のしみ（ごく薄く）
      const x = r() * 320, y = r() * 320, rad = 30 + r() * 70;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(70, 60, 40, ${(0.025 + r() * 0.03).toFixed(3)})`); g.addColorStop(1, 'rgba(70, 60, 40, 0)');
      c.fillStyle = g; c.fillRect(0, 0, 320, 320);
    }
    for (let i = 0; i < 700; i++) { // 和紙の繊維
      const x = r() * 320, y = r() * 320, a = r() * Math.PI, l = 4 + r() * 16;
      c.strokeStyle = `rgba(110, 85, 50, ${(0.04 + r() * 0.08).toFixed(3)})`; c.lineWidth = 0.6 + r() * 0.6;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 3, y + Math.sin(a) * l * 0.5 + r() * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    document.documentElement.style.setProperty('--paper-tex', `url(${cv.toDataURL('image/png')})`);
  } catch (e) {}
})();

// 決め絵の背に敷く「朱の一刷け」：かすれた筆の跡と金の砂子を、一度だけ描いて使い回す
(function brushSweep() {
  try {
    const W = 900, H = 260, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), r = seeded(19801225);
    // 穂先の一本一本：帯の中を左から右へ。ところどころかすれる
    for (let i = 0; i < 260; i++) {
      const y = H * 0.22 + r() * H * 0.56, edge = Math.abs(y - H / 2) / (H * 0.28);
      const x0 = 30 + r() * 80 + edge * 120, x1 = W - 40 - r() * 120 - edge * 160;
      c.strokeStyle = `rgba(${170 + Math.floor(r() * 30)}, ${30 + Math.floor(r() * 20)}, 28, ${0.08 + r() * 0.16 * (1 - edge * 0.6)})`;
      c.lineWidth = 2 + r() * 7;
      c.lineCap = 'round';
      let x = x0;
      c.beginPath(); c.moveTo(x, y);
      while (x < x1) {
        const step = 30 + r() * 90, dy = (r() - 0.5) * 4 + (x - x0) * -0.004;
        if (r() < 0.12) { c.stroke(); c.beginPath(); x += step * 0.5; c.moveTo(x, y + dy); continue; } // かすれ
        x += step; c.lineTo(Math.min(x, x1), y + dy);
      }
      c.stroke();
    }
    // 筆の入りの溜まり
    const g = c.createRadialGradient(110, H / 2, 10, 110, H / 2, 110);
    g.addColorStop(0, 'rgba(190, 42, 30, 0.55)'); g.addColorStop(1, 'rgba(190, 42, 30, 0)');
    c.fillStyle = g; c.fillRect(0, 0, 260, H);
    // 飛び散る墨と金の砂子
    for (let i = 0; i < 70; i++) {
      const gold = r() < 0.6, x = r() * W, y = r() * H, rad = gold ? 0.8 + r() * 2.2 : 1 + r() * 4;
      c.fillStyle = gold ? `rgba(232, 196, 104, ${0.5 + r() * 0.5})` : `rgba(180, 38, 30, ${0.3 + r() * 0.4})`;
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    document.documentElement.style.setProperty('--brush-sweep', `url(${cv.toDataURL('image/png')})`);
  } catch (e) {}
})();

// ---------- 家の志が高まったときの決め絵 ----------
const _tsRender = render;
render = function (...a) {
  const r = _tsRender.apply(this, a);
  if (S && S.taishiUp) {
    const up = S.taishiUp;
    setTimeout(() => {
      const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden;
      if (busy || !S || S.taishiUp !== up) return; // 合戦や窓が閉じたあとの render でもう一度
      S.taishiUp = null;
      const T = TAISHI[up.k];
      Sound.horagai();
      showKime(lordOf(S) || bestBy(gensOf(S, PLAYER), 'cha'), `志、${'一二三'[up.lv - 1]}段`, `${T.motto}——この志、天下に示す`, null, 'laugh',
        `<p class="ts-up"><b>${T.name}</b>の志が高まった：${T.step}（いまは${'一二三'[up.lv - 1]}段）</p>`);
    }, 900);
  }
  return r;
};

// ---------- 宿敵を討ち果たしたときの決め絵 ----------
const _nmRender = render;
render = function (...a) {
  const r = _nmRender.apply(this, a);
  if (S && S.nemesis && !S.nemesisDone && !castlesOf(S, S.nemesis).length) {
    const k = checkNemesis(S);
    if (k) {
      const shot = () => {
        const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden;
        if (busy) { setTimeout(shot, 1200); return; }
        Sound.horagai();
        showKime(lordOf(S) || bestBy(gensOf(S, PLAYER), 'str'), '宿敵、討ち果たす', `${CLANS[k].name}との因縁、ここに決着！`, null, 'laugh',
          `<p class="ts-up">褒美：金+${NEMESIS.gold}・全家臣の忠誠+${NEMESIS.loyal}</p>`);
      };
      setTimeout(shot, 900);
    }
  }
  return r;
};

// ---------- 家臣の声：軍議の画面に、話しかけてくる家臣の吹き出し ----------
function talkCard() {
  if (!S || S.result) return '';
  const t = talkOfSeason(S);
  if (!t || t.none) return '';
  const g = S.gens[t.gid];
  if (!g || g.clan !== PLAYER) return '';
  if (t.done) return `<div class="talk done">${portrait(g, 40, 'smile')}<p><b>${esc(g.name)}</b>${esc(t.reply || '')}</p></div>`;
  const btn = (x, i) => `<button class="btn ${i ? 'plain' : ''}" data-talk="${i}" ${x.gold && S.gold[PLAYER] < x.gold ? 'disabled' : ''}>${x.label}${x.sub ? `<small class="sub">${x.sub}</small>` : ''}</button>`;
  return `<div class="talk">
    <div class="talk-who">${portrait(g, 56, t.mood)}<b>${esc(g.name)}</b><small>${esc(g.title || '')}・${g.loc ? MAP.byId[g.loc].short : ''}</small></div>
    <div class="talk-bubble"><span class="talk-tag">家臣の声</span><p>「${esc(t.line)}」</p><div class="talk-btns">${btn(t.a, 0)}${btn(t.b, 1)}</div></div>
  </div>`;
}
const _tkRender = render;
render = function (...a) {
  const r = _tkRender.apply(this, a);
  const tiles = document.querySelector('.council .cn-tiles');
  if (tiles && !document.querySelector('.council .talk')) {
    tiles.insertAdjacentHTML('afterend', talkCard());
    document.querySelectorAll('.council [data-talk]').forEach((b) => {
      b.onclick = () => {
        Sound.tap();
        const reply = talkAnswer(S, +b.dataset.talk);
        if (S.talk) S.talk.reply = reply;
        save();
        render();
        if (reply) toast(`${portrait(S.gens[S.talk.gid], 30, 'smile')}<span>${esc(reply)}</span>`);
      };
    });
  }
  return r;
};
