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

  // 何歩目に笛のどの音が始まるか
  const FUE_AT = (() => {
    const map = {};
    let pos = 0;
    FUE.forEach(([m, len]) => { if (m) map[pos] = [m, len * 2]; pos += len * 2; });
    return map;
  })();
  const LOOP = 16 * 8;

  function bgmStart() {
    const c = ensure(); if (!c) return;
    bgmStop(0);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, c.currentTime);
    out.gain.exponentialRampToValueAtTime(0.55, c.currentTime + 0.8);
    out.connect(c.destination);
    const state = { out, step: 0, next: c.currentTime + 0.1, timer: null };
    state.timer = setInterval(() => {
      while (state.next < c.currentTime + 0.15) {
        const s = state.step % LOOP, bar = Math.floor(s / 16), b = s % 16, t = state.next;
        if (ODAIKO[b] === 'D') bgmDrum(c, out, t, true);
        if (ODAIKO[b] === 'd') bgmDrum(c, out, t, false);
        if (SHIME[b] === 't') bgmShime(c, out, t, b % 4 === 0);
        if (b % 4 === 0 || b === 14) bgmShamisen(c, out, t, BASS[bar] - (b === 14 ? 5 : 0));
        if (b % 4 === 2) bgmShamisen(c, out, t, BASS[bar] + 12);
        if (FUE_AT[s]) bgmFue(c, out, t, FUE_AT[s][0], FUE_AT[s][1] * STEP);
        state.step++;
        state.next += STEP;
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

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (on) tap(); else bgmStop(0.1);
      return on;
    },
    bgmStart,
    bgmStop,
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
