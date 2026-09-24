// 実績と戦績（プレイをまたいで端末に保存する）
const RECORD_KEY = 'azabu-records';

const ACHIEVEMENTS = [
  { id: 'first_win', icon: '初', name: '初めての天下', desc: '初めて天下統一する', end: (s) => s.result === 'win' },
  { id: 'win_toshin', icon: '都', name: '都心平定', desc: '「都心の陣」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'toshin' },
  { id: 'win_ku23', icon: '区', name: '二十三区の覇者', desc: '「二十三区統一」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'ku23' },
  { id: 'win_tokyo', icon: '京', name: '東京の覇者', desc: '「東京統一」で天下統一', end: (s) => s.result === 'win' && s.scenario === 'tokyo' },
  { id: 'win_hard', icon: '鬼', name: '鬼の上級', desc: '上級で天下統一', end: (s) => s.result === 'win' && s.diff === 'hard' },
  { id: 'fast', icon: '速', name: '電光石火', desc: '5年（20季）以内に天下統一', end: (s) => s.result === 'win' && s.turn <= 20 },
  { id: 'no_diplo', icon: '独', name: '外交いらず', desc: '外交を一度も使わずに天下統一', end: (s) => s.result === 'win' && !s.stats.diplo },
  { id: 'other_clan', icon: '新', name: '新たな野望', desc: '麻布家以外で天下統一', end: (s) => s.result === 'win' && s.player !== 'azabu' },
  { id: 'all_clans', icon: '全', name: '全家制覇', desc: '6つの家すべてで天下統一', end: (s, rec) => Object.keys(CLANS).filter((k) => k !== 'none').every((k) => rec.clanWins[k]) },
  { id: 'encircle_win', icon: '破', name: '包囲網突破', desc: '包囲網を受けながら天下統一', end: (s) => s.result === 'win' && s.encircle },
  { id: 'comeback', icon: '起', name: '起死回生', desc: '城が1つまで減ってから天下統一', end: (s) => s.result === 'win' && s.stats.minCastles <= 1 },
  { id: 'gens30', icon: '衆', name: '大所帯', desc: '家臣が30人を超える', play: (s) => gensOf(s, PLAYER).length >= 30 },
  { id: 'recruit10', icon: '縁', name: '人たらし', desc: '捕らえた武将を10人登用する', play: (s) => s.stats.recruited >= 10 },
  { id: 'lord3', icon: '三', name: '三代目', desc: '3代目の当主が誕生する', play: (s) => s.lords.length >= 3 },
  { id: 'lord5', icon: '五', name: '名門', desc: '5代目の当主が誕生する', play: (s) => s.lords.length >= 5 },
  { id: 'battle50', icon: '戦', name: '百戦錬磨', desc: '合戦で50回勝つ', play: (s) => s.stats.battlesWon >= 50 },
  { id: 'tactic10', icon: '読', name: '読み合いの達人', desc: '作戦の読み合いで10回勝つ', play: (s) => s.stats.tacticWins >= 10 },
  { id: 'first_lose', icon: '落', name: '落日を知る', desc: '初めて敗北する', end: (s) => s.result === 'lose' },
];

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
function recordEnding(s) {
  if (!s || s.debugUsed || s.recorded) return { got: [], unlockedNow: false };
  s.recorded = true;
  const rec = loadRecords();
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
