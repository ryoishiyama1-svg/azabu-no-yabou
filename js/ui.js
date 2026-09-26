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
function save() { writeSlot(currentSlot, S); }
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
  return `<div class="gcard ${acted ? 'acted' : ''}" data-gid="${g.id}">
    ${portrait(g, 46)}
    <div class="gi">
      <div class="gn">${esc(g.name)}${g.lord ? '<span class="lord">当主</span>' : ''}${loyalTag(g)}</div>
      <div class="gt">${gradeTag(g)}${esc(g.title)} ${skillTag(g)}</div>
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
petals($('title-petals'), 0, 18);

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
  if ($('ex-share')) $('ex-share').onclick = () => navigator.share({ title: '麻布の野望 セーブ', text: code }).catch(() => {});
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
$('btn-records').onclick = () => { Sound.unlock(); Sound.tap(); showRecords(); };

// シナリオ・家・当主の名前・難易度を決める
const TUT_KEY = 'azabu-tut-done';
function tutDone() { try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; } }

function showSetup() {
  const rec = loadRecords();
  const st = { diff: 'normal', scenario: tutDone() ? 'tokyo' : 'toshin', clan: 'azabu', name: '' };
  const pickList = (attr, obj, cur, label) => `<div class="diff-list">${Object.entries(obj).map(([k, d]) =>
    `<button data-${attr}="${k}" class="${k === cur ? 'on' : ''}"><b>${d.name}</b>${label(d)}<small>${d.desc}</small></button>`).join('')}</div>`;
  const clanList = () => {
    const ids = Object.keys(CLANS).filter((k) => k !== 'none' && SCHOOL_ROWS.some((r) => r[0] === k && SCENARIOS[st.scenario].filter(r)));
    return `<div class="clan-pick">${ids.map((k) => {
      const locked = !rec.unlocked.includes(k);
      return `<button data-clan="${k}" class="${k === st.clan ? 'on' : ''}" ${locked ? 'disabled' : ''}>
        ${crestBadge(k, 36)}<b>${CLANS[k].name.replace('家', '')}</b>
        <small>${locked ? '🔒 天下統一で解放' : '★'.repeat(CLANS[k].stars) + '☆'.repeat(5 - CLANS[k].stars)}</small></button>`;
    }).join('')}</div><p class="hint" id="clan-note">${CLANS[st.clan].note}</p>`;
  };
  const defaultName = () => `${CLANS[st.clan].name.replace('家', '')} 一郎`;
  openModal(`<h2>旗 揚 げ</h2>
    <h3>シナリオ</h3>
    ${pickList('sc', SCENARIOS, st.scenario, (d) => `<span class="lv">${d.level}</span>`)}
    <h3>率いる家</h3>
    <div id="clan-box">${clanList()}</div>
    <h3 id="name-head">当主の名前</h3>
    <input class="name-input" id="lord-name" maxlength="10" value="${defaultName()}" autocomplete="off">
    <h3>難易度</h3>
    ${pickList('diff', DIFFICULTY, st.diff, () => '')}
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
  bindPick('sc', (v) => {
    st.scenario = v;
    // シナリオにいない家は選べないので、麻布家に戻す
    if (!SCHOOL_ROWS.some((r) => r[0] === st.clan && SCENARIOS[v].filter(r))) st.clan = 'azabu';
    $('clan-box').innerHTML = clanList();
    bindClans();
  });
  bindClans();
  bindPick('diff', (v) => { st.diff = v; });
  $('setup-go').onclick = () => {
    const name = $('lord-name').value.trim() || defaultName();
    S = newGame({ lordName: name, diff: st.diff, scenario: st.scenario, clan: st.clan, tutorial: $('tut').checked });
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
  drawMap();
  render();
  centerOn(PLAYER);
  $('zoom-home').textContent = pShort()[0];
  Sound.bgmStart('map');
  if (isNew) {
    Sound.horagai();
    const lord = lordOf(S);
    const rivals = aiClans().map((k) => CLANS[k].name.replace('家', '')).join('・');
    const retainers = gensOf(S, PLAYER).length - 1;
    openModal(`<h2>${SCENARIOS[S.scenario].name}</h2>
      <p style="text-align:center">${portrait(lord, 84)}</p>
      <p>時は${dateLabel(0)}。${pName()}当主 <b>${esc(lord.name)}</b>（${lord.grade}年）は、${MAP.byId[PLAYER].ward}の地に旗を揚げた。</p>
      <p>この地には <b>${MAP.nodes.length}校</b> がひしめき、<b>${rivals}</b> の各家も勢力拡大をねらっている。</p>
      <p>頼れる家臣は${retainers}人。城を落として武将を登用し、天下を統一せよ！</p>
      <p class="hint">家訓「${KAKUN[S.kakun].name}」：${KAKUN[S.kakun].desc}<br>
      難易度：${diffOf(S).name} ・ 最初の${graceTurns(S)}季は他家も様子見をしている<br>
      ※当主も3年生の春には卒業します。後継者を育てておきましょう</p>
      <button class="btn red" data-close>出陣じゃ！</button>`);
  }
}

function showHelp() {
  const me = S ? pName() : '自分の家';
  openModal(`<h2>遊び方</h2>
    <h3>目的</h3>
    <p>${me}を率いて、地図上のすべての学校を制覇すれば天下統一（クリア）。城がすべて奪われると敗北です。</p>
    <h3>武将</h3>
    <ul>
      <li>命令は<b>武将</b>が行います。武将1人につき1ターン1回。武将のいない城は何もできません</li>
      <li>能力：<b>統率</b>＝合戦の強さ、<b>政治</b>＝開発、<b>魅力</b>＝徴兵・登用、<b>知略</b>＝守り・作戦を読む</li>
      <li>城を落とすと、敵の武将を<b>捕らえる</b>ことがあります。登用すれば家臣になります</li>
      <li>命令をこなすと、能力が少しずつ上がります</li>
    </ul>
    <h3>忠誠と褒美</h3>
    <ul>
      <li>家臣には<b>忠誠度</b>があり、季節ごとに少しずつ下がります（当主の魅力が高いと下がりにくい）</li>
      <li><b>褒美</b>（金${LOYAL.rewardCost}）で忠誠が上がります。合戦で勝つ、合宿や文化祭の演劇でも上がります</li>
      <li>忠誠が${LOYAL.leaveBelow}未満だと<b>出奔</b>、${LOYAL.rebelBelow}未満だと城ごと<b>謀反</b>を起こすことがあります。捕虜から登用した武将は忠誠が低めです</li>
    </ul>
    <h3>学校の特色と施設</h3>
    <ul>
      <li>学校には<b>特色</b>があります：${Object.values(TRAITS).map((t) => `<b>${t.name}</b>（${t.desc}）`).join('、')}</li>
      <li>城の命令「建設」で<b>施設</b>を${FAC_SLOTS}つまで建てられます：${Object.values(FACILITIES).map((f) => `${f.name}（${f.desc}）`).join('、')}</li>
      <li>特色と施設は、城を落とすとそのまま引き継げます</li>
    </ul>
    <h3>計略</h3>
    <ul>
      <li>城の命令「計略」で、道${SCHEME_RANGE}本先までの城に仕掛けられます</li>
      <li><b>流言</b>：敵城の兵と守りを減らす ／ <b>離間</b>：敵の武将の忠誠を下げる</li>
      <li><b>引き抜き</b>：敵の武将を寝返らせる。忠誠が低い相手ほど成功しやすい</li>
      <li><b>調略</b>：独立校を戦わずに味方にする。魅力が高く、近くに大軍がいるほど成功しやすい</li>
      <li>他家も計略を仕掛けてきます。忠誠の低い家臣は引き抜かれやすいので注意</li>
    </ul>
    <h3>卒業と家督相続</h3>
    <ul>
      <li>武将には<b>学年</b>があります。毎年春、<b>3年生は卒業</b>していなくなり、各校に<b>新入生</b>が入ります</li>
      <li><b>当主が卒業する</b>と、家臣の中から後継者を選びます。当主のいちばん得意な能力で<b>家訓</b>が決まり、その代のあいだ効果があります</li>
      <li>選ばれなかった実力者は、不満を抱いて家を去ることもあります</li>
    </ul>
    <h3>合戦の作戦</h3>
    <p>出陣のとき<b>作戦</b>を選べます。突撃は奇襲に、奇襲は籠城に、籠城（持久戦）は突撃に強い、じゃんけんの関係です。読み勝つと最初の士気が上がります。知略の高い大将は、敵の作戦を読めることがあります。</p>
    <h3>合戦の采配</h3>
    <ul>
      <li>合戦は1合ずつ進み、毎回<b>攻撃・突撃・守り・計略・退却</b>から命令を選びます（最大8合）</li>
      <li><b>突撃は計略に、計略は守りに、守りは突撃に強い</b>。計略が決まると敵は混乱して1合動けません</li>
      <li>兵が残っていても<b>士気が0になると総崩れ</b>。敵の兵か士気を0にすれば落城です</li>
      <li>特技を持つ武将は<b>戦法</b>（一番槍・火計・鼓舞など）を1度だけ使えます</li>
      <li>ときどき<b>一騎打ち</b>が起こります。斬るは払うに、払うは受けるに、受けるは斬るに強い</li>
      <li>「おまかせで決着」「結果まで飛ばす」で省略もできます。目録の「設定」で、いつもおまかせにもできます</li>
      <li>敵に攻められると<b>敵襲</b>の知らせが出て、守りの合戦も采配できます</li>
    </ul>
    <h3>命令</h3>
    <ul>
      <li><b>出陣</b>：道でつながった敵城を攻める。攻め先のとなりにある城から<b>援軍</b>も出せます</li>
      <li><b>輸送</b>：となりの自分の城へ兵を送る</li>
      <li><b>移動</b>：武将をとなりの自分の城へ移す</li>
      <li><b>徴兵</b>：金${RULES.recruitCost}で兵を増やす（魅力が高いほど多い）</li>
      <li><b>開発</b>：金${RULES.developCost}で経済を上げ、収入を増やす（政治が高いほど多い）</li>
      <li><b>築城</b>：金${RULES.fortifyCost}で防御を上げる</li>
    </ul>
    <h3>委任と一括命令</h3>
    <p>城を<b>委任</b>にすると、ターン終了時に自動で命令します。「全城で徴兵／開発」でまとめて命令もできます。</p>
    <h3>外交</h3>
    <ul>
      <li>各家との<b>友好度</b>を「贈答」で上げ、<b>停戦</b>や<b>同盟</b>を申し込めます（使者＝魅力の高い武将が1人行動します）</li>
      <li>停戦・同盟の相手とはおたがいに攻め合いません。破棄すると他の家からの信用も失います</li>
      <li>城の${Math.round(DIPLO.encircleShare * 100)}%以上を持つと、諸家が<b>包囲網</b>を結成して一斉に攻めてきます</li>
      <li>各家には<b>性格</b>があります（${Object.entries(CLAN_PERSONA).filter(([k]) => k !== PLAYER).map(([k, p]) => `${CLANS[k].name.replace('家', '')}＝${PERSONAS[p].name}`).join('、')}）。停戦・同盟の結びやすさや、攻め方が変わります</li>
      <li>他家どうしも停戦・同盟を結び、ときには裏切ります。外交の画面で、他家どうしの関係も見られます</li>
    </ul>
    <h3>イベント</h3>
    <p>季節ごとに卒業式・入学式・夏合宿・文化祭・受験シーズンが訪れ、転校生や寝返りの誘いなどの出来事も起こります。</p>
    <h3>他家と実績</h3>
    <p>一度天下統一すると、他の家でも遊べるようになります。「戦績・実績」で記録を見られます。</p>
    <h3>合戦のコツ</h3>
    <p>守る側は「兵力×防御×守将」で戦います。<b>勝算大</b>と出るまで兵や援軍を集めましょう。その日の士気で結果が変わることもあります。</p>
    <p class="hint">※実在の学校名を使ったフィクションです。武将・能力値・家紋はすべて架空です。</p>
    <button class="btn plain" data-close>閉じる</button>`);
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
  svg.setAttribute('viewBox', `0 0 ${MAP.width} ${MAP.height}`);
  svg.innerHTML = `<defs>
      <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a4a52" stop-opacity="0.55"/><stop offset="1" stop-color="#4a4a52" stop-opacity="0"/>
      </linearGradient>
      <pattern id="waves" width="36" height="18" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#e8f1f6" stroke-opacity="0.55" stroke-width="1.2">
          <path d="M0,18 A18,18 0 0,1 36,18 M6,18 A12,12 0 0,1 30,18 M12,18 A6,6 0 0,1 24,18"/>
          <path d="M-18,9 A18,18 0 0,1 18,9 M18,9 A18,18 0 0,1 54,9" stroke-opacity="0.3"/>
        </g>
      </pattern>
    </defs>
    <g>${sceneryMarkup()}</g>
    <g id="territory">${MAP.nodes.map((n) => `<path class="cell" data-id="${n.id}" d="${CELLS[n.id]}"/>`).join('')}</g>
    <g id="roads"></g>
    <g id="castles"></g>`;
  applyScale();

  const roads = $('roads');
  MAP.edges.forEach(([a, b]) => {
    const A = MAP.byId[a], B = MAP.byId[b];
    el('line', { class: 'road', x1: A.x, y1: A.y + 8, x2: B.x, y2: B.y + 8, 'data-a': a, 'data-b': b }, roads);
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
        <g class="keep">${castleMarkup(n.clan !== 'none')}</g>
        <g class="plate" transform="translate(0,27)">
          <rect x="${-w / 2}" y="-8.5" width="${w}" height="17" rx="3"/>
          <text>${n.short}</text>
        </g>
        <g class="deleg" transform="translate(${-w / 2 - 7},27)"><circle r="7.5"/><text>委</text></g>
        <g class="gbadge" transform="translate(17,-19)"><circle r="8"/><text></text></g>
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
  scale = Math.min(1.8, Math.max(0.4, newScale));
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

  document.querySelectorAll('#territory .cell').forEach((p) => {
    const owner = S.castles[p.dataset.id].owner;
    p.setAttribute('fill', owner === 'none' ? 'transparent' : CLANS[owner].color);
  });

  const targets = modeTargets();
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
    const ring = g.querySelector('.ring');
    const kind = mode && (mode.kind === 'attack' || mode.kind === 'scheme' ? 'target' : 'friend');
    ring.setAttribute('class', 'ring ' + (targets.includes(id) ? kind : id === selected ? 'sel' : ''));
  });

  document.querySelectorAll('#map .road').forEach((l) => {
    const a = l.dataset.a, b = l.dataset.b;
    const hot = mode && ((a === mode.from && targets.includes(b)) || (b === mode.from && targets.includes(a)));
    const lit = !mode && selected && (a === selected || b === selected);
    l.setAttribute('class', 'road' + (hot ? ' hot' : lit ? ' lit' : ''));
  });

  const banner = $('mode-banner');
  if (mode) {
    const label = mode.kind === 'attack' ? '⚔ 攻める城を選べ'
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
}

function modeTargets() {
  if (!mode) return [];
  if (mode.kind === 'scheme') return schemeTargets(S, mode.from, mode.scheme);
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
      <div class="stat"><span class="n">${c.eco}</span><span class="l">経 済</span></div>
    </div>
    <p class="facline"><span class="trait t-${traitOf(selected)}" title="${TRAITS[traitOf(selected)].desc}">${TRAITS[traitOf(selected)].name}</span>
      ${(c.fac || []).map((f) => `<span class="fac">${FACILITIES[f].name}</span>`).join('')}
      <span class="facnote">${TRAITS[traitOf(selected)].desc}${own && (c.fac || []).length < FAC_SLOTS ? `・施設の空き ${FAC_SLOTS - (c.fac || []).length}` : ''}</span></p>
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
        <button class="btn" id="c-move" ${dis(ownNeighbors(S, selected).length && readyTroops(S, selected) > 0)}><span class="k">送</span>輸送<small>兵を送る</small></button>
        <button class="btn" id="c-gen" ${dis(ownNeighbors(S, selected).length)}><span class="k">移</span>移動<small>武将を移す</small></button>
        <button class="btn" id="c-recruit" ${dis(canRecruit(S, selected))}><span class="k">兵</span>徴兵<small>金${RULES.recruitCost}</small></button>
        <button class="btn" id="c-develop" ${dis(canDevelop(S, selected))}><span class="k">商</span>開発<small>金${RULES.developCost}</small></button>
        <button class="btn" id="c-fortify" ${dis(canFortify(S, selected))}><span class="k">城</span>築城<small>金${RULES.fortifyCost}</small></button>
        <button class="btn" id="c-build" ${dis((c.fac || []).length < FAC_SLOTS && Object.keys(FACILITIES).some((f) => canBuild(S, selected, f)))}><span class="k">建</span>建設<small>施設を建てる</small></button>
        <button class="btn" id="c-reward" ${gens.some((g) => canReward(S, g)) ? '' : 'disabled'}><span class="k">賞</span>褒美<small>金${LOYAL.rewardCost}・忠誠+</small></button>
        <button class="btn" id="c-scheme" ${dis(S.gold[PLAYER] >= 150)}><span class="k">謀</span>計略<small>流言・引き抜き…</small></button>
        <button class="btn plain wide" id="c-close">閉じる</button>
      </div>`;
  } else {
    const srcs = attackSources(selected);
    const peace = atPeace(S, PLAYER, c.owner);
    const why = peace ? `${CLANS[c.owner].name}とは${relLabel(S, c.owner)}のため攻められません`
      : srcs.length ? 'となりの城から出陣できます' : `となりに命令できる${pName()}の城と武将がいません`;
    body = `${S.rel[c.owner] ? `<p class="hint">${clanChip(c.owner)} ${relLabel(S, c.owner)}・友好度 ${S.rel[c.owner].friend}・性格「${personaOf(c.owner).name}」</p>` : ''}
      <div class="cmds">
        <button class="btn red wide" id="c-strike" ${srcs.length ? '' : 'disabled'}><span class="k">攻</span>この城を攻める<small>${why}</small></button>
        <button class="btn plain wide" id="c-close">閉じる</button>
      </div>`;
  }
  panel.innerHTML = head + body;
  bindPanel();
}

function renderCouncil() {
  const counts = Object.keys(CLANS)
    .map((k) => [k, castlesOf(S, k).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => (a[0] === PLAYER ? -1 : b[0] === PLAYER ? 1 : b[1] - a[1]));
  const idleGens = gensOf(S, PLAYER).filter((g) => !S.acted[g.id] && g.loc && !S.delegate[g.loc]).length;
  const delegCount = castlesOf(S, PLAYER).filter((id) => S.delegate[id]).length;
  panel.innerHTML = `<div class="council">
    <div class="p-head"><h2>軍議</h2><span class="p-sub">${SCENARIOS[S.scenario].name} ／ 武将 ${gensOf(S, PLAYER).length}人 ／ 収入 ${fmt(income(S, PLAYER))}</span></div>
    <p class="kakun">${S.lords.length}代目 ${esc((lordOf(S) || {}).name || '（当主不在）')} ・ 家訓「${KAKUN[S.kakun].name}」<small>${KAKUN[S.kakun].desc}</small>${S.debug ? ' <b class="dbg">DEBUG</b>' : ''}</p>
    <p class="hint">城をタップして命令しましょう。命令できる武将：<b>${idleGens}人</b>${delegCount ? `　委任中の城：<b>${delegCount}</b>` : ''}</p>
    ${(() => {
      const low = gensOf(S, PLAYER).filter((g) => !g.lord && g.loc && g.loyal < LOYAL.leaveBelow).length;
      return low ? `<button class="warn loyal-warn" id="loyal-warn">⚠ 忠誠の低い家臣が ${low}人。出奔や謀反のおそれあり（タップで褒美）</button>` : '';
    })()}
    ${S.encircle ? `<p class="warn">🔥 ${pShort()}包囲網：諸家が手を結んで${pName()}を狙っている</p>` : ''}
    <div class="clan-list">${counts.map(([k, n]) => `<span class="chip" style="--c:${CLANS[k].color}">${crestBadge(k, 18)}${CLANS[k].name} ${n}${relIcon(k)}</span>`).join('')}</div>
    <div class="bulk">
      <button class="btn" id="bulk-recruit" ${S.gold[PLAYER] >= RULES.recruitCost && idleGens ? '' : 'disabled'}>全城で徴兵</button>
      <button class="btn" id="bulk-develop" ${S.gold[PLAYER] >= RULES.developCost && idleGens ? '' : 'disabled'}>全城で開発</button>
      <button class="btn" id="btn-diplo">外 交</button>
    </div>
    <button class="btn red end-btn" id="btn-end">ターン終了</button></div>`;
  $('btn-end').onclick = onEndTurn;
  $('bulk-recruit').onclick = () => bulk('recruit');
  $('bulk-develop').onclick = () => bulk('develop');
  $('btn-diplo').onclick = () => { Sound.tap(); showDiplomacy(); };
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
  7: { text: '季節ごとに行事が起こり、<b>外交</b>で他家と手を結ぶこともできます。城が増えたら<b>委任</b>や<b>全城で徴兵</b>を使うと楽ですぞ。では殿、天下統一を！', next: true, last: true },
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
  if (!step) { box.hidden = true; return; }
  if (step.done && step.done()) { S.tut++; save(); renderCoach(); return; }
  box.hidden = false;
  box.innerHTML = `${portrait(SENSEI, 44)}<div class="ct"><b>軍師</b><p>${step.text}</p>
    <div class="cb">${step.next ? `<button class="go" id="coach-next">${step.last ? '心得た' : '次へ'}</button>` : ''}<button id="coach-skip">手ほどきを終える</button></div></div>`;
  const next = $('coach-next');
  if (next) next.onclick = () => { Sound.tap(); if (step.last) endTutorial(); else { S.tut++; save(); renderCoach(); } };
  $('coach-skip').onclick = () => { Sound.tap(); endTutorial(); };
}

// ---------- 外交 ----------
function showDiplomacy(message) {
  const envoy = envoyOf(S);
  const alive = aiClans().filter((k) => castlesOf(S, k).length);
  const rows = alive.map((k) => {
    const r = S.rel[k];
    const peace = r.ally > 0 || r.truce > 0 || r.sister || r.trade > 0;
    const off = !envoy || (S.encircle && !r.sister);
    return `<div class="diplo-row ${r.sister ? 'sister' : ''}">
      <div class="dr-head">${clanChip(k)}<span>${relLabel(S, k)}</span><span class="p-sub">城 ${castlesOf(S, k).length}</span></div>
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
  if (res === 'deal') { Sound.win(); }
  else if (res === 'fail') { Sound.lose(); }
  else Sound.taiko(0, 0.5);
}

// ---------- イベント ----------
function runEvents(done) {
  if (!S.pending || !S.pending.length) { closeModal(); done(); return; }
  const ev = S.pending[0];
  const v = eventView(S, ev);
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
    openModal(`<div class="event" data-lock>
      <div class="ev-icon">${v.icon}</div>
      <h2>${v.title}</h2>
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
      achievementToast(checkAchievements(S));
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
        openModal(`<div class="event" data-lock><div class="ev-icon">${v.icon}</div><p class="ev-text">${esc(result)}</p></div>
        <button class="btn red" id="ev-next">承 知</button>`);
      }
      $('ev-next').onclick = () => {
        Sound.tap();
        if (v.scene && !(S.pending[0] && S.pending[0].id === 'envoy')) Sound.bgmStart('map');
        runEvents(done);
      };
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
function showBuild(id) {
  const c = S.castles[id];
  const g = bestBy(idleGensAt(S, id), 'pol');
  const rows = Object.entries(FACILITIES).map(([k, f]) => {
    const built = hasFac(S, id, k);
    const ok = g && canBuild(S, id, k);
    const why = built ? '建設済み' : (c.fac || []).length >= FAC_SLOTS ? '空きがない' : S.gold[PLAYER] < f.cost ? '金が足りない' : '';
    return `<button class="scheme-row" data-fac="${k}" ${ok ? '' : 'disabled'}>
      <b>${f.name}</b><span class="cost">${built ? '✔' : `金${f.cost}`}</span><small>${f.desc}</small>${why ? `<em>${why}</em>` : ''}</button>`;
  }).join('');
  openModal(`<h2>建 設</h2>
    <p class="hint" style="text-align:center">${MAP.byId[id].name}（${TRAITS[traitOf(id)].name}）・ 施設は${FAC_SLOTS}つまで（空き ${FAC_SLOTS - (c.fac || []).length}）<br>
    ${g ? `担当：${esc(g.name)}（政治${g.pol}）` : '命令できる武将がいません'}</p>
    <div class="scheme-list">${rows}</div>
    <button class="btn plain" data-close>やめる</button>`);
  modalBody.querySelectorAll('[data-fac]').forEach((b) => {
    b.onclick = () => {
      const f = b.dataset.fac;
      build(S, id, f, g);
      Sound.win();
      save();
      closeModal();
      render();
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
  on('c-gen', () => { Sound.tap(); chooseGeneralToMove(selected); });
  on('c-recruit', () => act(recruit, 'cha', '徴兵'));
  on('c-develop', () => act(develop, 'pol', '開発'));
  on('c-fortify', () => act(fortify, 'int', '築城'));
  on('c-reward', () => { Sound.tap(); showReward(gensAt(S, selected), '褒美'); });
  on('c-scheme', () => { Sound.tap(); showSchemeMenu(selected); });
  on('c-build', () => { Sound.tap(); showBuild(selected); });
  on('c-strike', () => { Sound.tap(); openAttack(null, selected); });
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

function showGeneral(gid) {
  const g = S.gens[gid];
  Sound.tap();
  openModal(`<div class="gdetail">
      ${portrait(g, 96)}
      <h2>${esc(g.name)}</h2>
      <p class="hint">${esc(g.title)}（${MAP.byId[g.school].name}出身）${g.lord ? `・${pName()}当主` : ''}</p>
      <p class="hint">${gradeTag(g)}${g.grade >= 3 ? '次の春に卒業' : `卒業まであと${4 - g.grade}回の春`}</p>
      <div class="gstats">
        ${['str', 'pol', 'cha', 'int'].map((k) => `<div><span>${STAT_NAMES[k]}</span><i style="width:${g[k]}%"></i><b>${g[k]}</b></div>`).join('')}
      </div>
      ${g.clan === PLAYER && !g.lord ? `<div class="gstats"><div><span>忠誠</span><i class="loyal-bar ${g.loyal < LOYAL.leaveBelow ? 'low' : ''}" style="width:${g.loyal}%"></i><b>${g.loyal}</b></div></div>
        <p class="hint">${g.loyal < LOYAL.rebelBelow ? '謀反を起こすおそれがある！' : g.loyal < LOYAL.leaveBelow ? '出奔するおそれがある' : g.loyal >= 80 ? '忠義に厚い' : 'まずまずの忠誠'}</p>` : ''}
      ${g.skill ? `<p><span class="skill">${SKILLS[g.skill].name}</span> ${SKILLS[g.skill].desc}</p>` : '<p class="hint">特技なし</p>'}
      ${g.skill && ARTS[g.skill] ? `<p class="hint">戦法「${ARTS[g.skill].name}」：${ARTS[g.skill].desc}</p>` : ''}
    </div>
    ${canReward(S, g) ? `<button class="btn red" id="gd-reward">褒美を与える（金${LOYAL.rewardCost}）</button>` : ''}
    <button class="btn plain" data-close>閉じる</button>`);
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
function openAttack(from, to) {
  tutAdvance(4);
  const srcs = from ? [from] : attackSources(to);
  let src = srcs.reduce((a, b) => (readyTroops(S, a) >= readyTroops(S, b) ? a : b));
  let gid = null;
  let amount = 0;
  let support = {}; // 援軍 { castleId: true }
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
    const ratio = (total * atkMult(g) * atkKakun(S, PLAYER)) / Math.max(1, power);
    const odds = ratio >= 1.3 ? ['勝算大', '#2e7d32'] : ratio >= 1.1 ? ['勝算あり', '#8a6d00'] : ratio >= 0.9 ? ['五分五分', '#b35c00'] : ['勝ち目うすし', '#b8262f'];
    $('amt-v').textContent = fmt(amount);
    $('total-v').textContent = fmt(total);
    $('odds').textContent = odds[0];
    $('odds').style.color = odds[1];
  }

  function draw() {
    const max = readyTroops(S, src);
    amount = Math.min(max, Math.round((max * 0.8) / 10) * 10 || max);
    const gens = idleGensAt(S, src).sort((a, b) => b.str - a.str);
    if (!gens.find((g) => g.id === gid)) gid = gens[0].id;
    const sup = supportList();
    openModal(`<h2>${MAP.byId[to].name} 攻め</h2>
      <p style="text-align:center;margin:0 0 6px">${clanChip(t.owner)}<br>守備 <b>${fmt(t.troops)}</b> 兵 × 防御 <b>${t.def.toFixed(1)}</b><br>
      守将：${dg ? `<b>${esc(dg.name)}</b>（統${dg.str} 知${dg.int}${dg.skill ? '・' + SKILLS[dg.skill].name : ''}）` : 'なし'}</p>
      ${srcs.length > 1 ? `<h3>出陣する城</h3><div class="src-list">${srcs.map((id) =>
        `<button data-src="${id}" class="${id === src ? 'on' : ''}"><span>${MAP.byId[id].name}</span><span>兵 ${fmt(readyTroops(S, id))}</span></button>`).join('')}</div>` : ''}
      ${arrivedTroops(S, src) ? `<p class="hint">🚚 ${MAP.byId[src].short}に到着したばかりの ${fmt(arrivedTroops(S, src))} 兵は、今季は出陣できません</p>` : ''}
      <h3>大将</h3>
      <div class="glist pick">${gens.map((g) => genCard(g, { extra: g.id === gid ? '<span class="check">✔</span>' : '' })).join('')}</div>
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
      <p class="odds" id="odds"></p>
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
  return Object.assign({ attackMode: 'command', defenseMode: 'command', speed: 'normal' }, v);
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
    <button class="btn plain" data-close>閉じる</button>`);
  modalBody.querySelectorAll('[data-set]').forEach((b) => {
    b.onclick = () => {
      Sound.tap();
      setSetting(b.dataset.set, b.dataset.v);
      modalBody.querySelectorAll(`[data-set="${b.dataset.set}"]`).forEach((x) => x.classList.toggle('on', x === b));
    };
  });
}

// ---------- 合戦（1合ずつ采配する） ----------
// B = startBattle() で作った合戦。auto = おまかせで進める
function runBattle(B, { auto = false, onClose } = {}) {
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
      ? `${sd === 'd' ? '' : portrait(gen, 40, null, 'R')}<div><b>${esc(gen.name)}</b><small>統率${gen.str}${sd === 'a' && supNames.length ? `・援軍${supNames.length}` : ''}</small></div>${sd === 'd' ? portrait(gen, 40) : ''}`
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
        <span class="b-wx" title="${WEATHER[B.weather].desc}">${WEATHER[B.weather].icon} ${WEATHER[B.weather].name}</span></div>${tac}</div>
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
  const animate = () => {
    const A = $('army-a'), D = $('army-d');
    $('bf-arrows').innerHTML = arrowVolley(B.round % 2 === 1);
    [A, D].forEach((x) => x.classList.add('lunge'));
    replay($('spark'), 'go');
    replay($('bf-dust'), 'go');
    replay(box, 'shake');
    Sound.clash(0.02);
    setTimeout(() => [A, D].forEach((x) => x.classList.remove('lunge')), 260);
    setTimeout(updateBars, 180);
  };
  updateBars();
  const openLines = [defense
    ? `${CLANS[B.attacker].name}の${g.name}が攻めてきた！ 城を守り抜け！`
    : `${g.name}が${fmt(B.a.start)}兵を率いて出陣！`];
  if (B.weather !== 'sun') openLines.push(`${WEATHER[B.weather].icon} ${WEATHER[B.weather].name}：${WEATHER[B.weather].desc}`);
  if (B.decisive) {
    // 決戦：本拠を守る大将の名乗り
    const lordD = dg ? dg.name : '城兵';
    openLines.unshift(`${lordD}「ここは${CLANS[B.defender].name}の本拠・${MAP.byId[B.to].short}！ 一歩たりとも通さぬ！」`);
    setTimeout(() => {
      const cut = $('b-cut');
      cut.textContent = '天下分け目の決戦';
      cut.className = 'b-cut go decisive';
      Sound.horagai();
      setTimeout(() => Sound.horagai(), 900);
    }, 300);
  }
  report(openLines);

  let busy = false;
  let timer = null;
  let fxSeq = 0;
  let carry = []; // 決着の直前に出た文（一騎打ちの結果など）を、決着の画面にも残す

  // 命令のボタン
  function renderCmds() {
    const el = $('b-cmds');
    if (B.over) { el.innerHTML = ''; return; }
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
    busy = true;
    carry = [];
    $('b-cmds').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const cmds = {};
    cmds[me] = cmd;
    cmds[foe] = aiCommand(S, B, foe);
    const rep = stepBattle(S, B, cmds);
    $('round').textContent = `第 ${'一二三四五六七八'[B.round - 1] || B.round} 合`;
    const lead = playBattleFx(rep.act || {});
    setTimeout(() => { report(rep.lines); animate(); }, lead);
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
    const du = { myGen, foeGen, mood: {}, say: null, busy: false, calls: [duelCall(myGen), duelCall(foeGen)] };
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
      body = `${du.say ? `<div class="du-say">${du.say}</div>` : ''}
        <button class="btn red" id="du-end">${won ? '勝ち名乗りを上げる' : '決着'}</button>`;
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
      <div class="du-title">一 騎 打 ち${started ? `<small>${roundName}／${DUEL.maxTurns}合</small>` : ''}</div>
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
        startDuel(B);
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
      $('du-end').onclick = () => {
        Sound.tap();
        Sound.bgmStart('battle');
        const lines = endDuel(S, B);
        d.hidden = true;
        carry = lines;
        report(lines);
        updateBars();
        afterRound();
      };
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
    if (r.won) {
      fall('army-d', 0);
      $('bf-fire').classList.add('on');
      document.querySelector('.bf-castle').style.setProperty('--c', CLANS[B.attacker].color);
    } else {
      $('army-a').classList.add('retreat');
    }
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
      handleCaptives(r.captured || [], () => { if (onClose) onClose(r); });
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
function handleCaptives(list, done) {
  if (!list.length) { done(); return; }
  const [gid, ...rest] = list;
  const g = S.gens[gid];
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

function showRoster() {
  const gens = gensOf(S, PLAYER).sort((a, b) => (b.lord ? 1 : 0) - (a.lord ? 1 : 0) || b.grade - a.grade || a.loc.localeCompare(b.loc));
  const seniors = gens.filter((g) => g.grade >= 3).length;
  const retainers = gens.filter((g) => !g.lord);
  const avgLoyal = retainers.length ? Math.round(retainers.reduce((a, g) => a + g.loyal, 0) / retainers.length) : 0;
  openModal(`<h2>家臣団</h2>
    <p class="hint" style="text-align:center">${gens.length}人（うち3年生 ${seniors}人は次の春に卒業）・ 平均の忠誠 ${avgLoyal} ・ タップするとその城へ</p>
    <button class="btn" id="roster-reward">褒美を与える（忠誠の低い順）</button>
    <div class="glist roster">${gens.map((g) => genCard(g, {
      acted: !!S.acted[g.id],
      extra: `<span class="where">${MAP.byId[g.loc].short}</span>`,
    })).join('')}</div>
    <h3>歴代当主</h3>
    ${lordsHistory()}
    <button class="btn plain" data-close>閉じる</button>`);
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
function showSeason(turn, then) {
  const box = $('season');
  box.className = `s${turn % 4}`;
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

function onEndTurn() {
  Sound.unlock();
  selected = null;
  mode = null;
  const before = S.gold[PLAYER];
  S.deferDefense = getSettings().defenseMode === 'command';
  const log = endTurn(S);
  save();
  render();
  const gain = S.gold[PLAYER] - before;
  const news = (S.news || []).slice();
  S.news = [];
  save();
  showSeason(S.turn, () => {
    showNewspaper(news, log, gain);
    $('ok').onclick = () => {
      Sound.tap();
      closeModal();
      afterDefenses();
    };
  });
}

// ---------- 学園新聞 ----------
// その季の出来事を、新聞の一面のように見せる
const NEWS_FILLER = [
  ['春の陽気、各校に活気', '新入生を迎え、どの家も力をたくわえる'],
  ['夏の日差し、嵐の前の静けさ', '各家は合宿で力を磨く'],
  ['秋風立つ、決戦の気配', '文化祭の裏で、諸家の思惑が交錯する'],
  ['冬ざれの学び舎、静かな攻防', '受験を前に、各家は守りを固める'],
];
function showNewspaper(news, log, gain) {
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
          <span>${i + 1}</span>${crestBadge(k, 14)}<i style="width:${(castlesOf(S, k).length / maxN) * 100}%;background:${CLANS[k].color}"></i><b>${castlesOf(S, k).length}</b></div>`).join('')}</div>
      </div>
      <p class="np-gold">💰 ${pName()}の収支 <b>${gain >= 0 ? '+' : ''}${fmt(gain)}</b>（収入 ${fmt(income(S, PLAYER))}）</p>
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
    else runEvents(() => achievementToast(checkAchievements(S)));
  });
}

function showEnding() {
  const win = S.result === 'win';
  Sound.bgmStart(win ? 'win' : 'lose');
  const { got, unlockedNow } = recordEnding(S);
  save();
  const lord = lordOf(S) || Object.values(S.gens).find((g) => g.lord);
  openModal(`<div class="ending ${win ? 'win' : 'lose'}" data-lock>
      ${lord ? portrait(lord, 84) : crestBadge(PLAYER, 72)}
      <div class="big">${win ? '天下統一' : '落 日'}</div>
      <p>${win
        ? `${dateLabel(S.turn)}、${pName()} ${S.lords.length}代目当主 ${esc(lord.name)} は${MAP.nodes.length}校をすべて制覇した！`
        : `${dateLabel(S.turn)}、${pName()}の城はすべて奪われた…`}</p>
      <p class="hint">${SCENARIOS[S.scenario].name} ・ 難易度：${diffOf(S).name} ・ ${S.turn}季 ・ 家臣 ${gensOf(S, PLAYER).length}人${S.debugUsed ? '<br>（デバッグを使ったため記録されません）' : ''}</p>
    </div>
    ${unlockedNow ? '<p class="result">🔓 すべての家で遊べるようになった！</p>' : ''}
    ${got.length ? `<h3>新しい実績</h3><div class="ach-list">${got.map((a) => achCard(a)).join('')}</div>` : ''}
    <h3>歴代当主</h3>
    ${lordsHistory()}
    <button class="btn red" id="again">もう一度</button>
    <button class="btn plain" id="to-title">タイトルへ</button>`);
  $('again').onclick = () => { clearSave(); closeModal(); showSetup(); };
  $('to-title').onclick = () => { clearSave(); closeModal(); showTitle(); };
}

// ---------- 実績と戦績 ----------
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
  Sound.win();
  clearTimeout(achTimer);
  achTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

function showRecords() {
  const rec = loadRecords();
  const got = ACHIEVEMENTS.filter((a) => rec.ach[a.id]).length;
  const best = Object.entries(SCENARIOS).map(([sk, sc]) => {
    const cells = Object.entries(DIFFICULTY).map(([dk, d]) => {
      const t = rec.best[`${sk}/${dk}`];
      return `<td>${t ? `${t}季` : '―'}</td>`;
    }).join('');
    return `<tr><th>${sc.name}</th>${cells}</tr>`;
  }).join('');
  const clans = Object.keys(CLANS).filter((k) => k !== 'none')
    .map((k) => `<span class="chip" style="--c:${CLANS[k].color}">${crestBadge(k, 18)}${CLANS[k].name.replace('家', '')} ${rec.clanWins[k] || 0}勝</span>`).join('');
  openModal(`<h2>戦績・実績</h2>
    <div class="stats"><div class="stat"><span class="n">${rec.wins}</span><span class="l">天下統一</span></div>
      <div class="stat"><span class="n">${rec.plays}</span><span class="l">遊んだ回数</span></div>
      <div class="stat"><span class="n">${got}/${ACHIEVEMENTS.length}</span><span class="l">実績</span></div></div>
    <h3>最短の天下統一</h3>
    <table class="best"><tr><th></th>${Object.values(DIFFICULTY).map((d) => `<th>${d.name}</th>`).join('')}</tr>${best}</table>
    <h3>家ごとの勝利</h3>
    <div class="clan-list">${clans}</div>
    <p class="hint">${rec.unlocked.length > 1 ? '🔓 すべての家で遊べます' : '🔒 一度天下統一すると、他の家でも遊べるようになります'}</p>
    <h3>実績</h3>
    <div class="ach-list">${ACHIEVEMENTS.map((a) => achCard(a, !!rec.ach[a.id])).join('')}</div>
    <button class="btn plain" data-close>閉じる</button>`);
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
    <button class="btn plain" id="m-export">セーブの書き出し（枠${currentSlot}）</button>
    <button class="btn plain" id="m-help">遊び方</button>
    ${debugOn() ? '<button class="btn plain" id="m-debug">🛠 デバッグ</button>' : ''}
    <button class="btn plain" id="m-title">タイトルへ（自動で保存されます）</button>
    <button class="btn plain" data-close>閉じる</button>`);
  $('m-roster').onclick = () => { Sound.tap(); showRoster(); };
  $('m-diplo').onclick = () => { Sound.tap(); showDiplomacy(); };
  $('m-records').onclick = () => { Sound.tap(); showRecords(); };
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
