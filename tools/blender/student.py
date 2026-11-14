"""霍格沃茲學生的角色模型：網格、材質、骨架，匯出成 GLB。

在背景執行（不需要開 Blender 視窗）：
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    -P tools/blender/student.py -- --out public/models/student.glb --preview /tmp/preview

座標：Blender 是 Z 朝上、角色面向 -Y；匯出成 glTF 後是 Y 朝上、面向 +Z，與遊戲一致。
單位是公尺，腳底在 z=0，身高約 1.84 m（含頭髮）。
"""
import argparse
import random
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='public/models/student.glb')
ap.add_argument('--preview', default='')
ap.add_argument('--blend', default='')
args = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TAU = math.pi * 2
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


def sat(x):
    return max(0.0, min(1.0, x))


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- 材質
def lin(h):
    out = []
    for k in (16, 8, 0):
        c = ((h >> k) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


MAT_ORDER = []
MATS = {}


def material(name, hexc, rough=0.8, double=False):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    col = lin(hexc)
    m.diffuse_color = (*col, 1)
    m.roughness = rough
    m.use_backface_culling = not double
    nt = m.node_tree
    if nt is not None:
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
            outn = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
            nt.links.new(bsdf.outputs[0], outn.inputs[0])
        bsdf.inputs['Base Color'].default_value = (*col, 1)
        bsdf.inputs['Roughness'].default_value = rough
    MATS[name] = len(MAT_ORDER)
    MAT_ORDER.append(m)
    return m


material('robe', 0x2a2b31, 0.78)
material('sweater', 0x6b6c70, 0.95)
material('sweater_rib', 0x5c5d61, 0.95)
material('trousers', 0x2c2d31, 0.85)
material('shirt', 0xece9e2, 0.7, double=True)
material('skin', 0xeec4a2, 0.62)
material('hair', 0x16130f, 0.55)
material('boot', 0x6a4426, 0.5)
material('sole', 0x2a1c12, 0.8)
material('sock', 0x77777a, 0.95)
material('glove', 0x3d3d40, 0.9)
material('leather', 0x7a4f2c, 0.6, double=True)
material('leather_dark', 0x4e3120, 0.6, double=True)
material('metal', 0xb8975a, 0.35)
material('frame', 0x1e1e20, 0.3, double=True)
material('patch', 0x5d4a86, 0.8)
material('eye', 0xf2f0ea, 0.3)
material('iris', 0x3b2a1a, 0.3)
material('lip', 0xc07a6a, 0.6)
material('wood', 0x4a2c16, 0.55)
material('straw', 0x8a6a32, 0.95, double=True)
material('house_primary', 0x7a0d15, 0.85, double=True)
material('house_secondary', 0xd9a521, 0.8, double=True)

HEM = 0.38  # 長袍下襬到小腿中段

# ---------------------------------------------------------------- 骨架定義
# (名稱, 頭, 尾, 父骨)
BONES = [
    ('root', (0, 0, 0), (0, 0, 0.12), None),
    ('hips', (0, 0, 0.95), (0, 0, 1.06), 'root'),
    ('spine', (0, 0, 1.06), (0, 0, 1.25), 'hips'),
    ('chest', (0, 0, 1.25), (0, 0, 1.46), 'spine'),
    ('neck', (0, 0.005, 1.47), (0, 0.008, 1.57), 'chest'),
    ('head', (0, 0.008, 1.57), (0, 0.008, 1.84), 'neck'),
    ('hood', (0, 0.13, 1.48), (0, 0.21, 1.36), 'chest'),
    ('bag', (0.13, -0.16, 1.0), (0.15, -0.19, 0.8), 'hips'),
]
for s, sd in ((1, 'L'), (-1, 'R')):
    BONES += [
        (f'upperarm.{sd}', (0.2 * s, 0, 1.44), (0.25 * s, 0, 1.16), 'chest'),
        (f'forearm.{sd}', (0.25 * s, 0, 1.16), (0.285 * s, -0.02, 0.9), f'upperarm.{sd}'),
        (f'hand.{sd}', (0.285 * s, -0.02, 0.9), (0.295 * s, -0.02, 0.8), f'forearm.{sd}'),
        (f'thigh.{sd}', (0.088 * s, 0, 0.93), (0.088 * s, 0, 0.5), 'hips'),
        (f'shin.{sd}', (0.088 * s, 0, 0.5), (0.088 * s, 0.01, 0.1), f'thigh.{sd}'),
        (f'foot.{sd}', (0.088 * s, 0.01, 0.1), (0.088 * s, -0.13, 0.03), f'shin.{sd}'),
        (f'robe.F.{sd}.1', (0.12 * s, -0.11, 1.0), (0.18 * s, -0.17, 0.68), 'hips'),
        (f'robe.F.{sd}.2', (0.18 * s, -0.17, 0.68), (0.23 * s, -0.22, HEM), f'robe.F.{sd}.1'),
    ]
BONES += [
    ('robe.B.1', (0, 0.13, 1.0), (0, 0.21, 0.68), 'hips'),
    ('robe.B.2', (0, 0.21, 0.68), (0, 0.27, HEM), 'robe.B.1'),
]
BONE_SEG = {b[0]: (Vector(b[1]), Vector(b[2])) for b in BONES}


def seg_dist(p, a, b):
    ab = b - a
    t = sat((p - a).dot(ab) / max(1e-9, ab.dot(ab)))
    return (a + ab * t - p).length


def chain_weights(p, bones, power=5.0):
    """依頂點到各骨段的距離分配權重（只在這個部件允許的骨頭之間）"""
    ws = []
    for b in bones:
        a, c = BONE_SEG[b]
        d = seg_dist(p, a, c)
        ws.append((b, 1.0 / (d ** power + 1e-12)))
    tot = sum(w for _, w in ws)
    ws = sorted(((b, w / tot) for b, w in ws), key=lambda x: -x[1])[:4]
    ws = [(b, w) for b, w in ws if w > 0.02]
    tot = sum(w for _, w in ws)
    return {b: w / tot for b, w in ws}


# ---------------------------------------------------------------- 網格累積
class Geo:
    def __init__(self):
        self.v = []
        self.f = []
        self.fm = []
        self.w = []

    def add(self, verts, faces, mat, bones=None, wfun=None, fmats=None):
        base = len(self.v)
        self.v += [Vector(p) for p in verts]
        for i, fc in enumerate(faces):
            self.f.append([base + k for k in fc])
            m = fmats[i] if fmats else mat
            self.fm.append(MATS[m])
        for p in verts:
            if wfun:
                self.w.append(wfun(Vector(p)))
            elif len(bones) == 1:
                self.w.append({bones[0]: 1.0})
            else:
                self.w.append(chain_weights(Vector(p), bones))


G = Geo()


def frames(cs, ref):
    out = []
    for i in range(len(cs)):
        d = (cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]).normalized()
        f = (ref - d * ref.dot(d)).normalized()
        out.append((d, f, d.cross(f)))
    return out


def tube(rings, n=16, arc=None, cap0=False, cap1=False, ref=FRONT, mod=None, zoff=None, clampz=None):
    """沿中心線的環形截面網格。rings: [(中心, rx, ry)]；a=0 在 f（預設正前方），往 +s 方向增加。
    arc(t) -> (起角, 終角) 時是開口的弧面（長袍前襟）。回傳 頂點、面、每面所屬的環序號"""
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


import random


def rev(f):
    return [list(reversed(fc)) for fc in f]


def xf(verts, M):
    return [M @ Vector(p) for p in verts]


def torus(c, R, r, ax_u, ax_v, U=22, V=6):
    c, u, v = Vector(c), Vector(ax_u), Vector(ax_v)
    n = u.cross(v).normalized()
    verts, faces = [], []
    for i in range(U):
        a = TAU * i / U
        d = u * math.cos(a) + v * math.sin(a)
        for j in range(V):
            b = TAU * j / V
            verts.append(c + d * (R + r * math.cos(b)) + n * (r * math.sin(b)))
    for i in range(U):
        for j in range(V):
            i2, j2 = (i + 1) % U, (j + 1) % V
            faces.append((i * V + j, i2 * V + j, i2 * V + j2, i * V + j2))
    return verts, faces


def strap(pts, w, th):
    """扁平的皮帶：pts = [(位置, 朝外的方向)]"""
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


# ---------------------------------------------------------------- 腿、針織襪與皮靴
for s, sd in ((1, 'L'), (-1, 'R')):
    x = 0.088 * s
    LEG = ['hips', f'thigh.{sd}', f'shin.{sd}']
    legs = [((x, 0, 0.98), 0.082, 0.08), ((x, 0, 0.78), 0.077, 0.074), ((x, 0.003, 0.52), 0.064, 0.063),
            ((x, 0.005, 0.34), 0.057, 0.057), ((x, 0.006, 0.24), 0.054, 0.055)]
    v, f, _ = tube(legs, 14)
    G.add(v, f, 'trousers', LEG)
    # 反摺的灰色針織襪口
    v, f, _ = tube([((x, 0.006, 0.17), 0.06, 0.062), ((x, 0.006, 0.205), 0.068, 0.07), ((x, 0.006, 0.235), 0.069, 0.071),
                    ((x, 0.006, 0.258), 0.06, 0.062)], 14)
    G.add(v, f, 'sock', [f'shin.{sd}'])
    # 靴筒
    v, f, _ = tube([((x, 0.008, 0.05), 0.066, 0.07), ((x, 0.007, 0.12), 0.064, 0.066), ((x, 0.006, 0.185), 0.061, 0.063)], 14)
    G.add(v, f, 'boot', [f'shin.{sd}', f'foot.{sd}'])
    # 靴身：前後方向的截面，鞋頭圓厚
    bt = [((x, 0.082, 0.06), 0.044, 0.05), ((x, 0.055, 0.065), 0.054, 0.06), ((x, -0.01, 0.06), 0.058, 0.055),
          ((x, -0.08, 0.05), 0.058, 0.045), ((x, -0.145, 0.045), 0.053, 0.04), ((x, -0.19, 0.04), 0.044, 0.034),
          ((x, -0.212, 0.036), 0.026, 0.02)]
    v, f, _ = tube(bt, 16, cap0=True, cap1=True, ref=UP, clampz=0.02)
    G.add(v, f, 'boot', [f'foot.{sd}'])
    sole = [((x, 0.088, 0.012), 0.047, 0.014), ((x, 0.05, 0.012), 0.058, 0.014), ((x, -0.08, 0.012), 0.062, 0.014),
            ((x, -0.19, 0.012), 0.048, 0.014), ((x, -0.222, 0.012), 0.026, 0.012)]
    v, f, _ = tube(sole, 14, cap0=True, cap1=True, ref=UP, clampz=0.0)
    G.add(v, f, 'sole', [f'foot.{sd}'])
    # 鞋帶：靴面上幾道深色橫線
    for k in range(4):
        yy = -0.02 - 0.03 * k
        v, f = box((x, yy - 0.002, 0.105 - 0.012 * k), (0.05, 0.008, 0.006), (-0.5, 0, 0))
        G.add(v, f, 'leather_dark', [f'foot.{sd}'])

# ---------------------------------------------------------------- 軀幹：襯衫下襬、皮帶、毛衣、長袍
v, f, _ = tube([((0, 0.002, 0.94), 0.169, 0.124), ((0, 0.004, 0.895), 0.176, 0.13), ((0, 0.006, 0.855), 0.181, 0.134)], 18)
G.add(v, f, 'shirt', ['hips', 'thigh.L', 'thigh.R'])
v, f, _ = tube([((0, 0, 0.928), 0.173, 0.127), ((0, 0, 0.97), 0.172, 0.126)], 18)
G.add(v, f, 'leather_dark', ['hips'])
v, f = box((0, -0.129, 0.949), (0.036, 0.008, 0.032))
G.add(v, f, 'metal', ['hips'])

sweater = [((0, 0, 0.955), 0.168, 0.122), ((0, 0, 1.05), 0.161, 0.115), ((0, 0, 1.15), 0.157, 0.11),
           ((0, 0, 1.25), 0.172, 0.115), ((0, 0, 1.35), 0.19, 0.118), ((0, 0, 1.42), 0.196, 0.112),
           ((0, 0.002, 1.47), 0.152, 0.096), ((0, 0.004, 1.51), 0.07, 0.062)]
v, f, _ = tube(sweater, 18, cap0=True)
G.add(v, f, 'sweater', ['hips', 'spine', 'chest', 'upperarm.L', 'upperarm.R'])
v, f, _ = tube([((0, 0, 0.952), 0.174, 0.128), ((0, 0, 0.985), 0.172, 0.126)], 18, mod=lambda a, t: 1 + 0.008 * math.sin(36 * a))
G.add(v, f, 'sweater_rib', ['hips', 'spine'])
# 毛衣的 V 領：白襯衫與領子
G.add([(-0.042, -0.113, 1.515), (0.042, -0.113, 1.515), (0.0, -0.121, 1.385)], [(0, 2, 1)], 'shirt', ['chest'])
for s in (1, -1):
    G.add([(0.01 * s, -0.122, 1.515), (0.062 * s, -0.104, 1.522), (0.026 * s, -0.124, 1.46)], [(0, 1, 2) if s > 0 else (0, 2, 1)], 'shirt', ['chest'])
# 斜紋領帶
tie = resample([((0, -0.125, 1.505), 0.012, 0.005), ((0, -0.129, 1.45), 0.017, 0.005), ((0, -0.133, 1.35), 0.022, 0.005)], 0.022)
tie.append(((0, -0.133, 1.33), 0.003, 0.004))
v, f, fr = tube(tie, 8, cap0=True, cap1=True)
G.add(v, f, 'house_primary', ['chest'], fmats=['house_secondary' if fr[i] % 2 else 'house_primary' for i in range(len(f))])

robe_top = [((0, 0, 0.95), 0.178, 0.13), ((0, 0, 1.05), 0.173, 0.125), ((0, 0, 1.15), 0.169, 0.121),
            ((0, 0, 1.25), 0.186, 0.127), ((0, 0, 1.35), 0.208, 0.131), ((0, 0, 1.42), 0.222, 0.128), ((0, 0.002, 1.455), 0.205, 0.118),
            ((0, 0.003, 1.48), 0.165, 0.103), ((0, 0.005, 1.51), 0.108, 0.088), ((0, 0.006, 1.535), 0.1, 0.082)]
TORSO_BONES = ['hips', 'spine', 'chest', 'upperarm.L', 'upperarm.R']


def top_gap(t):
    return 0.3 + 0.34 * t ** 2.2


def lapel(t):
    # 往上越寬：領口翻出學院色的內襯
    return 0.11 + 0.5 * t ** 3


v, f, _ = tube(robe_top, 24, arc=lambda t: (top_gap(t), TAU - top_gap(t)))
G.add(v, f, 'robe', TORSO_BONES)
inner = [(c, rx * 0.985, ry * 0.985) for c, rx, ry in robe_top]
v, f, _ = tube(inner, 24, arc=lambda t: (top_gap(t), TAU - top_gap(t)))
G.add(v, rev(f), 'house_primary', TORSO_BONES)
big = [(c, rx * 1.012, ry * 1.012) for c, rx, ry in robe_top]
for lo, hi in ((lambda t: top_gap(t) - 0.012, lambda t: top_gap(t) + lapel(t)), (lambda t: TAU - top_gap(t) - lapel(t), lambda t: TAU - top_gap(t) + 0.012)):
    v, f, _ = tube(big, 3, arc=lambda t, lo=lo, hi=hi: (lo(t), hi(t)))
    G.add(v, f, 'house_primary', TORSO_BONES)


def robe_at(z, a, k=1.0):
    rs = robe_top
    z = max(rs[0][0][2], min(rs[-1][0][2], z))
    for i in range(len(rs) - 1):
        z0, z1 = rs[i][0][2], rs[i + 1][0][2]
        if z0 <= z <= z1:
            t = (z - z0) / max(1e-9, z1 - z0)
            rx, ry = lerp(rs[i][1], rs[i + 1][1], t), lerp(rs[i][2], rs[i + 1][2], t)
            return Vector((rx * k * math.sin(a), -ry * k * math.cos(a), z))
    return Vector((0, 0, z))


# 豎起的領子：後半圈，內側是學院色
collar = [((0, 0.01, 1.485), 0.13, 0.108), ((0, 0.016, 1.515), 0.138, 0.114), ((0, 0.024, 1.54), 0.158, 0.13)]
v, f, _ = tube(collar, 16, arc=lambda t: (0.75, TAU - 0.75))
G.add(v, f, 'robe', ['chest', 'neck'])
v, f, _ = tube([(c, rx * 0.96, ry * 0.96) for c, rx, ry in collar], 16, arc=lambda t: (0.75, TAU - 0.75))
G.add(v, rev(f), 'house_primary', ['chest', 'neck'])

SKIRT_BONES = ['hips', 'robe.F.L.1', 'robe.F.L.2', 'robe.F.R.1', 'robe.F.R.2', 'robe.B.1', 'robe.B.2']
skirt = []
for i in range(7):
    t = i / 6
    rx = 0.18 + (0.385 - 0.18) * t ** 1.1
    skirt.append(((0, 0.012 * t, 1.06 - (1.06 - HEM) * t), rx, rx * (0.73 + 0.1 * t)))


def skirt_gap(t):
    return 0.3 + 0.2 * t


def folds(a, t):
    return 1 + 0.065 * t * math.sin(9 * a + 0.6) + 0.025 * t * math.sin(4 * a)


def hem(a, t):
    return -0.04 * t * (1 - math.cos(a)) / 2


SK_ARC = lambda t: (skirt_gap(t), TAU - skirt_gap(t))
v, f, _ = tube(skirt, 32, arc=SK_ARC, mod=folds, zoff=hem)
G.add(v, f, 'robe', SKIRT_BONES)
v, f, _ = tube([(c, rx * 0.985, ry * 0.985) for c, rx, ry in skirt], 32, arc=SK_ARC, mod=folds, zoff=hem)
G.add(v, rev(f), 'house_primary', SKIRT_BONES)
# 下襬一圈學院色滾邊
hem_rings = []
for k in range(2):
    tt = 0.965 + 0.035 * k
    rx = 0.18 + (0.385 - 0.18) * tt ** 1.1
    hem_rings.append(((0, 0.012 * tt, 1.06 - (1.06 - HEM) * tt), rx * 1.008, rx * (0.73 + 0.1 * tt) * 1.008))
v, f, _ = tube(hem_rings, 32, arc=lambda t: SK_ARC(0.965 + 0.035 * t), mod=lambda a, t: folds(a, 0.965 + 0.035 * t), zoff=lambda a, t: hem(a, 0.965 + 0.035 * t))
G.add(v, f, 'house_primary', SKIRT_BONES)
bigs = [(c, rx * 1.01, ry * 1.01) for c, rx, ry in skirt]
for lo, hi in ((lambda g: g - 0.01, lambda g: g + 0.06), (lambda g: TAU - g - 0.06, lambda g: TAU - g + 0.01)):
    v, f, _ = tube(bigs, 2, arc=lambda t, lo=lo, hi=hi: (lo(skirt_gap(t)), hi(skirt_gap(t))), mod=folds, zoff=hem)
    G.add(v, f, 'house_primary', SKIRT_BONES)

# 胸前（左胸）的學院徽章
v, f = box((0.118, -0.113, 1.36), (0.07, 0.008, 0.082), (0, 0, 0.42))
G.add(v, f, 'house_primary', ['chest'])
v, f = box((0.12, -0.118, 1.362), (0.042, 0.006, 0.05), (0, 0, 0.42))
G.add(v, f, 'house_secondary', ['chest'])

# ---------------------------------------------------------------- 斜背的皮書包：右肩到左腰
front, back = [], []
for k in range(16):
    t = k / 15
    z = lerp(1.505, 1.0, t ** 0.9)
    for path, a in ((front, lerp(-1.55, 0.6, t)), (back, lerp(-1.55, -5.25, t))):
        kk = 1.045 + 0.05 * (1 - t) ** 6
        p = robe_at(z, a, kk)
        n = Vector((math.sin(a), -math.cos(a), 0.9 * (1 - t) ** 5)).normalized()
        path.append((p, n))
STRAP_BONES = ['chest', 'spine', 'hips', 'bag']
for path in (front, back):
    v, f = strap(path, 0.042, 0.007)
    G.add(v, f, 'leather', STRAP_BONES)

BAG_A = 0.6
BAG_C = Vector((0.152, -0.178, 0.87))
BM = Matrix.Translation(BAG_C) @ Matrix.Rotation(BAG_A, 4, 'Z')


def bag_part(geo, mat):
    v, f = geo[0], geo[1]
    G.add(xf(v, BM), f, mat, ['bag'])


bag_part(box((0, 0, 0), (0.22, 0.066, 0.17)), 'leather')
bag_part(box((0, -0.036, 0.022), (0.228, 0.012, 0.135)), 'leather')
bag_part(box((0, -0.006, 0.084), (0.2, 0.05, 0.012)), 'leather_dark')
for bx in (-0.062, 0.062):
    bag_part(box((bx, -0.044, 0.02), (0.022, 0.006, 0.12)), 'leather_dark')
    bag_part(box((bx, -0.048, -0.032), (0.028, 0.006, 0.022)), 'metal')
for (px, pz, r, m) in ((-0.025, 0.055, 0.019, 'house_primary'), (0.025, 0.06, 0.017, 'house_secondary'),
                       (0.0, 0.0, 0.016, 'patch'), (-0.09, 0.055, 0.012, 'metal')):
    v, f, _ = tube([((px, -0.042, pz), r, r), ((px, -0.048, pz), r, r)], 10, cap1=True, ref=UP)
    bag_part((v, f), m)
# 書包兩側接背帶的扣環
for side in (-1, 1):
    v, f = box((0.112 * side, 0, 0.07), (0.01, 0.03, 0.03))
    bag_part((v, f), 'metal')

# ---------------------------------------------------------------- 手臂、袖子與露指手套
for s, sd in ((1, 'L'), (-1, 'R')):
    S, E, W, K = (Vector(p) for p in ((0.2 * s, 0, 1.44), (0.25 * s, 0, 1.16), (0.285 * s, -0.02, 0.9), (0.295 * s, -0.02, 0.8)))
    ARM = ['chest', f'upperarm.{sd}', f'forearm.{sd}', f'hand.{sd}']
    sleeve = [(Vector((0.155 * s, 0, 1.425)), 0.058, 0.058), (Vector((0.2 * s, 0, 1.4)), 0.068, 0.068),
              (S.lerp(E, 0.55), 0.068, 0.068), (E, 0.07, 0.072), (E.lerp(W, 0.45), 0.082, 0.085),
              (W + (W - E) * 0.02, 0.112, 0.116), (W + (W - E) * 0.12, 0.124, 0.128)]
    v, f, _ = tube(sleeve, 16)
    G.add(v, f, 'robe', ARM)
    v, f, _ = tube([(c, rx * 0.96, ry * 0.96) for c, rx, ry in sleeve], 16)
    G.add(v, rev(f), 'house_primary', ARM)
    v, f, _ = tube([(E, 0.046, 0.046), (E.lerp(W, 0.6), 0.042, 0.042), (W + Vector((0, 0, 0.02)), 0.039, 0.039)], 12)
    G.add(v, f, 'sweater', [f'forearm.{sd}'])
    v, f, _ = tube([(W + Vector((0, 0, 0.028)), 0.038, 0.038), (W + Vector((0, 0, 0.004)), 0.036, 0.036)], 12)
    G.add(v, f, 'shirt', [f'forearm.{sd}'])
    HAND = [f'forearm.{sd}', f'hand.{sd}']
    # 手套：手腕到指根，手指露出來
    v, f, _ = tube([(W + Vector((0, 0, 0.012)), 0.03, 0.036), (W + Vector((0, 0, -0.004)), 0.02, 0.031),
                    (W.lerp(K, 0.5), 0.021, 0.042), (K, 0.019, 0.044)], 12, cap1=True)
    G.add(v, f, 'glove', HAND)
    inward = Vector((-0.01 * s, 0, 0))
    for yo, ln in ((-0.028, 0.058), (-0.0095, 0.066), (0.0095, 0.062), (0.028, 0.05)):
        a = K + Vector((0, yo, 0.008))
        v, f, fr = tube([(a, 0.0098, 0.0098), (a + Vector((0, 0, -ln * 0.35)) + inward * 0.3, 0.0094, 0.0094),
                         (a + Vector((0, 0, -ln * 0.7)) + inward * 0.8, 0.0085, 0.0085), (a + Vector((0, 0, -ln)) + inward * 1.3, 0.0075, 0.0075)],
                        8, cap1=True)
        G.add(v, f, 'skin', [f'hand.{sd}'], fmats=['glove' if fr[i] == 0 else 'skin' for i in range(len(f))])
    t0 = W + Vector((-0.004 * s, -0.03, -0.035))
    v, f, fr = tube([(t0, 0.012, 0.012), (t0 + Vector((-0.008 * s, -0.016, -0.025)), 0.0105, 0.0105),
                     (t0 + Vector((-0.014 * s, -0.024, -0.05)), 0.0085, 0.0085)], 8, cap1=True)
    G.add(v, f, 'skin', [f'hand.{sd}'], fmats=['glove' if fr[i] == 0 else 'skin' for i in range(len(f))])
    if s == -1:
        # 魔杖：握在右手，指向前下方；握柄有一圈節
        g0 = K + Vector((0, 0.035, -0.02))
        tip = K + Vector((0, -0.3, -0.1))
        v, f, _ = tube([(g0, 0.011, 0.011), (g0.lerp(tip, 0.18), 0.0115, 0.0115), (g0.lerp(tip, 0.22), 0.0095, 0.0095),
                        (g0.lerp(tip, 0.3), 0.01, 0.01), (g0.lerp(tip, 0.32), 0.0085, 0.0085), (tip, 0.005, 0.005)],
                       7, cap0=True, cap1=True, ref=UP)
        G.add(v, f, 'wood', ['hand.R'])
        WAND_TIP = tip

# ---------------------------------------------------------------- 脖子、頭、臉
v, f, _ = tube([((0, 0.006, 1.46), 0.056, 0.053), ((0, 0.01, 1.62), 0.052, 0.05)], 12)
G.add(v, f, 'skin', ['chest', 'neck', 'head'])

HC = Vector((0, -0.004, 1.722))
HR = Vector((0.127, 0.131, 0.146))


def head_shape(q):
    # 下巴收窄、臉頰微收、後腦略平
    t = sat(-q.z / HR.z)
    k = 1 - 0.24 * t ** 1.8
    q = Vector((q.x * k, q.y * (1 - 0.1 * t ** 2), q.z))
    if q.y < 0:
        q.y -= 0.008 * t
    if q.y > 0:
        q.y *= 0.95
    return q


v, f = sphere(HC, HR, 20, 14, shape=head_shape)
G.add(v, f, 'skin', ['head'])


def surf_y(x, z):
    """臉表面在 (x,z) 的 y（前方為負）"""
    qz = (z - HC.z) / HR.z
    t = sat(-qz)
    k = 1 - 0.24 * t ** 1.8
    r = 1 - (x / (HR.x * k)) ** 2 - qz ** 2
    y = -HR.y * (1 - 0.1 * t ** 2) * math.sqrt(max(0.0, r)) - 0.008 * t
    return HC.y + y


EZ = 1.726
for s in (1, -1):
    ex = 0.045 * s
    ey = surf_y(ex, EZ)
    v, f = sphere((ex, ey + 0.007, EZ), (0.025, 0.012, 0.019), 12, 8)
    G.add(v, f, 'eye', ['head'])
    v, f = sphere((ex, ey - 0.0035, EZ - 0.001), (0.0125, 0.0045, 0.0135), 10, 6)
    G.add(v, f, 'iris', ['head'])
    v, f = box((0.047 * s, surf_y(0.047 * s, 1.762) - 0.003, 1.762), (0.042, 0.006, 0.0065), (0, 0, -0.1 * s))
    G.add(v, f, 'hair', ['head'])
    v, f = sphere((0.126 * s, 0.002, 1.712), (0.012, 0.022, 0.03), 8, 6)
    G.add(v, f, 'skin', ['head'])
v, f = sphere((0, surf_y(0, 1.697) - 0.003, 1.697), (0.0088, 0.009, 0.016), 8, 6, shape=lambda q: Vector((q.x, q.y - 0.25 * max(0.0, -q.z), q.z)))
G.add(v, f, 'skin', ['head'])
# 微笑的嘴
mouth = []
for k in range(5):
    x = -0.022 + 0.011 * k
    z = 1.664 + 0.006 * (x / 0.022) ** 2
    mouth.append(((x, surf_y(x, z) + 0.0015, z), 0.004, 0.003))
v, f, _ = tube(mouth, 6, cap0=True, cap1=True, ref=UP)
G.add(v, f, 'lip', ['head'])

# 圓框眼鏡
GY = surf_y(0.045, EZ) - 0.016
for s in (1, -1):
    v, f = torus((0.045 * s, GY, EZ), 0.03, 0.0028, (1, 0, 0), (0, 0, 1))
    G.add(v, f, 'frame', ['head'])
    v, f, _ = tube([((0.075 * s, GY + 0.004, EZ + 0.002), 0.0026, 0.0026), ((0.124 * s, -0.03, EZ + 0.004), 0.0026, 0.0026),
                    ((0.131 * s, 0.02, 1.716), 0.0026, 0.0026)], 5, ref=UP)
    G.add(v, f, 'frame', ['head'])
v, f, _ = tube([((-0.016, GY, EZ + 0.004), 0.0026, 0.0026), ((0, GY - 0.003, EZ + 0.01), 0.0026, 0.0026), ((0.016, GY, EZ + 0.004), 0.0026, 0.0026)], 5, ref=UP)
G.add(v, f, 'frame', ['head'])

# ---------------------------------------------------------------- 亂翹的黑髮
HAIR_C = HC + Vector((0, 0.01, 0.012))
HAIR_R = Vector((0.14, 0.146, 0.158))


def hair_keep(p):
    q = p - HAIR_C
    front = sat((-q.y / HAIR_R.y + 1) / 2)
    side = abs(q.x) / HAIR_R.x
    # 後腦垂到後頸、兩側停在耳朵上緣、前面是額頭的髮際
    def sm(e0, e1, x):
        x = sat((x - e0) / (e1 - e0))
        return x * x * (3 - 2 * x)
    line = lerp(lerp(-0.12, 0.0, sm(0.15, 0.45, front)), 0.048, sm(0.62, 0.85, front))
    return q.z > line


v, f = sphere(HAIR_C, HAIR_R, 22, 14, keep=hair_keep, shape=lambda q: Vector((q.x, q.y, q.z * (1.0 if q.z > 0 else 0.92))))
G.add(v, f, 'hair', ['head'])
rng = random.Random(11)
DOWN = Vector((0, 0, -1))
tufts = 0
while tufts < 150:
    z = rng.uniform(-0.6, 1.0)
    ph = rng.uniform(0, TAU)
    rr = math.sqrt(1 - z * z)
    n = Vector((rr * math.cos(ph), rr * math.sin(ph), z))
    root = HAIR_C + Vector((n.x * HAIR_R.x, n.y * HAIR_R.y, n.z * HAIR_R.z)) * 0.93
    if not hair_keep(root + n * 0.012):
        continue
    jit = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
    # 髮束順著頭形往後、往下貼成一層層，頂上少數翹起；瀏海停在眉毛上方
    back = Vector((0, 1, 0)) - n * n.y
    lift = 0.012
    if n.z > 0.72:
        d = (n * 0.32 + back * 0.65 + jit * 0.4).normalized()
        ln = rng.uniform(0.05, 0.08)
        lift = 0.02
    elif n.y < -0.15:
        d = (n * 0.25 + DOWN * 0.85 + Vector((n.x, 0, 0)) * 0.6 + jit * 0.25).normalized()
        ln = min(rng.uniform(0.045, 0.075), max(0.015, (root.z - 1.778) / max(0.25, -d.z)))
    else:
        d = (n * 0.28 + back * 0.2 + DOWN * 0.75 + jit * 0.3).normalized()
        ln = rng.uniform(0.05, 0.085)
        # 兩側只蓋到耳朵上緣，前側不能垂到眼鏡上
        floor = 1.766 if n.y < 0.05 else (1.695 if n.y < 0.55 else 1.62)
        ln = min(ln, max(0.015, (root.z - floor) / max(0.25, -d.z)))
    w = rng.uniform(0.045, 0.062)
    pts = [(root, w, 0.013), (root + d * ln * 0.45 + n * lift, w * 0.75, 0.01), (root + d * ln * 0.8 + n * lift * 0.7, w * 0.4, 0.006),
           (root + d * ln + n * lift * 0.5, 0.006, 0.003)]
    v, f, _ = tube(pts, 6, cap1=True, ref=n)
    G.add(v, f, 'hair', ['head'])
    tufts += 1

# ---------------------------------------------------------------- 大兜帽（垂在背後，內襯學院色）
HOODC = Vector((0, 0.165, 1.43))
# 兜帽開口往後上方傾，從背後看得到學院色內襯
HOODM = Matrix.Translation(HOODC) @ Matrix.Rotation(-0.55, 4, 'X') @ Matrix.Translation(-HOODC)
v, f = sphere(HOODC, (0.16, 0.085, 0.15), 18, 10, keep=lambda p: p.z < HOODC.z + 0.02)
G.add(xf(v, HOODM), f, 'robe', ['hood', 'chest'])
v, f = sphere(HOODC + Vector((0, -0.004, 0.004)), (0.148, 0.074, 0.138), 18, 10, keep=lambda p: p.z < HOODC.z + 0.021)
G.add(xf(v, HOODM), rev(f), 'house_primary', ['hood', 'chest'])

# ---------------------------------------------------------------- 建立物件
# glTF 載入時 three.js 會把名字裡的「.」拿掉，所以骨頭一律用底線
def nm(n):
    return n.replace('.', '_')


BONES = [(nm(a), h, t, nm(p) if p else None) for a, h, t, p in BONES]
G.w = [{nm(b): w for b, w in ws.items()} for ws in G.w]

coll = scene.collection
arm_data = bpy.data.armatures.new('student_rig')
arm = bpy.data.objects.new('student', arm_data)
coll.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name, h, t, par in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = Vector(h), Vector(t)
    eb.roll = 0
    if par:
        eb.parent = arm_data.edit_bones[par]
bpy.ops.object.mode_set(mode='OBJECT')

me = bpy.data.meshes.new('student_body')
me.from_pydata([tuple(p) for p in G.v], [], G.f)
for m in MAT_ORDER:
    me.materials.append(m)
me.polygons.foreach_set('material_index', G.fm)
me.polygons.foreach_set('use_smooth', [True] * len(G.f))
me.update()
body = bpy.data.objects.new('student_body', me)
coll.objects.link(body)
groups = {}
for i, ws in enumerate(G.w):
    for b, w in ws.items():
        if b not in groups:
            groups[b] = body.vertex_groups.new(name=b)
        groups[b].add([i], w, 'REPLACE')
body.parent = arm
mod = body.modifiers.new('rig', 'ARMATURE')
mod.object = arm

# 掃帚：獨立物件掛在 root 骨，網頁端切換顯示
bG = Geo()
v, f, _ = tube([((0, -1.05, 0.8), 0.016, 0.016), ((0, 0.2, 0.8), 0.019, 0.019), ((0, 0.66, 0.8), 0.021, 0.021)], 10, cap0=True, cap1=True, ref=UP)
bG.add(v, f, 'wood', ['root'])
v, f, _ = tube([((0, 0.58, 0.8), 0.046, 0.046), ((0, 0.665, 0.8), 0.046, 0.046)], 12, cap0=True, cap1=True, ref=UP)
bG.add(v, f, 'wood', ['root'])
v, f, _ = tube([((0, 0.6, 0.8), 0.04, 0.04), ((0, 0.75, 0.8), 0.085, 0.085), ((0, 0.98, 0.8), 0.118, 0.115), ((0, 1.22, 0.8), 0.1, 0.095)],
               20, cap1=True, ref=UP, mod=lambda a, t: 1 + 0.14 * t * math.sin(13 * a))
bG.add(v, f, 'straw', ['root'])
bme = bpy.data.meshes.new('broom')
bme.from_pydata([tuple(p) for p in bG.v], [], bG.f)
for m in MAT_ORDER:
    bme.materials.append(m)
bme.polygons.foreach_set('material_index', bG.fm)
bme.polygons.foreach_set('use_smooth', [True] * len(bG.f))
bme.update()
broom = bpy.data.objects.new('broom', bme)
coll.objects.link(broom)

tip_obj = bpy.data.objects.new('wand_tip', None)
tip_obj.empty_display_size = 0.03
coll.objects.link(tip_obj)

bpy.context.view_layer.update()
for ob, bone, world in ((broom, 'root', Matrix.Identity(4)), (tip_obj, 'hand_R', Matrix.Translation(WAND_TIP))):
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = world
bpy.context.view_layer.update()

tris = sum(len(p.vertices) - 2 for p in me.polygons) + sum(len(p.vertices) - 2 for p in bme.polygons)
print(f'[student] verts={len(me.vertices)} tris={tris} bones={len(BONES)} materials={len(MAT_ORDER)}')

# ---------------------------------------------------------------- 動畫
# 姿勢一律用「骨架空間的軸」描述，與骨頭的 roll 無關：
#   X：前後擺（負 = 往前：腿往前跨、手往前舉、膝蓋與手肘以正／負 X 彎）；軀幹與頭正 X = 往前傾、低頭
#   Y：側擺（左手往外 = 負，右手往外 = 正；軀幹側彎）
#   Z：扭轉
FPS = 30
scene.render.fps = FPS
REST = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}


def basis_quat(name, e):
    from mathutils import Euler
    R = Euler(e, 'XYZ').to_matrix()
    Rest = REST[name]
    return (Rest.inverted() @ R @ Rest).to_quaternion()


def S(p, k=1, off=0.0):
    return math.sin(TAU * (p * k + off))


def C(p, k=1, off=0.0):
    return math.cos(TAU * (p * k + off))


def pos(x):
    return max(0.0, x)


def gait(p, A, K, arm_a, fore, lean, bob, cloth, scarf, run):
    sw, cw = S(p), C(p)
    o = {}
    o['thigh_L'] = (-A * sw - 0.04 * run, 0, 0)
    o['thigh_R'] = (A * sw - 0.04 * run, 0, 0)
    # 膝蓋在往前擺的那半拍彎起來，著地前伸直
    o['shin_L'] = (0.08 + K * pos(cw) ** 1.3 + 0.12 * run * pos(-sw), 0, 0)
    o['shin_R'] = (0.08 + K * pos(-cw) ** 1.3 + 0.12 * run * pos(sw), 0, 0)
    o['foot_L'] = (-0.22 * pos(sw) + 0.35 * pos(-sw) * pos(-cw) * (1 + run), 0, 0)
    o['foot_R'] = (-0.22 * pos(-sw) + 0.35 * pos(sw) * pos(cw) * (1 + run), 0, 0)
    o['upperarm_L'] = (arm_a * sw - 0.05 - 0.1 * run, -0.08 - 0.06 * run, 0)
    o['upperarm_R'] = (-arm_a * sw - 0.05 - 0.1 * run, 0.08 + 0.06 * run, 0)
    o['forearm_L'] = (-fore - 0.2 * pos(-sw), 0, 0)
    o['forearm_R'] = (-fore - 0.2 * pos(sw), 0, 0)
    o['hand_L'] = (-0.1, 0, 0)
    o['hand_R'] = (-0.1, 0, 0)
    o['hips'] = (0, 0.03 * sw, -0.09 * sw)
    o['spine'] = (lean * 0.5, -0.02 * sw, 0.06 * sw)
    o['chest'] = (lean * 0.5 + 0.015 * S(p, 2), 0, 0.07 * sw)
    o['neck'] = (-lean * 0.4, 0, -0.06 * sw)
    o['head'] = (-lean * 0.4, 0, -0.04 * sw)
    # 長袍前襟被腿推開，後襬往後飄
    o['robe_F_L_1'] = (min(0.0, -A * sw) * 0.55 - cloth * 0.3, 0, -0.05 * run)
    o['robe_F_R_1'] = (min(0.0, A * sw) * 0.55 - cloth * 0.3, 0, 0.05 * run)
    o['robe_F_L_2'] = (-0.25 * A * S(p, 1, -0.12), 0, 0)
    o['robe_F_R_2'] = (0.25 * A * S(p, 1, -0.12), 0, 0)
    o['robe_B_1'] = (cloth + 0.04 * S(p, 2, -0.1), 0.04 * sw, 0)
    o['robe_B_2'] = (cloth * 0.6 + 0.08 * S(p, 2, -0.25), 0, 0)
    o['scarf_F_1'] = (-scarf * 0.45 - 0.05 * pos(S(p, 2, -0.1)), 0, 0.05 * sw)
    o['scarf_F_2'] = (-scarf * 0.2 + 0.08 * S(p, 2, -0.25), 0, 0)
    o['scarf_F_3'] = (-scarf * 0.1 + 0.1 * S(p, 2, -0.4), 0, 0)
    o['scarf_B_1'] = (scarf * 0.6 + 0.04 * S(p, 2, -0.1), 0, 0)
    o['scarf_B_2'] = (scarf * 0.3 + 0.08 * S(p, 2, -0.3), 0, 0)
    o['scarf_B_3'] = (scarf * 0.2 + 0.1 * S(p, 2, -0.45), 0, 0)
    o['hood'] = (0.05 * S(p, 2, -0.2) + cloth * 0.3, 0, 0)
    o['bag'] = (0.05 + 0.25 * run + 0.08 * (1 + run) * S(p, 2, -0.15), 0, 0.05 * sw)
    loc = (0, 0, -bob * abs(sw) + (0.035 * run * (1 - abs(sw))))
    return o, loc


def idle(p):
    b = S(p)
    o = {
        'chest': (0.015 * b, 0, 0), 'spine': (0.01, 0, 0), 'head': (-0.01 * b, 0, 0),
        'upperarm_L': (-0.04, -0.07 - 0.01 * b, 0), 'upperarm_R': (-0.04, 0.07 + 0.01 * b, 0),
        'forearm_L': (-0.14 - 0.02 * b, 0, 0), 'forearm_R': (-0.18 - 0.02 * b, 0, 0),
        'hips': (0, 0.025 * S(p, 1, 0.25), 0), 'thigh_L': (0, -0.02 * S(p, 1, 0.25), 0), 'thigh_R': (0, -0.02 * S(p, 1, 0.25), 0),
        'scarf_F_1': (0.02 * S(p, 2), 0, 0), 'scarf_F_3': (0.04 * S(p, 2, -0.2), 0, 0),
        'robe_B_2': (0.02 * S(p, 1, 0.3), 0, 0),
    }
    return o, (0.012 * S(p, 1, 0.25), 0, 0.004 * b)


def walk(p):
    return gait(p, A=0.46, K=0.78, arm_a=0.32, fore=0.22, lean=0.05, bob=0.028, cloth=0.08, scarf=0.12, run=0)


def run(p):
    return gait(p, A=0.82, K=1.55, arm_a=0.68, fore=1.2, lean=0.22, bob=0.05, cloth=0.32, scarf=0.55, run=1)


def jump(p):
    w = S(p)
    o = {
        'thigh_L': (-0.75, 0, 0), 'thigh_R': (0.22, 0, 0), 'shin_L': (1.05, 0, 0), 'shin_R': (0.5, 0, 0),
        'foot_L': (-0.2, 0, 0), 'foot_R': (0.35, 0, 0),
        'upperarm_L': (0.15, -0.85 - 0.04 * w, 0), 'upperarm_R': (0.15, 0.85 + 0.04 * w, 0),
        'forearm_L': (-0.45, 0, 0), 'forearm_R': (-0.45, 0, 0), 'spine': (0.06, 0, 0), 'head': (-0.06, 0, 0),
        'robe_B_1': (0.18, 0, 0), 'robe_B_2': (0.12, 0, 0), 'robe_F_L_1': (-0.55, 0, 0), 'robe_F_R_1': (-0.1, 0, 0),
        'scarf_F_1': (-0.3 + 0.05 * w, 0, 0), 'scarf_B_1': (-0.15, 0, 0),
    }
    return o, (0, 0, 0)


def fall(p):
    w, w2 = S(p), S(p, 2)
    o = {
        'thigh_L': (-0.35 + 0.12 * w, 0, -0.04), 'thigh_R': (-0.1 - 0.12 * w, 0, 0.04), 'shin_L': (0.55, 0, 0), 'shin_R': (0.4, 0, 0),
        'foot_L': (0.25, 0, 0), 'foot_R': (0.3, 0, 0),
        'upperarm_L': (-0.2 + 0.1 * w, -1.15 - 0.08 * w2, 0), 'upperarm_R': (-0.2 - 0.1 * w, 1.15 + 0.08 * w2, 0),
        'forearm_L': (-0.35, 0, 0), 'forearm_R': (-0.35, 0, 0), 'spine': (-0.04, 0, 0), 'head': (0.05, 0, 0),
        'robe_B_1': (0.5 + 0.08 * w2, 0, 0), 'robe_B_2': (0.35 + 0.12 * S(p, 2, -0.2), 0, 0),
        'robe_F_L_1': (-0.5 - 0.08 * w2, 0, 0), 'robe_F_R_1': (-0.5 - 0.08 * S(p, 2, 0.3), 0, 0),
        'robe_F_L_2': (-0.3, 0, 0), 'robe_F_R_2': (-0.3, 0, 0),
        'scarf_F_1': (-0.9 + 0.1 * w2, 0, 0.1 * w), 'scarf_F_2': (-0.3, 0, 0), 'scarf_B_1': (-0.5, 0, 0), 'hood': (-0.3, 0, 0),
    }
    return o, (0, 0, 0)


def land(p):
    o = {
        'thigh_L': (-0.95, 0, -0.06), 'thigh_R': (-0.95, 0, 0.06), 'shin_L': (1.55, 0, 0), 'shin_R': (1.55, 0, 0),
        'foot_L': (-0.6, 0, 0), 'foot_R': (-0.6, 0, 0), 'hips': (0.12, 0, 0), 'spine': (0.22, 0, 0), 'chest': (0.1, 0, 0),
        'head': (-0.3, 0, 0), 'upperarm_L': (-0.45, -0.35, 0), 'upperarm_R': (-0.45, 0.35, 0),
        'forearm_L': (-0.5, 0, 0), 'forearm_R': (-0.5, 0, 0),
        'robe_F_L_1': (-0.45, 0, 0), 'robe_F_R_1': (-0.45, 0, 0), 'robe_B_1': (0.2, 0, 0),
        'scarf_F_1': (-0.2, 0, 0),
    }
    return o, (0, -0.03, -0.2)


def broom_ride(p):
    w, w2 = S(p), S(p, 3)
    o = {
        'hips': (0.12, 0, 0), 'spine': (0.25 + 0.02 * w, 0, 0), 'chest': (0.2, 0, 0), 'neck': (-0.25, 0, 0), 'head': (-0.3, 0, 0),
        'thigh_L': (-1.15, -0.2, 0), 'thigh_R': (-1.15, 0.2, 0), 'shin_L': (1.85, 0, 0), 'shin_R': (1.85, 0, 0),
        'foot_L': (0.2, 0, 0), 'foot_R': (0.2, 0, 0),
        'upperarm_L': (-1.05, 0.28, 0), 'upperarm_R': (-1.05, -0.28, 0), 'forearm_L': (-0.4, 0, 0), 'forearm_R': (-0.4, 0, 0),
        'hand_L': (0.2, 0, 0), 'hand_R': (0.2, 0, 0),
        'robe_F_L_1': (-0.9, 0, -0.2), 'robe_F_R_1': (-0.9, 0, 0.2), 'robe_F_L_2': (0.3 + 0.08 * w2, 0, 0), 'robe_F_R_2': (0.3 + 0.08 * S(p, 3, 0.3), 0, 0),
        'robe_B_1': (0.9 + 0.06 * w2, 0, 0), 'robe_B_2': (0.3 + 0.15 * S(p, 3, -0.2), 0, 0),
        'scarf_F_1': (-0.55 + 0.1 * w2, 0, 0.15 * S(p, 2)), 'scarf_F_2': (0.3 + 0.2 * S(p, 3, -0.2), 0, 0), 'scarf_F_3': (0.2 + 0.25 * S(p, 3, -0.4), 0, 0),
        'scarf_B_1': (0.9 + 0.08 * w2, 0, 0), 'scarf_B_2': (0.3 + 0.2 * S(p, 3, -0.25), 0, 0), 'scarf_B_3': (0.2 + 0.25 * S(p, 3, -0.45), 0, 0),
        'hood': (0.5 + 0.1 * w2, 0, 0), 'bag': (-0.9, 0, 0),
    }
    return o, (0, 0.02, -0.12 + 0.01 * w)


def swim(p):
    st = S(p)
    o = {
        'thigh_L': (0.28 * st, 0, 0), 'thigh_R': (-0.28 * st, 0, 0), 'shin_L': (0.3 + 0.25 * st, 0, 0), 'shin_R': (0.3 - 0.25 * st, 0, 0),
        'foot_L': (0.5, 0, 0), 'foot_R': (0.5, 0, 0),
        'upperarm_L': (-2.5 + 0.75 * st, -0.3, 0), 'upperarm_R': (-2.5 - 0.75 * st, 0.3, 0),
        'forearm_L': (-0.25 - 0.2 * pos(st), 0, 0), 'forearm_R': (-0.25 - 0.2 * pos(-st), 0, 0),
        'neck': (-0.45, 0, 0), 'head': (-0.5, 0, 0), 'spine': (0.08, 0, 0.06 * st), 'chest': (0, 0, 0.06 * st),
        'robe_B_1': (0.15 + 0.05 * S(p, 2), 0, 0), 'robe_B_2': (0.15 + 0.08 * S(p, 2, -0.2), 0, 0),
        'scarf_F_1': (-0.3 + 0.1 * S(p, 2), 0, 0), 'scarf_B_1': (0.4, 0, 0),
    }
    return o, (0, 0, 0.012 * S(p, 2))


def lumos(p):
    o = {'upperarm_R': (-0.95, 0.1, 0), 'forearm_R': (-0.85, 0, 0), 'hand_R': (0.15, 0, 0)}
    return o, (0, 0, 0)


ACTIONS = [('idle', idle, 75), ('walk', walk, 24), ('run', run, 18), ('jump', jump, 30), ('fall', fall, 24),
           ('land', land, 2), ('broom', broom_ride, 60), ('swim', swim, 36), ('lumos', lumos, 2)]

ad = arm.animation_data_create()
pbs = arm.pose.bones
for b in pbs:
    b.rotation_mode = 'QUATERNION'


def apply_pose(fn, p):
    o, loc = fn(p)
    for b in pbs:
        b.rotation_quaternion = basis_quat(b.name, o.get(b.name, (0, 0, 0)))
        b.location = (0, 0, 0)
    pbs['hips'].location = REST['hips'].inverted() @ Vector(loc)


made = {}
for name, fn, n in ACTIONS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    frames_ = sorted(set(list(range(0, n + 1, 2)) + [n]))
    for fr in frames_:
        apply_pose(fn, fr / n)
        for b in pbs:
            b.keyframe_insert('rotation_quaternion', frame=fr, group=b.name)
        pbs['hips'].keyframe_insert('location', frame=fr, group='hips')
    tr = ad.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
    tr.mute = True
    made[name] = act
    ad.action = None
for b in pbs:
    b.rotation_quaternion = (1, 0, 0, 0)
    b.location = (0, 0, 0)
bpy.context.view_layer.update()
print(f'[student] actions={[a[0] for a in ACTIONS]}')


# ---------------------------------------------------------------- 預覽算繪
def setup_render():
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_cavity = True
    sh.show_shadows = True
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('bg')
    world.color = (0.62, 0.66, 0.7)
    scene.world = world
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 85
    cam = bpy.data.objects.new('cam', cam_data)
    coll.objects.link(cam)
    scene.camera = cam
    return cam


def aim(cam, tgt, ang, dist, up=0.12):
    d = Vector((math.sin(ang), -math.cos(ang), up)).normalized()
    cam.location = tgt + d * dist
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()


def sheet(paths, out_path):
    import numpy as np
    imgs = []
    for p in paths:
        im = bpy.data.images.load(p)
        a = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32)
        im.pixels.foreach_get(a)
        imgs.append(a.reshape(im.size[1], im.size[0], 4))
    sh = np.concatenate(imgs, axis=1)
    out = bpy.data.images.new('sheet', sh.shape[1], sh.shape[0], alpha=True)
    out.pixels.foreach_set(sh.ravel())
    out.filepath_raw = out_path
    out.file_format = 'PNG'
    out.save()
    print(f'[student] preview {out_path}')


def set_action(act, frame):
    ad.action = act
    if act is not None and hasattr(ad, 'action_slot') and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    scene.frame_set(frame)
    bpy.context.view_layer.update()


def render_previews(prefix):
    cam = setup_render()
    scene.render.resolution_x = 520
    scene.render.resolution_y = 860
    broom.hide_render = True
    paths = []
    for name, ang in (('front', 0), ('three_quarter', -0.75), ('side', -math.pi / 2), ('back', math.pi), ('face', -0.35)):
        dist, tgt = (1.25, Vector((0, 0, 1.66))) if name == 'face' else (5.6, Vector((0, 0, 0.92)))
        aim(cam, tgt, ang, dist, 0.05 if name == 'face' else 0.12)
        scene.render.filepath = f'{prefix}_{name}.png'
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet(paths, f'{prefix}_sheet.png')
    # 動畫：側面看每個片段的幾個瞬間
    scene.render.resolution_x = 420
    scene.render.resolution_y = 700
    shots = [('walk', 0), ('walk', 6), ('walk', 12), ('run', 0), ('run', 5), ('idle', 0), ('jump', 0), ('fall', 6),
             ('land', 0), ('broom', 0), ('swim', 9), ('lumos', 0)]
    paths = []
    for i, (name, fr) in enumerate(shots):
        set_action(made[name], fr)
        broom.hide_render = name != 'broom'
        aim(cam, Vector((0, 0, 0.9)), -1.15, 5.4)
        scene.render.filepath = f'{prefix}_anim_{i:02d}.png'
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet(paths, f'{prefix}_anim.png')
    set_action(None, 0)
    for b in pbs:
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)
    broom.hide_render = False
    bpy.data.objects.remove(cam)


if args.preview:
    render_previews(args.preview)

# ---------------------------------------------------------------- 匯出
if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
ad.action = None
for ob in bpy.data.objects:
    ob.select_set(ob in (arm, body, broom, tip_obj))
out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animation_mode='ACTIONS')
print(f'[student] exported {out} {os.path.getsize(out) / 1024:.0f} KB')
