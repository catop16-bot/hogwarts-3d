"""動物與奇獸：四足（貓、狗、鷹馬、夜騏、人馬、老鼠）、鳥（貓頭鷹、鳳凰）與蟾蜍。

每種動物有自己的骨架與動作片段，一起匯出（不像人形角色共用動畫）。
座標同 body.py：Blender Z 朝上、面向 -Y；單位公尺。姿勢的軸也與 rig.py 相同（X 負 = 往前擺）。
"""
import math
import random

from mathutils import Vector

from lib import FRONT, TAU, UP, Geo, box, lerp, rev, sphere, tube
from rig import S, C, pos

# ---------------------------------------------------------------- 參數
QUAD = dict(
    L=0.4, H=0.22, W=0.05, r=0.08, nl=0.08, na=0.6, hs=0.07, snout=0.03, ears='cat', tail='cat', tl=0.3, leg=0.022,
    feet='paw', wings=None, span=0.0, head='cat', fluff=1.0, centaur=False,
    body=0x6a5e52, belly=None, headc=None, wing=None, mane=None, eye=0xd8b030, nose=0x3a2a2a, hoof=0x2a2420, talon=0xc8a050,
    hair=0xf0e8c8, skin=0xe8c4a0,
)

ANIMALS = {
    'norris': dict(kind='quad', L=0.36, H=0.2, W=0.045, r=0.062, hs=0.06, tl=0.3, body=0x6a5e52, belly=0x8a7e70, eye=0xe0b830),
    'crookshanks': dict(kind='quad', L=0.4, H=0.22, W=0.05, r=0.085, hs=0.075, snout=0.0, tl=0.26, fluff=1.35, body=0xd2803a,
                        belly=0xe8a860, eye=0xe0b030, tail='bush'),
    'fang': dict(kind='quad', L=0.75, H=0.55, W=0.1, r=0.16, nl=0.18, na=0.75, hs=0.14, snout=0.13, ears='droop', tail='dog',
                 tl=0.4, leg=0.045, head='dog', body=0x1d1b19, eye=0x3a2a1a, nose=0x0c0b0a),
    'buckbeak': dict(kind='quad', L=1.5, H=1.15, W=0.24, r=0.33, nl=0.45, na=0.55, hs=0.22, snout=0.0, ears='none',
                     tail='horse', tl=0.7, leg=0.075, feet='hoof', front='talon', head='eagle', wings='feather', span=4.4,
                     body=0x7a7880, headc=0xb8b6b0, wing=0x8a8890, mane=0x5a5860, eye=0xe08020, talon=0xc0a050, hoof=0x2a2826),
    'thestral': dict(kind='quad', L=1.45, H=1.3, W=0.2, r=0.22, nl=0.55, na=0.5, hs=0.3, snout=0.22, ears='horse', tail='thin',
                     tl=0.9, leg=0.05, feet='hoof', head='dragon', wings='bat', span=4.0, body=0x17140f, wing=0x231d18,
                     eye=0xeeeee6, nose=0x0c0a08, hoof=0x0c0a08),
    'firenze': dict(kind='quad', L=1.4, H=1.15, W=0.22, r=0.3, nl=0.0, hs=0.0, ears='none', tail='horse', tl=0.75, leg=0.07,
                    feet='hoof', head='none', centaur=True, body=0xd8b46a, mane=0xf0e8c8, hair=0xf2ead0, skin=0xe8c6a2,
                    eye=0x3a6aa8, hoof=0x3a3026),
    'scabbers': dict(kind='quad', L=0.12, H=0.04, W=0.022, r=0.032, nl=0.02, na=1.0, hs=0.028, snout=0.03, ears='round',
                     tail='thin', tl=0.14, leg=0.008, head='rat', body=0x6a5a4a, belly=0x8a7a6a, eye=0x0c0a08, nose=0xd89090),
    'hedwig': dict(kind='bird', size=0.55, body=0xf2f0ea, speck=0x2a2622, eye=0xe8c020, beak=0x1a1816, owl=True),
    'owl_a': dict(kind='bird', size=0.45, body=0x7a5a3a, speck=0x3a2a1c, eye=0x1a1410, beak=0x3a3020, owl=True),
    'owl_b': dict(kind='bird', size=0.42, body=0xc8a878, face=0xf2ece0, speck=0x8a6a4a, eye=0x1a1410, beak=0xc8b8a0, owl=True),
    'fawkes': dict(kind='bird', size=0.6, body=0xb8221a, wing=0xc8401a, tailc=0xe0a020, eye=0x0c0a08, beak=0xd8b030, owl=False),
    'trevor': dict(kind='toad', size=0.1, body=0x5a6a3a, belly=0xa8a070, eye=0xc8a030),
}


# ================================================================ 四足
def quad_bones(p):
    L, H, W = p['L'], p['H'], p['W']
    na = p['na']
    nb = Vector((0, -L * 0.45, H + p['r'] * 0.3))
    ne = nb + Vector((0, -math.sin(na) * p['nl'], math.cos(na) * p['nl']))
    he = ne + Vector((0, -p['hs'] * 1.4 - p['snout'], -p['hs'] * 0.3))
    B = [
        ('root', (0, 0, 0), (0, 0, 0.1 * max(H, 0.3)), None),
        ('hips', (0, L * 0.45, H), (0, 0, H), 'root'),
        ('chest', (0, 0, H), (0, -L * 0.45, H), 'hips'),
        ('tail1', (0, L * 0.5, H), (0, L * 0.5 + p['tl'] * 0.5, H - p['tl'] * 0.15), 'hips'),
        ('tail2', (0, L * 0.5 + p['tl'] * 0.5, H - p['tl'] * 0.15), (0, L * 0.5 + p['tl'], H - p['tl'] * 0.35), 'tail1'),
    ]
    if p['nl'] > 0:
        B += [('neck', tuple(nb), tuple(ne), 'chest'), ('head', tuple(ne), tuple(he), 'neck')]
    for s, sd in ((1, 'L'), (-1, 'R')):
        for fb, y, par in (('F', -L * 0.38, 'chest'), ('B', L * 0.38, 'hips')):
            B += [(f'leg{fb}{sd}1', (W * s, y, H), (W * s, y + (0.02 if fb == 'F' else -0.03) * H, H * 0.48), par),
                  (f'leg{fb}{sd}2', (W * s, y + (0.02 if fb == 'F' else -0.03) * H, H * 0.48), (W * s, y, 0.02 * H), f'leg{fb}{sd}1')]
        if p['wings']:
            sp = p['span'] / 2
            r0 = Vector((W * 0.9 * s, -L * 0.18, H + p['r'] * 0.8))
            B += [(f'wing{sd}1', tuple(r0), tuple(r0 + Vector((sp * 0.45 * s, 0.05, 0.05))), 'chest'),
                  (f'wing{sd}2', tuple(r0 + Vector((sp * 0.45 * s, 0.05, 0.05))), tuple(r0 + Vector((sp * s, 0.18, 0.0))), f'wing{sd}1')]
    if p['centaur']:
        t0 = Vector((0, -L * 0.5, H + p['r'] * 0.5))
        B += [('torso', tuple(t0), tuple(t0 + Vector((0, -0.02, 0.55))), 'chest'),
              ('neck', tuple(t0 + Vector((0, -0.02, 0.55))), tuple(t0 + Vector((0, -0.025, 0.65))), 'torso'),
              ('head', tuple(t0 + Vector((0, -0.025, 0.65))), tuple(t0 + Vector((0, -0.03, 0.93))), 'neck')]
        for s, sd in ((1, 'L'), (-1, 'R')):
            sh = t0 + Vector((0.2 * s, 0, 0.5))
            B += [(f'upperarm{sd}', tuple(sh), tuple(sh + Vector((0.05 * s, 0, -0.28))), 'torso'),
                  (f'forearm{sd}', tuple(sh + Vector((0.05 * s, 0, -0.28))), tuple(sh + Vector((0.08 * s, -0.02, -0.54))), f'upperarm{sd}')]
    return B


def quad_geo(p, G, rng):
    L, H, W, r = p['L'], p['H'], p['W'], p['r']
    fl = p['fluff']
    fur = lambda a, t: 1 + (0.06 * (fl - 1) * math.sin(13 * a + 7 * t) if fl > 1 else 0)
    # 身體：從臀部到胸口的橢圓截面，肚子顏色另做一片
    rings = []
    for i in range(7):
        t = i / 6
        y = lerp(L * 0.58, -L * 0.55, t)
        k = math.sin(math.pi * (0.12 + 0.8 * t)) ** 0.5
        rings.append(((0, y, H + r * 0.15), W * 0.4 + r * fl * k, r * fl * 1.05 * k + 0.002))
    v, f, fr = tube(rings, 14, cap0=True, cap1=True, ref=UP, mod=fur)
    G.add(v, f, 'body', ['hips', 'chest'])
    if p['belly']:
        v, f, _ = tube([(Vector(c) - Vector((0, 0, rx * 0.06)), rx * 0.92, ry * 0.98) for c, rx, ry in rings[1:-1]], 10,
                       arc=lambda t: (math.pi - 0.9, math.pi + 0.9), ref=UP)
        G.add(v, f, 'belly', ['hips', 'chest'])
    # 腿：前腿直、後腿有往後的關節
    for s, sd in ((1, 'L'), (-1, 'R')):
        for fb, y in (('F', -L * 0.38), ('B', L * 0.38)):
            x = W * s
            knee = Vector((x, y + (0.02 if fb == 'F' else -0.03) * H, H * 0.48))
            top = Vector((x, y, H + r * 0.2))
            foot = Vector((x, y, 0.02 * H))
            lr = p['leg'] * (1.25 if fl > 1 else 1)
            thick = 1.6 if fb == 'B' else 1.3
            mat = 'talon' if (fb == 'F' and p.get('front') == 'talon') else 'body'
            v, f, _ = tube([(top, lr * thick * 1.4, lr * thick * 1.6), (top.lerp(knee, 0.6), lr * thick, lr * thick * 1.1), (knee, lr, lr),
                            (knee.lerp(foot, 0.7), lr * 0.85, lr * 0.85), (foot + Vector((0, 0, lr)), lr * 0.8, lr * 0.8)], 8)
            G.add(v, f, mat, ['hips' if fb == 'B' else 'chest', f'leg{fb}{sd}1', f'leg{fb}{sd}2'])
            if mat == 'talon':
                # 鷹爪：三根往前的爪
                for k in (-1, 0, 1):
                    v, f, _ = tube([(foot + Vector((k * lr * 0.6, 0, lr * 0.5)), lr * 0.35, lr * 0.35),
                                    (foot + Vector((k * lr * 1.2, -lr * 2.6, 0.0)), lr * 0.12, lr * 0.12)], 5, cap1=True, ref=UP)
                    G.add(v, f, 'beak', [f'leg{fb}{sd}2'])
            elif p['feet'] == 'hoof':
                v, f, _ = tube([(foot + Vector((0, 0, lr * 0.9)), lr * 0.95, lr * 0.95), (foot - Vector((0, 0.01, 0)), lr * 1.1, lr * 1.2)], 8, cap1=True, ref=FRONT)
                G.add(v, f, 'hoof', [f'leg{fb}{sd}2'])
            else:
                v, f = sphere(foot + Vector((0, -lr * 0.5, lr * 0.5)), (lr * 1.2, lr * 1.7, lr * 0.8), 8, 5)
                G.add(v, f, 'body', [f'leg{fb}{sd}2'])
    # 尾巴
    t0 = Vector((0, L * 0.55, H + r * 0.3))
    tl = p['tl']
    if p['tail'] in ('cat', 'bush'):
        pts = [(t0, 0.016 * (3 if p['tail'] == 'bush' else 1), 0.016 * (3 if p['tail'] == 'bush' else 1))]
        for k in range(1, 6):
            t = k / 5
            pts.append((t0 + Vector((0, tl * 0.55 * t, tl * (0.15 * t + 0.5 * t * t) - tl * 0.25 * t)),
                        (0.014 - 0.006 * t) * (2.6 if p['tail'] == 'bush' else 1), (0.014 - 0.006 * t) * (2.6 if p['tail'] == 'bush' else 1)))
        v, f, _ = tube(pts, 8, cap1=True, ref=UP)
        G.add(v, f, 'body', ['hips', 'tail1', 'tail2'])
    elif p['tail'] in ('dog', 'thin'):
        pts = [(t0 + Vector((0, tl * t, -tl * 0.55 * t * t)), lerp(p['leg'] * 0.7, p['leg'] * 0.2, t), lerp(p['leg'] * 0.7, p['leg'] * 0.2, t)) for t in (0, 0.33, 0.66, 1)]
        v, f, _ = tube(pts, 6, cap1=True, ref=UP)
        G.add(v, f, 'body', ['hips', 'tail1', 'tail2'])
        if p['tail'] == 'thin' and p['L'] > 0.5:
            v, f = sphere(pts[-1][0], (0.04, 0.08, 0.04), 6, 4)
            G.add(v, f, 'body', ['tail2'])
    elif p['tail'] == 'horse':
        v, f, _ = tube([(t0, 0.06, 0.05), (t0 + Vector((0, 0.15, -0.12)), 0.09, 0.07), (t0 + Vector((0, 0.22, -tl * 0.6)), 0.08, 0.06),
                        (t0 + Vector((0, 0.24, -tl)), 0.03, 0.03)], 8, cap1=True, ref=UP, mod=lambda a, t: 1 + 0.12 * math.sin(9 * a))
        G.add(v, f, 'mane', ['hips', 'tail1', 'tail2'])

    # 頭與脖子
    if p['nl'] > 0 and p['head'] != 'none':
        na, hs = p['na'], p['hs']
        nb = Vector((0, -L * 0.45, H + r * 0.3))
        ne = nb + Vector((0, -math.sin(na) * p['nl'], math.cos(na) * p['nl']))
        v, f, _ = tube([(nb + Vector((0, 0.03, -r * 0.3)), r * 0.6 * fl, r * 0.65 * fl), (nb.lerp(ne, 0.5), hs * 0.6 * fl, hs * 0.65 * fl), (ne, hs * 0.55, hs * 0.6)], 10, ref=FRONT)
        G.add(v, f, 'body', ['chest', 'neck', 'head'])
        if p['mane'] and p['head'] != 'eagle':
            v, f, _ = tube([(nb + Vector((0, 0.06, r * 0.4)), 0.02, hs * 0.5), (ne + Vector((0, 0.04, hs * 0.4)), 0.02, hs * 0.4)], 4, ref=FRONT)
            G.add(v, f, 'mane', ['chest', 'neck', 'head'])
        hc = ne + Vector((0, -hs * 0.35, 0))
        hb = ['head']
        hcol = 'headc' if p['headc'] else 'body'
        kind = p['head']
        if kind in ('cat', 'rat'):
            v, f = sphere(hc, (hs * 1.0 * fl, hs * 0.95, hs * 0.85 * fl), 12, 8)
            G.add(v, f, 'body', hb)
            if p['snout'] > 0:
                v, f = sphere(hc + Vector((0, -hs * 0.8, -hs * 0.25)), (hs * 0.45, p['snout'] * (1.5 if kind == 'rat' else 1), hs * 0.35), 8, 6)
                G.add(v, f, 'body', hb)
            nose = hc + Vector((0, -hs * 0.95 - p['snout'] * (1.3 if kind == 'rat' else 0.8), -hs * 0.18))
            v, f = sphere(nose, (hs * 0.14, hs * 0.1, hs * 0.1), 6, 4)
            G.add(v, f, 'nose', hb)
        elif kind == 'dog':
            v, f = sphere(hc, (hs * 0.9, hs * 0.95, hs * 0.9), 12, 8)
            G.add(v, f, 'body', hb)
            sn = hc + Vector((0, -hs * 0.9, -hs * 0.25))
            v, f, _ = tube([(hc + Vector((0, -hs * 0.4, -hs * 0.2)), hs * 0.55, hs * 0.5), (sn, hs * 0.45, hs * 0.42), (sn + Vector((0, -p['snout'] * 0.7, -0.01)), hs * 0.38, hs * 0.35)], 10, cap1=True, ref=UP)
            G.add(v, f, 'body', hb)
            v, f = sphere(sn + Vector((0, -p['snout'] * 0.75, 0.02)), (hs * 0.18, hs * 0.12, hs * 0.13), 6, 4)
            G.add(v, f, 'nose', hb)
        elif kind == 'eagle':
            v, f = sphere(hc, (hs * 0.9, hs * 1.1, hs * 0.95), 12, 8)
            G.add(v, f, hcol, hb)
            bk = hc + Vector((0, -hs * 0.9, -hs * 0.1))
            v, f, _ = tube([(bk, hs * 0.3, hs * 0.35), (bk + Vector((0, -hs * 0.45, -hs * 0.05)), hs * 0.18, hs * 0.2),
                            (bk + Vector((0, -hs * 0.7, -hs * 0.35)), hs * 0.03, hs * 0.03)], 8, cap1=True, ref=UP)
            G.add(v, f, 'beak', hb)
            # 頸羽：白色羽毛一路蓋到肩膀
            v, f, _ = tube([(nb + Vector((0, -0.02, r * 0.2)), r * 0.72, r * 0.75), (ne, hs * 0.7, hs * 0.75)], 12, ref=FRONT, mod=lambda a, t: 1 + 0.1 * math.sin(11 * a + 4 * t))
            G.add(v, f, hcol, ['chest', 'neck', 'head'])
        elif kind == 'dragon':
            # 夜騏：骨感、長吻的爬蟲類臉
            v, f, _ = tube([(hc + Vector((0, hs * 0.3, 0.02)), hs * 0.42, hs * 0.48), (hc, hs * 0.38, hs * 0.42), (hc + Vector((0, -hs * 0.9, -hs * 0.2)), hs * 0.22, hs * 0.24),
                            (hc + Vector((0, -hs * 1.4, -hs * 0.32)), hs * 0.12, hs * 0.13)], 10, cap0=True, cap1=True, ref=UP)
            G.add(v, f, 'body', hb)
        # 眼睛
        if kind != 'none':
            for s in (1, -1):
                ex = hs * (0.48 if kind in ('cat', 'rat') else 0.42)
                ey = -hs * (0.7 if kind in ('cat', 'rat') else 0.55)
                er = hs * (0.2 if kind == 'cat' else 0.13 if kind != 'dragon' else 0.16)
                v, f = sphere(hc + Vector((ex * s, ey, hs * 0.18)), (er, er * 0.7, er), 8, 6)
                G.add(v, f, 'eye', hb)
                if kind not in ('dragon',):
                    v, f = sphere(hc + Vector((ex * s * 1.02, ey - er * 0.55, hs * 0.18)), (er * 0.45, er * 0.25, er * 0.6 if kind == 'cat' else er * 0.45), 6, 4)
                    G.add(v, f, 'pupil', hb)
        # 耳朵
        e = p['ears']
        for s in (1, -1):
            if e == 'cat':
                b0 = hc + Vector((hs * 0.5 * s, -hs * 0.05, hs * 0.55))
                v, f, _ = tube([(b0, hs * 0.28, hs * 0.12), (b0 + Vector((hs * 0.08 * s, hs * 0.02, hs * 0.45)), 0.002, 0.002)], 5, cap0=True, ref=FRONT)
                G.add(v, f, 'body', hb)
            elif e == 'droop':
                b0 = hc + Vector((hs * 0.75 * s, 0, hs * 0.4))
                v, f, _ = tube([(b0, hs * 0.1, hs * 0.35), (b0 + Vector((hs * 0.15 * s, 0, -hs * 0.6)), hs * 0.08, hs * 0.3), (b0 + Vector((hs * 0.15 * s, 0, -hs * 0.9)), 0.002, hs * 0.1)], 6, cap1=True, ref=FRONT)
                G.add(v, f, 'body', hb)
            elif e == 'horse':
                b0 = hc + Vector((hs * 0.32 * s, hs * 0.3, hs * 0.38))
                v, f, _ = tube([(b0, hs * 0.1, hs * 0.07), (b0 + Vector((hs * 0.06 * s, hs * 0.1, hs * 0.35)), 0.002, 0.002)], 5, cap0=True, ref=FRONT)
                G.add(v, f, 'body', hb)
            elif e == 'round':
                v, f = sphere(hc + Vector((hs * 0.6 * s, hs * 0.1, hs * 0.6)), (hs * 0.32, hs * 0.08, hs * 0.32), 8, 5)
                G.add(v, f, 'nose', hb)

    # 翅膀：收在背上（姿勢裡再展開）
    if p['wings']:
        sp = p['span'] / 2
        for s, sd in ((1, 'L'), (-1, 'R')):
            r0 = Vector((W * 0.9 * s, -L * 0.18, H + r * 0.8))
            m1 = r0 + Vector((sp * 0.45 * s, 0.05, 0.05))
            tip = r0 + Vector((sp * s, 0.18, 0.0))
            bones = ['chest', f'wing{sd}1', f'wing{sd}2']
            if p['wings'] == 'feather':
                # 前緣骨架加一片羽面，後緣做成鋸齒
                pts = []
                n = 8
                for k in range(n + 1):
                    t = k / n
                    a = r0.lerp(m1, min(1, t * 2)) if t < 0.5 else m1.lerp(tip, (t - 0.5) * 2)
                    chord = lerp(0.55, 0.25, t) * sp / 2.2
                    pts.append((a, a + Vector((0, chord * (1 + 0.15 * (k % 2)), -0.02))))
                verts = [q for pr in pts for q in pr]
                faces = [(2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1) for k in range(n)]
                if s < 0:
                    faces = rev(faces)
                G.add(verts, faces, 'wing', bones)
                G.add(verts, rev(faces), 'wing', bones)
            else:
                # 蝙蝠翼：細骨加深色的膜
                fingers = [m1 + Vector((sp * 0.55 * s, 0.1, 0.02)), m1 + Vector((sp * 0.4 * s, 0.4, -0.05)), m1 + Vector((sp * 0.2 * s, 0.6, -0.08))]
                body_end = r0 + Vector((0, L * 0.5, -0.05))
                outline = [r0, m1] + fingers + [body_end]
                verts = [tuple(q) for q in outline]
                faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5)] if s > 0 else [(0, 2, 1), (0, 3, 2), (0, 4, 3), (0, 5, 4)]
                G.add(verts, faces, 'wing', bones)
                G.add(verts, rev(faces), 'wing', bones)
                for q in [m1] + fingers:
                    v, f, _ = tube([(r0 if q is m1 else m1, 0.012, 0.012), (q, 0.006, 0.006)], 5, ref=UP)
                    G.add(v, f, 'body', bones)

    # 人馬的上半身
    if p['centaur']:
        t0 = Vector((0, -L * 0.5, H + r * 0.5))
        TB = ['chest', 'torso']
        v, f, _ = tube([(t0 + Vector((0, 0.04, -0.12)), r * 0.85, r * 0.9), (t0 + Vector((0, 0, 0.1)), 0.17, 0.13), (t0 + Vector((0, -0.01, 0.35)), 0.2, 0.13),
                        (t0 + Vector((0, -0.015, 0.5)), 0.21, 0.12), (t0 + Vector((0, -0.02, 0.56)), 0.12, 0.09), (t0 + Vector((0, -0.02, 0.62)), 0.05, 0.05)], 14, ref=FRONT)
        G.add(v, f, 'skin', TB + ['neck'])
        hc = t0 + Vector((0, -0.03, 0.77))
        v, f = sphere(hc, (0.12, 0.125, 0.14), 14, 10, shape=lambda q: Vector((q.x * (1 - 0.2 * max(0, -q.z) / 0.14), q.y, q.z)))
        G.add(v, f, 'skin', ['head'])
        for s in (1, -1):
            v, f = sphere(hc + Vector((0.042 * s, -0.112, 0.01)), (0.02, 0.01, 0.015), 8, 5)
            G.add(v, f, 'eyewhite', ['head'])
            v, f = sphere(hc + Vector((0.042 * s, -0.12, 0.01)), (0.01, 0.004, 0.011), 6, 4)
            G.add(v, f, 'eye', ['head'])
        v, f = sphere(hc + Vector((0, -0.125, -0.025)), (0.012, 0.012, 0.022), 6, 4)
        G.add(v, f, 'skin', ['head'])
        # 長長的淡金色頭髮
        v, f = sphere(hc + Vector((0, 0.01, 0.02)), (0.13, 0.135, 0.145), 14, 10, keep=lambda q: q.z > hc.z - 0.02 or q.y > hc.y + 0.02)
        G.add(v, f, 'hair', ['head'])
        v, f, _ = tube([(hc + Vector((0, 0.03, 0.0)), 0.13, 0.12), (hc + Vector((0, 0.06, -0.2)), 0.15, 0.1), (hc + Vector((0, 0.08, -0.42)), 0.12, 0.06)], 12,
                       arc=lambda t: (1.6, TAU - 1.6), ref=FRONT)
        G.add(v, f, 'hair', ['head', 'neck', 'torso'])
        G.add(v, rev(f), 'hair', ['head', 'neck', 'torso'])
        for s, sd in ((1, 'L'), (-1, 'R')):
            sh = t0 + Vector((0.2 * s, 0, 0.5))
            el = sh + Vector((0.05 * s, 0, -0.28))
            wr = sh + Vector((0.08 * s, -0.02, -0.54))
            v, f, _ = tube([(sh + Vector((-0.03 * s, 0, 0.02)), 0.055, 0.055), (el, 0.042, 0.042), (wr, 0.034, 0.034), (wr + Vector((0, -0.01, -0.09)), 0.028, 0.02)], 8, cap1=True)
            G.add(v, f, 'skin', ['torso', f'upperarm{sd}', f'forearm{sd}'])


def quad_poses(p):
    wings = bool(p['wings'])
    cen = p['centaur']
    H = p['H']

    def base(ph):
        b = S(ph)
        o = {'chest': (0.01 * b, 0, 0), 'tail1': (0, 0.25 * S(ph, 1, 0.2), 0), 'tail2': (0, 0.3 * S(ph, 1, 0.05), 0),
             'neck': (0, 0, 0.15 * S(ph, 0.5)), 'head': (0.05 * b, 0, 0.2 * S(ph, 0.5, 0.1))}
        if wings:
            for s, sd in ((1, 'L'), (-1, 'R')):
                o[f'wing{sd}1'] = (0, 0.35 * s, 1.35 * s)
                o[f'wing{sd}2'] = (0, 0.25 * s, 1.5 * s)
        if cen:
            o['upperarmL'] = (-0.42, -0.08, -0.85)
            o['upperarmR'] = (-0.47, 0.08, 0.85)
            o['forearmL'] = (-1.85, 0, 0)
            o['forearmR'] = (-1.8, 0, 0)
            o['torso'] = (0.02 * b, 0, 0)
        return o

    def idle(ph):
        return base(ph), (0, 0, 0.004 * H * S(ph))

    def walk(ph):
        o = base(ph * 2)
        sw, cw = S(ph), C(ph)
        A, K = 0.42, 0.6
        o['legFL1'] = (-A * sw, 0, 0)
        o['legBR1'] = (-A * sw, 0, 0)
        o['legFR1'] = (A * sw, 0, 0)
        o['legBL1'] = (A * sw, 0, 0)
        o['legFL2'] = (K * pos(cw), 0, 0)
        o['legBR2'] = (-K * 0.6 * pos(cw), 0, 0)
        o['legFR2'] = (K * pos(-cw), 0, 0)
        o['legBL2'] = (-K * 0.6 * pos(-cw), 0, 0)
        o['neck'] = (0.06 * S(ph, 2), 0, 0)
        if cen:
            o['upperarmL'] = (0.2 * sw, -0.08, 0)
            o['upperarmR'] = (-0.2 * sw, 0.08, 0)
            o['forearmL'] = (-0.3, 0, 0)
            o['forearmR'] = (-0.3, 0, 0)
        return o, (0, 0, 0.02 * H * abs(S(ph, 2)))

    def sit(ph):
        # 貓坐：前半身抬起、後腿收在身體下面
        o = base(ph)
        o['hips'] = (-0.75, 0, 0)
        o['legBL1'] = (-1.1, 0, 0)
        o['legBR1'] = (-1.1, 0, 0)
        o['legBL2'] = (1.9, 0, 0)
        o['legBR2'] = (1.9, 0, 0)
        o['legFL1'] = (0.75, 0, 0)
        o['legFR1'] = (0.75, 0, 0)
        o['neck'] = (0.35, 0, 0.15 * S(ph, 0.5))
        o['tail1'] = (0.9, 0.3, 0)
        o['tail2'] = (0.4, 0.4 * S(ph, 1, 0.2), 0)
        return o, (0, 0, -H * 0.45)

    def lie(ph):
        o = base(ph)
        for sd in 'LR':
            o[f'legF{sd}1'] = (-1.35, 0, 0)
            o[f'legF{sd}2'] = (0.2, 0, 0)
            o[f'legB{sd}1'] = (-1.5, 0.15 if sd == 'L' else -0.15, 0)
            o[f'legB{sd}2'] = (2.4, 0, 0)
        o['neck'] = (0.25 + 0.03 * S(ph), 0, 0.2 * S(ph, 0.5))
        o['tail1'] = (0.5, 0.3, 0)
        return o, (0, 0, -H * 0.62)

    def graze(ph):
        o = base(ph)
        o['neck'] = (1.05 + 0.05 * S(ph, 2), 0, 0.1 * S(ph, 0.5))
        o['head'] = (0.3, 0, 0)
        return o, (0, 0, 0)

    def fly(ph):
        o = base(ph)
        f = S(ph)
        for s, sd in ((1, 'L'), (-1, 'R')):
            o[f'wing{sd}1'] = (0, -0.75 * f * s, 0.1 * s)
            o[f'wing{sd}2'] = (0, -0.35 * S(ph, 1, -0.1) * s, 0)
            o[f'legF{sd}1'] = (-1.0, 0, 0)
            o[f'legF{sd}2'] = (1.3, 0, 0)
            o[f'legB{sd}1'] = (1.0, 0, 0)
            o[f'legB{sd}2'] = (0.6, 0, 0)
        o['neck'] = (-0.2, 0, 0)
        o['tail1'] = (-0.4, 0, 0)
        return o, (0, 0, 0.12 * f)

    acts = [('idle', idle, 120), ('walk', walk, 30 if H < 0.5 else 40)]
    if p['head'] in ('cat', 'rat'):
        acts.append(('sit', sit, 120))
    acts.append(('lie', lie, 150))
    if p['L'] > 1.0 and not cen:
        acts.append(('graze', graze, 120))
    if wings:
        acts.append(('fly', fly, 24))
    return acts


# ================================================================ 鳥
def bird_bones(p):
    k = p['size']
    B = [
        ('root', (0, 0, 0), (0, 0, 0.05 * k), None),
        ('hips', (0, 0.06 * k, 0.12 * k), (0, -0.01 * k, 0.55 * k), 'root'),
        ('head', (0, -0.01 * k, 0.55 * k), (0, -0.03 * k, 0.85 * k), 'hips'),
        ('tail1', (0, 0.08 * k, 0.15 * k), (0, 0.2 * k, 0.02 * k), 'hips'),
    ]
    for s, sd in ((1, 'L'), (-1, 'R')):
        B += [(f'wing{sd}1', (0.15 * k * s, 0, 0.45 * k), (0.55 * k * s, 0.05 * k, 0.48 * k), 'hips'),
              (f'wing{sd}2', (0.55 * k * s, 0.05 * k, 0.48 * k), (1.0 * k * s, 0.15 * k, 0.45 * k), f'wing{sd}1')]
    return B


def bird_geo(p, G, rng):
    k = p['size']
    owl = p['owl']
    # 身體：上窄下寬的蛋形
    v, f, _ = tube([((0, 0.02 * k, 0.1 * k), 0.08 * k, 0.07 * k), ((0, 0.0, 0.25 * k), 0.17 * k, 0.15 * k), ((0, -0.01, 0.42 * k), 0.16 * k, 0.14 * k),
                    ((0, -0.01 * k, 0.55 * k), 0.12 * k, 0.11 * k)], 14, cap0=True, ref=FRONT)
    G.add(v, f, 'body', ['hips', 'tail1'])
    hc = Vector((0, -0.02 * k, 0.66 * k))
    hr = (0.15 if owl else 0.1) * k
    v, f = sphere(hc, (hr, hr * 0.95, hr * (0.9 if owl else 1.0)), 12, 8)
    G.add(v, f, 'body', ['head'])
    if p.get('face'):
        v, f = sphere(hc + Vector((0, -hr * 0.45, 0)), (hr * 0.85, hr * 0.5, hr * 0.85), 12, 8, keep=lambda q: q.y < hc.y - hr * 0.2)
        G.add(v, f, 'face', ['head'])
    for s in (1, -1):
        er = hr * (0.28 if owl else 0.16)
        v, f = sphere(hc + Vector((hr * 0.42 * s, -hr * 0.82, hr * 0.12)), (er, er * 0.5, er), 8, 5)
        G.add(v, f, 'eye', ['head'])
        v, f = sphere(hc + Vector((hr * 0.43 * s, -hr * 0.9, hr * 0.12)), (er * 0.45, er * 0.3, er * 0.45), 6, 4)
        G.add(v, f, 'pupil', ['head'])
    bk = hc + Vector((0, -hr * 0.9, -hr * (0.15 if owl else 0)))
    v, f, _ = tube([(bk, hr * 0.12, hr * 0.15), (bk + Vector((0, -hr * (0.18 if owl else 0.5), -hr * (0.25 if owl else 0.1))), 0.003, 0.003)], 6, cap0=True, cap1=True, ref=UP)
    G.add(v, f, 'beak', ['head'])
    if not owl:
        # 鳳凰頭上的冠羽與長長的金色尾羽
        for j in range(3):
            v, f, _ = tube([(hc + Vector((0, 0.02 * j * k, hr * 0.8)), 0.012 * k, 0.012 * k), (hc + Vector((0, (0.08 + 0.05 * j) * k, hr * 1.6)), 0.003, 0.003)], 4, cap1=True, ref=FRONT)
            G.add(v, f, 'tailc', ['head'])
        for j in range(5):
            a = (j - 2) * 0.12
            v, f, _ = tube([((0, 0.06 * k, 0.12 * k), 0.025 * k, 0.012 * k), ((math.sin(a) * 0.3 * k, 0.55 * k, -0.25 * k), 0.035 * k, 0.008 * k),
                            ((math.sin(a) * 0.5 * k, 0.95 * k, -0.45 * k), 0.005, 0.004)], 5, cap1=True, ref=UP)
            G.add(v, f, 'tailc', ['tail1'])
    else:
        v, f, _ = tube([((0, 0.06 * k, 0.12 * k), 0.08 * k, 0.03 * k), ((0, 0.16 * k, 0.0), 0.06 * k, 0.015 * k)], 6, cap1=True, ref=UP)
        G.add(v, f, 'body', ['tail1'])
    # 翅膀：收著時貼在身體兩側
    for s, sd in ((1, 'L'), (-1, 'R')):
        r0 = Vector((0.15 * k * s, 0, 0.45 * k))
        m1 = Vector((0.55 * k * s, 0.05 * k, 0.48 * k))
        tip = Vector((1.0 * k * s, 0.15 * k, 0.45 * k))
        pts = []
        n = 6
        for j in range(n + 1):
            t = j / n
            a = r0.lerp(m1, min(1, t * 2)) if t < 0.5 else m1.lerp(tip, (t - 0.5) * 2)
            pts.append((a, a + Vector((0, lerp(0.32, 0.18, t) * k, -0.03 * k))))
        verts = [q for pr in pts for q in pr]
        faces = [(2 * j, 2 * j + 2, 2 * j + 3, 2 * j + 1) for j in range(n)]
        if s < 0:
            faces = rev(faces)
        mat = 'wing' if p.get('wing') else 'body'
        G.add(verts, faces, mat, ['hips', f'wing{sd}1', f'wing{sd}2'])
        G.add(verts, rev(faces), mat, ['hips', f'wing{sd}1', f'wing{sd}2'])
        # 爪
        v, f = sphere((0.05 * k * s, -0.03 * k, 0.1 * k), (0.03 * k, 0.04 * k, 0.02 * k), 6, 4)
        G.add(v, f, 'beak', ['hips'])
    # 嘿美身上的黑色斑點
    if p.get('speck'):
        for _ in range(26):
            a = rng.uniform(-1.2, 1.2) + (math.pi if rng.random() < 0.5 else 0)
            z = rng.uniform(0.15, 0.5) * k
            rr = (0.155 if z < 0.4 * k else 0.15) * k
            v, f = sphere((math.sin(a) * rr, -math.cos(a) * rr * 0.9, z), (0.012 * k, 0.006 * k, 0.008 * k), 4, 3)
            G.add(v, f, 'speck', ['hips'])


def bird_poses(p):
    def fold(o, ph):
        for s, sd in ((1, 'L'), (-1, 'R')):
            o[f'wing{sd}1'] = (0, 1.1 * s, 1.45 * s)
            o[f'wing{sd}2'] = (0, 0.2 * s, 2.0 * s)
        return o

    def idle(ph):
        # 停著：偶爾轉頭（貓頭鷹可以轉很大）
        turn = (1.4 if p['owl'] else 0.6) * max(-1, min(1, 2.5 * S(ph, 1, 0.1))) * (1 if S(ph, 2) > -0.3 else 0.3)
        o = fold({'head': (0.05 * S(ph, 3), 0, turn), 'hips': (0.02 * S(ph, 2), 0, 0)}, ph)
        return o, (0, 0, 0)

    def fly(ph):
        f = S(ph)
        o = {'hips': (1.2, 0, 0), 'head': (-1.0, 0, 0), 'tail1': (-0.3, 0, 0)}
        for s, sd in ((1, 'L'), (-1, 'R')):
            # 身體往前倒 1.2 弧度，翅膀要轉回水平
            o[f'wing{sd}1'] = (-1.2, -0.8 * f * s, 0)
            o[f'wing{sd}2'] = (0, -0.4 * S(ph, 1, -0.12) * s, 0)
        return o, (0, 0, 0.03 * p['size'] * f)

    return [('idle', idle, 240), ('fly', fly, 16)]


# ================================================================ 蟾蜍
def toad_bones(p):
    k = p['size']
    return [('root', (0, 0, 0), (0, 0, 0.05 * k), None), ('hips', (0, 0.3 * k, 0.35 * k), (0, -0.3 * k, 0.4 * k), 'root')]


def toad_geo(p, G, rng):
    k = p['size']
    v, f = sphere((0, 0, 0.32 * k), (0.42 * k, 0.5 * k, 0.3 * k), 12, 8, shape=lambda q: Vector((q.x, q.y, q.z * (1.2 if q.y < 0 else 1))))
    G.add(v, f, 'body', ['hips'])
    v, f = sphere((0, -0.05 * k, 0.18 * k), (0.36 * k, 0.4 * k, 0.12 * k), 10, 6)
    G.add(v, f, 'belly', ['hips'])
    for s in (1, -1):
        v, f = sphere((0.2 * k * s, -0.3 * k, 0.55 * k), (0.11 * k, 0.11 * k, 0.1 * k), 8, 6)
        G.add(v, f, 'eye', ['hips'])
        v, f = sphere((0.22 * k * s, -0.38 * k, 0.56 * k), (0.05 * k, 0.03 * k, 0.06 * k), 6, 4)
        G.add(v, f, 'pupil', ['hips'])
        for fy in (-0.25, 0.3):
            v, f = sphere((0.42 * k * s, fy * k, 0.08 * k), (0.15 * k, 0.2 * k, 0.07 * k), 6, 4)
            G.add(v, f, 'body', ['hips'])
    for _ in range(14):
        a = rng.uniform(0, TAU)
        v, f = sphere((math.sin(a) * 0.32 * k, math.cos(a) * 0.38 * k, 0.5 * k), (0.03 * k, 0.03 * k, 0.02 * k), 4, 3)
        G.add(v, f, 'belly', ['hips'])


def toad_poses(p):
    def idle(ph):
        return {'hips': (0.03 * S(ph, 4), 0, 0)}, (0, 0, 0.004 * S(ph, 4))
    return [('idle', idle, 90)]


# ================================================================ 入口
def build_animal(key):
    p = dict(QUAD)
    p.update(ANIMALS[key])
    rng = random.Random(hash(key) & 0xffff)
    kind = p['kind']
    if kind == 'quad':
        bones = quad_bones(p)
    elif kind == 'bird':
        bones = bird_bones(p)
    else:
        bones = toad_bones(p)
    segs = {b[0]: (Vector(b[1]), Vector(b[2])) for b in bones}
    G = Geo(segs)
    if kind == 'quad':
        quad_geo(p, G, rng)
        acts = quad_poses(p)
    elif kind == 'bird':
        bird_geo(p, G, rng)
        acts = bird_poses(p)
    else:
        toad_geo(p, G, rng)
        acts = toad_poses(p)
    mats = [
        ('body', p['body'], 0.85, False), ('belly', p.get('belly') or p['body'], 0.85, False),
        ('headc', p.get('headc') or p['body'], 0.85, False), ('wing', p.get('wing') or p['body'], 0.85, True),
        ('mane', p.get('mane') or p['body'], 0.85, True), ('eye', p['eye'], 0.3, False), ('pupil', 0x080706, 0.3, False),
        ('eyewhite', 0xf2f0ea, 0.3, False), ('nose', p.get('nose', 0x3a2a2a), 0.5, False), ('hoof', p.get('hoof', 0x2a2420), 0.6, False),
        ('talon', p.get('talon', 0xc8a050), 0.6, False), ('beak', p.get('beak', 0x2a2420), 0.5, False), ('tailc', p.get('tailc', 0xe0a020), 0.7, True),
        ('face', p.get('face', 0xf2ece0), 0.85, False), ('speck', p.get('speck', 0x2a2622), 0.85, False),
        ('skin', p.get('skin', 0xe8c4a0), 0.62, False), ('hair', p.get('hair', 0xf0e8c8), 0.55, True),
    ]
    height = max(q.z for q in G.v)
    return G, bones, mats, acts, height
