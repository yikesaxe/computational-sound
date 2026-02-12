document.addEventListener("DOMContentLoaded", () => {
  // ===== FREQUENCY MAP =====
  const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096,  //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910,  //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398,  //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138,  //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916,  //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192,  //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821,  //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797,  //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277,  //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832,  //7 - A#
    '85': 987.766602512248223,  //U - B
  };

  // Keyboard octave structure
  const octaves = [
    {
      white: [
        ["90", "Z", "C"],
        ["88", "X", "D"],
        ["67", "C", "E"],
        ["86", "V", "F"],
        ["66", "B", "G"],
        ["78", "N", "A"],
        ["77", "M", "B"]
      ],
      black: [
        ["83", "S", "C♯", 1],
        ["68", "D", "D♯", 2],
        ["71", "G", "F♯", 3],
        ["72", "H", "G♯", 4],
        ["74", "J", "A♯", 5]
      ]
    },
    {
      white: [
        ["81", "Q", "C"],
        ["87", "W", "D"],
        ["69", "E", "E"],
        ["82", "R", "F"],
        ["84", "T", "G"],
        ["89", "Y", "A"],
        ["85", "U", "B"]
      ],
      black: [
        ["50", "2", "C♯", 1],
        ["51", "3", "D♯", 2],
        ["53", "5", "F♯", 3],
        ["54", "6", "G♯", 4],
        ["55", "7", "A♯", 5]
      ]
    }
  ];

  // Build keyboard UI
  const kbdEl = document.getElementById("kbd");
  const keyEls = new Map();

  for (const octave of octaves) {
    const octaveDiv = document.createElement("div");
    octaveDiv.className = "octave";

    for (const [code, key, note] of octave.white) {
      const d = document.createElement("div");
      d.className = "key white";
      d.dataset.code = code;
      octaveDiv.appendChild(d);
      keyEls.set(code, d);
    }

    for (const [code, key, note, pos] of octave.black) {
      const d = document.createElement("div");
      d.className = "key black";
      d.dataset.code = code;
      d.dataset.pos = pos;
      octaveDiv.appendChild(d);
      keyEls.set(code, d);
    }

    kbdEl.appendChild(octaveDiv);
  }

  // ===== AUDIO CONTEXT =====
  let audioCtx = null;
  let globalGain = null;
  const activeVoices = {};

  // ===== SYNTHESIS MODE =====
  let currentMode = 'additive';
  const modeBtns = document.querySelectorAll('#modeSelector .mode-btn');
  const synthParams = document.querySelectorAll('.synth-param');

  function updateSynthMode(mode) {
    currentMode = mode;
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    synthParams.forEach(param => {
      param.classList.toggle('hidden', param.dataset.for !== mode);
    });
    updateParamDisplay();
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => updateSynthMode(btn.dataset.mode));
  });

  // ===== PARAMETER DISPLAY =====
  const paramDisplay = document.getElementById('paramDisplay');
  const paramPrev = document.getElementById('paramPrev');
  const paramNext = document.getElementById('paramNext');

  const paramConfigs = {
    additive: [
      { id: 'partials', label: 'Partials', format: v => Math.round(v) },
      { id: 'rolloff', label: 'Rolloff', format: v => parseFloat(v).toFixed(1) }
    ],
    am: [
      { id: 'amFreq', label: 'Mod Hz', format: v => parseFloat(v).toFixed(1) },
      { id: 'amDepth', label: 'Depth', format: v => parseFloat(v).toFixed(2) }
    ],
    fm: [
      { id: 'fmRatio', label: 'Ratio', format: v => parseFloat(v).toFixed(1) },
      { id: 'fmIndex', label: 'Index', format: v => parseFloat(v).toFixed(1) }
    ]
  };

  let currentParamIndex = 0;

  function updateParamDisplay() {
    const params = paramConfigs[currentMode];
    if (!params || params.length === 0) {
      paramDisplay.textContent = currentMode.toUpperCase();
      return;
    }
    currentParamIndex = Math.min(currentParamIndex, params.length - 1);
    const param = params[currentParamIndex];
    const input = document.getElementById(param.id);
    paramDisplay.textContent = `${param.label}: ${param.format(input.value)}`;
  }

  paramPrev.addEventListener('click', () => {
    const params = paramConfigs[currentMode];
    currentParamIndex = (currentParamIndex - 1 + params.length) % params.length;
    updateParamDisplay();
  });

  paramNext.addEventListener('click', () => {
    const params = paramConfigs[currentMode];
    currentParamIndex = (currentParamIndex + 1) % params.length;
    updateParamDisplay();
  });

  // ===== CONTROLS =====
  const masterVolEl = document.getElementById("masterVol");
  const attackEl = document.getElementById("attack");
  const decayEl = document.getElementById("decay");
  const sustainEl = document.getElementById("sustain");
  const releaseEl = document.getElementById("release");
  const enableBtn = document.getElementById("enableAudio");

  // Additive params
  const partialsEl = document.getElementById("partials");
  const rolloffEl = document.getElementById("rolloff");

  // AM params
  const amFreqEl = document.getElementById("amFreq");
  const amDepthEl = document.getElementById("amDepth");

  // FM params
  const fmRatioEl = document.getElementById("fmRatio");
  const fmIndexEl = document.getElementById("fmIndex");

  // LFO params
  const lfoRateEl = document.getElementById("lfoRate");
  const lfoDepthEl = document.getElementById("lfoDepth");
  let currentLfoTarget = 'none';

  const lfoTargetBtns = document.querySelectorAll('#lfoTarget .mode-btn');
  lfoTargetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentLfoTarget = btn.dataset.target;
      lfoTargetBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // ===== AUDIO INIT =====
  function ensureAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(parseFloat(masterVolEl.value), audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);
  }

  // ===== ANTI-CLIPPING =====
  function updatePerVoiceGains() {
    const keys = Object.keys(activeVoices);
    const n = keys.length || 1;
    const scale = 1 / Math.sqrt(n);
    for (const k of keys) {
      const v = activeVoices[k];
      if (!v || !v.voiceGain) continue;
      const t = audioCtx.currentTime;
      v.voiceGain.gain.cancelScheduledValues(t);
      v.voiceGain.gain.setTargetAtTime(v.baseLevel * scale, t, 0.01);
    }
  }

  // ===== ADSR ENVELOPE =====
  function applyADSR(gainNode, peakLevel) {
    const A = parseFloat(attackEl.value);
    const D = parseFloat(decayEl.value);
    const S = parseFloat(sustainEl.value);
    const t0 = audioCtx.currentTime;
    const eps = 0.0001;
    gainNode.gain.cancelScheduledValues(t0);
    gainNode.gain.setValueAtTime(eps, t0);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(eps, peakLevel), t0 + A);
    const sustainLevel = Math.max(eps, peakLevel * S);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, t0 + A + D);
  }

  function releaseVoice(voice) {
    const R = parseFloat(releaseEl.value);
    const t0 = audioCtx.currentTime;
    const eps = 0.0001;
    voice.voiceGain.gain.cancelScheduledValues(t0);
    voice.voiceGain.gain.setTargetAtTime(eps, t0, Math.max(0.01, R / 6));
    const stopTime = t0 + R + 0.1;

    // Stop all oscillators
    if (voice.oscillators) {
      voice.oscillators.forEach(osc => {
        try { osc.stop(stopTime); } catch(e) {}
      });
    }
    if (voice.osc) {
      try { voice.osc.stop(stopTime); } catch(e) {}
    }
    // Stop constant sources
    if (voice.sources) {
      voice.sources.forEach(src => {
        try { src.stop(stopTime); } catch(e) {}
      });
    }
  }

  // ===== SYNTHESIS: ADDITIVE =====
  function createAdditiveVoice(freq) {
    const numPartials = parseInt(partialsEl.value);
    const rolloff = parseFloat(rolloffEl.value);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    voiceGain.connect(globalGain);

    const oscillators = [];
    for (let i = 1; i <= numPartials; i++) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * i, audioCtx.currentTime);

      const partialGain = audioCtx.createGain();
      const amplitude = 1 / Math.pow(i, rolloff);
      partialGain.gain.setValueAtTime(amplitude, audioCtx.currentTime);

      osc.connect(partialGain);
      partialGain.connect(voiceGain);
      osc.start();
      oscillators.push(osc);
    }

    // Apply LFO if targeting amplitude
    applyLFOToGain(voiceGain);

    const baseLevel = 0.35;
    applyADSR(voiceGain, baseLevel);

    return { voiceGain, oscillators, baseLevel };
  }

  // ===== SYNTHESIS: AM =====
  function createAMVoice(freq) {
    const modFreq = parseFloat(amFreqEl.value);
    const modDepth = parseFloat(amDepthEl.value);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    voiceGain.connect(globalGain);

    // Carrier oscillator
    const carrier = audioCtx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Modulator oscillator
    const modulator = audioCtx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(modFreq, audioCtx.currentTime);

    // AM gain node
    const amGain = audioCtx.createGain();
    amGain.gain.setValueAtTime(1 - modDepth * 0.5, audioCtx.currentTime);

    // Modulation depth gain
    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(modDepth * 0.5, audioCtx.currentTime);

    // Connect modulator to AM gain's gain parameter
    modulator.connect(modGain);
    modGain.connect(amGain.gain);

    // Connect carrier through AM gain
    carrier.connect(amGain);
    amGain.connect(voiceGain);

    carrier.start();
    modulator.start();

    // Apply LFO
    applyLFOToGain(voiceGain);

    const baseLevel = 0.35;
    applyADSR(voiceGain, baseLevel);

    return { voiceGain, oscillators: [carrier, modulator], baseLevel };
  }

  // ===== SYNTHESIS: FM =====
  function createFMVoice(freq) {
    const modRatio = parseFloat(fmRatioEl.value);
    const modIndex = parseFloat(fmIndexEl.value);

    const modFreq = freq * modRatio;
    const modAmount = modFreq * modIndex;

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    voiceGain.connect(globalGain);

    // Modulator oscillator
    const modulator = audioCtx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(modFreq, audioCtx.currentTime);

    // Modulation depth
    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(modAmount, audioCtx.currentTime);

    // Carrier oscillator
    const carrier = audioCtx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Connect modulator to carrier frequency
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Connect carrier to output
    carrier.connect(voiceGain);

    modulator.start();
    carrier.start();

    // Apply LFO
    applyLFOToGain(voiceGain);

    const baseLevel = 0.35;
    applyADSR(voiceGain, baseLevel);

    return { voiceGain, oscillators: [carrier, modulator], baseLevel };
  }

  // ===== LFO =====
  function applyLFOToGain(voiceGain) {
    if (currentLfoTarget === 'none') return;

    const lfoRate = parseFloat(lfoRateEl.value);
    const lfoDepth = parseFloat(lfoDepthEl.value);

    if (currentLfoTarget === 'amplitude') {
      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(lfoRate, audioCtx.currentTime);

      const lfoGainNode = audioCtx.createGain();
      lfoGainNode.gain.setValueAtTime(lfoDepth * 0.3, audioCtx.currentTime);

      lfo.connect(lfoGainNode);
      lfoGainNode.connect(voiceGain.gain);
      lfo.start();
    }
  }

  function applyLFOToPitch(osc, freq) {
    if (currentLfoTarget !== 'pitch') return;

    const lfoRate = parseFloat(lfoRateEl.value);
    const lfoDepth = parseFloat(lfoDepthEl.value);

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(lfoRate, audioCtx.currentTime);

    const lfoGainNode = audioCtx.createGain();
    // Vibrato depth: up to 50 cents (half semitone)
    lfoGainNode.gain.setValueAtTime(freq * lfoDepth * 0.03, audioCtx.currentTime);

    lfo.connect(lfoGainNode);
    lfoGainNode.connect(osc.frequency);
    lfo.start();

    return lfo;
  }

  // ===== CREATE VOICE (based on mode) =====
  function createVoice(freq) {
    let voice;
    switch (currentMode) {
      case 'additive':
        voice = createAdditiveVoice(freq);
        break;
      case 'am':
        voice = createAMVoice(freq);
        break;
      case 'fm':
        voice = createFMVoice(freq);
        break;
      default:
        voice = createAdditiveVoice(freq);
    }

    // Apply pitch LFO to first oscillator if needed
    if (currentLfoTarget === 'pitch' && voice.oscillators && voice.oscillators[0]) {
      const lfoOsc = applyLFOToPitch(voice.oscillators[0], freq);
      if (lfoOsc) {
        voice.oscillators.push(lfoOsc);
      }
    }

    return voice;
  }

  // ===== SYNESTHESIA =====
  const noteColors = {
    'C': { hue: 0, sat: 85, light: 65 },
    'C#': { hue: 25, sat: 90, light: 60 },
    'D': { hue: 45, sat: 95, light: 60 },
    'D#': { hue: 55, sat: 90, light: 65 },
    'E': { hue: 90, sat: 80, light: 55 },
    'F': { hue: 150, sat: 75, light: 60 },
    'F#': { hue: 175, sat: 85, light: 55 },
    'G': { hue: 200, sat: 85, light: 60 },
    'G#': { hue: 240, sat: 75, light: 65 },
    'A': { hue: 280, sat: 80, light: 60 },
    'A#': { hue: 310, sat: 85, light: 60 },
    'B': { hue: 340, sat: 80, light: 65 }
  };

  const keyToNote = {
    '90': 'C', '83': 'C#', '88': 'D', '68': 'D#', '67': 'E', '86': 'F', '71': 'F#',
    '66': 'G', '72': 'G#', '78': 'A', '74': 'A#', '77': 'B',
    '81': 'C', '50': 'C#', '87': 'D', '51': 'D#', '69': 'E', '82': 'F', '53': 'F#',
    '84': 'G', '54': 'G#', '89': 'A', '55': 'A#', '85': 'B'
  };

  const synesthesiaLayer = document.getElementById('synesthesiaLayer');
  const blendLayer = document.getElementById('blendLayer');
  const activeNoteColors = new Map();

  function updateBlendedBackground() {
    const colors = Array.from(activeNoteColors.values());
    
    if (colors.length === 0) {
      blendLayer.style.background = 'transparent';
      return;
    }
    
    if (colors.length === 1) {
      const c = colors[0];
      blendLayer.style.background = `radial-gradient(ellipse at 50% 50%, 
        hsla(${c.hue}, ${c.sat}%, ${c.light}%, 0.3) 0%, 
        hsla(${c.hue}, ${c.sat}%, ${c.light}%, 0.1) 50%, 
        transparent 70%)`;
      return;
    }
    
    let sinSum = 0, cosSum = 0, satSum = 0, lightSum = 0;
    colors.forEach(c => {
      const rad = c.hue * Math.PI / 180;
      sinSum += Math.sin(rad);
      cosSum += Math.cos(rad);
      satSum += c.sat;
      lightSum += c.light;
    });
    
    const avgHue = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360;
    const avgSat = satSum / colors.length;
    const avgLight = lightSum / colors.length;
    
    const gradientStops = colors.map((c, i) => {
      const angle = (i / colors.length) * 360;
      const x = 50 + Math.cos(angle * Math.PI / 180) * 30;
      const y = 50 + Math.sin(angle * Math.PI / 180) * 30;
      return `radial-gradient(ellipse at ${x}% ${y}%, 
        hsla(${c.hue}, ${c.sat}%, ${c.light}%, 0.35) 0%, 
        transparent 50%)`;
    });
    
    gradientStops.push(`radial-gradient(ellipse at 50% 50%, 
      hsla(${avgHue}, ${avgSat}%, ${avgLight + 10}%, 0.4) 0%, 
      hsla(${avgHue}, ${avgSat}%, ${avgLight}%, 0.2) 40%, 
      transparent 60%)`);
    
    blendLayer.style.background = gradientStops.join(', ');
  }

  function createColorBurst(keyCode, freq) {
    const noteName = keyToNote[keyCode];
    if (!noteName) return;
    
    const noteColor = noteColors[noteName];
    const { hue, sat, light } = noteColor;
    
    activeNoteColors.set(keyCode, noteColor);
    updateBlendedBackground();
    
    const numBursts = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numBursts; i++) {
      const burst = document.createElement('div');
      const isRising = Math.random() > 0.4;
      burst.className = isRising ? 'color-burst rising' : 'color-burst';
      
      const x = Math.random() * 100;
      const y = isRising ? (70 + Math.random() * 30) : (Math.random() * 100);
      const baseSize = 180 + (1000 - freq) * 0.25;
      const size = Math.max(120, Math.min(350, baseSize + Math.random() * 80));
      
      burst.style.left = `${x}%`;
      burst.style.top = `${y}%`;
      burst.style.width = `${size}px`;
      burst.style.height = `${size}px`;
      burst.style.animationDelay = `${i * 0.1}s`;
      burst.style.background = `radial-gradient(circle, 
        hsla(${hue}, ${sat}%, ${light}%, 0.85) 0%, 
        hsla(${hue}, ${sat + 5}%, ${light - 5}%, 0.5) 35%, 
        hsla(${(hue + 20) % 360}, ${sat}%, ${light}%, 0.2) 60%, 
        transparent 70%)`;
      
      synesthesiaLayer.appendChild(burst);
      const duration = isRising ? 3500 : 3000;
      setTimeout(() => burst.remove(), duration + i * 100);
    }
    
    const numParticles = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numParticles; i++) {
      const particle = document.createElement('div');
      particle.className = 'color-particle';
      
      const x = Math.random() * 100;
      const y = 50 + Math.random() * 50;
      const size = 30 + Math.random() * 50;
      
      particle.style.left = `${x}%`;
      particle.style.top = `${y}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.animationDelay = `${Math.random() * 0.3}s`;
      particle.style.background = `hsla(${hue}, ${sat}%, ${light}%, 0.6)`;
      
      synesthesiaLayer.appendChild(particle);
      setTimeout(() => particle.remove(), 2800);
    }
  }

  function removeNoteColor(keyCode) {
    activeNoteColors.delete(keyCode);
    updateBlendedBackground();
  }

  // ===== PLAY / STOP =====
  function playNote(keyCode, freqOverride = null) {
    ensureAudio();
    if (!keyboardFrequencyMap[keyCode]) return;
    const freq = freqOverride ?? keyboardFrequencyMap[keyCode];

    const voice = createVoice(freq);
    activeVoices[keyCode] = voice;
    updatePerVoiceGains();

    const el = keyEls.get(keyCode);
    if (el) el.classList.add("active");
    
    createColorBurst(keyCode, freq);
  }

  function stopNote(keyCode) {
    const voice = activeVoices[keyCode];
    if (!voice) return;
    releaseVoice(voice);
    delete activeVoices[keyCode];
    updatePerVoiceGains();

    const el = keyEls.get(keyCode);
    if (el) el.classList.remove("active");
    
    removeNoteColor(keyCode);
  }

  // ===== KEYBOARD HANDLERS =====
  function keyDown(event) {
    const key = (event.detail || event.which).toString();
    if (!keyboardFrequencyMap[key]) return;
    if (activeVoices[key]) return;
    playNote(key);
  }

  function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (!keyboardFrequencyMap[key]) return;
    stopNote(key);
  }

  window.addEventListener("keydown", keyDown, false);
  window.addEventListener("keyup", keyUp, false);

  // ===== UI HANDLERS =====
  enableBtn.addEventListener("click", async () => {
    ensureAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    enableBtn.textContent = "Audio Enabled ✓";
    enableBtn.disabled = true;
  });

  // Volume knob
  const volumeKnob = document.getElementById('volumeKnob');
  function updateKnobRotation(knob, value, min = 0, max = 1) {
    const percent = (value - min) / (max - min);
    const rotation = -120 + (percent * 240);
    knob.style.transform = `rotate(${rotation}deg)`;
  }

  updateKnobRotation(volumeKnob, parseFloat(masterVolEl.value));

  masterVolEl.addEventListener("input", () => {
    updateKnobRotation(volumeKnob, parseFloat(masterVolEl.value));
    if (!globalGain) return;
    globalGain.gain.setTargetAtTime(parseFloat(masterVolEl.value), audioCtx.currentTime, 0.01);
  });

  // Synth param knobs
  const knobConfigs = [
    { input: partialsEl, knob: document.getElementById('partialsKnob'), min: 1, max: 16 },
    { input: rolloffEl, knob: document.getElementById('rolloffKnob'), min: 0.5, max: 3 },
    { input: amFreqEl, knob: document.getElementById('amFreqKnob'), min: 0.5, max: 100 },
    { input: amDepthEl, knob: document.getElementById('amDepthKnob'), min: 0, max: 1 },
    { input: fmRatioEl, knob: document.getElementById('fmRatioKnob'), min: 0.5, max: 8 },
    { input: fmIndexEl, knob: document.getElementById('fmIndexKnob'), min: 0, max: 20 },
    { input: lfoRateEl, knob: document.getElementById('lfoRateKnob'), min: 0.1, max: 20 },
    { input: lfoDepthEl, knob: document.getElementById('lfoDepthKnob'), min: 0, max: 1 }
  ];

  knobConfigs.forEach(({ input, knob, min, max }) => {
    if (!input || !knob) return;
    updateKnobRotation(knob, parseFloat(input.value), min, max);
    input.addEventListener('input', () => {
      updateKnobRotation(knob, parseFloat(input.value), min, max);
      updateParamDisplay();
    });
  });

  // Fader thumb positioning
  function updateFaderThumb(input, thumbId) {
    const thumb = document.getElementById(thumbId);
    if (!thumb) return;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const percent = (val - min) / (max - min);
    thumb.style.bottom = `${percent * 75}%`;
  }

  updateFaderThumb(attackEl, 'attackThumb');
  updateFaderThumb(decayEl, 'decayThumb');
  updateFaderThumb(sustainEl, 'sustainThumb');
  updateFaderThumb(releaseEl, 'releaseThumb');

  attackEl.addEventListener("input", () => updateFaderThumb(attackEl, 'attackThumb'));
  decayEl.addEventListener("input", () => updateFaderThumb(decayEl, 'decayThumb'));
  sustainEl.addEventListener("input", () => updateFaderThumb(sustainEl, 'sustainThumb'));
  releaseEl.addEventListener("input", () => updateFaderThumb(releaseEl, 'releaseThumb'));

  // Initialize
  updateParamDisplay();
});
