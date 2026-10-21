// ---------- 今日の一局と段位 ----------
// 今日の一局：日付から盤面が決まる（誰が遊んでも同じ）。何季で天下を取れたかを日ごとに残し、友だちと比べる
// 段位：天下統一・実績・今日の一局の成績で点がたまり、足軽から天下人へ上がっていく
const DAILY_KEY = 'azabu-daily';
const RANKS = [
  { pts: 0, name: '足軽' }, { pts: 10, name: '足軽大将' }, { pts: 30, name: '侍大将' }, { pts: 60, name: '家老' },
  { pts: 100, name: '城主' }, { pts: 160, name: '大名' }, { pts: 250, name: '天下人' },
];
const dailyLoad = () => { try { return JSON.parse(localStorage.getItem(DAILY_KEY)) || {}; } catch (e) { return {}; } };
const dailySave = (d) => { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) {} };
function todayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// その日の盤面：日付の数から、戦い・家・戦いの型・難易度を選ぶ
function dailyPlan(key = todayKey()) {
  const n = key.split('-').join('') | 0;
  const h = Math.imul(n ^ (n >>> 7), 2654435761) >>> 0; // 隣り合う日でも、盤面がよく散るように混ぜる
  const r = seeded((h % 1000000007) + 1);
  const scs = Object.keys(SCENARIOS).filter((k) => k !== 'toshin');
  const scenario = scs[Math.floor(r() * scs.length)];
  const clans = scenarioClans(scenario);
  const lead = EDITIONS[SCENARIOS[scenario].ed] ? EDITIONS[SCENARIOS[scenario].ed].lead : clans[0];
  const clan = r() < 0.5 ? lead : clans[Math.floor(r() * clans.length)];
  const variant = ['std', 'std', 'gunyu', 'appei', 'gekoku'][Math.floor(r() * 5)];
  return { key, scenario, clan, diff: 'normal', variant, seed: (n * 2654435761) >>> 0 };
}
function dailyLabel(p) { return `${SCENARIOS[p.scenario].name}・${CLANS[p.clan].name}・${VARIANTS[p.variant].name}`; }
function startDaily() {
  const p = dailyPlan();
  udeNewGame({ scenario: p.scenario, clan: p.clan, diff: p.diff, seed: p.seed }, `${CLANS[p.clan].name.replace('家', '').replace('・', '')} 一郎`);
  delete S.ude; // 腕比べのコードではなく、今日の一局として残す
  if (p.variant !== 'std') applyVariant(S, p.variant);
  S.daily = p.key;
  save();
  closeModal();
  startGame(true);
  toast(`🗓️ 今日の一局：${esc(dailyLabel(p))}`);
}
function dailyRecord(s) {
  if (!s || !s.daily || s.dailyRecorded || !s.result) return null;
  s.dailyRecorded = true;
  const d = dailyLoad(), cur = d[s.daily] || {};
  const r = { win: s.result === 'win', turns: s.turn, castles: castlesOf(s, PLAYER).length };
  const better = !cur.best || (r.win && (!cur.best.win || r.turns < cur.best.turns)) || (!r.win && !cur.best.win && r.castles > cur.best.castles);
  if (better) cur.best = r;
  cur.tries = (cur.tries || 0) + 1;
  d[s.daily] = cur;
  dailySave(d);
  return { r, better, best: cur.best };
}
// 段位の点：天下統一・実績・今日の一局（天下統一した日）
function rankPoints() {
  const rec = loadRecords();
  const d = dailyLoad();
  const days = Object.values(d).filter((x) => x.best && x.best.win).length;
  return (rec.wins || 0) * 10 + Object.keys(rec.ach || {}).length * 3 + days * 8;
}
function rankOf(pts = rankPoints()) {
  let i = 0;
  RANKS.forEach((r, j) => { if (pts >= r.pts) i = j; });
  return { i, ...RANKS[i], next: RANKS[i + 1] || null, pts };
}

// ---------- 画面：今日の一局・タイトルの段位・終わりの記録 ----------
function showDaily() {
  const p = dailyPlan(), d = dailyLoad(), today = d[p.key];
  const days = Array.from({ length: 7 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - i); return todayKey(t); });
  const fmtR = (b) => (b ? (b.win ? `天下統一 ${b.turns}季` : `${b.castles}城まで`) : '―');
  openModal(`<h2>今日の一局</h2>
    <div class="daily-card"><p class="dl-date">${p.key.replace(/-/g, '．')}</p>
      <div class="dl-plan">${crestBadge(p.clan, 56)}<div><b>${esc(CLANS[p.clan].name)}</b><small>${esc(SCENARIOS[p.scenario].name)}・${esc(VARIANTS[p.variant].name)}・中級</small></div></div>
      <p class="hint">今日の盤面は、誰が遊んでも同じ。何季で天下を取れるか、友だちと比べよう。</p>
      <p class="dl-best">今日のベスト：<b>${fmtR(today && today.best)}</b>${today ? `（${today.tries}回）` : ''}</p></div>
    <button class="btn red" id="dl-go">今日の一局を始める</button>
    <h3>この七日</h3><ol class="dl-week">${days.map((k) => `<li><span>${k.slice(5).replace('-', '/')}</span><b>${fmtR(d[k] && d[k].best)}</b></li>`).join('')}</ol>
    <button class="btn plain" data-close>もどる</button>`);
  $('dl-go').onclick = () => { Sound.tap(); startDaily(); };
}
$('btn-daily').onclick = () => { Sound.unlock(); Sound.tap(); showDaily(); };

// タイトルに段位
function rankHtml() {
  const R = rankOf();
  const pct = R.next ? Math.round(((R.pts - RANKS[R.i].pts) / (R.next.pts - RANKS[R.i].pts)) * 100) : 100;
  return `<div class="rank-plate"><span>段位</span><b>${R.name}</b><i><u style="width:${pct}%"></u></i><small>${R.next ? `${R.pts}点・「${R.next.name}」まで あと${R.next.pts - R.pts}点` : `${R.pts}点・極めた`}</small></div>`;
}
const _dlTitle = showTitle;
showTitle = function (...a) {
  const r = _dlTitle.apply(this, a);
  const inner = document.querySelector('#title .title-buttons');
  if (inner) { let el = document.getElementById('rank-plate'); if (!el) { el = document.createElement('div'); el.id = 'rank-plate'; inner.parentNode.insertBefore(el, inner); } el.innerHTML = rankHtml(); }
  return r;
};
// 終わり：今日の一局の記録と、昇段の知らせ
const _dlEnding = showEnding;
showEnding = function (...a) {
  const before = rankOf().i;
  if (S && S.daily) { const got = dailyRecord(S); if (got) S.dailyRes = got; } // エンドロールを挟んでも、記録は一度だけ
  const res = S && S.dailyRes;
  const out = _dlEnding.apply(this, a);
  const end = modalBody.querySelector('.ending');
  if (end && S && S.daily && S.result) {
    const d = dailyLoad()[S.daily], b = d && d.best;
    const score = (x) => (x.win ? `天下統一まで${x.turns}季` : `${x.castles}城まで`);
    const text = `【${gameTitle()} 今日の一局 ${S.daily}】${CLANS[PLAYER].name}で${score({ win: S.result === 'win', turns: S.turn, castles: castlesOf(S, PLAYER).length })}！ 君は何季で取れる？`;
    if (!modalBody.querySelector('.daily-end')) end.insertAdjacentHTML('afterend', `<div class="ude-card daily-end"><div class="ude-head"><span>今日の一局</span><b>${S.daily}</b></div>
      <p class="ude-score">${score({ win: S.result === 'win', turns: S.turn, castles: castlesOf(S, PLAYER).length })}${res && res.better ? '<i>今日のベスト</i>' : ''}</p>
      <small>${b ? `今日のベスト：${score(b)}・${d.tries}回目` : ''}</small><button class="btn red" id="dl-share">結果を送る</button></div>`);
    const btn = $('dl-share');
    if (btn) btn.onclick = async () => { Sound.tap(); if (navigator.share) { try { await navigator.share({ title: gameTitle(), text }); } catch (e) {} return; } try { await navigator.clipboard.writeText(text); toast('📋 結果をコピーした'); } catch (e) { prompt('この文を送ろう', text); } };
  }
  const after = rankOf();
  if (after.i > before) setTimeout(() => { Sound.horagai(); toast(`<span class="ms-done">昇段</span><span>段位が「<b>${after.name}</b>」に上がった！</span>`); }, 900);
  return out;
};
