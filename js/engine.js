/* 仙剑AVG · 视觉小说引擎 */
const Engine = {
  nodes: [], nodeMap: {},
  idx: 0, currentId: null,
  affection: { linger: 0, yueru: 0, anu: 0 },
  flags: {},
  backlog: [], seenCG: new Set(),
  typing: false, typeTimer: null, fullText: "",
  auto: false, autoTimer: null, skip: false,
  charName: { xiaoyao: "李逍遥", linger: "赵灵儿", yueru: "林月如", anu: "阿奴",
    jinyuan: "刘晋元", caiyi: "彩依", jiujianxian: "酒剑仙", baiyue: "拜月教主",
    laolao: "姥姥", daniang: "李大娘", tiannan: "林天南", jiansheng: "剑圣",
    shigu: "圣姑", gailuojiao: "盖罗娇" },

  async init() {
    AudioSys.init();
    // 按顺序加载章节
    const files = ["story_ch0", "story_ch1", "story_ch2", "story_ch3",
                   "story_ch4", "story_ch5", "story_ch6", "story_ch7", "story_endings"];
    for (const f of files) {
      try {
        const r = await fetch(`js/${f}.json`);
        if (r.ok) {
          const arr = await r.json();
          for (const n of arr) {
            // 结局文件是分组结构 {id, title, nodes[]}，展平
            if (n.nodes && Array.isArray(n.nodes)) {
              if (n.nodes.length) this.nodeMap[n.id] = { _redirect: n.nodes[0].id, _title: n.title };
              for (const sub of n.nodes) { this.nodes.push(sub); this.nodeMap[sub.id] = sub; }
            } else {
              this.nodes.push(n); this.nodeMap[n.id] = n;
            }
          }
        }
      } catch (e) { console.warn("load fail:", f); }
    }
    this.bindUI();
    this.refreshContinue();
  },

  bindUI() {
    const $ = id => document.getElementById(id);
    $("btn-start").onclick = e => { e.stopPropagation(); this.newGame(); };
    $("btn-continue").onclick = e => { e.stopPropagation(); this.loadGame(0); };
    $("btn-gallery").onclick = e => { e.stopPropagation(); this.openGallery(); };
    $("game-screen").onclick = () => this.advance();
    $("btn-save").onclick = e => { e.stopPropagation(); this.openSave(true); };
    $("btn-load").onclick = e => { e.stopPropagation(); this.openSave(false); };
    $("btn-backlog").onclick = e => { e.stopPropagation(); this.openBacklog(); };
    $("btn-auto").onclick = e => { e.stopPropagation(); this.toggleAuto(e.target); };
    $("btn-skip").onclick = e => { e.stopPropagation(); this.toggleSkip(e.target); };
    $("btn-title").onclick = e => { e.stopPropagation(); this.toTitle(); };
    $("btn-ending-title").onclick = () => this.toTitle();
    document.querySelectorAll(".modal-close").forEach(b =>
      b.onclick = () => b.closest(".modal").classList.add("hidden"));
    document.addEventListener("keydown", e => {
      if (e.key === " " || e.key === "Enter") {
        if (!$("game-screen").classList.contains("hidden") &&
            $("choice-box").classList.contains("hidden")) this.advance();
      }
    });
  },

  /* ---------- 流程 ---------- */
  newGame() {
    this.affection = { linger: 0, yueru: 0, anu: 0 };
    this.flags = {}; this.backlog = []; this.seenCG = new Set();
    document.getElementById("title-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    this.jump(this.nodes[0].id);
  },

  jump(id) {
    clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
    let n = this.nodeMap[id];
    if (!n) { console.error("missing node:", id); return; }
    // 结局组重定向到首节点
    if (n._redirect) { this._endingId = id; this._endingTitle = n._title; n = this.nodeMap[n._redirect]; }
    this.currentId = n.id;
    this.idx = this.nodes.indexOf(n);
    this.render(n);
  },

  advance() {
    if (!document.getElementById("choice-box").classList.contains("hidden")) return;
    if (this.typing) { this.finishType(); return; }
    const n = this.nodeMap[this.currentId];
    if (!n) return;
    if (n.choice) return; // 等待选择
    if (n.ending) return; // 已在结局屏
    // 剧终节点：弹出结局屏，绝不串到下一个结局
    if (n.the_end) { this.showEnding(this._endingId || "end_alone"); return; }
    if (n.go) this.jump(n.go);
    else if (this.idx + 1 < this.nodes.length) this.jump(this.nodes[this.idx + 1].id);
  },

  render(n) {
    // 条件跳转
    if (n.if) {
      const c = n.if;
      let ok = false;
      if (c.afftotal !== undefined) {
        const total = (this.affection.linger||0) + (this.affection.yueru||0) + (this.affection.anu||0);
        ok = c.lt !== undefined ? total < c.lt : total >= (c.gte || 0);
      } else if (c.aff && c.top) {
        const a = this.affection;
        const v = a[c.aff] || 0;
        ok = v > 0 && v >= (a.linger||0) && v >= (a.yueru||0) && v >= (a.anu||0);
        // 并列时按 linger > yueru > anu 优先级（分支顺序已保证）
      } else if (c.aff) {
        const v = this.affection[c.aff] || 0;
        ok = c.gte !== undefined ? v >= c.gte : v === c.eq;
      } else if (c.flag) {
        const v = this.flags[c.flag] || 0;
        ok = c.gte !== undefined ? v >= c.gte : v === c.eq;
      }
      this.jump(ok ? c.go : c.else);
      return;
    }
    // 结局（旧式节点，直接弹屏）
    if (n.ending) { this.showEnding(n.ending); return; }
    // 剧终节点：先正常显示最后一行台词，玩家点继续后 advance() 再弹结局屏

    // 背景 / CG
    if (n.bg) {
      const isCG = n.bg.startsWith("cg_");
      const layer = document.getElementById(isCG ? "cg-layer" : "bg-layer");
      const other = document.getElementById(isCG ? "bg-layer" : "cg-layer");
      const file = isCG ? `cg/${n.bg}.jpg` : `bg/${n.bg}.jpg`;
      layer.style.backgroundImage = `url(${file})`;
      layer.classList.remove("hidden");
      if (isCG) { this.seenCG.add(n.bg); this.saveSeen(); }
      else document.getElementById("cg-layer").classList.add("hidden");
    }
    // BGM
    if (n.bgm) AudioSys.play(n.bgm);
    // 立绘
    if (n.show) for (const s of n.show) {
      const img = document.getElementById("sprite-" + s.pos);
      img.src = `characters/${s.c}.jpg`;
      img.classList.remove("hidden");
      img.dataset.char = s.c;
    }
    if (n.hide) for (const c of n.hide) {
      document.querySelectorAll(".sprite").forEach(img => {
        if (img.dataset.char === c) { img.classList.add("hidden"); img.dataset.char = ""; }
      });
    }
    // 说话人高亮
    const speaker = this.charKey(n.name);
    document.querySelectorAll(".sprite").forEach(img => {
      img.classList.toggle("dim", !!speaker && img.dataset.char && img.dataset.char !== speaker);
    });

    // 好感 / flag
    if (n.do) for (const k in n.do) this.affection[k] = (this.affection[k] || 0) + n.do[k];
    if (n.set) for (const k in n.set) this.flags[k] = (this.flags[k] || 0) + n.set[k];

    // 文本
    const nameBox = document.getElementById("name-box");
    if (n.name) { nameBox.textContent = n.name; nameBox.classList.remove("hidden"); }
    else nameBox.classList.add("hidden");
    this.backlog.push({ name: n.name || "", text: n.text });
    if (this.backlog.length > 200) this.backlog.shift();

    document.getElementById("choice-box").classList.add("hidden");
    if (n.choice) {
      // 先显示文本，打完字再出选项
      this.typeText(n.text, () => this.showChoices(n.choice));
    } else {
      this.typeText(n.text, null);
    }
  },

  charKey(name) {
    for (const k in this.charName) if (this.charName[k] === name) return k;
    return null;
  },

  typeText(text, done) {
    const box = document.getElementById("text-box");
    const ind = document.getElementById("next-indicator");
    ind.style.visibility = "hidden";
    this.fullText = text; this.typing = true;
    let i = 0; box.textContent = "";
    clearInterval(this.typeTimer);
    const speed = this.skip ? 1 : 38;
    this.typeTimer = setInterval(() => {
      i += 1;
      box.textContent = text.slice(0, i);
      if (i >= text.length) { this.finishType(); if (done) done(); }
    }, speed);
    this._typeDone = done;
  },

  finishType() {
    if (!this.typing) return;
    clearInterval(this.typeTimer);
    this.typing = false;
    document.getElementById("text-box").textContent = this.fullText;
    document.getElementById("next-indicator").style.visibility = "visible";
    if (this._typeDone) { const d = this._typeDone; this._typeDone = null; d(); }
    else if (this.auto || this.skip) {
      clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
      const delay = this.skip ? 200 : 1800 + this.fullText.length * 30;
      const t = setTimeout(() => this.advance(), delay);
      if (this.skip) this.skipTimer = t; else this.autoTimer = t;
    }
  },

  showChoices(choices) {
    const box = document.getElementById("choice-box");
    box.innerHTML = "";
    box.classList.remove("hidden");
    document.getElementById("next-indicator").style.visibility = "hidden";
    for (const c of choices) {
      const b = document.createElement("button");
      b.textContent = c.t;
      b.onclick = e => {
        e.stopPropagation();
        if (c.do) for (const k in c.do) this.affection[k] = (this.affection[k] || 0) + c.do[k];
        box.classList.add("hidden");
        this.jump(c.go);
      };
      box.appendChild(b);
    }
  },

  /* ---------- 结局 ---------- */
  showEnding(endId) {
    this.auto = false; this.skip = false;
    clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
    document.querySelectorAll("#top-bar button").forEach(b => b.classList.remove("on"));
    AudioSys.play("moshi");
    const data = {
      end_linger_true:  { t: "再续前缘", bg: "cg_snow", d: "历经生死，灵儿终于回到了逍遥身边。一家三口归隐仙灵岛，笑声洒满荷花池。" },
      end_linger_fate:  { t: "宿命",     bg: "cg_final", d: "灵儿化作光芒，与水魔兽同归于尽。逍遥抱着忆如，在苗疆的风中久久伫立。" },
      end_yueru_true:   { t: "月圆",     bg: "cg_snow", d: "傀儡虫之法终见奇效，月如缓缓睁开双眼。雪后初晴，一家三口团聚。" },
      end_yueru_memory: { t: "追忆",     bg: "bg_snow", d: "大雪纷飞。逍遥抱着忆如，望向树下那道红衣身影——是梦，还是她真的回来了？" },
      end_anu:          { t: "笛声",     bg: "bg_dali", d: "城头笛声悠扬。阿奴笑着挥手，目送逍遥远去，把心事藏进了风里。" },
      end_alone:        { t: "孤影",     bg: "bg_snow", d: "江湖路远，逍遥独行。唯有剑上的寒光，记得那些逝去的笑颜。" },
    }[endId] || { t: "终", bg: "bg_snow", d: "" };
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("ending-screen").classList.remove("hidden");
    document.getElementById("ending-bg").style.backgroundImage = `url(cg/${data.bg}.jpg), url(bg/${data.bg}.jpg)`;
    document.getElementById("ending-title").textContent = this._endingTitle || data.t;
    document.getElementById("ending-desc").textContent = data.d;
    const a = this.affection;
    const worms = this.flags.kui_lei_chong || 0;
    document.getElementById("ending-stats").innerHTML =
      `灵儿好感 ${a.linger} · 月如好感 ${a.yueru} · 阿奴好感 ${a.anu}<br>傀儡虫 ${worms} 只 · 已收集CG ${this.seenCG.size} 张`;
    // 解锁结局CG
    const key = "__endings";
    const got = JSON.parse(localStorage.getItem("xianjian_" + key) || "[]");
    if (!got.includes(endId)) { got.push(endId); localStorage.setItem("xianjian_" + key, JSON.stringify(got)); }
  },

  /* ---------- 存档 ---------- */
  save(slot, isSave) {
    const key = "xianjian_save_" + slot;
    if (isSave) {
      const n = this.nodeMap[this.currentId];
      const data = { id: this.currentId, affection: this.affection, flags: this.flags,
        backlog: this.backlog.slice(-50), seenCG: [...this.seenCG],
        preview: (n.name ? n.name + "：" : "") + (n.text || "").slice(0, 24),
        date: new Date().toLocaleString("zh-CN") };
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.affection = d.affection; this.flags = d.flags;
      this.backlog = d.backlog || []; this.seenCG = new Set(d.seenCG || []);
      document.getElementById("title-screen").classList.add("hidden");
      document.getElementById("ending-screen").classList.add("hidden");
      document.getElementById("game-screen").classList.remove("hidden");
      this.jump(d.id);
      return true;
    }
  },

  openSave(isSave) {
    document.getElementById("save-panel-title").textContent = isSave ? "存档" : "读档";
    const box = document.getElementById("save-slots");
    box.innerHTML = "";
    for (let i = 0; i <= 5; i++) {
      const raw = localStorage.getItem("xianjian_save_" + i);
      const d = raw ? JSON.parse(raw) : null;
      const div = document.createElement("div");
      div.className = "save-slot";
      div.innerHTML = d
        ? `存档 ${i} · ${d.preview}… <span class="slot-date">${d.date}</span>`
        : `存档 ${i} · （空）`;
      div.onclick = e => {
        e.stopPropagation();
        if (isSave) { this.save(i, true); this.openSave(true); }
        else if (this.save(i, false)) document.getElementById("save-panel").classList.add("hidden");
      };
      box.appendChild(div);
    }
    document.getElementById("save-panel").classList.remove("hidden");
  },

  refreshContinue() {
    document.getElementById("btn-continue").style.display =
      localStorage.getItem("xianjian_save_0") ? "" : "none";
  },

  loadGame(slot) { this.save(slot, false); },

  openBacklog() {
    const list = document.getElementById("backlog-list");
    list.innerHTML = this.backlog.slice(-40).map(b =>
      `<div class="backlog-item">${b.name ? `<span class="b-name">${b.name}</span><br>` : ""}<span class="b-text">${b.text}</span></div>`
    ).join("") || "<p style='color:#6a5f4a'>暂无记录</p>";
    list.scrollTop = list.scrollHeight;
    document.getElementById("backlog-panel").classList.remove("hidden");
  },

  openGallery() {
    const grid = document.getElementById("gallery-grid");
    const all = ["cg_meet","cg_wedding","cg_biwu","cg_fly","cg_tower","cg_death","cg_past","cg_rain","cg_final","cg_snow"];
    const seen = new Set(JSON.parse(localStorage.getItem("xianjian_seenCG") || "[]"));
    [...this.seenCG].forEach(c => seen.add(c));
    grid.innerHTML = "";
    for (const cg of all) {
      const div = document.createElement("div");
      const unlocked = seen.has(cg);
      div.className = "gallery-item" + (unlocked ? "" : " locked");
      if (unlocked) {
        div.style.backgroundImage = `url(cg/${cg}.jpg)`;
        div.onclick = () => window.open(`cg/${cg}.jpg`, "_blank");
      }
      grid.appendChild(div);
    }
    document.getElementById("gallery-panel").classList.remove("hidden");
  },

  saveSeen() {
    const seen = new Set(JSON.parse(localStorage.getItem("xianjian_seenCG") || "[]"));
    [...this.seenCG].forEach(c => seen.add(c));
    localStorage.setItem("xianjian_seenCG", JSON.stringify([...seen]));
  },

  toggleAuto(btn) {
    this.auto = !this.auto;
    btn.classList.toggle("on", this.auto);
    if (this.auto) { if (!this.typing) this.advance(); }
    else clearTimeout(this.autoTimer);
  },

  toggleSkip(btn) {
    this.skip = !this.skip;
    btn.classList.toggle("on", this.skip);
    if (this.skip) this.advance();
    else clearTimeout(this.skipTimer);
  },

  toTitle() {
    AudioSys.stop();
    this.auto = false; this.skip = false;
    clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
    document.querySelectorAll("#top-bar button").forEach(b => b.classList.remove("on"));
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("ending-screen").classList.add("hidden");
    document.getElementById("title-screen").classList.remove("hidden");
    this.refreshContinue();
  },
};

document.addEventListener("DOMContentLoaded", () => Engine.init());
// 首次点击激活音频（浏览器策略）
document.addEventListener("pointerdown", function once() {
  if (AudioSys.actx && AudioSys.actx.state === "suspended") AudioSys.actx.resume();
}, { once: false });
