// ---------- 画帳：集めた名場面・家の物語・実績を、金屏風に貼って眺める ----------
// 名場面は rec.meiba（すでに残している）、家の物語は rec.storyBook（ここから残す）、実績は rec.ach
let GACHO_TAB = 'meiba';
const STORY_TITLES = { yurai: '旗の由来', shukumei: '宿命の相手', yuigon: '先代の遺言', chikai: '志の誓い', higan: '悲願' };
const _gcStoryDone = storyDone;
storyDone = function (s, stx) {
  const r = _gcStoryDone(s, stx);
  if (!s.debugUsed) {
    const rec = loadRecords();
    rec.storyBook = rec.storyBook || {};
    const key = stx.id.startsWith('fall:') ? 'fall' : stx.id;
    rec.storyBook[key] = rec.storyBook[key] || { at: Date.now(), house: CLANS[PLAYER].name, n: 0 };
    rec.storyBook[key].n++;
    if (stx.id.startsWith('fall:')) { rec.storyBook.falls = rec.storyBook.falls || {}; rec.storyBook.falls[stx.clan] = Date.now(); }
    saveRecords(rec);
  }
  return r;
};
function showGacho(back) {
  const rec = loadRecords();
  const mGot = Object.keys(MEIBA).filter((id) => (rec.meiba || {})[id]).length;
  const sb = rec.storyBook || {};
  const aGot = ACHIEVEMENTS.filter((a) => rec.ach[a.id]).length;
  const tabs = [['meiba', `名場面 ${mGot}/${Object.keys(MEIBA).length}`], ['story', `家の物語 ${Object.keys(STORY_TITLES).filter((k) => sb[k]).length}/${Object.keys(STORY_TITLES).length}`], ['ach', `実績 ${aGot}/${ACHIEVEMENTS.length}`]];
  let body = '';
  if (GACHO_TAB === 'meiba') {
    body = `<div class="gc-grid">${Object.entries(MEIBA).map(([id, m]) => (rec.meiba || {})[id]
      ? `<button class="gc-tile got" data-mb="${id}"><div class="gc-art">${meibaArt(id, { foe: null })}</div><b>${m.name}</b><small>${m.sub}</small></button>`
      : `<div class="gc-tile"><div class="gc-art shadow">${meibaArt(id, { foe: null })}</div><b>？？？</b><small>${m.desc.split('。')[0]}…</small></div>`).join('')}</div>`;
  } else if (GACHO_TAB === 'story') {
    const falls = Object.keys(sb.falls || {});
    body = `<div class="gc-story">${Object.entries(STORY_TITLES).map(([k, t], i) => `<div class="gc-chap ${sb[k] ? 'got' : ''}"><span>第${'一二三四五'[i]}話</span><b>${sb[k] ? t : '？？？'}</b><small>${sb[k] ? `${esc(sb[k].house)}で初めて見た・${sb[k].n}回` : 'まだ語られていない'}</small></div>`).join('')}</div>
      <h3>見届けた家の最期</h3><div class="gc-falls">${falls.length ? falls.map((k) => `<span>${crestBadge(k, 30)}<b>${CLANS[k] ? CLANS[k].name : ''}</b></span>`).join('') : '<p class="hint">まだない</p>'}</div>`;
  } else {
    body = `<div class="ach-meter"><i style="width:${Math.round((aGot / ACHIEVEMENTS.length) * 100)}%"></i><span>${aGot} / ${ACHIEVEMENTS.length}</span></div><div class="seal-grid">${ACHIEVEMENTS.map((a) => achSeal(a, !!rec.ach[a.id])).join('')}</div>`;
  }
  openModal(`<h2>画 帳</h2>
    <div class="gc-tabs">${tabs.map(([k, t]) => `<button data-gc="${k}" class="${k === GACHO_TAB ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${body}
    <button class="btn plain" id="gc-back">${back ? 'もどる' : '閉じる'}</button>`);
  $('modal').classList.add('setup-mode', 'gacho-mode');
  modalBody.querySelectorAll('[data-gc]').forEach((b) => { b.onclick = () => { Sound.tap(); GACHO_TAB = b.dataset.gc; showGacho(back); }; });
  modalBody.querySelectorAll('[data-mb]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.mb, m = MEIBA[id];
      Sound.hyoshigi(2);
      openModal(`<div class="gc-big"><p class="mb-kicker">戦国の名場面</p><h2>${m.name}</h2>${meibaArt(id, { foe: null })}<p class="mb-sub">${m.sub}</p><p>${m.desc}</p>
        ${typeof rec.meiba[id] === 'number' ? `<p class="hint">初めて見た日：${new Date(rec.meiba[id]).toLocaleDateString('ja-JP')}</p>` : ''}</div>
        <button class="btn plain" id="gc-bk">画帳へもどる</button>`);
      $('modal').classList.add('setup-mode', 'gacho-mode');
      $('gc-bk').onclick = () => { Sound.tap(); showGacho(back); };
    };
  });
  $('gc-back').onclick = () => { Sound.tap(); if (back) back(); else closeModal(); };
}
const _gcOpen = openModal;
openModal = function (html) { $('modal').classList.remove('gacho-mode'); return _gcOpen(html); };
// タイトルに「画帳」、戦績の画面にも入口
(function gachoButton() {
  const zukan = $('btn-zukan');
  if (zukan && !$('btn-gacho')) {
    const b = document.createElement('button');
    b.className = 'btn fuda'; b.id = 'btn-gacho'; b.textContent = '画帳';
    zukan.insertAdjacentElement('afterend', b);
    b.onclick = () => { Sound.unlock(); Sound.tap(); showGacho(); };
  }
})();
const _gcRecords = showRecords;
showRecords = function (...a) {
  const r = _gcRecords.apply(this, a);
  const h = modalBody.querySelector('h2');
  if (h) { h.insertAdjacentHTML('afterend', '<button class="btn red" id="rec-gacho">画帳を開く<small class="sub">名場面・家の物語・実績を眺める</small></button>'); $('rec-gacho').onclick = () => { Sound.tap(); showGacho(showRecords); }; }
  return r;
};
