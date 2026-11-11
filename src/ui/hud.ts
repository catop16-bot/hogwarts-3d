import { LANDMARKS, CATEGORY_NAMES, type Landmark, type Category } from '../landmarks/data';
import type { LandmarkSystem } from '../landmarks/picker';
import type { Environment } from '../environment/environment';
import { EVENTS, SPEEDS } from '../environment/timeSystem';
import { WEATHER, type WeatherKind } from '../environment/weather';
import type { CameraRig, CameraMode } from '../camera/controls';
import { QUALITY, type QualityName } from '../core/quality';
import type { Player } from '../player/player';
import { HOUSES } from '../player/character';
import type { SceneManager } from '../castle/scenes/manager';
import { SCENES, type PortalDef } from '../castle/scenes/registry';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const SPEED_LABELS = ['⏸', '1×', '1 分/秒', '10 分/秒', '1 時/秒'];
const EVENT_WEATHER: Record<string, WeatherKind> = { term: 'partly', boats: 'clear', halloween: 'partly', quidditch: 'partly', christmas: 'snow', spring: 'mist', summer: 'clear', aurora: 'clear' };
const EVENT_FOCUS: Record<string, string> = { term: 'railViaduct', boats: 'viaduct', halloween: 'greatHall', quidditch: 'quidditch', christmas: 'viaductCourtyard', spring: 'owlery', summer: 'lake', aurora: 'astronomy' };

export interface HudDeps {
  env: Environment;
  rig: CameraRig;
  landmarks: LandmarkSystem;
  player: Player;
  scenes: SceneManager;
  getQuality: () => QualityName;
  setQuality: (q: QualityName) => void;
  getStats: () => { fps: number; calls: number; tris: number };
  getActive: () => string[];
}

export class Hud {
  private root = $('#ui');
  private card!: HTMLElement;
  private tip!: HTMLElement;
  private toastEl!: HTMLElement;
  private toastTimer = 0;
  private lastActive = '';
  private scrubbing = false;

  constructor(private d: HudDeps) {
    this.root.innerHTML = this.template();
    this.card = $('#card');
    this.tip = $('#tip');
    this.toastEl = $('#toast');
    this.buildList();
    this.buildLabels();
    this.bind();
    this.setMode(d.rig.mode);
  }

  private template() {
    const weatherBtns = (Object.keys(WEATHER) as WeatherKind[]).map((k) => `<button class="chip wx" data-wx="${k}" title="${WEATHER[k].name}">${WEATHER[k].icon}</button>`).join('');
    const speedBtns = SPEEDS.map((_, i) => `<button class="chip sp" data-sp="${i}">${SPEED_LABELS[i]}</button>`).join('');
    const events = EVENTS.map((e) => `<button class="event" data-ev="${e.id}"><b>${e.name}</b><span>${e.month} 月 ${e.day} 日 · ${e.desc}</span></button>`).join('');
    const quality = (Object.keys(QUALITY) as QualityName[]).map((k) => `<button class="chip ql" data-ql="${k}">${QUALITY[k].label}</button>`).join('');
    return `
    <header class="brand"><div class="brand-title">霍格沃茲</div><div class="brand-sub">HOGWARTS · 3D 觀覽</div></header>
    <nav class="topbar">
      <button class="tool" id="btn-list" title="地標清單">☰ 地標</button>
      <button class="tool" id="btn-labels" title="顯示／隱藏標籤 (L)">◈ 標籤</button>
      <button class="tool" id="btn-walk" title="化身學生，在校園裡漫遊 (G)">🚶 漫遊</button>
      <button class="tool" id="btn-fly" title="自由飛行 (F)">✈ 飛行</button>
      <button class="tool" id="btn-tour" title="電影運鏡導覽 (T)">▶ 導覽</button>
      <button class="tool" id="btn-events" title="校曆上的特別時刻">✦ 事件</button>
      <button class="tool" id="btn-settings" title="畫質設定">⚙</button>
      <button class="tool" id="btn-hide" title="隱藏介面 (H)">⤢</button>
    </nav>
    <aside class="panel left" id="list">
      <input id="search" type="search" placeholder="搜尋地標…" autocomplete="off" />
      <div id="list-items"></div>
    </aside>
    <aside class="panel right hidden" id="card"></aside>
    <div class="panel pop hidden" id="events"><h3>校曆上的特別時刻</h3>${events}</div>
    <div class="panel pop hidden" id="settings">
      <h3>畫質</h3><div class="row">${quality}</div>
      <p class="note">「中」適合一般筆電；「高」會以原生解析度繪製並開啟完整的環境光遮蔽。</p>
      <div class="stats" id="stats"></div>
      <h3>操作</h3>
      <p class="note">拖曳旋轉 · 滾輪縮放 · 右鍵拖曳平移<br/>點擊建築查看介紹<br/>飛行模式：WASD 移動、Q／E 升降、Shift 加速、拖曳轉向<br/>漫遊模式（G）：WASD 移動、Shift 奔跑、空白鍵跳躍、F 騎掃帚、Q 點亮魔杖、E 進門、拖曳轉視角、滾輪拉遠近<br/>空白鍵暫停時間 · H 隱藏介面</p>
    </div>
    <div class="panel walkbar hidden" id="walkbar">
      <h3>學院</h3>
      <div class="row">${HOUSES.map((h, i) => `<button class="chip hs" data-hs="${i}" style="--hc:#${h.primary.toString(16).padStart(6, '0')}">${h.name}</button>`).join('')}</div>
      <div class="row"><button class="chip" id="btn-broom" title="騎上／跳下飛天掃帚 (F)">🧹 掃帚</button><button class="chip" id="btn-lumos" title="點亮魔杖 (Q)">✨ 路摸思</button><button class="chip" id="btn-exit" title="回到觀覽模式 (G)">離開漫遊</button></div>
      <h3>前往</h3>
      <select id="goto"><option value="">選擇城堡裡的場景…</option>${SCENES.filter((s) => s.name).map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
      <p class="note" id="walk-help"></p>
    </div>
    <div class="timebar panel">
      <div class="clock">
        <div class="clock-time" id="t-time">--:--</div>
        <div class="clock-date"><span id="t-date"></span> · <span id="t-season"></span> · <span id="t-moon"></span></div>
      </div>
      <div class="sliders">
        <label><span>時刻</span><input id="s-hour" type="range" min="0" max="23.99" step="0.01" /></label>
        <label><span>日期</span><input id="s-day" type="range" min="0" max="364" step="1" class="season-track" /></label>
      </div>
      <div class="controls">
        <div class="row">${speedBtns}<button class="chip" id="btn-season" title="時刻不變，快速推進日期，觀察四季更替">四季快轉</button></div>
        <div class="row"><button class="chip" id="btn-auto" title="依季節自動變換天氣">自動</button>${weatherBtns}<span class="wx-name" id="wx-name"></span></div>
      </div>
    </div>
    <div class="prompt hidden" id="prompt"></div>
    <div id="fade"></div>
    <div id="labels"></div>
    <div class="tooltip hidden" id="tip"></div>
    <div class="toast hidden" id="toast"></div>
    <div class="modehint hidden" id="modehint"></div>`;
  }

  private buildList() {
    const wrap = $('#list-items');
    const cats: Category[] = ['castle', 'grounds', 'beyond'];
    wrap.innerHTML = cats
      .map(
        (c) => `<div class="cat">${CATEGORY_NAMES[c]}</div>` +
          LANDMARKS.filter((l) => l.category === c)
            .map((l) => `<button class="item" data-id="${l.id}"><b>${l.name}</b><span>${l.en}</span></button>`)
            .join(''),
      )
      .join('');
    wrap.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
      if (btn) this.d.landmarks.select(btn.dataset.id!);
    });
    $<HTMLInputElement>('#search').addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      wrap.querySelectorAll<HTMLElement>('.item').forEach((el) => {
        const l = LANDMARKS.find((x) => x.id === el.dataset.id)!;
        el.style.display = !q || l.name.includes(q) || l.en.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  private buildLabels() {
    const wrap = $('#labels');
    for (const l of LANDMARKS) {
      const el = document.createElement('button');
      el.className = `label cat-${l.category}`;
      el.innerHTML = `<i></i><span>${l.name}</span>`;
      el.addEventListener('click', () => this.d.landmarks.select(l.id));
      wrap.appendChild(el);
      this.d.landmarks.entries.get(l.id)!.label = el;
    }
  }

  private bind() {
    const { env, rig, landmarks } = this.d;
    const toggle = (id: string, others: string[] = []) => {
      others.forEach((o) => $(o).classList.add('hidden'));
      $(id).classList.toggle('hidden');
    };
    $('#btn-list').onclick = () => $('#list').classList.toggle('hidden');
    $('#btn-labels').onclick = () => this.toggleLabels();
    const { player } = this.d;
    const toggleWalk = () => (rig.mode === 'walk' ? player.exit() : player.enter());
    $('#btn-walk').onclick = toggleWalk;
    $('#btn-exit').onclick = () => player.exit();
    $('#btn-broom').onclick = () => this.broom();
    const goto = $<HTMLSelectElement>('#goto');
    goto.onchange = () => {
      const s = SCENES.find((x) => x.id === goto.value);
      goto.value = '';
      goto.blur();
      if (s) this.travel(s.spawn);
    };
    this.d.scenes.onEnter = (s) => this.toast(`${s.name}　${s.intro}`, 6000);
    $('#btn-lumos').onclick = () => player.toggleLumos();
    this.root.querySelectorAll<HTMLElement>('.hs').forEach((b) => (b.onclick = () => player.setHouse(parseInt(b.dataset.hs!))));
    player.onChange = () => this.refreshWalk();
    this.refreshWalk();
    $('#btn-fly').onclick = () => rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly');
    $('#btn-tour').onclick = () => rig.setMode(rig.mode === 'tour' ? 'orbit' : 'tour');
    $('#btn-events').onclick = () => toggle('#events', ['#settings']);
    $('#btn-settings').onclick = () => toggle('#settings', ['#events']);
    $('#btn-hide').onclick = () => this.toggleUi();
    rig.onModeChange = (m) => this.setMode(m);

    const hour = $<HTMLInputElement>('#s-hour');
    const day = $<HTMLInputElement>('#s-day');
    const scrub = (el: HTMLInputElement, fn: (v: number) => void) => {
      el.addEventListener('input', () => fn(parseFloat(el.value)));
      el.addEventListener('pointerdown', () => (this.scrubbing = true));
      window.addEventListener('pointerup', () => (this.scrubbing = false));
    };
    scrub(hour, (v) => env.time.setHour(v));
    scrub(day, (v) => env.time.setDay(v));

    this.root.querySelectorAll<HTMLElement>('.sp').forEach((b) => {
      b.onclick = () => {
        const i = parseInt(b.dataset.sp!);
        env.time.seasonFast = false;
        env.time.paused = i === 0;
        if (i > 0) env.time.speedIndex = i;
      };
    });
    $('#btn-season').onclick = () => {
      env.time.seasonFast = !env.time.seasonFast;
      env.time.paused = false;
      if (env.time.seasonFast) {
        env.weather.auto = true;
        if (env.time.hour < 9 || env.time.hour > 16) env.time.setHour(13);
      }
    };
    this.root.querySelectorAll<HTMLElement>('.wx').forEach((b) => (b.onclick = () => env.weather.set(b.dataset.wx as WeatherKind)));
    $('#btn-auto').onclick = () => (env.weather.auto = !env.weather.auto);
    this.root.querySelectorAll<HTMLElement>('.ql').forEach((b) => (b.onclick = () => this.d.setQuality(b.dataset.ql as QualityName)));
    this.root.querySelectorAll<HTMLElement>('.event').forEach((b) => {
      b.onclick = () => {
        const ev = EVENTS.find((e) => e.id === b.dataset.ev)!;
        env.time.jump(ev.month, ev.day, ev.hour);
        env.time.seasonFast = false;
        env.time.paused = false;
        env.time.speedIndex = 2;
        env.weather.set(EVENT_WEATHER[ev.id] || 'partly');
        if (ev.id === 'christmas') env.weather.snowAcc = 1;
        landmarks.select(EVENT_FOCUS[ev.id], true);
        $('#events').classList.add('hidden');
        this.toast(`${ev.name}　${ev.desc}`, 7000);
      };
    });

    landmarks.onSelect = (l) => this.showCard(l);
    landmarks.onHover = (l, x, y) => {
      if (!l) return this.tip.classList.add('hidden');
      this.tip.classList.remove('hidden');
      this.tip.innerHTML = `<b>${l.name}</b><span>${l.en}</span>`;
      this.tip.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
    };

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'KeyH') this.toggleUi();
      else if (e.code === 'KeyG') toggleWalk();
      else if (e.code === 'KeyF' && rig.mode === 'walk') this.broom();
      else if (e.code === 'KeyQ' && rig.mode === 'walk') player.toggleLumos();
      else if (e.code === 'KeyE' && rig.mode === 'walk') {
        if (this.portal) this.travel(this.portal.to);
      }
      else if (e.code === 'KeyF') rig.setMode(rig.mode === 'fly' ? 'orbit' : 'fly');
      else if (e.code === 'KeyT') rig.setMode(rig.mode === 'tour' ? 'orbit' : 'tour');
      else if (e.code === 'KeyL') this.toggleLabels();
      else if (e.code === 'Space' && rig.mode !== 'fly' && rig.mode !== 'walk') {
        env.time.paused = !env.time.paused;
        e.preventDefault();
      } else if (e.code === 'Escape') {
        landmarks.select(null);
        $('#events').classList.add('hidden');
        $('#settings').classList.add('hidden');
      }
    });
  }

  private toggleLabels() {
    const l = this.d.landmarks;
    l.labelsVisible = !l.labelsVisible;
    $('#btn-labels').classList.toggle('on', l.labelsVisible);
  }
  private toggleUi() {
    document.body.classList.toggle('ui-hidden');
    if (document.body.classList.contains('ui-hidden')) this.toast('介面已隱藏，按 H 可以再叫出來', 2600, true);
  }

  private setMode(m: CameraMode) {
    $('#btn-fly').classList.toggle('on', m === 'fly');
    $('#btn-tour').classList.toggle('on', m === 'tour');
    document.body.classList.toggle('tour', m === 'tour');
    document.body.classList.toggle('walk', m === 'walk');
    $('#btn-walk').classList.toggle('on', m === 'walk');
    $('#walkbar').classList.toggle('hidden', m !== 'walk');
    if (m === 'walk') this.card.classList.add('hidden');
    const hint = $('#modehint');
    hint.classList.toggle('hidden', m === 'orbit' || m === 'walk');
    hint.textContent = m === 'fly' ? '飛行模式　WASD 移動 · Q／E 升降 · Shift 加速 · 拖曳轉向 · 滾輪調速 · F 離開' : m === 'tour' ? '電影導覽中　按任意鍵或點一下畫面結束' : '';
  }

  private portal: PortalDef | null = null;
  private traveling = false;

  private broom() {
    if (!this.d.player.toggleBroom()) this.toast('室內太窄了，沒辦法騎掃帚', 2500);
  }

  /** 畫面淡出、把角色送到目的地、再淡入 */
  private travel(to: [number, number, number, number]) {
    if (this.traveling) return;
    this.traveling = true;
    const fade = $('#fade');
    fade.classList.add('on');
    window.setTimeout(() => {
      this.d.player.enter(to[0], to[2], to[1] + 0.5, to[3]);
      window.setTimeout(() => {
        fade.classList.remove('on');
        this.traveling = false;
      }, 180);
    }, 260);
  }

  private refreshWalk() {
    const p = this.d.player;
    this.root.querySelectorAll<HTMLElement>('.hs').forEach((b) => b.classList.toggle('on', parseInt(b.dataset.hs!) === p.house));
    $('#btn-broom').classList.toggle('on', p.mode === 'broom');
    $('#btn-lumos').classList.toggle('on', p.character.lumos);
    $('#walk-help').innerHTML =
      p.mode === 'broom'
        ? 'W／S 前進後退，鏡頭朝哪就往哪飛<br/>A／D 轉向 · 空白鍵上升 · C 下降<br/>Shift 加速 · F 跳下掃帚'
        : 'WASD 移動 · Shift 奔跑 · 空白鍵跳躍<br/>拖曳轉視角 · 滾輪拉遠近<br/>F 騎上掃帚 · Q 點亮魔杖 · G 離開<br/>走到門前按 E 進入';
  }

  private showCard(l: Landmark | null) {
    this.root.querySelectorAll('.item').forEach((el) => el.classList.toggle('active', (el as HTMLElement).dataset.id === l?.id));
    if (!l) return this.card.classList.add('hidden');
    this.card.classList.remove('hidden');
    this.card.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="card-cat">${CATEGORY_NAMES[l.category]}</div>
      <h2>${l.name}</h2>
      <div class="card-en">${l.en}</div>
      <p class="tagline">${l.tagline}</p>
      <p>${l.intro}</p>
      <h4>故事</h4><p>${l.story}</p>
      <h4>你知道嗎</h4><p>${l.trivia}</p>
      <button class="land" id="btn-land">🚶 在這裡降落，親自走走</button>`;
    this.card.scrollTop = 0;
    $('.close', this.card).onclick = () => this.d.landmarks.select(null);
    $('#btn-land', this.card).onclick = () => this.d.player.enterAt(l);
  }

  toast(text: string, ms = 4000, force = false) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.toggle('force', force);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  /** 每幀更新時鐘、滑桿與按鈕狀態 */
  update() {
    const { env } = this.d;
    const time = env.time;
    $('#t-time').textContent = time.formatTime();
    $('#t-date').textContent = time.formatDate();
    $('#t-season').textContent = `${time.seasonName}季`;
    $('#t-moon').textContent = time.moonName();
    if (!this.scrubbing) {
      $<HTMLInputElement>('#s-hour').value = String(time.hour);
      $<HTMLInputElement>('#s-day').value = String(Math.floor(time.doy));
    }
    this.root.querySelectorAll<HTMLElement>('.sp').forEach((b) => {
      const i = parseInt(b.dataset.sp!);
      b.classList.toggle('on', !time.seasonFast && (time.paused ? i === 0 : i === time.speedIndex));
    });
    $('#btn-season').classList.toggle('on', time.seasonFast && !time.paused);
    $('#btn-auto').classList.toggle('on', env.weather.auto);
    this.root.querySelectorAll<HTMLElement>('.wx').forEach((b) => b.classList.toggle('on', b.dataset.wx === env.weather.kind));
    $('#wx-name').textContent = WEATHER[env.weather.kind].name;
    const q = this.d.getQuality();
    this.root.querySelectorAll<HTMLElement>('.ql').forEach((b) => b.classList.toggle('on', b.dataset.ql === q));
    if (!$('#settings').classList.contains('hidden')) {
      const s = this.d.getStats();
      $('#stats').textContent = `${s.fps.toFixed(0)} FPS · ${s.calls} 次繪製 · ${(s.tris / 1e6).toFixed(2)} 百萬三角形`;
    }
    // 走到門前的互動提示
    const walking = this.d.rig.mode === 'walk';
    const portal = walking && !this.traveling ? this.d.scenes.nearestPortal(this.d.player.pos) : null;
    if (portal !== this.portal) {
      this.portal = portal;
      const el = $('#prompt');
      el.classList.toggle('hidden', !portal);
      if (portal) el.innerHTML = `<kbd>E</kbd> 前往 <b>${portal.label}</b>`;
    }
    const act = this.d.getActive().filter((a) => a !== '聖誕佈置').join('、');
    if (act && act !== this.lastActive) this.toast(`✦ ${act}`, 5000);
    this.lastActive = act;
  }
}
