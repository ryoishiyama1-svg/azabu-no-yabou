// 実績と戦績（プレイをまたいで端末に保存する）
const RECORD_KEY = 'azabu-records';

const ACHIEVEMENTS = [
  { id: 'first_win', icon: '初', name: '初めての天下', desc: '初めて天下統一する', end: (s) => s.result === 'win' },
  { id: 'win_toshin', icon: '都', name: '都心平定', desc: '「都心の陣」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'toshin' },
  { id: 'win_ku23', icon: '区', name: '二十三区の覇者', desc: '「二十三区統一」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'ku23' },
  { id: 'win_tokyo', icon: '京', name: '東京の覇者', desc: '「東京統一」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'tokyo' },
  { id: 'win_shutoken', icon: '関', name: '関東の覇者', desc: '「首都圏大戦」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'shutoken' },
  { id: 'win_hard', icon: '鬼', name: '鬼の上級', desc: '上級で天下統一', end: (s) => s.result === 'win' && s.diff === 'hard' },
  { id: 'fast', icon: '速', name: '電光石火', desc: '5年（20季）以内に天下統一', end: (s) => s.result === 'win' && s.turn <= 20 },
  { id: 'no_diplo', icon: '独', name: '外交いらず', desc: '外交を一度も使わずに天下統一', end: (s) => s.result === 'win' && !s.stats.diplo },
  { id: 'other_clan', icon: '新', name: '新たな野望', desc: '版の主役（東京版なら麻布家）以外の家で天下統一', end: (s) => s.result === 'win' && s.player !== EDITIONS[edOf(s.scenario)].lead },
  { id: 'all_clans', icon: '全', name: '全家制覇', desc: 'すべての家で天下統一', end: (s, rec) => Object.keys(CLANS).filter((k) => k !== 'none').every((k) => rec.clanWins[k]) },
  { id: 'encircle_win', icon: '破', name: '包囲網突破', desc: '包囲網を受けながら天下統一', end: (s) => s.result === 'win' && s.encircle },
  { id: 'comeback', icon: '起', name: '起死回生', desc: '城が1つまで減ってから天下統一', end: (s) => s.result === 'win' && s.stats.minCastles <= 1 },
  { id: 'gens30', icon: '衆', name: '大所帯', desc: '家臣が30人を超える', play: (s) => gensOf(s, PLAYER).length >= 30 },
  { id: 'recruit10', icon: '縁', name: '人たらし', desc: '捕らえた武将を10人登用する', play: (s) => s.stats.recruited >= 10 },
  { id: 'lord3', icon: '三', name: '三代目', desc: '3代目の当主が誕生する', play: (s) => s.lords.length >= 3 },
  { id: 'lord5', icon: '五', name: '名門', desc: '5代目の当主が誕生する', play: (s) => s.lords.length >= 5 },
  { id: 'battle50', icon: '戦', name: '百戦錬磨', desc: '合戦で50回勝つ', play: (s) => s.stats.battlesWon >= 50 },
  { id: 'tactic10', icon: '読', name: '読み合いの達人', desc: '作戦の読み合いで10回勝つ', play: (s) => s.stats.tacticWins >= 10 },
  { id: 'duel5', icon: '騎', name: '一騎当千', desc: '一騎打ちで5回勝つ', play: (s) => (s.stats.duelWins || 0) >= 5 },
  { id: 'debate3', icon: '舌', name: '弁舌の士', desc: '舌戦で3つの城を無血開城させる', play: (s) => (s.stats.debateWins || 0) >= 3 },
  { id: 'treasure5', icon: '宝', name: '蔵の主', desc: '家宝を5つ持つ', play: (s) => (s.vault || []).length + gensOf(s, PLAYER).filter((g) => g.treasure).length >= 5 },
  { id: 'rival', icon: '宿', name: '宿命の好敵手', desc: '宿敵が生まれる', play: (s) => Object.values(s.rivals || {}).some((n) => n >= RIVAL_AT) },
  { id: 'legend', icon: '伝', name: '語り継がれる者', desc: '名を上げた武将が列伝に名を残す', play: (s) => (s.hall || []).some((h) => h.rec.w + h.rec.cap + h.rec.dw * 2 + h.rec.def >= 10) },
  { id: 'first_lose', icon: '落', name: '落日を知る', desc: '初めて敗北する', end: (s) => s.result === 'lose' },
  { id: 'zukan50', icon: '鑑', name: '名門録', desc: '学校図鑑に50校を載せる', play: (s, rec) => Object.keys(rec.zukan || {}).length >= 50 },
  { id: 'zukan_ed', icon: '録', name: '一国の図鑑', desc: 'ひとつの版の学校をすべて図鑑に載せる', play: (s, rec) => Object.keys(EDITIONS).some((ed) => zukanIds(ed).every((id) => (rec.zukan || {})[id])) },
];

// ---------- 学校図鑑（すべてのゲームを通して、自分の家が治めた学校を集める） ----------
// rec.zukan[学校id] = { at: 初めて治めた時刻, n: 治めたゲームの数, ed: 初めて治めた版 }
// s.zukanSeen = そのゲームで数えた学校（同じゲームで二度は数えない）
function zukanSync(s) {
  if (!s || s.debugUsed || !s.castles) return [];
  s.zukanSeen = s.zukanSeen || {};
  const mine = Object.keys(s.castles).filter((id) => s.castles[id].owner === s.player && !s.zukanSeen[id]);
  if (!mine.length) return [];
  const rec = loadRecords();
  rec.zukan = rec.zukan || {};
  const fresh = [];
  mine.forEach((id) => {
    s.zukanSeen[id] = true;
    if (rec.zukan[id]) rec.zukan[id].n++;
    else { rec.zukan[id] = { at: Date.now(), n: 1, ed: edOf(s.scenario) }; fresh.push(id); }
  });
  saveRecords(rec);
  return fresh;
}
// その版に出てくる学校（版のどれかのシナリオに出る学校）
function zukanIds(ed) {
  const scs = scenariosOf(ed).map((k) => SCENARIOS[k]);
  return SCHOOL_ROWS.filter((r) => scs.some((sc) => sc.filter(r))).map((r) => r[0]);
}
const zukanAll = () => [...new Set(SCHOOL_ROWS.map((r) => r[0]))];

function loadRecords() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem(RECORD_KEY)); } catch (e) {}
  return Object.assign({ plays: 0, wins: 0, best: {}, clanWins: {}, unlocked: ['azabu'], ach: {} }, r || {});
}
function saveRecords(r) {
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch (e) {}
}

// 遊んでいる途中の実績を調べて、新しく取れたものを返す
function checkAchievements(s) {
  if (!s || s.debugUsed) return [];
  const rec = loadRecords();
  const got = ACHIEVEMENTS.filter((a) => a.play && !rec.ach[a.id] && a.play(s, rec));
  got.forEach((a) => { rec.ach[a.id] = Date.now(); });
  if (got.length) saveRecords(rec);
  return got;
}

// ゲームが終わったとき：戦績を記録し、実績と他家の解放を調べる
// ---------- 当主の年表 ----------
// 一度の天下取りを、大きな出来事と歴代当主で年表にする。遊び終えたゲームは rec.annals に残す（新しい順に10件）
function chronicleOf(s) {
  const house = CLANS[s.player] ? CLANS[s.player].name : '';
  const home = MAP.byId[s.player];
  const first = s.lords && s.lords[0];
  const events = (s.saga || []).filter((e) => e.weight >= 45).sort((a, b) => a.turn - b.turn).slice(-60)
    .map((e) => ({ turn: e.turn, head: e.head, sub: e.sub, big: e.weight >= 88 }));
  // はじまり（旗揚げ）と、おわり（天下統一か落日）
  events.unshift({ turn: 0, head: `${house}、${home ? home.ward : ''}の地に旗を揚げる`, sub: first ? `当主・${first.name}` : '', big: false });
  if (s.result) events.push({ turn: s.turn, head: s.result === 'win' ? `${house}、天下統一` : `${house}、滅亡`, sub: s.result === 'win' ? `${MAP.nodes.length}校を平定` : '最後の城が落ちた', big: true });
  return {
    at: Date.now(), scenario: s.scenario, player: s.player, house, result: s.result || null, turn: s.turn,
    lords: (s.lords || []).map((l) => ({ name: l.name, from: l.from, kakun: l.kakun })),
    events,
  };
}

function recordEnding(s) {
  if (!s || s.debugUsed || s.recorded) return { got: [], unlockedNow: false };
  s.recorded = true;
  const rec = loadRecords();
  rec.annals = [chronicleOf(s), ...(rec.annals || [])].slice(0, 10);
  rec.plays++;
  let unlockedNow = false;
  if (s.result === 'win') {
    rec.wins++;
    rec.clanWins[s.player] = (rec.clanWins[s.player] || 0) + 1;
    const key = `${s.scenario}/${s.diff}`;
    if (!rec.best[key] || s.turn < rec.best[key]) rec.best[key] = s.turn;
    // 一度でも天下統一したら、すべての家で遊べるようになる
    const all = Object.keys(CLANS).filter((k) => k !== 'none');
    if (rec.unlocked.length < all.length) { rec.unlocked = all; unlockedNow = true; }
  }
  const got = ACHIEVEMENTS.filter((a) => !rec.ach[a.id] && (a.end ? a.end(s, rec) : a.play(s, rec)));
  got.forEach((a) => { rec.ach[a.id] = Date.now(); });
  saveRecords(rec);
  return { got, unlockedNow };
}
