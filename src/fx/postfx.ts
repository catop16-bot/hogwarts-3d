import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  Effect,
  EffectAttribute,
  BlendFunction,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  SMAAPreset,
  GodRaysEffect,
  OutlineEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { SkyU, GLSL_SKY_APPROX } from '../environment/sky';
import { FogU, Environment } from '../environment/environment';
import { U } from '../core/globals';
import type { QualityLevel } from '../core/quality';

/** 高度霧＋距離霧＋曝光：由深度重建世界座標後計算 */
class FogEffect extends Effect {
  constructor() {
    super(
      'FogEffect',
      /* glsl */ `
      uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
      uniform vec3 uZenith, uHorizon, uSunPos, uSunGlow;
      uniform float uFogDensity, uFogHeightDensity, uFogHeightFalloff, uExposure;
      ${GLSL_SKY_APPROX}
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
        vec3 col = inputColor.rgb;
        if (depth < 0.999995) {
          vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 vp = uProjInv * ndc; vp /= vp.w;
          vec3 wp = (uViewInv * vp).xyz;
          vec3 ray = wp - uCamPos;
          float dist = length(ray);
          vec3 rd = ray / dist;
          float od = dist * uFogDensity;
          float b = uFogHeightFalloff;
          float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
          float hf = uFogHeightDensity * (exp(-max(uCamPos.y, 0.0) * b) - exp(-max(wp.y, 0.0) * b)) / (ry * b);
          od += max(hf, 0.0);
          float f = 1.0 - exp(-od);
          vec3 fd = normalize(vec3(rd.x, max(rd.y, 0.0) * 0.5 + 0.02, rd.z));
          vec3 fc = skyApprox(fd, uZenith, uHorizon, uSunPos, uSunGlow);
          col = mix(col, fc, f);
        }
        outputColor = vec4(col * uExposure, inputColor.a);
      }`,
      {
        attributes: EffectAttribute.DEPTH,
        uniforms: new Map<string, any>([
          ['uProjInv', { value: new THREE.Matrix4() }],
          ['uViewInv', { value: new THREE.Matrix4() }],
          ['uCamPos', { value: new THREE.Vector3() }],
          ['uZenith', SkyU.uZenith],
          ['uHorizon', SkyU.uHorizon],
          ['uSunPos', SkyU.uSunPos],
          ['uSunGlow', SkyU.uSunGlow],
          ['uFogDensity', FogU.uFogDensity],
          ['uFogHeightDensity', FogU.uFogHeightDensity],
          ['uFogHeightFalloff', FogU.uFogHeightFalloff],
          ['uExposure', FogU.uExposure],
        ]),
      },
    );
  }
}

/** 電影調色：略去飽和、冷調陰影、暖調亮部、暗角與底片顆粒 */
export const GradeU = {
  uSat: { value: 0.9 },
  uContrast: { value: 0.18 },
  uVignette: { value: 0.85 },
  uGrain: { value: 0.035 },
  uShadowTint: { value: new THREE.Vector3(-0.012, 0.004, 0.022) },
  uHighTint: { value: new THREE.Vector3(0.02, 0.008, -0.02) },
  uLetterbox: { value: 0 },
};
class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float uSat, uContrast, uVignette, uGrain, uTime, uLetterbox;
      uniform vec3 uShadowTint, uHighTint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = pow(clamp(inputColor.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        c += uShadowTint * (1.0 - smoothstep(0.0, 0.5, l)) * 2.0;
        c += uHighTint * smoothstep(0.4, 1.0, l) * 2.0;
        c = clamp(c, 0.0, 1.0);
        c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
        vec2 q = uv - 0.5;
        c *= 1.0 - dot(q, q) * uVignette;
        float n = fract(sin(dot(uv * vec2(1913.0, 1087.0) + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
        c += (n - 0.5) * uGrain * (1.2 - l);
        float bar = step(abs(uv.y - 0.5), 0.5 - uLetterbox);
        c *= bar;
        outputColor = vec4(pow(max(c, 0.0), vec3(2.2)), inputColor.a);
      }`,
      {
        uniforms: new Map<string, any>([
          ['uSat', GradeU.uSat],
          ['uContrast', GradeU.uContrast],
          ['uVignette', GradeU.uVignette],
          ['uGrain', GradeU.uGrain],
          ['uShadowTint', GradeU.uShadowTint],
          ['uHighTint', GradeU.uHighTint],
          ['uLetterbox', GradeU.uLetterbox],
          ['uTime', U.uTime],
        ]),
      },
    );
  }
}

export class PostFX {
  composer: EffectComposer;
  outline!: OutlineEffect;
  private fog!: FogEffect;
  private godRays?: GodRaysEffect;
  private sunMesh: THREE.Mesh;
  private ao?: any;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private env: Environment,
  ) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffddaa, transparent: true, fog: false, depthWrite: false }),
    );
    this.sunMesh.frustumCulled = false;
    this.sunMesh.matrixAutoUpdate = false;
  }

  build(q: QualityLevel) {
    const { composer, scene, camera } = this;
    const selection = this.outline ? Array.from(this.outline.selection) : [];
    composer.removeAllPasses();
    composer.addPass(new RenderPass(scene, camera));
    this.ao = undefined;
    if (q.ao) {
      const ao = new N8AOPostPass(scene, camera, 1, 1);
      ao.configuration.aoRadius = 7;
      ao.configuration.distanceFalloff = 1.2;
      ao.configuration.intensity = 2.6;
      ao.configuration.halfRes = q.aoHalf;
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.aoSamples = q.aoHalf ? 12 : 16;
      ao.configuration.denoiseSamples = 4;
      ao.configuration.denoiseRadius = 12;
      ao.configuration.color = new THREE.Color(0.0, 0.0, 0.01);
      // n8ao 的半解析度多重渲染目標在新版 three 需要修正 texture 存取子
      const ds = (ao as any).depthDownsampleTarget;
      if (ds && Array.isArray(ds.texture)) Object.defineProperty(Object.getPrototypeOf(ds), 'texture', { get() { return this.textures[0]; }, set() {} });
      composer.addPass(ao as any);
      this.ao = ao;
    }
    this.fog = new FogEffect();
    composer.addPass(new EffectPass(camera, this.fog));

    const effects: Effect[] = [];
    this.godRays = undefined;
    if (q.godRays) {
      this.godRays = new GodRaysEffect(camera, this.sunMesh, {
        blendFunction: BlendFunction.SCREEN,
        samples: 48,
        density: 0.96,
        decay: 0.93,
        weight: 0.32,
        exposure: 0.5,
        clampMax: 1,
        resolutionScale: 0.5,
        blur: true,
      });
      effects.push(this.godRays);
    }
    effects.push(
      new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.25, intensity: 0.9, radius: 0.78, levels: 7 }),
    );
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    effects.push(new GradeEffect());
    this.outline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 2.6,
      pulseSpeed: 0,
      visibleEdgeColor: 0xffd890,
      hiddenEdgeColor: 0x6b5220,
      resolutionScale: 0.5,
      blur: true,
      xRay: true,
    });
    this.outline.selection.set(selection);
    effects.push(this.outline);
    if (q.smaa) effects.push(new SMAAEffect({ preset: SMAAPreset.MEDIUM }));
    composer.addPass(new EffectPass(camera, ...effects));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    const cam = this.camera;
    const u = this.fog.uniforms;
    u.get('uProjInv')!.value.copy(cam.projectionMatrixInverse);
    u.get('uViewInv')!.value.copy(cam.matrixWorld);
    u.get('uCamPos')!.value.copy(cam.position);
    if (this.godRays) {
      const env = this.env;
      const d = 20000;
      this.sunMesh.position.copy(cam.position).addScaledVector(env.sunPos, d);
      this.sunMesh.scale.setScalar(d * 0.03);
      this.sunMesh.updateMatrix();
      const facing = Math.max(0, cam.getWorldDirection(new THREE.Vector3()).dot(env.sunPos));
      const amount = env.sunVisible * Math.min(1, facing * 1.6) * (1 - THREE.MathUtils.smoothstep(env.time.sunElevation, 25, 55));
      (this.sunMesh.material as THREE.MeshBasicMaterial).color.copy(SkyU.uSunGlow.value).multiplyScalar(1.6);
      this.godRays.blendMode.opacity.value = amount;
    }
    this.composer.render(dt);
  }
}
