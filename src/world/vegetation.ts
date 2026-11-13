import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, makeRng, patchMaterial } from '../core/globals';
import { heightAt, normalAt, forestDensity, onPath, STAMPS } from './heightfield';

/** 給樹木幾何加上頂點顏色與 aFol（0 樹幹、1 樹葉）、aFlex（柔軟度） */
function tag(g: THREE.BufferGeometry, color: THREE.Color | ((y: number) => THREE.Color), fol: number, flex?: (p: THREE.Vector3) => number) {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const c = new Float32Array(n * 3);
  const f = new Float32Array(n);
  const fx = new Float32Array(n);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(ng.attributes.position as THREE.BufferAttribute, i);
    const cc = typeof color === 'function' ? color(p.y) : color;
    c[i * 3] = cc.r;
    c[i * 3 + 1] = cc.g;
    c[i * 3 + 2] = cc.b;
    f[i] = fol;
    fx[i] = flex ? flex(p) : Math.max(0, p.y);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
  ng.setAttribute('aFol', new THREE.BufferAttribute(f, 1));
  ng.setAttribute('aFlex', new THREE.BufferAttribute(fx, 1));
  ng.deleteAttribute('uv');
  return ng;
}

function pineGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.012, 0.032, 0.5, 5, 1, true);
  trunk.translate(0, 0.25, 0);
  parts.push(tag(trunk, new THREE.Color(0.09, 0.06, 0.04), 0));
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 0.25 - 0.17 * t;
    const h = 0.34 - 0.08 * t;
    const y = 0.18 + 0.6 * t * (1 - 0.12 * t);
    const cone = new THREE.ConeGeometry(r, h, 7, 1, true);
    cone.rotateY(i * 0.7);
    cone.translate(0, y + h / 2, 0);
    const base = y;
    parts.push(tag(cone, (yy) => new THREE.Color().setScalar(0.62 + 0.38 * Math.min(1, (yy - base) / h)), 1));
  }
  return mergeGeometries(parts)!;
}

function broadleafGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.03, 0.055, 0.5, 6, 1, true);
  trunk.translate(0, 0.25, 0);
  parts.push(tag(trunk, new THREE.Color(0.08, 0.06, 0.045), 0));
  const blobs: [number, number, number, number, number][] = [
    [0, 0.7, 0, 0.31, 0],
    [0.2, 0.56, 0.08, 0.2, 0],
    [-0.19, 0.6, -0.1, 0.22, 0],
    [0.03, 0.86, 0.05, 0.2, 0],
  ];
  for (const [x, y, z, r, detail] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.scale(1.15, 0.85, 1.15);
    g.translate(x, y, z);
    const ng = g.index ? g.toNonIndexed() : g;
    // 以樹冠中心為基準的球狀法線，讓整棵樹的明暗柔和連續
    const pos = ng.attributes.position as THREE.BufferAttribute;
    const nor = ng.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).sub(new THREE.Vector3(0, 0.55, 0)).normalize();
      nor.setXYZ(i, v.x, v.y, v.z);
    }
    parts.push(tag(ng, (yy) => new THREE.Color().setScalar(0.55 + 0.45 * THREE.MathUtils.smoothstep(yy, 0.42, 0.92)), 1));
  }
  return mergeGeometries(parts)!;
}

const TREE_SHADER = {
  vertexPars: /* glsl */ `
    attribute float aFol; attribute float aFlex;
    varying float vFol; varying float vSeed; varying float vLocalY;`,
  vertexMain: (willow: boolean) => /* glsl */ `
    {
      #ifdef USE_INSTANCING
        vec3 org = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 org = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
      #endif
      vSeed = hash21(org.xz * 0.37);
      vFol = aFol;
      vLocalY = position.y;
      ${
        willow
          ? `float fl = aFlex;
             float thrash = 0.25 + uWind * 1.1;
             float ph = uTime * (1.3 + thrash * 1.6) + position.x * 0.5 + position.z * 0.37;
             transformed.x += (sin(ph) + 0.5 * sin(ph * 2.3 + 1.7)) * fl * fl * thrash * 0.55;
             transformed.z += (cos(ph * 0.8 + 2.0) + 0.5 * sin(ph * 1.9)) * fl * fl * thrash * 0.5;
             transformed.y += sin(ph * 1.4 + 0.6) * fl * fl * thrash * 0.3;`
          : `float fl = aFlex * aFlex;
             float ph = uTime * (0.9 + uWind * 1.4) + vSeed * 40.0;
             transformed.x += sin(ph) * fl * (0.012 + uWind * 0.05);
             transformed.z += cos(ph * 0.83 + 1.3) * fl * (0.012 + uWind * 0.05);`
      }
    }`,
  fragPars: /* glsl */ `
    uniform vec4 uFoliage;
    varying float vFol; varying float vSeed; varying float vLocalY;`,
};

function treeMaterial(kind: 'pine' | 'broad' | 'willow') {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: kind === 'pine' ? THREE.DoubleSide : THREE.FrontSide });
  const broadColor = /* glsl */ `
    vec3 spring = vec3(0.13, 0.25, 0.045);
    vec3 summer = vec3(0.045, 0.115, 0.025);
    vec3 a1 = mix(vec3(0.42, 0.17, 0.02), vec3(0.5, 0.36, 0.04), fract(vSeed * 7.31));
    vec3 autumn = mix(a1, vec3(0.3, 0.05, 0.02), step(0.72, fract(vSeed * 3.17)));
    autumn = mix(autumn, summer * 1.4, step(0.86, fract(vSeed * 11.3)));
    vec3 winter = vec3(0.075, 0.06, 0.045);
    vec3 fc = spring * uFoliage.x + summer * uFoliage.y + autumn * uFoliage.z + winter * uFoliage.w;
    // 冬天落葉：以雜訊挖空樹冠，只留下稀疏的枝條
    float bare = uFoliage.w * 0.9 + uFoliage.z * 0.12 * step(0.5, fract(vSeed * 5.1));
    if (hash21(floor(vWPos.xz * 3.0) + floor(vWPos.y * 3.0)) < bare) discard;`;
  return patchMaterial(mat, {
    key: `tree-${kind}`,
    uniforms: { uFoliage: U.uFoliage },
    vertexPars: TREE_SHADER.vertexPars,
    vertexMain: TREE_SHADER.vertexMain(kind === 'willow'),
    fragPars: TREE_SHADER.fragPars,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        if (vFol > 0.5) {
          ${
            kind === 'pine'
              ? `vec3 fc = mix(vec3(0.022, 0.055, 0.03), vec3(0.04, 0.085, 0.035), fract(vSeed * 9.7));
                 fc = mix(fc, fc * vec3(1.25, 1.2, 0.8), uFoliage.x * 0.4);`
              : broadColor
          }
          fc *= 0.75 + 0.5 * fract(vSeed * 17.3);
          float n = noiseTex(vWPos.xz / 3.1 + vWPos.y / 2.3).r;
          fc *= 0.75 + 0.5 * n;
          diffuseColor.rgb *= fc;
          float sn = uSnow * smoothstep(${kind === 'pine' ? '-0.25, 0.35' : '0.1, 0.6'}, N.y + (n - 0.5) * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.84, 0.92), sn * ${kind === 'pine' ? '0.85' : '0.9'});
        } else {
          diffuseColor.rgb *= 0.8 + 0.4 * noiseTex(vWPos.xy * 0.4).g;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.76, 0.84), uSnow * 0.35 * smoothstep(0.0, 0.6, N.x + 0.4));
        }
      }`,
  });
}

interface Bucket {
  m: THREE.Matrix4[];
  c: THREE.Color[];
}

export function buildForest(density: number, campus: [number, number, number, boolean][] = []) {
  const group = new THREE.Group();
  group.name = 'forest';
  const rng = makeRng(4242);
  const geos = { pine: pineGeometry(), broad: broadleafGeometry() };
  const mats = { pine: treeMaterial('pine'), broad: treeMaterial('broad') };
  const CELL = 420;
  const buckets = new Map<string, Bucket>();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let count = 0;

  const place = (x: number, z: number, type: 'pine' | 'broad', h: number, wide: number, tint: THREE.Color) => {
    const y = heightAt(x, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    s.set(h * wide, h, h * wide);
    m.compose(p.set(x, y - 0.4, z), q, s);
    const key = `${type}:${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { m: [], c: [] }));
    b.m.push(m.clone());
    b.c.push(tint);
    count++;
  };

  const STEP = 10.5;
  const R = 3000;
  for (let gz = -R; gz < R; gz += STEP) {
    for (let gx = -R; gx < R; gx += STEP) {
      const x = gx + rng() * STEP;
      const z = gz + rng() * STEP;
      const r1 = rng();
      const r2 = rng();
      const r3 = rng();
      const f = forestDensity(x, z);
      const dens = Math.max(f.forbidden, f.wood * 0.5);
      if (r1 > dens * density) continue;
      const y = heightAt(x, z);
      if (y < 1.6 || y > 420) continue;
      if (normalAt(x, z, 2, nrm).y < 0.78) continue;
      if (onPath(x, z) < 4) continue;
      const forb = f.forbidden > f.wood * 0.5;
      if (forb) {
        // 禁忌森林：高大陰暗、針闊葉混生
        const deep = f.forbidden;
        const broad = r2 < 0.5;
        const dark = 0.55 + 0.35 * r3 - deep * 0.12;
        place(x, z, broad ? 'broad' : 'pine', broad ? 17 + r3 * 12 : 24 + r3 * 16, broad ? 1.05 + r2 * 0.5 : 0.85 + r2 * 0.4, new THREE.Color(dark, dark, dark * 1.05));
      } else {
        const broad = r2 < 0.18;
        place(x, z, broad ? 'broad' : 'pine', broad ? 9 + r3 * 7 : 12 + r3 * 11, broad ? 1.1 + r2 : 0.9 + r2 * 0.5, new THREE.Color(0.9, 0.9, 0.9));
      }
    }
  }
  // 校園裡零星的大樹
  const lawn: [number, number, number][] = [
    [150, -175, 15], [168, -190, 13], [20, -190, 16], [-20, -182, 12], [230, -160, 14], [205, -200, 15], [250, -330, 13],
    [455, 118, 12], [500, 170, 16], [512, 120, 14], [440, 172, 11], [395, -85, 10], [352, -18, 9], [120, -250, 14], [60, -260, 15],
    [-420, 120, 12], [-480, 20, 14], [-500, 110, 12], [-430, -40, 11], [300, -420, 14], [240, -520, 15], [420, -560, 12],
  ];
  for (const [x, z, h] of lawn) place(x, z, 'broad', h, 1.5, new THREE.Color(1, 1, 1));
  // 城堡台地上的樹（位置由校園佈置算好，已避開建築與步道）
  for (const [x, z, h, pine] of campus) place(x, z, pine ? 'pine' : 'broad', h, pine ? 0.9 : 1.35, new THREE.Color(1, 1, 1));
  // 湖岸與海格小屋後方的森林邊緣
  void STAMPS;

  for (const [key, b] of buckets) {
    const type = key.split(':')[0] as 'pine' | 'broad';
    const mesh = new THREE.InstancedMesh(geos[type], mats[type], b.m.length);
    for (let i = 0; i < b.m.length; i++) {
      mesh.setMatrixAt(i, b.m[i]);
      mesh.setColorAt(i, b.c[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    mesh.name = `trees:${key}`;
    group.add(mesh);
  }
  group.userData.count = count;
  return group;
}

/** 渾拚柳：粗短的樹幹加上會揮舞的長枝條 */
export function buildWillow(x: number, z: number) {
  const rng = makeRng(77);
  const y = heightAt(x, z);
  const parts: THREE.BufferGeometry[] = [];
  const bark = new THREE.Color(0.11, 0.085, 0.06);
  const trunk = new THREE.CylinderGeometry(1.25, 1.9, 5.5, 9, 4);
  const tp = trunk.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const k = 1 + 0.16 * Math.sin(a * 3 + tp.getY(i)) + 0.08 * Math.sin(a * 7);
    tp.setX(i, tp.getX(i) * k + Math.sin(tp.getY(i) * 0.5) * 0.3);
    tp.setZ(i, tp.getZ(i) * k);
  }
  trunk.translate(0, 2.75, 0);
  trunk.computeVertexNormals();
  parts.push(tag(trunk, bark, 0, () => 0));
  const knob = new THREE.IcosahedronGeometry(2.1, 1);
  knob.scale(1.1, 0.8, 1.1);
  knob.translate(0, 5.8, 0);
  parts.push(tag(knob, bark, 0, () => 0));
  const limbs = 15;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rng() * 0.4;
    const reach = 6 + rng() * 5;
    const rise = 3.5 + rng() * 4.5;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const pts = [
      new THREE.Vector3(dx * 1.2, 6.0, dz * 1.2),
      new THREE.Vector3(dx * reach * 0.35, 6.2 + rise * 0.8, dz * reach * 0.35),
      new THREE.Vector3(dx * reach * 0.75, 6.2 + rise, dz * reach * 0.75),
      new THREE.Vector3(dx * reach * 1.1, 6.0 + rise * 0.55, dz * reach * 1.1),
      new THREE.Vector3(dx * reach * 1.3, 5.0 + rise * 0.1 - rng() * 2, dz * reach * 1.3),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 12, 0.24, 5, false);
    // 讓枝條往末端變細
    const pos = tube.attributes.position as THREE.BufferAttribute;
    const uv = tube.attributes.uv as THREE.BufferAttribute;
    const flex = new Float32Array(pos.count);
    const c = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      const t = uv.getX(k);
      curve.getPointAt(Math.min(1, t), c);
      const sc = 1 - 0.8 * t;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * sc, c.y + (pos.getY(k) - c.y) * sc, c.z + (pos.getZ(k) - c.z) * sc);
      flex[k] = t;
    }
    tube.setAttribute('flexTmp', new THREE.BufferAttribute(flex, 1));
    const ng = tube.toNonIndexed();
    const fl = ng.attributes.flexTmp as THREE.BufferAttribute;
    let idx = 0;
    const tagged = tag(ng, bark, 0, () => fl.getX(idx++));
    tagged.deleteAttribute('flexTmp');
    parts.push(tagged);
    // 枝梢的葉叢
    for (let k = 0; k < 4; k++) {
      const t = 0.55 + k * 0.14;
      curve.getPointAt(Math.min(1, t), c);
      const blob = new THREE.IcosahedronGeometry(0.9 + rng() * 0.5, 0);
      blob.scale(1.3, 0.7, 1.3);
      blob.translate(c.x, c.y + 0.2, c.z);
      parts.push(tag(blob, new THREE.Color(0.8, 0.8, 0.8), 1, () => t));
    }
  }
  for (const g of parts) g.deleteAttribute('uv');
  const geo = mergeGeometries(parts)!;
  const mesh = new THREE.Mesh(geo, treeMaterial('willow'));
  mesh.position.set(x, y - 0.3, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'willow';
  mesh.frustumCulled = false;
  return mesh;
}
