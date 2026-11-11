import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

interface Collider {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  bvh: MeshBVH;
  side: THREE.Side;
}

const _ray = new THREE.Ray();
const _box = new THREE.Box3();
const _seg = new THREE.Line3();
const _triPoint = new THREE.Vector3();
const _capPoint = new THREE.Vector3();
const _v = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/** 哪些材質的網格算是實體（窗貼片、燈火、旗幟不擋人） */
const SOLID = /:(stone|roof|wood|glass|cloth|matte|istone|iwood)$/;

/**
 * 靜態碰撞世界：直接拿建築的合併網格與它們的 BVH 來用。
 * 所有網格都在世界座標下（沒有額外的變換）。
 */
export class CollisionWorld {
  readonly colliders: Collider[] = [];

  add(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as any).isInstancedMesh || !SOLID.test(m.name)) return;
      const g = m.geometry as any;
      if (!g.boundsTree) g.computeBoundsTree();
      if (!g.boundingBox) g.computeBoundingBox();
      this.colliders.push({ mesh: m, box: g.boundingBox.clone().expandByScalar(0.5), bvh: g.boundsTree, side: (m.material as THREE.Material).side });
    });
  }

  /** 從 (x, yTop, z) 往下找最近的地板，回傳地板高度；找不到回傳 null */
  floorBelow(x: number, yTop: number, z: number, maxDist: number): number | null {
    _ray.origin.set(x, yTop, z);
    _ray.direction.copy(DOWN);
    let best: number | null = null;
    for (const c of this.colliders) {
      const b = c.box;
      if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || yTop < b.min.y || yTop - maxDist > b.max.y) continue;
      const hit = c.bvh.raycastFirst(_ray, c.side, 0, maxDist);
      if (hit && (best === null || hit.point.y > best)) best = hit.point.y;
    }
    return best;
  }

  /** 射線檢測，回傳最近的命中距離 */
  rayDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number | null {
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    _v.copy(origin).addScaledVector(dir, maxDist);
    _box.makeEmpty().expandByPoint(origin).expandByPoint(_v);
    let best: number | null = null;
    for (const c of this.colliders) {
      if (!c.box.intersectsBox(_box)) continue;
      const hit = c.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, best ?? maxDist);
      if (hit && (best === null || hit.distance < best)) best = hit.distance;
    }
    return best;
  }

  /**
   * 把膠囊（線段 a–b、半徑 r）推出所有實體之外，直接修改 a、b。
   * 回傳總位移量（寫入 out）。
   */
  resolveCapsule(a: THREE.Vector3, b: THREE.Vector3, r: number, out: THREE.Vector3) {
    out.set(0, 0, 0);
    _seg.start.copy(a);
    _seg.end.copy(b);
    for (const c of this.colliders) {
      _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end).expandByScalar(r);
      if (!c.box.intersectsBox(_box)) continue;
      c.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(_seg, _triPoint, _capPoint);
          if (d < r && d > 1e-6) {
            const depth = r - d;
            _v.copy(_capPoint).sub(_triPoint).multiplyScalar(depth / d);
            _seg.start.add(_v);
            _seg.end.add(_v);
            out.add(_v);
            _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end).expandByScalar(r);
          }
          return false;
        },
      });
    }
    a.copy(_seg.start);
    b.copy(_seg.end);
    return out;
  }
}
