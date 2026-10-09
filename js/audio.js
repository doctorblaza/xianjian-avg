/* 仙剑AVG · 音频系统
 * BGM 槽位映射仙剑曲名。播放 music/ 下内置的仙剑原声 mp3；
 * 若文件解码失败，则用 WebAudio 生成五声音阶古风氛围兜底，保证不静音。
 */
const BGM_SLOTS = {
  dielian:   { file: "music/蝶恋.mp3",       mood: "tender"  }, // 主题/爱情
  taohuayuan:{ file: "music/桃花岛.mp3",     mood: "peace"   }, // 日常/仙境
  moshi:     { file: "music/莫失莫忘.mp3",   mood: "sad"     }, // 悲伤
  baiyue:    { file: "music/拜月.mp3",       mood: "tense"   }, // 紧张/反派
  moshi_baiyue: { file: "music/莫失莫忘.mp3", mood: "sad"   }, // 剧本混用键→悲伤
  junmobai:  { file: "music/君莫悲.mp3",     mood: "heroic"  }, // 豪情
  huainian:  { file: "music/怀念.mp3",       mood: "nostalgic"},// 回忆
  zhandou:   { file: "music/战斗.mp3",       mood: "battle"  }, // 战斗（文字演出用）
  ningjing:  { file: "music/宁静.mp3",       mood: "peace"   }, // 宁静
};

const AudioSys = {
  el: null, current: null, genTimer: null, actx: null, master: null,

  init() {
    this.el = new Audio();
    this.el.loop = true;
    this.el.volume = 0.7;
  },

  play(key) {
    if (!key || key === this.current) return;
    this.stopGen();
    const slot = BGM_SLOTS[key];
    if (!slot) return;
    this.current = key;
    // 试播文件，失败则切生成音乐
    const test = new Audio();
    test.oncanplaythrough = () => {
      this.el.src = slot.file;
      this.fadeIn();
    };
    test.onerror = () => this.startGen(slot.mood);
    test.src = slot.file;
  },

  fadeIn() {
    this.el.volume = 0;
    this.el.play().catch(() => {});
    const t = setInterval(() => {
      if (this.el.volume < 0.7) this.el.volume = Math.min(0.7, this.el.volume + 0.07);
      else clearInterval(t);
    }, 120);
  },

  stop() {
    this.el.pause();
    this.stopGen();
    this.current = null;
  },

  /* ---- 生成式古风兜底：五声音阶拨弦 ---- */
  ensureCtx() {
    if (!this.actx) {
      this.actx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.actx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.actx.destination);
    }
    if (this.actx.state === "suspended") this.actx.resume();
  },

  // 宫商角徵羽 (C D E G A) 跨两个八度
  SCALES: {
    tender:    [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3],
    peace:     [293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3],
    sad:       [220.0, 261.6, 293.7, 329.6, 392.0, 440.0, 523.3],
    tense:     [196.0, 220.0, 261.6, 293.7, 329.6, 392.0, 440.0],
    heroic:    [329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0],
    nostalgic: [261.6, 293.7, 329.6, 392.0, 440.0, 523.3],
    battle:    [220.0, 261.6, 293.7, 392.0, 440.0, 523.3, 587.3],
  },

  pluck(freq, dur = 2.2) {
    const t = this.actx.currentTime;
    const o = this.actx.createOscillator();
    const o2 = this.actx.createOscillator();
    const g = this.actx.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    o2.type = "sine"; o2.frequency.value = freq * 2.001;
    const g2 = this.actx.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  },

  startGen(mood) {
    this.ensureCtx();
    this.stopGen();
    const scale = this.SCALES[mood] || this.SCALES.peace;
    let idx = 3;
    const step = () => {
      // 随机游走，保持古风韵味
      idx += [ -2, -1, -1, 0, 1, 1, 2 ][Math.floor(Math.random() * 7)];
      idx = Math.max(0, Math.min(scale.length - 1, idx));
      this.pluck(scale[idx], 2.5 + Math.random());
      if (Math.random() < 0.3) setTimeout(() => this.pluck(scale[Math.max(0, idx - 2)], 3), 400);
      const interval = mood === "battle" ? 700 : mood === "tense" ? 1100 : 1600;
      this.genTimer = setTimeout(step, interval + Math.random() * 800);
    };
    step();
  },

  stopGen() {
    if (this.genTimer) { clearTimeout(this.genTimer); this.genTimer = null; }
  },
};
