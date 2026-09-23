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

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (on) tap();
      return on;
    },
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
