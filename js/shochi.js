// ---------- 落城の処置と、地の平定 ----------
// 1) 城を落としたら、その城をどう扱うかを選ぶ：乱取り（金を得るが町が荒れ、諸家に悪名）・安堵（町と兵が根づく）・懐柔（金を払い、捕らえた者と敵の家の心をつかむ）
// 2) 同じ区（全国版では同じ県）の学校をすべて治めると「平定」。季ごとに年貢が入り、平定の瞬間には城の守りも固まる
const SHOCHI = {
  ryaku: { name: '乱取り', loot: 2.5, eco: 0.75, troops: 0.9, infamy: 3 },
  ando: { name: '安堵', eco: 8, troops: 100 },
  kaiju: { name: '懐柔', cost: 120, friend: 20, recruit: 0.25, eco: 3 },
};
const HEITEI = { gold: 40, def: 0.1 };
let SC_WAIT = false;

// 落とした城を控えておき、合戦の画面が閉じてから尋ねる（ターン終了の自動の合戦は、尋ねない）
const _scAttack = attack;
attack = function (s, ...a) {
  const r = _scAttack.call(this, s, ...a);
  if (r && r.won && r.attacker === PLAYER && s === S && !s.moves) (s.shochi = s.shochi || []).push({ to: r.to, def: r.defender });
  return r;
};
const _scEnd = endBattle;
endBattle = function (s, B, log) {
  const r = _scEnd.call(this, s, B, log);
  if (r && r.won && r.attacker === PLAYER && s === S && !s.moves) (s.shochi = s.shochi || []).push({ to: r.to, def: r.defender });
  return r;
};
// 懐柔した城で捕らえた者は、仕えやすい
const _scRecruit = recruitChance;
recruitChance = function (s, g) {
  return clamp(_scRecruit(s, g) + (g.kaiju ? SHOCHI.kaiju.recruit : 0), 0.05, 0.95);
};
function shochiApply(s, it, kind) {
  const c = s.castles[it.to];
  if (!c || c.owner !== PLAYER) return '';
  const nm = MAP.byId[it.to].short;
  if (kind === 'ryaku') {
    const gain = Math.round(c.eco * SHOCHI.ryaku.loot);
    s.gold[PLAYER] += gain;
    c.eco = Math.max(20, Math.round(c.eco * SHOCHI.ryaku.eco));
    c.troops = Math.round(c.troops * SHOCHI.ryaku.troops);
    Object.keys(s.rel || {}).forEach((k) => changeFriend(s, k, -SHOCHI.ryaku.infamy));
    s.stats.ryaku = (s.stats.ryaku || 0) + 1;
    return `${nm}で乱取り：金+${gain}（町が荒れ、諸家の目が冷たくなった）`;
  }
  if (kind === 'kaiju') {
    if (s.gold[PLAYER] < SHOCHI.kaiju.cost) return shochiApply(s, it, 'ando');
    s.gold[PLAYER] -= SHOCHI.kaiju.cost;
    c.eco += SHOCHI.kaiju.eco;
    if (it.def !== 'none' && s.rel[it.def]) changeFriend(s, it.def, SHOCHI.kaiju.friend);
    Object.values(s.gens).forEach((g) => { if (g.clan === 'captive' && g.capturedAt === it.to) g.kaiju = true; });
    s.stats.kaiju = (s.stats.kaiju || 0) + 1;
    return `${nm}を懐柔：${it.def !== 'none' && CLANS[it.def] ? `${CLANS[it.def].name}との仲が和らぎ、` : ''}捕らえた者が仕えやすくなった`;
  }
  c.eco += SHOCHI.ando.eco;
  c.troops += SHOCHI.ando.troops;
  s.stats.ando = (s.stats.ando || 0) + 1;
  return `${nm}を安堵：町が落ち着き、生徒${SHOCHI.ando.troops}人が兵に加わった`;
}
function showShochi() {
  const list = (S.shochi || []).filter((it) => S.castles[it.to] && S.castles[it.to].owner === PLAYER);
  if (!list.length) { S.shochi = []; return; }
  const rows = list.map((it, i) => {
    const c = S.castles[it.to], nm = MAP.byId[it.to].short;
    const caps = Object.values(S.gens).filter((g) => g.clan === 'captive' && g.capturedAt === it.to).length;
    return `<div class="sc-row" data-i="${i}">
      <div class="sc-head">${it.def !== 'none' && CLANS[it.def] ? crestBadge(it.def, 34) : crestBadge(PLAYER, 34)}<div><b>${nm}</b><small>${it.def !== 'none' && CLANS[it.def] ? `${CLANS[it.def].name}から奪った` : '独立校を治めた'}・町 ${c.eco}・兵 ${fmt(c.troops)}${caps ? `・捕虜 ${caps}人` : ''}</small></div></div>
      <div class="sc-opts">
        <button data-k="ryaku"><b>乱取り</b><small>金 +${Math.round(c.eco * SHOCHI.ryaku.loot)}<br>町と兵が減り、諸家に悪名</small></button>
        <button data-k="ando" class="rec"><b>安堵</b><small>町 +${SHOCHI.ando.eco}・兵 +${SHOCHI.ando.troops}<br>城がよく根づく</small></button>
        <button data-k="kaiju" ${S.gold[PLAYER] < SHOCHI.kaiju.cost ? 'disabled' : ''}><b>懐柔</b><small>金 −${SHOCHI.kaiju.cost}<br>${it.def !== 'none' ? '敵の家と和らぎ、' : ''}捕虜が仕えやすい</small></button>
      </div></div>`;
  }).join('');
  openModal(`<h2>落城の処置</h2><p class="hint" style="text-align:center">落とした城を、どう治めるか</p>${rows}
    ${list.length > 1 ? '<button class="btn plain" id="sc-all">残りはすべて安堵</button>' : ''}`);
  $('modal').classList.add('shochi-mode');
  const done = [];
  const check = () => {
    if (done.length < list.length) return;
    S.shochi = [];
    save();
    setTimeout(() => { closeModal(); render(); }, 650);
  };
  const choose = (i, k) => {
    if (done.includes(i)) return;
    done.push(i);
    const msg = shochiApply(S, list[i], k);
    const row = modalBody.querySelector(`.sc-row[data-i="${i}"]`);
    if (row) { row.classList.add('done', `k-${k}`); row.querySelector('.sc-opts').innerHTML = `<p class="sc-msg">${msg}</p>`; }
    if (k === 'ryaku') Sound.fire(); else if (k === 'kaiju') Sound.kira(); else Sound.stamp(0);
    check();
  };
  modalBody.querySelectorAll('.sc-row').forEach((row) => {
    row.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => choose(+row.dataset.i, b.dataset.k); });
  });
  if ($('sc-all')) $('sc-all').onclick = () => { Sound.tap(); list.forEach((_, i) => choose(i, 'ando')); };
}

// ---------- 地の平定 ----------
let HEITEI_GROUPS = null, HEITEI_MAP = null;
function heiteiGroups() {
  if (HEITEI_GROUPS && HEITEI_MAP === MAP) return HEITEI_GROUPS;
  const usePref = MAP.nodes.some((n) => n.pref);
  const g = {};
  MAP.nodes.forEach((n) => { const k = (usePref ? n.pref : n.ward) || ''; if (k) (g[k] = g[k] || []).push(n.id); });
  Object.keys(g).forEach((k) => { if (g[k].length < 2) delete g[k]; });
  HEITEI_GROUPS = g; HEITEI_MAP = MAP;
  return g;
}
const heiteiKeyOf = (id) => Object.keys(heiteiGroups()).find((k) => heiteiGroups()[k].includes(id));
const heiteiOwned = (s) => Object.keys(heiteiGroups()).filter((k) => heiteiGroups()[k].every((id) => s.castles[id] && s.castles[id].owner === PLAYER));
const _htEnd = endTurn;
endTurn = function (s, ...a) {
  const log = _htEnd.call(this, s, ...a);
  if (s === S && !s.result) {
    const own = heiteiOwned(s);
    if (own.length) {
      const gain = HEITEI.gold * own.length;
      s.gold[PLAYER] += gain;
      if (Array.isArray(log)) log.push(`🏯 平定した地（${own.join('・')}）から年貢 +${gain}`);
    }
  }
  return log;
};
// 平定した瞬間：決め絵と、城の守りが固まる（地ごとに一度だけ）
const _htRender = render;
render = function (...a) {
  const r = _htRender.apply(this, a);
  if (S && !S.result && !$('game').hidden) {
    S.heitei = S.heitei || {};
    const fresh = heiteiOwned(S).filter((k) => !S.heitei[k]);
    if (fresh.length) {
      fresh.forEach((k) => {
        S.heitei[k] = true;
        heiteiGroups()[k].forEach((id) => { const c = S.castles[id]; c.def = Math.min(RULES.defCap, Math.round((c.def + HEITEI.def) * 10) / 10); });
      });
      const shot = () => {
        const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden || document.querySelector('.world-cover');
        if (busy) { setTimeout(shot, 1000); return; }
        const lord = lordOf(S);
        if (!lord) return;
        Sound.horagai();
        showKime(lord, `${fresh.join('・')} 平定`, pick(['この地は、わが家のものとなった。民を安んじよ', 'ついに一円を平らげた。ここからが本当の始まりだ', '一つの地を治めきった。次の地へ進もうぞ']), null, 'smile',
          `<p class="ts-up">季ごとの年貢 +${HEITEI.gold * fresh.length}・この地の城の守り +${HEITEI.def}</p>`);
        save();
      };
      setTimeout(shot, 900);
    }
    // 城の札に、その地の平定まであといくつか
    if (typeof selected === 'string' && selected) {
      const motto = document.querySelector('.motto');
      const k = heiteiKeyOf(selected);
      if (motto && k && !motto.parentElement.querySelector('.heitei-chip')) {
        const ids = heiteiGroups()[k], mine = ids.filter((id) => S.castles[id].owner === PLAYER).length;
        motto.insertAdjacentHTML('beforebegin', `<p class="heitei-chip ${mine === ids.length ? 'full' : ''}"><b>${k}</b>${ids.map((id) => `<i class="${S.castles[id].owner === PLAYER ? 'on' : ''}" title="${MAP.byId[id].short}"></i>`).join('')}
          <span>${mine === ids.length ? `平定済み・年貢 +${HEITEI.gold}/季` : `平定まであと${ids.length - mine}校（${ids.filter((id) => S.castles[id].owner !== PLAYER).map((id) => MAP.byId[id].short).join('・')}）`}</span></p>`);
      }
    }
    // 落城の処置
    if ((S.shochi || []).length && !SC_WAIT) {
      SC_WAIT = true;
      const ask = () => {
        const busy = !modal.hidden || document.querySelector('.kime:not([hidden])') || !$('battle').hidden || document.querySelector('.world-cover');
        if (busy) { setTimeout(ask, 700); return; }
        SC_WAIT = false;
        showShochi();
      };
      setTimeout(ask, 500);
    }
  }
  return r;
};
