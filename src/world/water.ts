import * as THREE from 'three';
import { U } from '../core/globals';
import { SkyU, GLSL_SKY_APPROX } from '../environment/sky';
import { MASK_EXTENT, buildDepthTexture } from './terrain';

/**
 * 黑湖：平面反射（鏡像相機重繪一次場景）＋雜訊波紋＋菲涅耳，
 * 冬天結冰，雨天與強風時波浪變大。
 */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private rt: THREE.WebGLRenderTarget;
  private virtualCamera = new THREE.PerspectiveCamera();
  private textureMatrix = new THREE.Matrix4();
  reflectionEnabled = true;
  private resScale = 0.5;

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, depthBuffer: true });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uNoise: U.uNoise,
        uIce: U.uIce,
        uSnow: U.uSnow,
        uWind: U.uWind,
        uZenith: SkyU.uZenith,
        uHorizon: SkyU.uHorizon,
        uSunPos: SkyU.uSunPos,
        uSunGlow: SkyU.uSunGlow,
        uLightDir: U.uSunDir,
        uLightColor: { value: new THREE.Color() },
        uRefl: { value: this.rt.texture },
        uTexMatrix: { value: this.textureMatrix },
        uUseRefl: { value: 1 },
        uDepth: { value: buildDepthTexture() },
        uRain: { value: 0 },
        uDay: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vW;
        uniform float uTime, uIce, uSnow, uWind, uUseRefl, uRain, uDay;
        uniform sampler2D uNoise, uRefl, uDepth;
        uniform vec3 uZenith, uHorizon, uSunPos, uSunGlow, uLightDir, uLightColor;
        uniform mat4 uTexMatrix;
        ${GLSL_SKY_APPROX}
        void main(){
          vec3 toCam = cameraPosition - vW;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          vec2 uv = vW.xz;
          vec2 duv = uv / ${(MASK_EXTENT * 2).toFixed(1)} + 0.5;
          float h = texture2D(uDepth, duv).r;
          float inMap = step(abs(duv.x - 0.5), 0.5) * step(abs(duv.y - 0.5), 0.5);
          float depth = mix(30.0, max(-h, 0.0), inMap);

          // 波紋法線：三層雜訊疊加，遠處淡出避免閃爍
          float amp = (0.05 + uWind * 0.11 + uRain * 0.04) * (1.0 - uIce);
          float t = uTime;
          vec2 g = (texture2D(uNoise, uv / 31.0 + t * vec2(0.011, 0.007)).rg - 0.5) * 1.0;
          g += (texture2D(uNoise, uv / 8.3 - t * vec2(0.021, 0.016)).gb - 0.5) * 0.8;
          g += (texture2D(uNoise, uv / 113.0 + t * vec2(0.004, -0.003)).ba - 0.5) * 0.5;
          g += (texture2D(uNoise, uv / 2.1 + t * vec2(0.05, 0.04)).rb - 0.5) * 0.35 * uRain;
          float fade = 1.0 / (1.0 + dist * 0.0012);
          vec3 n = normalize(vec3(g.x * amp * fade, 1.0, g.y * amp * fade));

          float ndv = max(dot(n, V), 0.0);
          float fres = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, n);
          R.y = abs(R.y);
          vec3 sky = skyApprox(R, uZenith, uHorizon, uSunPos, uSunGlow);
          vec3 refl = sky;
          if (uUseRefl > 0.5) {
            vec4 rc = uTexMatrix * vec4(vW, 1.0);
            vec2 ruv = rc.xy / rc.w + n.xz * 0.3;
            refl = texture2D(uRefl, clamp(ruv, 0.001, 0.999)).rgb;
          }
          // 湖水本色：泥炭色的深湖，岸邊較淺
          vec3 ambient = (uZenith * 0.6 + uHorizon * 0.4);
          vec3 deep = vec3(0.012, 0.03, 0.034) * (ambient * 2.2 + uLightColor * 0.25);
          vec3 shallow = vec3(0.10, 0.12, 0.085) * (ambient * 2.2 + uLightColor * 0.3);
          vec3 body = mix(shallow, deep, smoothstep(0.0, 7.0, depth));
          vec3 col = mix(body, refl, fres);

          // 陽光／月光在水面的碎光
          float spec = pow(max(dot(R, uLightDir), 0.0), 220.0);
          col += uLightColor * spec * 1.6 * (1.0 - uIce);

          // 岸邊的白沫
          float foamN = texture2D(uNoise, uv / 5.0 + t * 0.02).r;
          float foam = (1.0 - smoothstep(0.0, 0.9, depth)) * smoothstep(0.45, 0.75, foamN + 0.25 * sin(t * 0.8 + uv.x * 0.3)) * (0.3 + uWind * 0.6);
          col = mix(col, ambient * 2.0 + uLightColor * 0.2, foam * 0.5 * (1.0 - uIce));

          // 結冰
          if (uIce > 0.001) {
            float crack = texture2D(uNoise, uv / 19.0).r;
            float crack2 = texture2D(uNoise, uv / 4.0).g;
            float lines = (1.0 - smoothstep(0.0, 0.03, abs(crack - 0.5))) * 0.5 + (1.0 - smoothstep(0.0, 0.02, abs(crack2 - 0.5))) * 0.2;
            float snowPatch = smoothstep(0.35, 0.65, texture2D(uNoise, uv / 67.0).b + uSnow * 0.35);
            vec3 light = ambient * 2.4 + uLightColor * max(uLightDir.y, 0.0) * 0.32;
            vec3 ice = mix(vec3(0.16, 0.24, 0.3), vec3(0.62, 0.68, 0.74), snowPatch) * light;
            ice += lines * light * 0.25;
            vec3 iceCol = mix(ice, refl, fres * 0.45);
            iceCol += uLightColor * pow(max(dot(reflect(-V, vec3(0.0, 1.0, 0.0)), uLightDir), 0.0), 60.0) * 0.25;
            float edge = smoothstep(0.0, 0.25, uIce - (1.0 - smoothstep(0.0, 14.0, depth)) * 0.0 - texture2D(uNoise, uv / 140.0).a * 0.35 * (1.0 - uIce));
            col = mix(col, iceCol, edge);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const geo = new THREE.PlaneGeometry(27000, 27000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = 0;
    this.mesh.name = 'water';
    this.mesh.userData.noReflect = true;
    this.mesh.frustumCulled = false;
  }

  setQuality(enabled: boolean, scale: number) {
    this.reflectionEnabled = enabled;
    this.resScale = scale;
    this.material.uniforms.uUseRefl.value = enabled ? 1 : 0;
  }

  /** 以鏡像相機繪製倒影（做法與 three 的 Reflector 相同） */
  renderReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, hidden: THREE.Object3D[]) {
    if (!this.reflectionEnabled || camera.position.y < 0.5) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(64, Math.floor(size.x * this.resScale));
    const h = Math.max(64, Math.floor(size.y * this.resScale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);

    const vc = this.virtualCamera;
    const normal = new THREE.Vector3(0, 1, 0);
    const planePos = new THREE.Vector3(0, 0, 0);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new THREE.Vector3().subVectors(planePos, camPos);
    view.reflect(normal).negate().add(planePos);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = new THREE.Vector3().subVectors(planePos, lookAt);
    target.reflect(normal).negate().add(planePos);
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    vc.lookAt(target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    vc.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    // 斜裁剪平面：把水面以下的東西裁掉
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0.15, 0));
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1,
      (1 + pm.elements[10]) / pm.elements[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1 - 0.003;
    pm.elements[14] = clip.w;

    const vis = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    const prevRT = renderer.getRenderTarget();
    const prevAuto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = prevAuto;
    hidden.forEach((o, i) => (o.visible = vis[i]));
  }
}
