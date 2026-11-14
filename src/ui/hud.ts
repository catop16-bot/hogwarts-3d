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
import type { NpcManager, Npc } from '../npc/manager';
import * as THREE from 'three';
import { SCENES, PORTALS, type PortalDef } from '../castle/scenes/registry';
import { MapView } from './map';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const SPEED_LABELS = ['⏸', '1×', '1 分/秒', '10 分/秒', '1 時/秒'];
const PEOPLE_TABS: [string, string][] = [['all', '全部'], ['staff', '教職員'], ['student', '學生'], ['ghost', '幽靈'], ['other', '小精靈與動物']];
const EVENT_WEATHER: Record<string, WeatherKind> = { term: 'partly', boats: 'clear', halloween: 'partly', quidditch: 'partly', christmas: 'snow', spring: 'mist', summer: 'clear', aurora: 'clear' };
const EVENT_FOCUS: Record<string, string> = { term: 'railViaduct', boats: 'viaduct', halloween: 'greatHall', quidditch: 'quidditch', christmas: 'viaductCourtyard', spring: 'owlery', summer: 'lake', aurora: 'astronomy' };

export interface HudDeps {
  env: Environment;
  rig: CameraRig;
  landmarks: LandmarkSystem;
  player: Player;
  scenes: SceneManager;
  npcs: NpcManager;
  getQuality: () => QualityName;
  setQuality: (q: QualityName) => void;
  getStats: () => { fps: number; calls: number; tris: number };
  getActive: () => string[];
  getSaver: () => boolean;
  setSaver: (on: boolean) => void;
  renderer: THREE.WebGLRenderer;
  buildings: THREE.Object3D;
}

export class Hud {
  private root = $('#ui');
  private card!: HTMLElement;
  private tip!: HTMLElement;
  private toastEl!: HTMLElement;
  private toastTimer = 0;
  private lastActive = '';
  private scrubbing = false;
  private map!: MapView;
  private nearby: PortalDef | null = null;

  constructor(private d: HudDeps) {
    this.root.innerHTML = this.template();
    this.card = $('#card');
    this.tip = $('#tip');
    this.toastEl = $('#toast');
    this.buildList();
    this.buildLabels();
    this.map = new MapView({
      renderer: d.renderer,
      buildings: d.buildings,
      getPlayer: () => ({ x: d.player.pos.x, z: d.player.pos.z, yaw: d.player.heading, active: d.rig.mode === 'walk' }),
      travel: (to) => this.travel(to),
    });
    this.root.appendChild(this.map.el);
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
      <button class="tool" id="btn-list" title="地標清單">☰ <span class="tl">地標</span></button>
      <button class="tool" id="btn-map" title="城堡與校園地圖，點入口直接前往 (M)">🗺 <span class="tl">地圖</span></button>
      <button class="tool" id="btn-labels" title="顯示／隱藏標籤 (L)">◈ <span class="tl">標籤</span></button>
      <button class="tool" id="btn-walk" title="化身學生，在校園裡漫遊 (G)">🚶 <span class="tl">漫遊</span></button>
      <button class="tool" id="btn-fly" title="自由飛行 (F)">✈ <span class="tl">飛行</span></button>
      <button class="tool" id="btn-tour" title="電影運鏡導覽 (T)">▶ <span class="tl">導覽</span></button>
      <button class="tool" id="btn-people" title="人物：誰在哪裡，點一下前往 (P)">👥 <span class="tl">人物</span></button>
      <button class="tool" id="btn-events" title="校曆上的特別時刻">✦ <span class="tl">事件</span></button>
      <button class="tool" id="btn-settings" title="畫質設定">⚙</button>
      <button class="tool" id="btn-hide" title="隱藏介面 (H)">⤢</button>
    </nav>
    <aside class="panel left" id="list">
      <input id="search" type="search" placeholder="搜尋地標…" autocomplete="off" />
      <div id="list-items"></div>
    </aside>
    <aside class="panel right hidden" id="card"></aside>
    <div class="panel pop hidden" id="events"><h3>校曆上的特別時刻</h3>${events}</div>
    <div class="panel pop hidden" id="people">
      <h3>人物</h3>
      <div class="row" id="people-tabs">${PEOPLE_TABS.map(([k, n], i) => `<button class="chip${i ? '' : ' on'}" data-pk="${k}">${n}</button>`).join('')}</div>
      <p class="note">此刻在哪裡、在做什麼；點一下就前往那裡。</p>
      <div id="people-list"></div>
    </div>
    <div class="panel pop hidden" id="settings">
      <h3>畫質</h3><div class="row">${quality}</div>
      <p class="note">「中」適合一般筆電；「高」會以原生解析度繪製並開啟完整的環境光遮蔽。</p>
      <h3>省電</h3><div class="row"><button class="chip" id="btn-saver">省電模式</button></div>
      <p class="note">開啟時：畫面靜止兩秒後降到每秒 20 幀，視窗不在前景時 12 幀，一有操作立刻回到 60。電腦發燙或風扇很吵時請保持開啟，並把畫質調到「低」。</p>
      <div class="stats" id="stats"></div>
      <h3>操作</h3>
      <p class="note">拖曳旋轉 · 滾輪縮放 · 右鍵拖曳平移<br/>點擊建築查看介紹<br/>飛行模式：WASD 移動、Q／E 升降、Shift 加速、拖曳轉向<br/>漫遊模式（G）：WASD 移動、Shift 奔跑、空白鍵跳躍、F 騎掃帚、Q 點亮魔杖、E 進門、拖曳轉視角、滾輪拉遠近<br/>空白鍵暫停時間 · H 隱藏介面</p>
    </div>
    <div class="panel walkbar hidden fold" id="walkbar">
      <button class="fold-btn" data-fold="walkbar" title="收合／展開">漫遊選單 <i>▾</i></button>
      <h3>學院</h3>
      <div class="row">${HOUSES.map((h, i) => `<button class="chip hs" data-hs="${i}" style="--hc:#${h.primary.toString(16).padStart(6, '0')}">${h.name}</button>`).join('')}</div>
      <div class="row"><button class="chip" id="btn-broom" title="騎上／跳下飛天掃帚 (F)">🧹 掃帚</button><button class="chip" id="btn-lumos" title="點亮魔杖 (Q)">✨ 路摸思</button><button class="chip" id="btn-exit" title="回到觀覽模式 (G)">離開漫遊</button></div>
      <h3>前往</h3>
      <select id="goto"><option value="">選擇城堡裡的場景…</option>${SCENES.filter((s) => s.name).map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
      <p class="note" id="walk-help"></p>
    </div>
    <div class="timebar panel fold" id="timebar">
      <button class="fold-btn" data-fold="timebar" title="收合／展開時間列"><i>▾</i></button>
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
    <div class="talk hidden" id="talk"><div class="talk-who"><b></b><span></span></div><p></p></div>
    <div class="nearby hidden" id="nearby"><i>▲</i><span></span></div>
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

  /** 窄螢幕（手機直立、窄的面板）：時間列與漫遊選單預設收合 */
  private setupFolds() {
    const narrow = innerWidth < 760 || innerHeight > innerWidth * 1.15;
    this.root.querySelectorAll<HTMLElement>('.fold').forEach((el) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(`hogwarts.fold.${el.id}`);
      } catch {}
      el.classList.toggle('folded', saved != null ? saved === '1' : narrow);
    });
    this.root.querySelectorAll<HTMLElement>('.fold-btn').forEach((b) => {
      b.onclick = () => {
        const el = $(`#${b.dataset.fold}`);
        el.classList.toggle('folded');
        try {
          localStorage.setItem(`hogwarts.fold.${el.id}`, el.classList.contains('folded') ? '1' : '0');
        } catch {}
      };
    });
  }

  private bind() {
    this.setupFolds();
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
    $('#btn-map').onclick = () => this.map.toggle();
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
    $('#btn-events').onclick = () => toggle('#events', ['#settings', '#people']);
    $('#btn-settings').onclick = () => toggle('#settings', ['#events', '#people']);
    $('#btn-people').onclick = () => {
      toggle('#people', ['#events', '#settings']);
      this.refreshPeople();
    };
    $('#people-tabs').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pk]');
      if (!b) return;
      this.peopleKind = b.dataset.pk!;
      $('#people-tabs').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
      this.refreshPeople();
    };
    $('#people-list').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-npc]');
      const n = b && this.d.npcs.npcs.find((o) => o.def.id === b.dataset.npc);
      if (!n) return;
      const r = this.d.npcs.locate(n);
      if (!r.to) return this.toast(`${n.def.name}現在${r.where}`, 3000);
      $('#people').classList.add('hidden');
      this.travel(r.to);
      this.toast(`前往${r.where}找${n.def.name}`, 3500);
    };
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
    $('#btn-saver').onclick = () => this.d.setSaver(!this.d.getSaver());
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
      else if (e.code === 'KeyM') this.map.toggle();
      else if (e.code === 'KeyP') $('#btn-people').click();
      else if (e.code === 'Escape' && this.map.open) this.map.toggle(false);
      else if (e.code === 'KeyE' && rig.mode === 'walk') {
        if (this.npc) this.talkTo(this.npc);
        else if (this.portal) this.travel(this.portal.to);
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
        $('#people').classList.add('hidden');
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
  private peopleKind = 'all';
  private peopleT = 0;

  /** 人物清單：依類別列出具名角色此刻的去處 */
  private refreshPeople() {
    const el = $('#people');
    if (el.classList.contains('hidden')) return;
    const kinds: Record<string, string[]> = { all: ['staff', 'student', 'ghost', 'elf', 'animal'], staff: ['staff'], student: ['student'], ghost: ['ghost'], other: ['elf', 'animal'] };
    const want = kinds[this.peopleKind] ?? kinds.all;
    const rows = this.d.npcs.npcs
      .filter((n) => !n.def.crowd && want.includes(n.def.kind))
      .map((n) => {
        const r = this.d.npcs.locate(n);
        const doing = n.slot?.doing ?? '不在城堡裡';
        return `<button class="event${r.to ? '' : ' off'}" data-npc="${n.def.id}"><b>${n.def.name}</b><span>${n.def.title}<br/>${doing}${r.to && !doing.includes(r.where) ? `（${r.where}）` : ''}</span></button>`;
      });
    $('#people-list').innerHTML = rows.join('');
  }
  private npc: Npc | null = null;
  private talking: Npc | null = null;
  private talkTimer = 0;
  private traveling = false;

  /** 跟 NPC 說話：畫面下方顯示名字、定位與一句話 */
  private talkTo(n: Npc) {
    const r = this.d.npcs.talk(n, this.d.player.house);
    const el = $('#talk');
    el.querySelector('b')!.textContent = r.name;
    el.querySelector('span')!.textContent = r.title;
    el.querySelector('p')!.textContent = r.line;
    el.classList.remove('hidden');
    this.talking = n;
    clearTimeout(this.talkTimer);
    this.talkTimer = window.setTimeout(() => this.endTalk(), 6500);
  }

  private endTalk() {
    this.talking = null;
    $('#talk').classList.add('hidden');
  }

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
      this.d.scenes.prepare(to[0], to[1], to[2]);
      this.d.player.enter(to[0], to[2], to[1] + 0.5, to[3]);
      window.setTimeout(() => {
        fade.classList.remove('on');
        this.traveling = false;
      }, 180);
    }, 260);
  }

  /** 附近（35 公尺內）最近的一扇門：在畫面上用箭頭指出方向 */
  private updateNearby(on: boolean) {
    const el = $('#nearby');
    let best: PortalDef | null = null;
    if (on) {
      const p = this.d.player.pos;
      let bd = 35 * 35;
      for (const q of PORTALS) {
        if (Math.abs(q.pos[1] - p.y) > 3.5) continue;
        const d = (q.pos[0] - p.x) ** 2 + (q.pos[2] - p.z) ** 2;
        if (d < bd && d > 2.4 * 2.4) {
          bd = d;
          best = q;
        }
      }
    }
    if (best !== this.nearby) {
      this.nearby = best;
      el.classList.toggle('hidden', !best);
    }
    if (!best) return;
    const cam = this.d.player.camera;
    _nv.set(best.pos[0], best.pos[1] + 1, best.pos[2]).applyMatrix4(cam.matrixWorldInverse);
    const ang = Math.atan2(_nv.x, -_nv.z);
    const dist = Math.hypot(best.pos[0] - this.d.player.pos.x, best.pos[2] - this.d.player.pos.z);
    (el.firstElementChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    (el.lastElementChild as HTMLElement).textContent = `${best.label} · ${dist.toFixed(0)} 公尺`;
  }

  private refreshWalk() {
    const p = this.d.player;
    this.root.querySelectorAll<HTMLElement>('.hs').forEach((b) => b.classList.toggle('on', parseInt(b.dataset.hs!) === p.house));
    $('#btn-broom').classList.toggle('on', p.mode === 'broom');
    $('#btn-lumos').classList.toggle('on', p.character.lumos);
    $('#walk-help').innerHTML =
      p.mode === 'broom'
        ? 'W／S 前進後退，鏡頭朝哪就往哪飛<br/>A／D 轉向 · 空白鍵上升 · C 下降<br/>Shift 加速 · F 跳下掃帚'
        : 'WASD 移動 · Shift 奔跑 · 空白鍵跳躍<br/>拖曳轉視角 · 滾輪拉遠近<br/>F 騎上掃帚 · Q 點亮魔杖 · G 離開<br/>走到門前按 E 進入 · M 地圖';
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
    $('#btn-saver').classList.toggle('on', this.d.getSaver());
    if (!$('#settings').classList.contains('hidden')) {
      const s = this.d.getStats();
      $('#stats').textContent = `${s.fps.toFixed(0)} FPS · ${s.calls} 次繪製 · ${(s.tris / 1e6).toFixed(2)} 百萬三角形`;
    }
    // 走到門前的互動提示
    const walking = this.d.rig.mode === 'walk';
    const pp = this.d.player.pos;
    let portal = walking && !this.traveling ? this.d.scenes.nearestPortal(pp) : null;
    // 門和人都在附近時，取比較近的那個
    let npc = walking && !this.traveling ? this.d.npcs.nearest(pp) : null;
    if (npc && portal) {
      if (this.d.npcs.distanceTo(npc, pp) < Math.hypot(portal.pos[0] - pp.x, portal.pos[2] - pp.z)) portal = null;
      else npc = null;
    }
    if (portal !== this.portal || npc !== this.npc) {
      this.portal = portal;
      this.npc = npc;
      const el = $('#prompt');
      el.classList.toggle('hidden', !portal && !npc);
      if (npc) el.innerHTML = `<kbd>E</kbd> 和 <b>${npc.def.name}</b> 說話`;
      else if (portal) el.innerHTML = `<kbd>E</kbd> 前往 <b>${portal.label}</b>`;
    }
    if (this.talking && (!walking || this.d.npcs.distanceTo(this.talking, pp) > 4.5 || !this.talking.shown)) this.endTalk();
    this.map.update();
    if (performance.now() - this.peopleT > 2000) {
      this.peopleT = performance.now();
      this.refreshPeople();
    }
    this.updateNearby(walking && !portal && !npc);
    const act = this.d.getActive().filter((a) => a !== '聖誕佈置').join('、');
    if (act && act !== this.lastActive) this.toast(`✦ ${act}`, 5000);
    this.lastActive = act;
  }
}

const _nv = new THREE.Vector3();
