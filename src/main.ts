import * as THREE from 'three';
import './ui/styles.css';
import { U } from './core/globals';
import { QUALITY, type QualityName } from './core/quality';
import { Environment } from './environment/environment';
import { buildTerrain } from './world/terrain';
import { Water } from './world/water';
import { buildForest, buildWillow } from './world/vegetation';
import { STAMPS } from './world/heightfield';
import { CameraRig } from './camera/controls';
import { PostFX, GradeU } from './fx/postfx';
import { buildCastle } from './castle/castle';
import { buildGrounds } from './castle/grounds';
import { ClockU } from './castle/materials';
import { LandmarkSystem } from './landmarks/picker';
import { WorldEvents } from './fx/events';
import { Hud } from './ui/hud';
import { buildInteriorExtras } from './castle/interiors';
import { buildPublicPockets } from './castle/scenes/public';
import { buildClassroomPockets } from './castle/scenes/classrooms';
import { buildHousePockets } from './castle/scenes/houses';
import { buildSecretPockets } from './castle/scenes/secrets';
import { buildCampusPockets } from './castle/scenes/campus';
import { buildTowerPockets } from './castle/scenes/towers';
import { buildWingPockets } from './castle/scenes/wings';
import { Grass } from './world/grass';
import { SceneManager } from './castle/scenes/manager';
import { SCENES, PORTALS } from './castle/scenes/registry';
import { CollisionWorld } from './player/collision';
import { Player } from './player/player';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const loadingFill = document.getElementById('loading-fill')!;
const loadingText = document.getElementById('loading-text')!;
// 等瀏覽器畫一幀；分頁在背景時 requestAnimationFrame 不會觸發，所以加上計時器保底
const nextFrame = () =>
  new Promise<void>((r) => {
    requestAnimationFrame(() => r());
    setTimeout(r, 60);
  });
async function step(pct: number, text: string) {
  loadingFill.style.width = `${pct}%`;
  loadingText.textContent = text;
  await nextFrame();
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;

  let qualityName: QualityName = (localStorage.getItem('hogwarts.quality') as QualityName) || 'medium';
  if (!QUALITY[qualityName]) qualityName = 'medium';
  let quality = QUALITY[qualityName];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 2, 32000);
  const rig = new CameraRig(camera, canvas);
  const env = new Environment(quality.shadow);
  scene.add(env.group);

  const T0 = performance.now();
  const lap = (n: string) => console.info(`[載入] ${n} ${(performance.now() - T0).toFixed(0)}ms`);
  await step(6, '塑造蘇格蘭高地的山巒…');
  scene.add(buildTerrain());

  lap('terrain');
  await step(24, '注滿黑湖…');
  const water = new Water();
  scene.add(water.mesh);

  lap('water');
  await step(34, '砌起城堡的石牆與塔樓…');
  const landmarkRoot = new THREE.Group();
  scene.add(landmarkRoot);
  const castle = buildCastle();
  castle.forEach((b) => landmarkRoot.add(b.group));
  const interiors = buildInteriorExtras();
  scene.add(interiors.group);
  buildPublicPockets();
  buildClassroomPockets();
  buildHousePockets();
  buildSecretPockets();
  buildTowerPockets();
  buildWingPockets();

  lap('castle');
  await step(56, '修築道路、村莊與魁地奇球場…');
  const grounds = buildGrounds();
  grounds.built.forEach((b) => landmarkRoot.add(b.group));
  grounds.extras.forEach((o) => scene.add(o));
  buildCampusPockets();
  const scenes = new SceneManager();
  scene.add(scenes.group);

  lap('grounds');
  await step(70, '栽下禁忌森林…');
  const forest = buildForest(quality.trees);
  scene.add(forest);
  const willow = buildWillow(STAMPS.willow.x, STAMPS.willow.z);
  scene.add(willow);

  lap('forest');
  await step(84, '喚醒貓頭鷹與特快車…');
  const events = new WorldEvents(grounds.handles);
  scene.add(events.group);

  const post = new PostFX(renderer, scene, camera, env);
  post.build(quality);
  const landmarks = new LandmarkSystem(camera, canvas, rig, post);
  [...castle, ...grounds.built].forEach((b) => landmarks.register(b.id, b.group));
  landmarks.register('willow', willow);

  // 第三人稱漫遊：碰撞直接使用建築的網格
  const world = new CollisionWorld();
  [...castle, ...grounds.built].forEach((b) => world.add(b.group));
  world.add(scenes.group);
  scenes.onBuilt = (g) => world.add(g);
  const grass = new Grass(world);
  scene.add(grass.mesh);
  const player = new Player(camera, canvas, world, rig);
  scene.add(player.character.root);

  let fps = 60;
  function applyQuality() {
    quality = QUALITY[qualityName];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.dpr));
    env.setShadowSize(quality.shadow);
    water.setQuality(quality.reflection, quality.reflectionScale);
    const sel = landmarks.selected;
    post.build(quality);
    landmarks.select(sel, false);
    resize();
  }
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  const hud = new Hud({
    env,
    rig,
    landmarks,
    player,
    scenes,
    getQuality: () => qualityName,
    setQuality: (q) => {
      qualityName = q;
      localStorage.setItem('hogwarts.quality', q);
      applyQuality();
    },
    getStats: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    getActive: () => events.active,
    renderer,
    buildings: landmarkRoot,
  });
  applyQuality();

  lap('all');
  await step(100, '歡迎來到霍格沃茲');
  document.getElementById('loading')!.classList.add('done');

  const hiddenInReflection: THREE.Object3D[] = [water.mesh, env.weather.group, events.group.children[0]];
  const timer = new THREE.Timer();
  let wasWalking = false;
  let fpsAcc = 0;
  let fpsN = 0;
  (window as any).__hog = { scene, camera, rig, env, player, world, scenes, SCENES, PORTALS, renderer, water, post, landmarks, events, hud, get fps() { return fps; }, info: renderer.info };

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    U.uTime.value += dt;
    rig.update(dt);
    const walking = rig.mode === 'walk';
    if (walking) player.update(dt);
    else if (player.active) player.deactivate();
    if (walking !== wasWalking) {
      wasWalking = walking;
      camera.near = walking ? 0.3 : 2;
      camera.fov = walking ? 52 : 42;
      camera.updateProjectionMatrix();
      if (walking) landmarks.select(null, false);
    }
    // 室內場景：燈光、口袋場景的顯示、室內判定
    interiors.update(U.uTime.value);
    scenes.update(dt, U.uTime.value, camera.position, walking ? player.pos : null, env);
    player.noFly = !!scenes.active?.pocket;
    player.indoor = !!scenes.active && !scenes.active.outdoor;
    grass.update(camera.position);
    const ph = renderer.domElement.height;
    env.update(dt, camera, rig.focus, rig.viewDist, ph);
    events.update(dt, env, camera, ph);
    water.material.uniforms.uLightColor.value.copy(env.sun.color).multiplyScalar(env.sun.intensity);
    water.material.uniforms.uRain.value = env.weather.cur.rain;
    ClockU.uHour.value = env.time.hour;
    GradeU.uLetterbox.value += ((rig.mode === 'tour' ? 0.085 : 0) - GradeU.uLetterbox.value) * Math.min(1, dt * 3);
    renderer.info.reset();
    // 倒影只需要畫出湖邊附近的樹
    const farTrees: THREE.Object3D[] = [];
    if (water.reflectionEnabled) {
      for (const c of forest.children) {
        const bs = (c as THREE.InstancedMesh).boundingSphere!;
        if (bs.center.distanceTo(camera.position) - bs.radius > 1100) farTrees.push(c);
      }
    }
    water.renderReflection(renderer, scene, camera, hiddenInReflection.concat(farTrees));
    post.render(dt);
    landmarks.updateLabels(window.innerWidth, window.innerHeight);
    hud.update();
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 0.5) {
      fps = fpsN / fpsAcc;
      fpsAcc = 0;
      fpsN = 0;
    }
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  let raf = 0;
  let lastFrame = 0;
  // 開發時：分頁在背景時 requestAnimationFrame 會停擺，用計時器補幀，方便自動化測試
  if (import.meta.env.DEV) setInterval(() => performance.now() - lastFrame > 120 && frame(), 50);
  frame();
}

boot().catch((err) => {
  console.error(err);
  loadingText.textContent = `載入失敗：${err?.message || err}`;
});
