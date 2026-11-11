import * as THREE from 'three';
import { smoothstep } from '../core/globals';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const LAT = (57 * Math.PI) / 180; // 蘇格蘭高地

export const SPEEDS = [0, 1, 60, 600, 3600];

export function dayOfYearFrom(month: number, day: number) {
  let d = day - 1;
  for (let m = 0; m < month - 1; m++) d += MONTH_DAYS[m];
  return d;
}
export function monthDayFrom(doy: number) {
  let d = Math.floor(((doy % 365) + 365) % 365);
  let m = 0;
  while (d >= MONTH_DAYS[m]) {
    d -= MONTH_DAYS[m];
    m++;
  }
  return { month: m + 1, day: d + 1 };
}

export interface CalendarEvent {
  id: string;
  name: string;
  month: number;
  day: number;
  hour: number;
  desc: string;
}
/** 霍格沃茲校曆上的幾個重要時刻 */
export const EVENTS: CalendarEvent[] = [
  { id: 'term', name: '開學日 · 特快車抵達', month: 9, day: 1, hour: 17.6, desc: '霍格沃茲特快車在傍晚駛過高架橋，新生乘小船橫渡黑湖。' },
  { id: 'boats', name: '開學日 · 新生渡湖', month: 9, day: 1, hour: 19.1, desc: '入夜後，一年級新生提著燈籠乘船前往船屋。' },
  { id: 'halloween', name: '萬聖節晚宴', month: 10, day: 31, hour: 18.5, desc: '大廳透出南瓜色的燭光，海格的南瓜也長到最大。' },
  { id: 'quidditch', name: '魁地奇開季賽', month: 11, day: 9, hour: 11.2, desc: '葛來分多對史萊哲林，球員在球場上空穿梭。' },
  { id: 'christmas', name: '聖誕節', month: 12, day: 25, hour: 16.4, desc: '白雪覆蓋城堡，庭院立起聖誕樹，黑湖結了冰。' },
  { id: 'spring', name: '春日清晨', month: 4, day: 20, hour: 6.6, desc: '晨霧繚繞，貓頭鷹成群飛回貓頭鷹屋。' },
  { id: 'summer', name: '夏至午後', month: 6, day: 21, hour: 15, desc: '一年之中白晝最長的日子，巨烏賊在湖面曬太陽。' },
  { id: 'aurora', name: '冬夜極光', month: 1, day: 18, hour: 23.2, desc: '晴朗的隆冬深夜，北方天空偶爾出現極光。' },
];

export class TimeSystem {
  /** 從 1 月 1 日 00:00 起算的總天數（可超過 365） */
  t = dayOfYearFrom(9, 1) + 17.4 / 24;
  speedIndex = 2;
  seasonFast = false;
  paused = false;

  readonly sunDir = new THREE.Vector3();
  readonly moonDir = new THREE.Vector3();
  sunElevation = 0; // 度
  moonElevation = 0;
  moonPhase = 0; // 0 新月、0.5 滿月
  moonIllum = 0;
  /** 春、夏、秋、冬 權重 */
  readonly season = new THREE.Vector4();
  seasonalSnow = 0;
  ice = 0;

  get speed() {
    return this.paused ? 0 : SPEEDS[this.speedIndex];
  }
  get doy() {
    return ((this.t % 365) + 365) % 365;
  }
  get hour() {
    return (this.t - Math.floor(this.t)) * 24;
  }
  get monthDay() {
    return monthDayFrom(this.doy);
  }
  get seasonName() {
    const m = this.monthDay.month;
    return m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  }

  setHour(h: number) {
    this.t = Math.floor(this.t) + h / 24;
  }
  setDay(doy: number) {
    const frac = this.t - Math.floor(this.t);
    this.t = Math.floor(doy) + frac;
  }
  jump(month: number, day: number, hour: number) {
    this.t = dayOfYearFrom(month, day) + hour / 24;
  }

  update(dtReal: number) {
    if (!this.paused) {
      if (this.seasonFast) this.t += dtReal * 6; // 每秒 6 天，時刻不變
      else this.t += (dtReal * SPEEDS[this.speedIndex]) / 86400;
    }
    this.compute();
  }

  compute() {
    const doy = this.doy;
    const hour = this.hour;
    // 太陽赤緯與時角
    const decl = (-23.44 * Math.PI) / 180 * Math.cos((2 * Math.PI * (doy + 10)) / 365);
    const H = ((hour - 12) * 15 * Math.PI) / 180;
    TimeSystem.dirFrom(decl, H, this.sunDir);
    this.sunElevation = (Math.asin(this.sunDir.y) * 180) / Math.PI;
    // 月亮：朔望週期 29.53 天
    this.moonPhase = (((this.t + 9) / 29.53) % 1 + 1) % 1;
    const pa = this.moonPhase * 2 * Math.PI;
    const mDecl = decl * Math.cos(pa) + 0.09 * Math.sin(pa * 0.5 + 1.0);
    TimeSystem.dirFrom(mDecl, H - pa, this.moonDir);
    this.moonElevation = (Math.asin(this.moonDir.y) * 180) / Math.PI;
    this.moonIllum = (1 - Math.cos(pa)) / 2;

    // 季節權重：冬 1/15、春 4/20、夏 7/15、秋 10/22
    const anchors = [15, 110, 196, 295];
    const order = [3, 0, 1, 2]; // 對應 season 向量的分量：冬、春、夏、秋
    const w = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const a = anchors[i];
      const b = i === 3 ? anchors[0] + 365 : anchors[i + 1];
      let d = doy;
      if (d < anchors[0]) d += 365;
      if (d >= a && d < b) {
        const k = smoothstep(0, 1, (d - a) / (b - a));
        w[order[i]] = 1 - k;
        w[order[(i + 1) % 4]] = k;
      }
    }
    this.season.set(w[0], w[1], w[2], w[3]);
    // 季節性積雪：11 月底開始，3 月初融化
    const dd = doy < 180 ? doy + 365 : doy;
    this.seasonalSnow = smoothstep(329, 348, dd) * (1 - smoothstep(365 + 52, 365 + 74, dd));
    this.ice = smoothstep(346, 362, dd) * (1 - smoothstep(365 + 40, 365 + 58, dd));
  }

  private static dirFrom(decl: number, H: number, out: THREE.Vector3) {
    const sinAlt = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
    const east = -Math.cos(decl) * Math.sin(H);
    const north = Math.cos(LAT) * Math.sin(decl) - Math.sin(LAT) * Math.cos(decl) * Math.cos(H);
    out.set(east, sinAlt, -north).normalize();
  }

  formatDate() {
    const { month, day } = this.monthDay;
    return `${month} 月 ${day} 日`;
  }
  formatTime() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  moonName() {
    const p = this.moonPhase;
    const names = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
    return names[Math.round(p * 8) % 8];
  }
}
