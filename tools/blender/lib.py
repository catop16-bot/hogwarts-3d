"""角色生成器共用的幾何工具：環形截面網格、球、方塊、圓環、扁帶，以及累積頂點、面、材質與骨頭權重的 Geo。

座標：Blender 是 Z 朝上、角色面向 -Y；匯出成 glTF 後是 Y 朝上、面向 +Z。單位是公尺，腳底在 z=0。
"""
import math

import bmesh
from mathutils import Matrix, Vector

TAU = math.pi * 2
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))
DOWN = Vector((0, 0, -1))


def sat(x):
    return max(0.0, min(1.0, x))


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(e0, e1, x):
    x = sat((x - e0) / (e1 - e0))
    return x * x * (3 - 2 * x)


def lin(h):
    """sRGB 十六進位色碼轉線性色"""
    out = []
    for k in (16, 8, 0):
        c = ((h >> k) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def seg_dist(p, a, b):
    ab = b - a
    t = sat((p - a).dot(ab) / max(1e-9, ab.dot(ab)))
    return (a + ab * t - p).length


class Geo:
    """累積網格：每個頂點記下骨頭權重，每個面記下材質名稱"""

    def __init__(self, segs):
        # segs: 骨頭名稱 -> (頭, 尾)，用來依距離分配權重
        self.segs = segs
        self.v = []
        self.f = []
        self.fm = []
        self.w = []

    def weights(self, p, bones, power=5.0):
        ws = []
        for b in bones:
            a, c = self.segs[b]
            d = seg_dist(p, a, c)
            ws.append((b, 1.0 / (d ** power + 1e-12)))
        tot = sum(w for _, w in ws)
        ws = sorted(((b, w / tot) for b, w in ws), key=lambda x: -x[1])[:4]
        ws = [(b, w) for b, w in ws if w > 0.02]
        tot = sum(w for _, w in ws)
        return {b: w / tot for b, w in ws}

    def add(self, verts, faces, mat, bones=None, wfun=None, fmats=None):
        base = len(self.v)
        self.v += [Vector(p) for p in verts]
        for i, fc in enumerate(faces):
            self.f.append([base + k for k in fc])
            self.fm.append(fmats[i] if fmats else mat)
        for p in verts:
            if wfun:
                self.w.append(wfun(Vector(p)))
            elif len(bones) == 1:
                self.w.append({bones[0]: 1.0})
            else:
                self.w.append(self.weights(Vector(p), bones))


def _prune(self, drop):
    keep = [i for i, m in enumerate(self.fm) if not drop(m)]
    used = sorted({k for i in keep for k in self.f[i]})
    remap = {o: n for n, o in enumerate(used)}
    self.f = [[remap[k] for k in self.f[i]] for i in keep]
    self.fm = [self.fm[i] for i in keep]
    self.v = [self.v[o] for o in used]
    self.w = [self.w[o] for o in used]


Geo.prune = _prune


def frames(cs, ref):
    out = []
    for i in range(len(cs)):
        d = (cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]).normalized()
        f = (ref - d * ref.dot(d)).normalized()
        out.append((d, f, d.cross(f)))
    return out


def tube(rings, n=16, arc=None, cap0=False, cap1=False, ref=FRONT, mod=None, zoff=None, clampz=None):
    """沿中心線的環形截面網格。rings: [(中心, rx, ry)]；a=0 在 f（預設正前方），往 +s 方向增加。
    arc(t) -> (起角, 終角) 時是開口的弧面。回傳 頂點、面、每面所屬的環序號"""
    cs = [Vector(r[0]) for r in rings]
    fr = frames(cs, ref)
    closed = arc is None
    m = n if closed else n + 1
    verts = []
    for i, (c, rx, ry) in enumerate(rings):
        d, f, s = fr[i]
        t = i / max(1, len(rings) - 1)
        a0, a1 = (0.0, TAU) if closed else arc(t)
        for j in range(m):
            a = a0 + (a1 - a0) * j / n
            k = mod(a, t) if mod else 1.0
            p = cs[i] + s * (rx * k * math.sin(a)) + f * (ry * k * math.cos(a))
            if zoff:
                p.z += zoff(a, t)
            if clampz is not None and p.z < clampz:
                p.z = clampz
            verts.append(p)
    faces, fring = [], []
    for i in range(len(rings) - 1):
        for j in range(n):
            j2 = (j + 1) % m if closed else j + 1
            faces.append((i * m + j, i * m + j2, (i + 1) * m + j2, (i + 1) * m + j))
            fring.append(i)
    if closed and cap0:
        verts.append(cs[0].copy())
        c = len(verts) - 1
        for j in range(n):
            faces.append((c, (j + 1) % m, j))
            fring.append(0)
    if closed and cap1:
        verts.append(cs[-1].copy())
        c = len(verts) - 1
        o = (len(rings) - 1) * m
        for j in range(n):
            faces.append((c, o + j, o + (j + 1) % m))
            fring.append(len(rings) - 2)
    return verts, faces, fring


def from_bm(bm):
    bm.verts.index_update()
    verts = [v.co.copy() for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def sphere(c, r, u=16, v=10, keep=None, shape=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for vt in bm.verts:
        p = vt.co
        q = Vector((p.x * r[0], p.y * r[1], p.z * r[2]))
        if shape:
            q = shape(q)
        vt.co = q + Vector(c)
    if keep:
        bmesh.ops.delete(bm, geom=[vt for vt in bm.verts if not keep(vt.co)], context='VERTS')
    return from_bm(bm)


def box(c, size, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    M = Matrix.Translation(Vector(c)) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    for vt in bm.verts:
        vt.co = M @ Vector((vt.co.x * size[0], vt.co.y * size[1], vt.co.z * size[2]))
    return from_bm(bm)


def cone(base, top, r0, r1, n=14, cap0=True):
    v, f, _ = tube([(base, r0, r0), (top, r1, r1)], n, cap0=cap0, cap1=r1 > 0, ref=FRONT if abs((Vector(top) - Vector(base)).normalized().y) < 0.9 else UP)
    return v, f


def resample(points, step):
    pts = [Vector(p[0]) for p in points]
    out = []
    for i in range(len(points) - 1):
        a, b = pts[i], pts[i + 1]
        k = max(1, round((b - a).length / step))
        for j in range(k):
            t = j / k
            out.append((a.lerp(b, t), lerp(points[i][1], points[i + 1][1], t), lerp(points[i][2], points[i + 1][2], t)))
    out.append(points[-1])
    return out


def rev(f):
    return [list(reversed(fc)) for fc in f]


def xf(verts, M):
    return [M @ Vector(p) for p in verts]


def torus(c, R, r, ax_u, ax_v, U=22, V=6, arc=TAU):
    c, u, v = Vector(c), Vector(ax_u), Vector(ax_v)
    n = u.cross(v).normalized()
    full = arc >= TAU - 1e-6
    UU = U if full else U + 1
    verts, faces = [], []
    for i in range(UU):
        a = arc * i / U
        d = u * math.cos(a) + v * math.sin(a)
        for j in range(V):
            b = TAU * j / V
            verts.append(c + d * (R + r * math.cos(b)) + n * (r * math.sin(b)))
    for i in range(U):
        for j in range(V):
            i2, j2 = (i + 1) % UU, (j + 1) % V
            faces.append((i * V + j, i2 * V + j, i2 * V + j2, i * V + j2))
    return verts, faces


def strap(pts, w, th):
    """扁平的帶子：pts = [(位置, 朝外的方向)]"""
    verts, faces = [], []
    for i, (p, n) in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        side = d.cross(n).normalized()
        nn = side.cross(d).normalized()
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(p + side * (sx * w / 2) + nn * (sy * th / 2))
    for i in range(len(pts) - 1):
        for j in range(4):
            j2 = (j + 1) % 4
            faces.append((i * 4 + j, i * 4 + j2, (i + 1) * 4 + j2, (i + 1) * 4 + j))
    return verts, faces
