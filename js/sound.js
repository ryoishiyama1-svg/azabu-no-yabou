// 効果音（音源ファイルは使わず、その場で合成する）
const Sound = (() => {
  const KEY = 'azabu-sound';
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  // iPhoneでは画面をタップしたときに初めて音を出せるようになる
  function ensure() {
    if (!on) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(c) {
    const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let noise = null;

  function env(c, node, t, peak, attack, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // 太鼓：低い音の高さが下がる＋皮の音
  function taiko(delay = 0, vol = 1) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    env(c, g, t, 0.9 * vol, 0.005, 0.45);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.5);
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise; f.type = 'lowpass'; f.frequency.value = 900;
    env(c, ng, t, 0.35 * vol, 0.002, 0.08);
    n.connect(f).connect(ng).connect(c.destination);
    n.start(t); n.stop(t + 0.12);
  }

  // ほら貝：ゆらぎのある低い音
  function horagai() {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(196, t);
    o.frequency.linearRampToValueAtTime(220, t + 0.25);
    o.frequency.setValueAtTime(220, t + 0.9);
    o.frequency.linearRampToValueAtTime(185, t + 1.4);
    lfo.frequency.value = 5.5; lg.gain.value = 3;
    lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 850; f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.2);
    g.gain.setValueAtTime(0.28, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t); lfo.start(t); o.stop(t + 1.55); lfo.stop(t + 1.55);
  }

  // 刀がぶつかる音
  function clash(delay = 0) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = noise; f.type = 'highpass'; f.frequency.value = 2500;
    env(c, g, t, 0.25, 0.002, 0.15);
    n.connect(f).connect(g).connect(c.destination);
    n.start(t); n.stop(t + 0.2);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = 2600;
    env(c, og, t, 0.08, 0.002, 0.25);
    o.connect(og).connect(c.destination);
    o.start(t); o.stop(t + 0.3);
  }

  // 琴：音をはじく
  function koto(notes, gap = 0.12) {
    const c = ensure(); if (!c) return;
    notes.forEach((freq, i) => {
      const t = c.currentTime + i * gap;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      env(c, g, t, 0.3, 0.004, 0.9);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 1);
    });
  }

  // 木の札を置く音
  function tap() {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.05);
    env(c, g, t, 0.12, 0.002, 0.06);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.1);
  }

  // ---------- 合戦BGM ----------
  // 都節音階（レ・ミ♭・ソ・ラ・シ♭）の和風の曲を、太鼓・三味線・篠笛で合成してくり返す
  const BPM = 138;
  const STEP = 60 / BPM / 4; // 16分音符の長さ
  // 大太鼓 D / 締太鼓 t（1小節16歩）
  const ODAIKO = 'D...D.d.D...D.dd';
  const SHIME = 'tt.tt.t.tt.tt.tt';
  // 篠笛の旋律 [MIDI音番号, 8分音符いくつ分]（8小節）
  const FUE = [
    [74, 2], [75, 1], [74, 1], [70, 2], [69, 2],
    [67, 3], [69, 1], [70, 2], [69, 2],
    [74, 2], [75, 1], [74, 1], [79, 2], [75, 2],
    [74, 4], [70, 2], [69, 2],
    [62, 2], [63, 1], [62, 1], [67, 2], [69, 2],
    [70, 3], [69, 1], [67, 4],
    [69, 2], [70, 2], [74, 2], [70, 2],
    [69, 6], [0, 2],
  ];
  // 三味線の低音（1小節ごとの根音）
  const BASS = [50, 50, 55, 50, 50, 55, 57, 57];
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let bgm = null;

  function bgmDrum(c, out, t, big) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 95 : 70, t);
    o.frequency.exponentialRampToValueAtTime(big ? 45 : 40, t + 0.3);
    env(c, g, t, big ? 0.8 : 0.45, 0.004, big ? 0.4 : 0.25);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.45);
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise; f.type = 'lowpass'; f.frequency.value = 700;
    env(c, ng, t, big ? 0.25 : 0.12, 0.002, 0.06);
    n.connect(f).connect(ng).connect(out);
    n.start(t); n.stop(t + 0.1);
  }

  function bgmShime(c, out, t, accent) {
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 3;
    env(c, g, t, accent ? 0.32 : 0.16, 0.001, 0.05);
    n.connect(f).connect(g).connect(out);
    n.start(t); n.stop(t + 0.08);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = 420;
    env(c, og, t, accent ? 0.12 : 0.06, 0.001, 0.05);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.08);
  }

  function bgmShamisen(c, out, t, m) {
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = midi(m);
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    env(c, g, t, 0.16, 0.002, 0.22);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + 0.28);
  }

  function bgmFue(c, out, t, m, dur) {
    const o = c.createOscillator(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o.frequency.value = midi(m + 12);
    // 吹き始めは少し低めから入る（篠笛らしさ）
    o.frequency.setValueAtTime(midi(m + 12) * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(midi(m + 12), t + 0.06);
    lfo.frequency.value = 5.8; lg.gain.value = dur > 0.4 ? 9 : 3;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.04);
    g.gain.setValueAtTime(0.11, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
    // 息の音
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise; f.type = 'bandpass'; f.frequency.value = midi(m + 12) * 2; f.Q.value = 2;
    env(c, ng, t, 0.03, 0.02, Math.min(dur, 0.3));
    n.connect(f).connect(ng).connect(out);
    n.start(t); n.stop(t + Math.min(dur, 0.35));
  }

  // 旋律 [[音, 8分音符いくつ分], ...] を「何歩目（16分音符）に何の音を何歩ぶん」の表にする
  function melodyAt(notes) {
    const map = {};
    let pos = 0;
    notes.forEach(([m, len]) => { if (m) map[pos] = [m, len * 2]; pos += len * 2; });
    return map;
  }
  const FUE_AT = melodyAt(FUE);

  // ---------- 地図BGM ----------
  // 陽音階（レ・ミ・ソ・ラ・シ）で、琴の分散和音と尺八の旋律。ゆったり16小節
  const MAP_STEP = 60 / 72 / 4;
  const YO = [50, 52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81];
  const SHAKU = [
    [69, 4], [71, 2], [74, 2],
    [71, 6], [69, 2],
    [67, 4], [69, 2], [71, 2],
    [69, 8],
    [74, 4], [76, 2], [74, 2],
    [71, 4], [69, 4],
    [67, 2], [69, 2], [71, 2], [69, 2],
    [67, 6], [0, 2],
    [64, 4], [67, 2], [69, 2],
    [71, 6], [69, 2],
    [74, 4], [71, 2], [69, 2],
    [67, 8],
    [69, 4], [71, 2], [74, 2],
    [76, 4], [74, 4],
    [71, 2], [69, 2], [67, 2], [64, 2],
    [62, 6], [0, 2],
  ];
  const SHAKU_AT = melodyAt(SHAKU);
  // 1小節ごとの琴の根音（YO の何番目か）
  const KOTO_ROOT = [0, 0, 2, 3, 0, 4, 2, 3, 1, 2, 3, 2, 0, 1, 2, 0];

  // 琴：ばちではじいた瞬間に少し音が下がり、ゆっくり消える
  function bgmKoto(c, out, t, m, vol = 0.14) {
    const f0 = midi(m);
    [[1, 'triangle', vol], [2, 'sine', vol * 0.35], [3, 'sine', vol * 0.12]].forEach(([h, type, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0 * h * 1.012, t);
      o.frequency.exponentialRampToValueAtTime(f0 * h, t + 0.04);
      env(c, g, t, v, 0.003, h === 1 ? 1.6 : 0.6);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 1.7);
    });
  }

  // 尺八：下から入って、のばすと揺れる。息の音が多め
  function bgmShaku(c, out, t, m, dur) {
    const f = midi(m);
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    [o, o2].forEach((x) => {
      x.frequency.setValueAtTime(f * 0.94, t);
      x.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    });
    lfo.frequency.value = 4.5;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(dur > 0.8 ? f * 0.012 : 0, t + Math.min(dur * 0.6, 0.9));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const o2g = c.createGain(); o2g.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.setValueAtTime(0.1, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.99);
    o.connect(g); o2.connect(o2g).connect(g); g.connect(out);
    [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + dur); });
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise; n.loop = true;
    nf.type = 'bandpass'; nf.frequency.value = f * 1.5; nf.Q.value = 1.5;
    env(c, ng, t, 0.05, 0.06, Math.min(dur, 0.5));
    n.connect(nf).connect(ng).connect(out);
    n.start(t); n.stop(t + Math.min(dur, 0.6));
  }

  // ---------- タイトルBGM ----------
  // 笙（しょう）のような和音がゆっくりふくらみ、大太鼓と尺八で幕が開くような曲
  const TITLE_STEP = 60 / 66 / 4;
  const TITLE_MELO = melodyAt([
    [62, 2], [69, 4], [71, 2],
    [74, 6], [71, 2],
    [69, 4], [67, 2], [69, 2],
    [64, 8],
    [67, 2], [69, 2], [71, 2], [74, 2],
    [76, 6], [74, 2],
    [71, 3], [69, 1], [67, 2], [64, 2],
    [62, 8],
  ]);
  // 2小節ごとの笙の和音
  const SHO = [[62, 69, 74, 76], [67, 74, 76, 81], [69, 76, 81, 83], [62, 69, 71, 76]];

  function bgmSho(c, out, t, notes, dur) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.setValueAtTime(0.05, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2200;
    g.connect(f).connect(out);
    notes.forEach((m, i) => {
      [0, 3].forEach((cents) => { // 少しずらして重ね、うなりを出す
        const o = c.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = midi(m) * Math.pow(2, cents / 1200);
        o.connect(g);
        o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }

  // ---------- エンディングBGM ----------
  // 勝利：祭囃子（締太鼓・大太鼓・当り鉦・篠笛）
  const WIN_STEP = 60 / 104 / 4;
  const WIN_MELO = melodyAt([
    [74, 1], [76, 1], [79, 2], [76, 2], [74, 2],
    [71, 2], [74, 2], [76, 4],
    [79, 1], [81, 1], [79, 2], [76, 2], [74, 2],
    [76, 6], [0, 2],
    [74, 2], [71, 2], [69, 2], [71, 2],
    [74, 2], [76, 2], [74, 4],
    [71, 1], [74, 1], [76, 2], [74, 2], [71, 2],
    [69, 2], [71, 2], [74, 4],
  ]);
  const MATSURI_SHIME = 'tt.tt.t.tt.tt.t.';
  const MATSURI_KANE = '..k...k...k...k.';

  // 当り鉦：金属の高い音が重なって、すぐ消える
  function bgmKane(c, out, t) {
    [1800, 2650, 3900].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = i ? 'sine' : 'square';
      o.frequency.value = f;
      env(c, g, t, i ? 0.03 : 0.02, 0.001, 0.12);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.15);
    });
  }

  // 敗北：都節音階の尺八の独奏
  const LOSE_STEP = 60 / 56 / 4;
  const LOSE_MELO = melodyAt([
    [74, 4], [75, 2], [74, 2],
    [70, 6], [69, 2],
    [67, 4], [69, 2], [70, 2],
    [69, 8],
    [62, 4], [63, 2], [67, 2],
    [69, 4], [70, 2], [69, 2],
    [67, 2], [63, 2], [62, 4],
    [62, 8],
  ]);
  const LOSE_SHO = [[50, 57, 62], [55, 62, 70], [51, 58, 63], [50, 57, 62]];
  const LOSE_BASS = [50, 50, 55, 57, 50, 55, 51, 50];

  // ---------- 会談BGM ----------
  // 静かな座敷：鼓の「ポン」と、間をたっぷり取った琴の旋律（都節音階）
  const MEET_STEP = 60 / 60 / 4;
  const MEET_KOTO = melodyAt([
    [69, 3], [70, 1], [74, 4], [0, 4], [74, 2], [75, 2], [74, 4], [0, 4],
    [70, 2], [69, 2], [67, 4], [0, 4], [62, 2], [63, 2], [67, 4], [0, 4],
    [69, 3], [70, 1], [74, 4], [0, 4], [79, 2], [75, 2], [74, 4], [0, 4],
    [70, 2], [69, 2], [67, 2], [63, 2], [62, 8], [0, 8],
  ]);
  // 鼓の打ち方（1小節16歩）P=ポン（高く澄んだ音） p=小さく o=低いドン
  const TSUZUMI = ['P.......p.....o.', '........P...p...'];
  const MEET_SHO = [[62, 69, 74], [58, 65, 70], [55, 62, 67], [57, 62, 69]];

  // 鼓：皮を打った瞬間に音程が上がって、すっと下がる
  function bgmTsuzumi(c, out, t, kind) {
    const o = c.createOscillator(), g = c.createGain();
    const f = kind === 'o' ? 180 : 420;
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.4);
    env(c, g, t, kind === 'P' ? 0.22 : kind === 'p' ? 0.1 : 0.16, 0.002, kind === 'o' ? 0.3 : 0.45);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.5);
    noise = noise || noiseBuffer(c);
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise;
    nf.type = 'bandpass'; nf.frequency.value = 2500; nf.Q.value = 0.8;
    env(c, ng, t, 0.06, 0.001, 0.04);
    n.connect(nf).connect(ng).connect(out);
    n.start(t); n.stop(t + 0.06);
  }

  const TRACKS = {
    meeting: {
      step: MEET_STEP, loop: 16 * 8, vol: 0.45,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        const k = TSUZUMI[bar % 2][b];
        if (k !== '.') bgmTsuzumi(c, out, t, k);
        if (b === 0 && bar % 2 === 0) bgmSho(c, out, t, MEET_SHO[(bar / 2) % 4], MEET_STEP * 32);
        if (b === 0) bgmKoto(c, out, t, [50, 46, 43, 45][Math.floor(bar / 2) % 4], 0.1);
        if (MEET_KOTO[s]) bgmKoto(c, out, t, MEET_KOTO[s][0], 0.12);
      },
    },
    win: {
      step: WIN_STEP, loop: 16 * 8, vol: 0.5,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        if (b === 0 || b === 8) bgmDrum(c, out, t, true);
        if (b === 6 || b === 14) bgmDrum(c, out, t, false);
        if (MATSURI_SHIME[b] === 't') bgmShime(c, out, t, b % 4 === 0);
        if (MATSURI_KANE[b] === 'k') bgmKane(c, out, t);
        if (b === 0 && bar % 2 === 0) bgmSho(c, out, t, SHO[(bar / 2) % 4], WIN_STEP * 32);
        if (WIN_MELO[s]) bgmFue(c, out, t, WIN_MELO[s][0], WIN_MELO[s][1] * WIN_STEP);
      },
    },
    lose: {
      step: LOSE_STEP, loop: 16 * 8, vol: 0.55,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        if (b === 0 && bar % 2 === 0) bgmSho(c, out, t, LOSE_SHO[bar / 2], LOSE_STEP * 32);
        if (b === 0) bgmKoto(c, out, t, LOSE_BASS[bar], 0.13);
        if (b === 8 && bar % 2 === 1) {
          bgmKoto(c, out, t, LOSE_BASS[bar] + 19, 0.06);
          bgmKoto(c, out, t + LOSE_STEP * 2, LOSE_BASS[bar] + 17, 0.05);
        }
        if (LOSE_MELO[s]) bgmShaku(c, out, t, LOSE_MELO[s][0], LOSE_MELO[s][1] * LOSE_STEP);
      },
    },
    title: {
      step: TITLE_STEP, loop: 16 * 8, vol: 0.5,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        if (s === 0) {
          // 琴のグリッサンド
          YO.slice(5, 13).forEach((m, i) => bgmKoto(c, out, t + i * 0.06, m, 0.08));
        }
        if (b === 0 && bar % 2 === 0) bgmSho(c, out, t, SHO[bar / 2], TITLE_STEP * 32);
        if (b === 0 || b === 8) bgmDrum(c, out, t, true);
        if (bar % 4 === 3 && b >= 12) bgmDrum(c, out, t, false); // 太鼓の連打
        if (b === 0) bgmKoto(c, out, t, [50, 55, 57, 50][bar % 4], 0.14);
        if (TITLE_MELO[s]) bgmShaku(c, out, t, TITLE_MELO[s][0], TITLE_MELO[s][1] * TITLE_STEP);
      },
    },
    battle: {
      step: STEP, loop: 16 * 8, vol: 0.55,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        if (ODAIKO[b] === 'D') bgmDrum(c, out, t, true);
        if (ODAIKO[b] === 'd') bgmDrum(c, out, t, false);
        if (SHIME[b] === 't') bgmShime(c, out, t, b % 4 === 0);
        if (b % 4 === 0 || b === 14) bgmShamisen(c, out, t, BASS[bar] - (b === 14 ? 5 : 0));
        if (b % 4 === 2) bgmShamisen(c, out, t, BASS[bar] + 12);
        if (FUE_AT[s]) bgmFue(c, out, t, FUE_AT[s][0], FUE_AT[s][1] * STEP);
      },
    },
    map: {
      step: MAP_STEP, loop: 16 * 16, vol: 0.5,
      play(c, out, s, t) {
        const bar = Math.floor(s / 16), b = s % 16;
        const r = KOTO_ROOT[bar] + 3; // 分散和音の最初の音
        const arp = [YO[r], YO[r + 2], YO[r + 4], YO[r + 5]];
        const up = bar % 2 === 0;
        if (b === 0) bgmKoto(c, out, t, YO[KOTO_ROOT[bar]], 0.16); // 低音
        if (b % 4 === 0) bgmKoto(c, out, t + (b ? 0 : 0.03), up ? arp[b / 4] : arp[3 - b / 4], 0.1);
        if (b === 14 && bar % 4 === 3) bgmKoto(c, out, t, arp[2], 0.07);
        if (SHAKU_AT[s]) bgmShaku(c, out, t, SHAKU_AT[s][0], SHAKU_AT[s][1] * MAP_STEP);
      },
    },
  };

  function bgmStart(kind = 'battle') {
    const c = ensure(); if (!c) return;
    if (bgm && bgm.kind === kind) return; // すでに流れている
    bgmStop(0.6);
    const tr = TRACKS[kind];
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, c.currentTime);
    out.gain.exponentialRampToValueAtTime(tr.vol, c.currentTime + (kind === 'battle' || kind === 'win' ? 0.8 : 2));
    out.connect(c.destination);
    const state = { kind, out, step: 0, next: c.currentTime + 0.1, timer: null };
    state.timer = setInterval(() => {
      if (c.state !== 'running') return;
      // 裏にいた間などで大きく遅れたら、今の時刻から続ける
      if (state.next < c.currentTime - 0.5) state.next = c.currentTime + 0.05;
      while (state.next < c.currentTime + 0.15) {
        tr.play(c, out, state.step % tr.loop, state.next);
        state.step++;
        state.next += tr.step;
      }
    }, 25);
    bgm = state;
  }

  function bgmStop(fade = 0.6) {
    if (!bgm || !ctx) return;
    const b = bgm;
    bgm = null;
    clearInterval(b.timer);
    const t = ctx.currentTime;
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setValueAtTime(Math.max(0.0001, b.out.gain.value), t);
    b.out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fade));
    setTimeout(() => b.out.disconnect(), (fade + 0.5) * 1000);
  }

  // 確認用：曲を音にせずデータとして作り、音量の最大値と平均を返す
  async function analyze(kind, seconds = 20) {
    const rate = 22050;
    const c = new OfflineAudioContext(1, rate * seconds, rate);
    const tr = TRACKS[kind];
    const out = c.createGain();
    out.gain.value = tr.vol;
    out.connect(c.destination);
    for (let i = 0, t = 0.05; t < seconds - 2; i++, t += tr.step) tr.play(c, out, i % tr.loop, t);
    const buf = await c.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4) };
  }

  // アプリが裏に回ったら音を止め、戻ったら再開する
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume();
  });

  return {
    get on() { return on; },
    get playing() { return bgm ? bgm.kind : null; },
    get ready() { return !!ctx; }, // 一度タップされて音を出せる状態か
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (on) tap(); else bgmStop(0.1);
      return on;
    },
    bgmStart,
    bgmStop,
    analyze,
    unlock() { ensure(); },
    tap,
    taiko,
    clash,
    horagai,
    win() { koto([587, 659, 784, 880, 1175], 0.11); },   // 陽音階で上る
    lose() { koto([440, 392, 330, 294, 220], 0.2); },
    season() { taiko(0, 0.8); taiko(0.28, 0.8); taiko(0.62, 1); },
  };
})();
