// ---------- 戦いの型：同じ地図でも、始まりの形を変える ----------
// 旗揚げで選ぶ。newGame のあとに盤面を組み替えるだけ（S.variant に残す）
const VARIANTS = {
  std: { name: '標準', mark: '常', desc: 'いつもの天下取り' },
  gunyu: { name: '群雄割拠', mark: '群', desc: 'どの家も同じ兵と金で始まる。家の差はなく、腕だけで競う' },
  appei: { name: '大大名の圧政', mark: '圧', desc: '最大の家がまわりの独立校を従えて始まる。ほかの家は手を結び、こちらも誘われる' },
  gekoku: { name: '下剋上の世', mark: '剋', desc: '自分の家は兵が少なく、他家は城が一つずつ多い。代わりに軍資金が多く、はじめから勢いがある（上級者向け）' },
};
function applyVariant(s, v) {
  s.variant = v;
  const clans = scenarioClans(s.scenario).filter((k) => castlesOf(s, k).length);
  const ai = clans.filter((k) => k !== PLAYER);
  if (v === 'gunyu') {
    clans.forEach((k) => {
      castlesOf(s, k).forEach((id) => { s.castles[id].troops = 1500; s.castles[id].def = Math.max(1, Math.min(s.castles[id].def, 1.2)); });
      s.gold[k] = s.gold[PLAYER];
    });
  }
  if (v === 'appei') {
    // 大大名：地図の真ん中にいちばん近い本拠の他家（天下の中央に構える）
    const cx = MAP.nodes.reduce((a, n) => a + n.x, 0) / MAP.nodes.length, cy = MAP.nodes.reduce((a, n) => a + n.y, 0) / MAP.nodes.length;
    const home = (k) => MAP.byId[k] || MAP.byId[castlesOf(s, k)[0]];
    const far = (k) => { const n = home(k); return n ? Math.hypot(n.x - cx, n.y - cy) : 1e9; };
    const big = ai.slice().sort((a, b) => far(a) - far(b))[0];
    if (big) {
      // まわりの独立校を、道のりの近い順に天下の四分の一ほどまで従える
      const want = Math.round(MAP.nodes.length * 0.25);
      const dist = { }, q = castlesOf(s, big).slice();
      q.forEach((id) => { dist[id] = 0; });
      for (let i = 0; i < q.length; i++) MAP.adj[q[i]].forEach((n) => { if (dist[n] === undefined) { dist[n] = dist[q[i]] + 1; q.push(n); } });
      const pickUp = q.filter((id) => s.castles[id].owner === 'none' && dist[id] <= 3).slice(0, Math.max(0, want - castlesOf(s, big).length));
      pickUp.forEach((id) => { s.castles[id].owner = big; s.castles[id].troops = Math.max(s.castles[id].troops, 900); });
      s.gold[big] = Math.round(s.gold[big] * 2);
      s.tyrant = big;
      const others = ai.filter((k) => k !== big);
      others.forEach((a, i) => others.slice(i + 1).forEach((b) => { const r = aiRel(s, a, b); r.truce = Math.max(r.truce, 8); r.friend = Math.max(r.friend, 70); }));
      others.forEach((k) => { const r = aiRel(s, k, big); r.friend = Math.min(r.friend, 10); r.ally = 0; r.truce = 0; });
      others.forEach((k) => { if (s.rel[k]) s.rel[k].friend = Math.min(100, s.rel[k].friend + 20); });
      if (s.rel[big]) s.rel[big].friend = Math.min(s.rel[big].friend, 15);
      s.nemesis = big; // 宿敵の家は、大大名
      addNews(s, `${CLANS[big].name}、大大名として天下ににらみ`, `${castlesOf(s, big).length}城を従える`, 80);
    }
  }
  if (v === 'gekoku') {
    castlesOf(s, PLAYER).forEach((id) => { s.castles[id].troops = Math.round((s.castles[id].troops * 0.6) / 10) * 10; });
    s.gold[PLAYER] += 600;
    s.momentum = 2;
    ai.forEach((k) => {
      const near = castlesOf(s, k).flatMap((id) => MAP.adj[id]).find((n) => s.castles[n].owner === 'none' && !MAP.adj[n].some((m) => s.castles[m].owner === PLAYER));
      if (near) { s.castles[near].owner = k; s.castles[near].troops = Math.max(s.castles[near].troops, 700); }
    });
  }
  return s;
}
