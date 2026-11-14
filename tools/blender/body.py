"""依角色參數（specs.py）產生人形角色的網格與骨頭權重。

原本 student.py 的學生（設計圖上的造型）是預設值；其他角色改參數：身高、體型、膚色、髮型、鬍子、
眼鏡、帽子、服裝（學生長袍／教授長袍／大衣）、配件。
"""
import math
import random

from mathutils import Matrix, Vector

from lib import (DOWN, FRONT, TAU, UP, Geo, box, lerp, rev, sat, smooth, sphere, strap, torus, tube, xf, resample)
from rig import bone_list

HOUSE_COLORS = [(0x7a0d15, 0xd9a521), (0xc79a12, 0x1c1a17), (0x14306e, 0x9a7a45), (0x0f4a26, 0xa9adb3)]

DEFAULTS = dict(
    scale=1.0, legs=1.0, girth=1.0, belly=0.0, head=1.0, shoulders=1.0, female=False,
    skin=0xeec4a2, hair=0x16130f, iris=0x3b2a1a, lip=0xc07a6a, brow=None,
    hair_style='messy', hair_len=1.5, hair_seed=11, fringe=True,
    beard=None, beard_color=None, beard_len=1.3, moustache=False,
    glasses=None, nose=1.0, hook=0.0, ears=1.0,
    outfit='student', house=0, robe=0x2a2b31, lining=None, under=0x6b6c70, shirt=0xece9e2,
    trousers=0x2c2d31, boot=0x6a4426, hem=None, closed=False, hood=None, buttons=False,
    tie=None, crest=None, bag=None, gloves=False, skirt=0x55565b, dress=None,
    mouth='smile', eyes=1.0, ruff=False, rope=False, apron=None, shawl=None, badge=False, hat=None, hat_color=None, hat_tip=0.0, prop='wand', prop_color=None, wand=0x4a2c16,
)

MAT_DEFS = [
    # 名稱, 預設色, 粗糙度, 雙面
    ('robe', 0x2a2b31, 0.78, False), ('sweater', 0x6b6c70, 0.95, False), ('sweater_rib', 0x5c5d61, 0.95, False),
    ('trousers', 0x2c2d31, 0.85, False), ('shirt', 0xece9e2, 0.7, True), ('skin', 0xeec4a2, 0.62, False),
    ('hair', 0x16130f, 0.55, True), ('beard', 0x16130f, 0.6, True), ('boot', 0x6a4426, 0.5, False), ('sole', 0x2a1c12, 0.8, False),
    ('sock', 0x77777a, 0.95, False), ('glove', 0x3d3d40, 0.9, False), ('leather', 0x7a4f2c, 0.6, True),
    ('leather_dark', 0x4e3120, 0.6, True), ('metal', 0xb8975a, 0.35, False), ('frame', 0x1e1e20, 0.3, True),
    ('patch', 0x5d4a86, 0.8, False), ('eye', 0xf2f0ea, 0.3, False), ('iris', 0x3b2a1a, 0.3, False), ('lip', 0xc07a6a, 0.6, False),
    ('wood', 0x4a2c16, 0.55, False), ('straw', 0x8a6a32, 0.95, True), ('skirt', 0x55565b, 0.9, True), ('hat', 0x2a2b31, 0.8, True),
    ('prop', 0xd77fa1, 0.7, True), ('apron', 0xeeeae2, 0.85, True), ('shawl', 0x8a4a6a, 0.95, True), ('house_primary', 0x7a0d15, 0.85, True), ('house_secondary', 0xd9a521, 0.8, True),
]


def material_table(sp):
    hp, hs = HOUSE_COLORS[sp['house']]
    lining = sp['lining']
    col = {
        'robe': sp['robe'], 'sweater': sp['under'], 'sweater_rib': dim(sp['under'], 0.88), 'trousers': sp['trousers'],
        'shirt': sp['shirt'], 'skin': sp['skin'], 'hair': sp['hair'], 'beard': sp['beard_color'] or sp['hair'],
        'boot': sp['boot'], 'iris': sp['iris'], 'lip': sp['lip'], 'skirt': sp['skirt'],
        'hat': sp['hat_color'] or sp['robe'], 'apron': sp['apron'] or 0xeeeae2, 'shawl': sp['shawl'] or 0x8a4a6a, 'prop': sp['prop_color'] or 0xd77fa1, 'wood': sp['wand'],
        'house_primary': hp if lining is None else lining, 'house_secondary': hs,
    }
    return [(n, col.get(n, c), r, d) for n, c, r, d in MAT_DEFS]


def dim(h, k):
    r, g, b = (h >> 16) & 255, (h >> 8) & 255, h & 255
    return (int(r * k) << 16) | (int(g * k) << 8) | int(b * k)


def build(spec):
    sp = dict(DEFAULTS)
    sp.update(spec)
    student = sp['outfit'] == 'student'
    elf = sp['outfit'] == 'elf'
    if sp['hem'] is None:
        sp['hem'] = 0.38 if student else (0.24 if sp['outfit'] == 'coat' else 0.07)
    for k, dv in (('hood', student), ('tie', student), ('crest', student), ('bag', student)):
        if sp[k] is None:
            sp[k] = dv
    HEM = sp['hem']
    BONES = bone_list(HEM)
    SEG = {b[0]: (Vector(b[1]), Vector(b[2])) for b in BONES}
    G = Geo(SEG)
    rng = random.Random(sp['hair_seed'])
    extra = {}

    # ------------------------------------------------------------ 腿、襪子、靴子
    for s, sd in ((1, 'L'), (-1, 'R')):
        x = 0.088 * s
        LEG = ['hips', f'thigh.{sd}', f'shin.{sd}']
        legs = [((x, 0, 0.98), 0.082, 0.08), ((x, 0, 0.78), 0.077, 0.074), ((x, 0.003, 0.52), 0.064, 0.063),
                ((x, 0.005, 0.34), 0.057, 0.057), ((x, 0.006, 0.24), 0.054, 0.055)]
        if sp['female']:
            legs = [(c, rx * 0.86, ry * 0.86) for c, rx, ry in legs]
        if elf:
            legs = [(c, rx * 0.55, ry * 0.55) for c, rx, ry in legs]
        v, f, _ = tube(legs, 12)
        G.add(v, f, 'trousers', LEG)
        if student:
            v, f, _ = tube([((x, 0.006, 0.17), 0.06, 0.062), ((x, 0.006, 0.205), 0.068, 0.07), ((x, 0.006, 0.235), 0.069, 0.071),
                            ((x, 0.006, 0.258), 0.06, 0.062)], 12)
            G.add(v, f, 'sock', [f'shin.{sd}'])
        v, f, _ = tube([((x, 0.008, 0.05), 0.066, 0.07), ((x, 0.007, 0.12), 0.064, 0.066), ((x, 0.006, 0.185), 0.061, 0.063)], 12)
        G.add(v, f, 'boot', [f'shin.{sd}', f'foot.{sd}'])
        bt = [((x, 0.082, 0.06), 0.044, 0.05), ((x, 0.055, 0.065), 0.054, 0.06), ((x, -0.01, 0.06), 0.058, 0.055),
              ((x, -0.08, 0.05), 0.058, 0.045), ((x, -0.145, 0.045), 0.053, 0.04), ((x, -0.19, 0.04), 0.044, 0.034),
              ((x, -0.212, 0.036), 0.026, 0.02)]
        v, f, _ = tube(bt, 14, cap0=True, cap1=True, ref=UP, clampz=0.02)
        G.add(v, f, 'boot', [f'foot.{sd}'])
        sole = [((x, 0.088, 0.012), 0.047, 0.014), ((x, 0.05, 0.012), 0.058, 0.014), ((x, -0.08, 0.012), 0.062, 0.014),
                ((x, -0.19, 0.012), 0.048, 0.014), ((x, -0.222, 0.012), 0.026, 0.012)]
        v, f, _ = tube(sole, 12, cap0=True, cap1=True, ref=UP, clampz=0.0)
        G.add(v, f, 'sole', [f'foot.{sd}'])
        if student:
            for k in range(4):
                yy = -0.02 - 0.03 * k
                v, f = box((x, yy - 0.002, 0.105 - 0.012 * k), (0.05, 0.008, 0.006), (-0.5, 0, 0))
                G.add(v, f, 'leather_dark', [f'foot.{sd}'])

    # ------------------------------------------------------------ 裙子（女生的百褶裙、女教授的長裙）
    if sp['female'] and student:
        sk = [((0, 0.0, 0.97), 0.172, 0.128), ((0, 0.004, 0.8), 0.215, 0.165), ((0, 0.008, 0.62), 0.25, 0.195)]
        v, f, _ = tube(sk, 28, mod=lambda a, t: 1 + 0.05 * t * abs(math.sin(7 * a)))
        G.add(v, f, 'skirt', ['hips', 'thigh.L', 'thigh.R'])
        G.add(v, rev(f), 'skirt', ['hips', 'thigh.L', 'thigh.R'])
    if elf:
        # 小精靈的枕頭套：從胸口套到膝蓋，下襬參差不齊
        tu = [((0, 0.0, 1.0), 0.16, 0.12), ((0, 0.004, 0.8), 0.19, 0.15), ((0, 0.008, 0.6), 0.2, 0.16)]
        v, f, _ = tube(tu, 16, zoff=lambda a, t: -0.04 * t * abs(math.sin(5 * a)))
        G.add(v, f, 'sweater', ['hips', 'thigh.L', 'thigh.R'])
        G.add(v, rev(f), 'sweater', ['hips', 'thigh.L', 'thigh.R'])
    if sp['dress'] is not None:
        dr = [((0, 0.0, 0.97), 0.172, 0.128), ((0, 0.006, 0.6), 0.25, 0.2), ((0, 0.01, 0.12), 0.3, 0.25)]
        v, f, _ = tube(dr, 24)
        G.add(v, f, 'skirt', ['hips', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R'])

    # ------------------------------------------------------------ 襯衫下襬、皮帶、毛衣（或教授的內衣）
    if student:
        v, f, _ = tube([((0, 0.002, 0.94), 0.169, 0.124), ((0, 0.004, 0.895), 0.176, 0.13), ((0, 0.006, 0.855), 0.181, 0.134)], 16)
        G.add(v, f, 'shirt', ['hips', 'thigh.L', 'thigh.R'])
        v, f, _ = tube([((0, 0, 0.928), 0.173, 0.127), ((0, 0, 0.97), 0.172, 0.126)], 16)
        G.add(v, f, 'leather_dark', ['hips'])
        v, f = box((0, -0.129, 0.949), (0.036, 0.008, 0.032))
        G.add(v, f, 'metal', ['hips'])
    sweater = [((0, 0, 0.955), 0.168, 0.122), ((0, 0, 1.05), 0.161, 0.115), ((0, 0, 1.15), 0.157, 0.11),
               ((0, 0, 1.25), 0.172, 0.115), ((0, 0, 1.35), 0.19, 0.118), ((0, 0, 1.42), 0.196, 0.112),
               ((0, 0.002, 1.47), 0.152, 0.096), ((0, 0.004, 1.51), 0.07, 0.062)]
    v, f, _ = tube(sweater, 16, cap0=True)
    G.add(v, f, 'sweater', ['hips', 'spine', 'chest', 'upperarm.L', 'upperarm.R'])
    if student:
        v, f, _ = tube([((0, 0, 0.952), 0.174, 0.128), ((0, 0, 0.985), 0.172, 0.126)], 16, mod=lambda a, t: 1 + 0.008 * math.sin(36 * a))
        G.add(v, f, 'sweater_rib', ['hips', 'spine'])
    # 領口：V 領露出的襯衫與領子（教授是高領）
    if sp['closed']:
        v, f, _ = tube([((0, 0.006, 1.47), 0.075, 0.068), ((0, 0.008, 1.56), 0.066, 0.062)], 12)
        G.add(v, f, 'shirt', ['chest', 'neck'])
    else:
        G.add([(-0.042, -0.113, 1.515), (0.042, -0.113, 1.515), (0.0, -0.121, 1.385)], [(0, 2, 1)], 'shirt', ['chest'])
        for s in (1, -1):
            G.add([(0.01 * s, -0.122, 1.515), (0.062 * s, -0.104, 1.522), (0.026 * s, -0.124, 1.46)], [(0, 1, 2) if s > 0 else (0, 2, 1)], 'shirt', ['chest'])
    if sp['tie']:
        tie = resample([((0, -0.125, 1.505), 0.012, 0.005), ((0, -0.129, 1.45), 0.017, 0.005), ((0, -0.133, 1.35), 0.022, 0.005)], 0.022)
        tie.append(((0, -0.133, 1.33), 0.003, 0.004))
        v, f, fr = tube(tie, 6, cap0=True, cap1=True)
        G.add(v, f, 'house_primary', ['chest'], fmats=['house_secondary' if fr[i] % 2 else 'house_primary' for i in range(len(f))])

    # ------------------------------------------------------------ 長袍上半身
    robe_top = [((0, 0, 0.95), 0.178, 0.13), ((0, 0, 1.05), 0.173, 0.125), ((0, 0, 1.15), 0.169, 0.121),
                ((0, 0, 1.25), 0.186, 0.127), ((0, 0, 1.35), 0.208, 0.131), ((0, 0, 1.42), 0.222, 0.128), ((0, 0.002, 1.455), 0.205, 0.118),
                ((0, 0.003, 1.48), 0.165, 0.103), ((0, 0.005, 1.51), 0.108, 0.088), ((0, 0.006, 1.535), 0.1, 0.082)]
    TORSO = ['hips', 'spine', 'chest', 'upperarm.L', 'upperarm.R']
    closed = sp['closed']

    def top_gap(t):
        return (0.05 + 0.25 * t ** 3) if closed else (0.3 + 0.34 * t ** 2.2)

    def lapel(t):
        return 0.05 if closed else 0.11 + 0.5 * t ** 3

    v, f, _ = tube(robe_top, 20, arc=lambda t: (top_gap(t), TAU - top_gap(t)))
    G.add(v, f, 'robe', TORSO)
    v, f, _ = tube([(c, rx * 0.985, ry * 0.985) for c, rx, ry in robe_top], 20, arc=lambda t: (top_gap(t), TAU - top_gap(t)))
    G.add(v, rev(f), 'house_primary', TORSO)
    big = [(c, rx * 1.012, ry * 1.012) for c, rx, ry in robe_top]
    for lo, hi in ((lambda t: top_gap(t) - 0.012, lambda t: top_gap(t) + lapel(t)), (lambda t: TAU - top_gap(t) - lapel(t), lambda t: TAU - top_gap(t) + 0.012)):
        v, f, _ = tube(big, 3, arc=lambda t, lo=lo, hi=hi: (lo(t), hi(t)))
        G.add(v, f, 'house_primary', TORSO)

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

    def robe_top_r(z):
        p = robe_at(z, math.pi / 2, 1.0)
        q = robe_at(z, 0, 1.0)
        return abs(p.x), abs(q.y)

    collar = [((0, 0.01, 1.485), 0.13, 0.108), ((0, 0.016, 1.515), 0.138, 0.114), ((0, 0.024, 1.54), 0.158, 0.13)]
    v, f, _ = tube(collar, 14, arc=lambda t: (0.75, TAU - 0.75))
    G.add(v, f, 'robe', ['chest', 'neck'])
    v, f, _ = tube([(c, rx * 0.96, ry * 0.96) for c, rx, ry in collar], 14, arc=lambda t: (0.75, TAU - 0.75))
    G.add(v, rev(f), 'house_primary', ['chest', 'neck'])

    # ------------------------------------------------------------ 長袍下襬
    SKIRT = ['hips', 'robe.F.L.1', 'robe.F.L.2', 'robe.F.R.1', 'robe.F.R.2', 'robe.B.1', 'robe.B.2']
    flare = 0.385 if HEM > 0.3 else 0.43
    nring = 7 if HEM > 0.3 else 9
    skirt = []

    def skirt_ring(t):
        rx = 0.18 + (flare - 0.18) * t ** 1.1
        return ((0, 0.012 * t, 1.06 - (1.06 - HEM) * t), rx, rx * (0.73 + 0.1 * t))

    for i in range(nring):
        skirt.append(skirt_ring(i / (nring - 1)))

    def skirt_gap(t):
        return (0.05 + 0.04 * t) if closed else (0.3 + 0.2 * t)

    def folds(a, t):
        return 1 + 0.065 * t * math.sin(9 * a + 0.6) + 0.025 * t * math.sin(4 * a)

    def hem(a, t):
        return -0.04 * t * (1 - math.cos(a)) / 2

    SK_ARC = lambda t: (skirt_gap(t), TAU - skirt_gap(t))
    v, f, _ = tube(skirt, 28, arc=SK_ARC, mod=folds, zoff=hem)
    G.add(v, f, 'robe', SKIRT)
    v, f, _ = tube([(c, rx * 0.985, ry * 0.985) for c, rx, ry in skirt], 28, arc=SK_ARC, mod=folds, zoff=hem)
    G.add(v, rev(f), 'house_primary', SKIRT)
    if student:
        hem_rings = []
        for k in range(2):
            c, rx, ry = skirt_ring(0.965 + 0.035 * k)
            hem_rings.append((c, rx * 1.008, ry * 1.008))
        v, f, _ = tube(hem_rings, 28, arc=lambda t: SK_ARC(0.965 + 0.035 * t), mod=lambda a, t: folds(a, 0.965 + 0.035 * t), zoff=lambda a, t: hem(a, 0.965 + 0.035 * t))
        G.add(v, f, 'house_primary', SKIRT)
    bigs = [(c, rx * 1.01, ry * 1.01) for c, rx, ry in skirt]
    for lo, hi in ((lambda g: g - 0.01, lambda g: g + 0.06), (lambda g: TAU - g - 0.06, lambda g: TAU - g + 0.01)):
        v, f, _ = tube(bigs, 2, arc=lambda t, lo=lo, hi=hi: (lo(skirt_gap(t)), hi(skirt_gap(t))), mod=folds, zoff=hem)
        G.add(v, f, 'house_primary', SKIRT)

    # 排釦：石內卜那種從領口一路扣到腰的小釦子
    if sp['buttons']:
        for k in range(14):
            z = 1.5 - k * 0.04
            p = robe_at(z, 0, 1.0) + Vector((0, -0.006, 0))
            v, f = sphere(p, (0.007, 0.005, 0.007), 6, 4)
            G.add(v, f, 'robe', ['chest', 'spine', 'hips'])

    # 大衣的口袋（海格）
    if sp['outfit'] == 'coat':
        for s in (1, -1):
            for z, a in ((0.88, 0.75), (0.7, 0.85)):
                c = skirt_ring((1.06 - z) / (1.06 - HEM))
                rx, ry = c[1], c[2]
                p = Vector((rx * math.sin(a * s) * 1.03, -ry * math.cos(a) * 1.03, z))
                v, f = box(p, (0.09, 0.01, 0.1), (0, 0, a * s))
                G.add(v, f, 'leather', ['hips', f'robe.F.{"L" if s > 0 else "R"}.1'])

    # 圍裙：從胸口垂到小腿，蓋在長袍前面（龐芮夫人、芽菜教授、羅斯默塔夫人）
    if sp['apron']:
        rings = []
        for z, k in ((1.36, 1.035), (1.25, 1.04), (1.1, 1.045), (0.97, 1.05)):
            c = robe_at(z, 0, 1.0)
            rings.append(((0, 0, z), robe_top_r(z)[0] * k, robe_top_r(z)[1] * k))
        n = 6
        for i in range(1, n + 1):
            c = skirt_ring(min(1.0, i / n * (1.06 - max(HEM, 0.3)) / (1.06 - HEM)))
            rings.append((c[0], c[1] * 1.045, c[2] * 1.045))
        v, f, _ = tube(rings, 10, arc=lambda t: (-0.85 - 0.25 * t, 0.85 + 0.25 * t), mod=lambda a, t: folds(a, t) if t > 0.4 else 1.0)
        G.add(v, f, 'apron', ['chest', 'spine', 'hips', 'robe.F.L.1', 'robe.F.R.1', 'robe.F.L.2', 'robe.F.R.2'])
        G.add(v, rev(f), 'apron', ['chest', 'spine', 'hips', 'robe.F.L.1', 'robe.F.R.1', 'robe.F.L.2', 'robe.F.R.2'])
    # 披肩：圍住肩膀、前面垂成 V 字（崔老妮教授）
    if sp['shawl']:
        rings = [((0, 0.004, 1.52), 0.13, 0.11), ((0, 0.002, 1.47), 0.235, 0.15), ((0, 0, 1.4), 0.262, 0.165), ((0, 0, 1.3), 0.258, 0.168)]
        v, f, _ = tube(rings, 20, zoff=lambda a, t: -0.16 * t * ((math.cos(a) + 1) / 2) ** 2, mod=lambda a, t: 1 + 0.03 * math.sin(10 * a) * t)
        G.add(v, f, 'shawl', TORSO)
        G.add(v, rev(f), 'shawl', TORSO)
        for k, z in enumerate((1.44, 1.4, 1.35)):
            v, f = torus((0, -0.004, z), 0.11 + 0.012 * k, 0.006, (1, 0, 0), (0, 0.55, 0.83), U=16, V=4)
            G.add(v, f, 'metal', ['chest'])
    # 修士的繩腰帶
    if sp['rope']:
        v, f = torus((0, 0, 1.0), robe_top_r(1.0)[0] * 1.02, 0.012, (1, 0, 0), (0, 0.73, 0), U=20, V=5)
        G.add(v, f, 'leather', ['hips', 'spine'])
        for s_ in (-1, 1):
            v, f, _ = tube([((0.03 * s_, -robe_top_r(1.0)[1] - 0.01, 0.99), 0.012, 0.012), ((0.04 * s_, -robe_top_r(0.8)[1] - 0.04, 0.75), 0.01, 0.01)], 5, cap1=True, ref=UP)
            G.add(v, f, 'leather', ['hips', 'robe.F.L.1' if s_ > 0 else 'robe.F.R.1'])
    # 伊莉莎白時代的輪狀皺領（差點沒頭的尼克）
    if sp['ruff']:
        rings = [((0, 0.006, 1.47), 0.07, 0.065), ((0, 0.006, 1.5), 0.17, 0.15), ((0, 0.006, 1.53), 0.07, 0.065)]
        v, f, _ = tube(rings, 36, mod=lambda a, t: 1 + 0.18 * math.sin(18 * a) * math.sin(math.pi * t))
        G.add(v, f, 'shirt', ['chest', 'neck'])
        G.add(v, rev(f), 'shirt', ['chest', 'neck'])
    # 級長徽章
    if sp['badge']:
        v, f = box((-0.12, -0.122, 1.38), (0.04, 0.008, 0.05), (0, 0, -0.42))
        G.add(v, f, 'metal', ['chest'])
        v, f = box((-0.121, -0.127, 1.38), (0.022, 0.004, 0.03), (0, 0, -0.42))
        G.add(v, f, 'house_primary', ['chest'])

    if sp['crest']:
        v, f = box((0.118, -0.113, 1.36), (0.07, 0.008, 0.082), (0, 0, 0.42))
        G.add(v, f, 'house_primary', ['chest'])
        v, f = box((0.12, -0.118, 1.362), (0.042, 0.006, 0.05), (0, 0, 0.42))
        G.add(v, f, 'house_secondary', ['chest'])

    # ------------------------------------------------------------ 斜背的書包
    if sp['bag']:
        front, back = [], []
        for k in range(12):
            t = k / 11
            z = lerp(1.505, 1.0, t ** 0.9)
            for path, a in ((front, lerp(-1.55, 0.6, t)), (back, lerp(-1.55, -5.25, t))):
                kk = 1.045 + 0.05 * (1 - t) ** 6
                p = robe_at(z, a, kk)
                n = Vector((math.sin(a), -math.cos(a), 0.9 * (1 - t) ** 5)).normalized()
                path.append((p, n))
        for path in (front, back):
            v, f = strap(path, 0.042, 0.007)
            G.add(v, f, 'leather', ['chest', 'spine', 'hips', 'bag'])
        BM = Matrix.Translation(Vector((0.152, -0.178, 0.87))) @ Matrix.Rotation(0.6, 4, 'Z')

        def bag_part(geo, mat):
            G.add(xf(geo[0], BM), geo[1], mat, ['bag'])

        bag_part(box((0, 0, 0), (0.22, 0.066, 0.17)), 'leather')
        bag_part(box((0, -0.036, 0.022), (0.228, 0.012, 0.135)), 'leather')
        bag_part(box((0, -0.006, 0.084), (0.2, 0.05, 0.012)), 'leather_dark')
        for bx in (-0.062, 0.062):
            bag_part(box((bx, -0.044, 0.02), (0.022, 0.006, 0.12)), 'leather_dark')
            bag_part(box((bx, -0.048, -0.032), (0.028, 0.006, 0.022)), 'metal')
        for (px, pz, r, m) in ((-0.025, 0.055, 0.019, 'house_primary'), (0.025, 0.06, 0.017, 'house_secondary'),
                               (0.0, 0.0, 0.016, 'patch'), (-0.09, 0.055, 0.012, 'metal')):
            v, f, _ = tube([((px, -0.042, pz), r, r), ((px, -0.048, pz), r, r)], 8, cap1=True, ref=UP)
            bag_part((v, f), m)
        for side in (-1, 1):
            bag_part(box((0.112 * side, 0, 0.07), (0.01, 0.03, 0.03)), 'metal')

    # ------------------------------------------------------------ 手臂、袖子、手
    wand_tip = None
    for s, sd in ((1, 'L'), (-1, 'R')):
        Sh, E, W, K = (Vector(p) for p in ((0.2 * s, 0, 1.44), (0.25 * s, 0, 1.16), (0.285 * s, -0.02, 0.9), (0.295 * s, -0.02, 0.8)))
        ARM = ['chest', f'upperarm.{sd}', f'forearm.{sd}', f'hand.{sd}']
        cuff = 1.0 if student else 1.25
        sleeve = [(Vector((0.155 * s, 0, 1.425)), 0.058, 0.058), (Vector((0.2 * s, 0, 1.4)), 0.068, 0.068),
                  (Sh.lerp(E, 0.55), 0.068, 0.068), (E, 0.07, 0.072), (E.lerp(W, 0.45), 0.082 * cuff, 0.085 * cuff),
                  (W + (W - E) * 0.02, 0.112 * cuff, 0.116 * cuff), (W + (W - E) * 0.12, 0.124 * cuff, 0.128 * cuff)]
        v, f, _ = tube(sleeve, 14)
        G.add(v, f, 'robe', ARM)
        v, f, _ = tube([(c, rx * 0.96, ry * 0.96) for c, rx, ry in sleeve], 14)
        G.add(v, rev(f), 'house_primary', ARM)
        if elf:
            # 小精靈：細瘦的光手臂
            v, f, _ = tube([(Vector((0.17 * s, 0, 1.43)), 0.045, 0.045), (Sh.lerp(E, 0.5), 0.032, 0.032), (E, 0.03, 0.03),
                            (E.lerp(W, 0.6), 0.026, 0.026), (W + Vector((0, 0, 0.02)), 0.024, 0.024)], 8)
            G.add(v, f, 'skin', ['chest', f'upperarm.{sd}', f'forearm.{sd}'])
        else:
            v, f, _ = tube([(E, 0.046, 0.046), (E.lerp(W, 0.6), 0.042, 0.042), (W + Vector((0, 0, 0.02)), 0.039, 0.039)], 10)
            G.add(v, f, 'sweater', [f'forearm.{sd}'])
            v, f, _ = tube([(W + Vector((0, 0, 0.028)), 0.038, 0.038), (W + Vector((0, 0, 0.004)), 0.036, 0.036)], 10)
            G.add(v, f, 'shirt', [f'forearm.{sd}'])
        HAND = [f'forearm.{sd}', f'hand.{sd}']
        palm = 'glove' if sp['gloves'] else 'skin'
        v, f, _ = tube([(W + Vector((0, 0, 0.012)), 0.03, 0.036), (W + Vector((0, 0, -0.004)), 0.02, 0.031),
                        (W.lerp(K, 0.5), 0.021, 0.042), (K, 0.019, 0.044)], 10, cap1=True)
        G.add(v, f, palm, HAND)
        inward = Vector((-0.01 * s, 0, 0))
        for yo, ln in ((-0.028, 0.058), (-0.0095, 0.066), (0.0095, 0.062), (0.028, 0.05)):
            a = K + Vector((0, yo, 0.008))
            v, f, fr = tube([(a, 0.0098, 0.0098), (a + Vector((0, 0, -ln * 0.35)) + inward * 0.3, 0.0094, 0.0094),
                             (a + Vector((0, 0, -ln * 0.7)) + inward * 0.8, 0.0085, 0.0085), (a + Vector((0, 0, -ln)) + inward * 1.3, 0.0075, 0.0075)],
                            6, cap1=True)
            G.add(v, f, 'skin', [f'hand.{sd}'], fmats=[palm if fr[i] == 0 else 'skin' for i in range(len(f))])
        t0 = W + Vector((-0.004 * s, -0.03, -0.035))
        v, f, fr = tube([(t0, 0.012, 0.012), (t0 + Vector((-0.008 * s, -0.016, -0.025)), 0.0105, 0.0105),
                         (t0 + Vector((-0.014 * s, -0.024, -0.05)), 0.0085, 0.0085)], 6, cap1=True)
        G.add(v, f, 'skin', [f'hand.{sd}'], fmats=[palm if fr[i] == 0 else 'skin' for i in range(len(f))])
        if s == -1 and sp['prop'] == 'wand':
            g0 = K + Vector((0, 0.035, -0.02))
            tip = K + Vector((0, -0.3, -0.1))
            v, f, _ = tube([(g0, 0.011, 0.011), (g0.lerp(tip, 0.18), 0.0115, 0.0115), (g0.lerp(tip, 0.22), 0.0095, 0.0095),
                            (g0.lerp(tip, 0.3), 0.01, 0.01), (g0.lerp(tip, 0.32), 0.0085, 0.0085), (tip, 0.005, 0.005)],
                           6, cap0=True, cap1=True, ref=UP)
            G.add(v, f, 'wood', ['hand.R'])
            wand_tip = tip
        if s == -1 and sp['prop'] == 'umbrella':
            # 海格的粉紅雨傘：收起來握在右手，傘尖朝下
            top = K + Vector((0, 0.0, 0.06))
            tipp = K + Vector((0, -0.05, -0.75))
            v, f, _ = tube([(top, 0.012, 0.012), (top + Vector((0, 0, -0.06)), 0.012, 0.012)], 6, cap0=True, ref=UP)
            G.add(v, f, 'wood', ['hand.R'])
            v, f, _ = tube([(top + Vector((0, 0, -0.07)), 0.02, 0.02), (top.lerp(tipp, 0.35), 0.045, 0.045), (top.lerp(tipp, 0.9), 0.012, 0.012), (tipp, 0.004, 0.004)],
                           8, cap0=True, cap1=True, ref=FRONT, mod=lambda a, t: 1 + 0.12 * abs(math.sin(4 * a)))
            G.add(v, f, 'prop', ['hand.R'])
    extra['wand_tip'] = wand_tip

    # ------------------------------------------------------------ 脖子與頭
    v, f, _ = tube([((0, 0.006, 1.46), 0.056, 0.053), ((0, 0.01, 1.62), 0.052, 0.05)], 10)
    G.add(v, f, 'skin', ['chest', 'neck', 'head'])
    HC = Vector((0, -0.004, 1.722))
    HR = Vector((0.127, 0.131, 0.146))
    if sp['female']:
        HR = Vector((0.122, 0.127, 0.142))

    def head_shape(q):
        t = sat(-q.z / HR.z)
        k = 1 - (0.28 if sp['female'] else 0.24) * t ** 1.8
        q = Vector((q.x * k, q.y * (1 - 0.1 * t ** 2), q.z))
        if q.y < 0:
            q.y -= 0.008 * t
        if q.y > 0:
            q.y *= 0.95
        return q

    v, f = sphere(HC, HR, 18, 12, shape=head_shape)
    G.add(v, f, 'skin', ['head'])

    def surf_y(x, z):
        qz = (z - HC.z) / HR.z
        t = sat(-qz)
        k = 1 - (0.28 if sp['female'] else 0.24) * t ** 1.8
        r = 1 - (x / (HR.x * k)) ** 2 - qz ** 2
        y = -HR.y * (1 - 0.1 * t ** 2) * math.sqrt(max(0.0, r)) - 0.008 * t
        return HC.y + y

    EZ = 1.726
    brow = 'beard' if sp['brow'] == 'beard' else 'hair'
    for s in (1, -1):
        ex = 0.045 * s
        ey = surf_y(ex, EZ)
        ek = sp['eyes']
        v, f = sphere((ex, ey + 0.007 - 0.01 * (ek - 1), EZ), (0.025 * ek, 0.012 * ek, 0.019 * ek), 10, 6)
        G.add(v, f, 'eye', ['head'])
        v, f = sphere((ex, ey - 0.0035 - 0.016 * (ek - 1), EZ - 0.001), (0.0125 * ek, 0.0045 * ek, 0.0135 * ek), 8, 6)
        G.add(v, f, 'iris', ['head'])
        bw = 0.042 if not sp['brow'] == 'beard' else 0.048
        v, f = box((0.047 * s, surf_y(0.047 * s, 1.762) - 0.003, 1.762), (bw, 0.006, 0.0065 if brow == 'hair' else 0.012), (0, 0, -0.1 * s))
        G.add(v, f, brow, ['head'])
        es = sp['ears']
        if elf:
            # 蝙蝠一樣的大耳朵，往兩側斜上方張開
            r0 = Vector((0.118 * s, 0.01, 1.72))
            v, f, _ = tube([(r0, 0.02, 0.04), (r0 + Vector((0.07 * s, 0.01, 0.03)), 0.022, 0.07), (r0 + Vector((0.15 * s, 0.02, 0.07)), 0.014, 0.05),
                            (r0 + Vector((0.22 * s, 0.03, 0.1)), 0.003, 0.006)], 8, cap1=True, ref=FRONT)
            G.add(v, f, 'skin', ['head'])
        else:
            v, f = sphere((0.126 * s * (1 + 0.15 * (es - 1)), 0.002, 1.712), (0.012 * es, 0.022 * es, 0.03 * es), 8, 6)
            G.add(v, f, 'skin', ['head'])
    nk = sp['nose']
    hook = sp['hook']
    v, f = sphere((0, surf_y(0, 1.697) - 0.003, 1.697 + 0.004 * (nk - 1)), (0.0088 * (1 + 0.3 * (nk - 1)), 0.009 * nk, 0.016 * nk), 8, 6,
                  shape=lambda q: Vector((q.x, q.y - 0.25 * max(0.0, -q.z) - hook * 0.007 * (1 - min(1.0, (q.z / (0.016 * nk)) ** 2)), q.z)))
    G.add(v, f, 'skin', ['head'])
    mouth = []
    for k in range(5):
        x = -0.022 + 0.011 * k
        z = 1.664 + {'smile': 0.006, 'flat': 0.0, 'frown': -0.005}[sp['mouth']] * (x / 0.022) ** 2
        mouth.append(((x, surf_y(x, z) + 0.0015, z), 0.004, 0.003))
    v, f, _ = tube(mouth, 6, cap0=True, cap1=True, ref=UP)
    G.add(v, f, 'lip', ['head'])

    # ------------------------------------------------------------ 眼鏡
    GY = surf_y(0.045, EZ) - 0.016
    gl = sp['glasses']
    if gl:
        R = {'round': 0.03, 'half': 0.028, 'square': 0.029, 'big': 0.04}[gl]
        gz = EZ - (0.012 if gl == 'half' else 0)
        for s in (1, -1):
            if gl == 'half':
                v, f = torus((0.045 * s, GY, gz), R, 0.0028, (1, 0, 0), (0, 0, -1), U=12, arc=math.pi)
                G.add(v, f, 'frame', ['head'])
                v, f, _ = tube([((0.017 * s, GY, gz), 0.0026, 0.0026), ((0.073 * s, GY, gz), 0.0026, 0.0026)], 4, ref=UP)
                G.add(v, f, 'frame', ['head'])
            elif gl == 'square':
                pts = [(0.016, 0.022), (0.074, 0.022), (0.074, -0.02), (0.016, -0.02), (0.016, 0.022)]
                v, f, _ = tube([((x * s, GY, gz + z), 0.0028, 0.0028) for x, z in pts], 4, ref=FRONT)
                G.add(v, f, 'frame', ['head'])
            else:
                v, f = torus((0.045 * s, GY - (0.004 if gl == 'big' else 0), gz), R, 0.003, (1, 0, 0), (0, 0, 1), U=18)
                G.add(v, f, 'frame', ['head'])
                if gl == 'big':
                    # 厚鏡片讓眼睛看起來特別大
                    v, f = sphere((0.045 * s, GY - 0.004, gz), (R * 0.95, 0.004, R * 0.95), 12, 6)
                    G.add(v, f, 'eye', ['head'])
                    v, f = sphere((0.045 * s, GY - 0.009, gz), (0.016, 0.003, 0.017), 8, 6)
                    G.add(v, f, 'iris', ['head'])
            ox = (0.045 + R) * s
            v, f, _ = tube([((ox, GY + 0.004, gz + 0.002), 0.0026, 0.0026), ((0.124 * s, -0.03, EZ + 0.004), 0.0026, 0.0026),
                            ((0.131 * s, 0.02, 1.716), 0.0026, 0.0026)], 4, ref=UP)
            G.add(v, f, 'frame', ['head'])
        if gl != 'half':
            v, f, _ = tube([((-0.016, GY, gz + 0.004), 0.0026, 0.0026), ((0, GY - 0.003, gz + 0.01), 0.0026, 0.0026), ((0.016, GY, gz + 0.004), 0.0026, 0.0026)], 4, ref=UP)
            G.add(v, f, 'frame', ['head'])

    # ------------------------------------------------------------ 頭髮
    hair_head(G, sp, HC, HR, rng, robe_at)

    # ------------------------------------------------------------ 鬍子
    beard_build(G, sp, HC, HR, surf_y, robe_at, rng)

    # ------------------------------------------------------------ 兜帽
    if sp['hood']:
        HOODC = Vector((0, 0.165, 1.43))
        HOODM = Matrix.Translation(HOODC) @ Matrix.Rotation(-0.55, 4, 'X') @ Matrix.Translation(-HOODC)
        v, f = sphere(HOODC, (0.16, 0.085, 0.15), 16, 9, keep=lambda p: p.z < HOODC.z + 0.02)
        G.add(xf(v, HOODM), f, 'robe', ['hood', 'chest'])
        v, f = sphere(HOODC + Vector((0, -0.004, 0.004)), (0.148, 0.074, 0.138), 16, 9, keep=lambda p: p.z < HOODC.z + 0.021)
        G.add(xf(v, HOODM), rev(f), 'house_primary', ['hood', 'chest'])

    # ------------------------------------------------------------ 帽子
    if sp['hat'] == 'cosy':
        # 多比的茶壺保溫套：圓頂、有個小球
        c = HC + Vector((0, 0.01, HR.z * 0.15))
        v, f = sphere(c, (HR.x * 1.08, HR.y * 1.08, HR.z * 1.0), 16, 10, keep=lambda p: p.z > c.z - 0.01)
        G.add(v, f, 'hat', ['head'])
        v, f = sphere(c + Vector((0, 0, HR.z * 1.0)), (0.025, 0.025, 0.025), 8, 6)
        G.add(v, f, 'house_secondary', ['head'])
    elif sp['hat'] == 'nurse':
        # 護士帽：頭頂偏後的一圈白色硬布
        c = HC + Vector((0, 0.03, HR.z * 0.82))
        v, f, _ = tube([(c + Vector((0, 0, -0.01)), 0.105, 0.09), (c + Vector((0, -0.01, 0.06)), 0.11, 0.07)], 16, cap1=True, ref=FRONT)
        G.add(v, f, 'hat', ['head'])
    elif sp['hat']:
        top = HC.z + HR.z * 0.5
        base = Vector((0, HC.y + 0.01, top))
        brim = 0.25 if sp['hat'] == 'witch' else 0.2
        hh = 0.36 if sp['hat'] == 'witch' else 0.42
        v, f, _ = tube([(base + Vector((0, 0, -0.004)), brim, brim), (base + Vector((0, 0, 0.006)), brim * 0.98, brim * 0.98),
                        (base + Vector((0, 0, 0.012)), 0.15, 0.15)], 20, ref=FRONT,
                       mod=lambda a, t: 1 + 0.04 * math.sin(3 * a + 1))
        G.add(v, f, 'hat', ['head'])
        G.add(v, rev(f), 'hat', ['head'])
        tipb = sp['hat_tip']
        rings = []
        for k in range(7):
            t = k / 6
            c = base + Vector((0, tipb * 0.12 * t ** 2, hh * t - tipb * 0.06 * t ** 3))
            r = 0.135 * (1 - t) + 0.006
            rings.append((c, r, r))
        v, f, _ = tube(rings, 14, cap1=True, ref=FRONT)
        G.add(v, f, 'hat', ['head'])
        # 帽帶
        v, f, _ = tube([(base + Vector((0, 0, 0.012)), 0.137, 0.137), (base + Vector((0, 0, 0.04)), 0.128, 0.128)], 14)
        G.add(v, f, 'house_secondary' if sp['lining'] is None else 'leather_dark', ['head'])

    # 小精靈沒有長袍：拿掉長袍與內襯的面，再清掉沒用到的頂點
    if elf:
        G.prune(lambda m: m in ('robe', 'house_primary'))

    # ------------------------------------------------------------ 體型變形：肩寬、胖瘦、頭的大小、身高
    sc, gi, hs, sh, belly = sp['scale'], sp['girth'], sp['head'], sp['shoulders'], sp['belly']
    NECK = Vector((0, 0.008, 1.57))

    def arm_w(ws):
        return sum(w for b, w in ws.items() if b.split('.')[0] in ('upperarm', 'forearm', 'hand'))

    def bump(z):
        return smooth(0.5, 0.82, z) * (1 - smooth(1.46, 1.62, z))

    lg = sp['legs']

    def deform(p, ws):
        q = p.copy()
        # 腿長：臀部以下壓短，上半身整個往下移
        q.z = q.z * lg if q.z < 0.95 else q.z - 0.95 * (1 - lg)
        aw = arm_w(ws)
        hw = ws.get('head', 0.0)
        sgn = 1 if q.x >= 0 else -1
        # 手臂整條平移（不跟著變粗），軀幹依高度放大
        shift = 0.2 * ((gi - 1) * bump(1.4) + (sh - 1))
        body_k = 1 + (gi - 1) * bump(q.z)
        moved = Vector((q.x + sgn * shift, q.y, q.z))
        scaled = Vector((q.x * body_k, q.y * body_k, q.z))
        q = scaled.lerp(moved, aw)
        if belly:
            bz = math.exp(-((q.z - 1.08) / 0.17) ** 2)
            if q.y < 0.02:
                q.y -= belly * bz * (1 - aw) * sat(-q.y / 0.12 + 0.4)
        if hs != 1.0 and hw > 0:
            q = q.lerp(NECK + (q - NECK) * hs, hw)
        return q * sc

    G.v = [deform(p, w) for p, w in zip(G.v, G.w)]
    out_bones = []
    for bn, h, t, par in BONES:
        root = bn.split('.')[0]
        ws = {'upperarm': 1.0} if root in ('upperarm', 'forearm', 'hand') else ({'head': 1.0} if bn == 'head' else {})
        h2 = deform(Vector(h), ws if bn != 'head' else {})
        t2 = deform(Vector(t), ws)
        out_bones.append((bn, tuple(h2), tuple(t2), par))
    if wand_tip is not None:
        extra['wand_tip'] = deform(wand_tip, {'upperarm': 1.0})
    extra['height'] = max(p.z for p in G.v)
    extra['head_z'] = deform(HC, {'head': 1.0}).z
    return G, out_bones, material_table(sp), extra


# ---------------------------------------------------------------- 髮型
def hair_head(G, sp, HC, HR, rng, robe_at):
    style = sp['hair_style']
    if style == 'none':
        return
    HAIR_C = HC + Vector((0, 0.01, 0.012))
    k = {'bushy': 1.12, 'bun': 0.98, 'short': 1.0, 'messy': 1.0, 'long': 1.0, 'bald': 1.0, 'ponytail': 1.0}.get(style, 1.0)
    HAIR_R = Vector((0.14 * k, 0.146 * k, 0.158 * k))
    if sp['hat']:
        # 戴帽子：只留帽緣下露出的頭髮
        HAIR_R = Vector((0.136, 0.142, 0.15))

    def front_of(q):
        return sat((-q.y / HAIR_R.y + 1) / 2)

    def keep(p):
        q = p - HAIR_C
        front = front_of(q)
        if style == 'bald':
            # 禿頂：只剩後腦與兩側一圈
            return q.z < 0.05 and q.z > -0.09 and front < 0.62
        line = lerp(lerp(-0.12, 0.0, smooth(0.15, 0.45, front)), 0.048 if sp['fringe'] else 0.07, smooth(0.62, 0.85, front))
        return q.z > line

    v, f = sphere(HAIR_C, HAIR_R, 20, 12, keep=keep, shape=lambda q: Vector((q.x, q.y, q.z * (1.0 if q.z > 0 else 0.92))))
    G.add(v, f, 'hair', ['head'])

    # 髮束
    counts = {'spiky': 110, 'messy': 150, 'short': 70, 'long': 60, 'bushy': 170, 'bun': 30, 'bald': 40, 'ponytail': 40}
    n = counts.get(style, 80)
    back_dir = Vector((0, 1, 0))
    made = 0
    tries = 0
    while made < n and tries < 5000:
        tries += 1
        z = rng.uniform(-0.6, 1.0)
        ph = rng.uniform(0, TAU)
        rr = math.sqrt(1 - z * z)
        nn = Vector((rr * math.cos(ph), rr * math.sin(ph), z))
        root = HAIR_C + Vector((nn.x * HAIR_R.x, nn.y * HAIR_R.y, nn.z * HAIR_R.z)) * 0.93
        if not keep(root + nn * 0.012):
            continue
        if sp['hat'] and root.z > HC.z + HR.z * 0.5:
            continue
        jit = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        back = back_dir - nn * nn.y
        lift = 0.012
        if style == 'spiky':
            d = (nn * 0.85 + UP * 0.35 + back * 0.2 + jit * 0.3).normalized()
            ln = rng.uniform(0.035, 0.065)
            lift = 0.0
        elif style in ('messy', 'bushy') and nn.z > 0.72:
            d = (nn * 0.32 + back * 0.65 + jit * 0.4).normalized()
            ln = rng.uniform(0.05, 0.08)
            lift = 0.02
        elif nn.y < -0.15:
            # 瀏海：停在眉毛上方
            d = (nn * 0.25 + DOWN * 0.85 + Vector((nn.x, 0, 0)) * 0.6 + jit * 0.25).normalized()
            ln = min(rng.uniform(0.045, 0.075), max(0.015, (root.z - 1.778) / max(0.25, -d.z)))
            if style in ('short', 'bun', 'ponytail', 'long'):
                d = (nn * 0.3 + back * 0.5 + Vector((nn.x * 1.5, 0, 0)) + jit * 0.15).normalized()
                ln = rng.uniform(0.03, 0.05)
        else:
            if style in ('short', 'bun', 'ponytail', 'bald', 'long'):
                d = (nn * 0.2 + back * 0.4 + DOWN * 0.7 + jit * 0.15).normalized()
                ln = rng.uniform(0.03, 0.055)
                lift = 0.006
            else:
                d = (nn * 0.28 + back * 0.2 + DOWN * 0.75 + jit * 0.3).normalized()
                ln = rng.uniform(0.05, 0.085)
            floor = 1.766 if nn.y < 0.05 else (1.695 if nn.y < 0.55 else 1.62)
            if style in ('long', 'bushy'):
                floor = 1.766 if nn.y < -0.35 else 1.6
            ln = min(ln, max(0.015, (root.z - floor) / max(0.25, -d.z)))
        w = rng.uniform(0.045, 0.062) * (1.25 if style == 'bushy' else 1.0)
        pts = [(root, w, 0.013), (root + d * ln * 0.45 + nn * lift, w * 0.75, 0.01), (root + d * ln * 0.8 + nn * lift * 0.7, w * 0.4, 0.006),
               (root + d * ln + nn * lift * 0.5, 0.006, 0.003)]
        v, f, _ = tube(pts, 5, cap1=True, ref=nn)
        G.add(v, f, 'hair', ['head'])
        made += 1

    # 長髮：從耳上垂到肩膀或背後的一片髮簾，前面留出臉
    if style in ('long', 'bushy'):
        end = sp['hair_len']
        puff = 1.28 if style == 'bushy' else 1.0
        rings = []
        z0 = HC.z + 0.02
        nr = 9
        for i in range(nr):
            t = i / (nr - 1)
            z = lerp(z0, end, t)
            # 頭部範圍用頭的橢圓，往下過了下巴就貼著肩膀與背部外側
            qz = (z - HAIR_C.z) / HAIR_R.z
            hr = math.sqrt(max(0.0, 1 - min(0.97, qz * qz))) if z > HC.z - 0.08 else 0.0
            rxh, ryh = HAIR_R.x * max(hr, 0.72), HAIR_R.y * max(hr, 0.72)
            if z < 1.56:
                body = robe_at(z, math.pi / 2, 1.0)
                bx = abs(body.x)
                by = abs(robe_at(z, 0, 1.0).y)
                blend = smooth(1.56, 1.42, z)
                rxh = lerp(rxh, bx * 0.82 + 0.02, blend)
                ryh = lerp(ryh, by + 0.03, blend)
            spread = 1 + (puff - 1) * math.sin(math.pi * min(1, t * 1.3))
            # 髮尾收窄
            rxh *= lerp(1.0, 0.72 if style == 'long' else 0.85, smooth(0.55, 1.0, t))
            cy = HAIR_C.y + 0.012 + 0.02 * t
            rings.append(((0, cy, z), rxh * 1.06 * spread, ryh * 1.06 * spread))
        g0, g1 = (0.95, 1.7) if style == 'long' else (0.85, 1.3)

        def gap(t):
            # 過了下巴就只垂在肩膀後面
            return lerp(g0, g1, smooth(0.2, 0.5, t))

        v, f, _ = tube(rings, 22, arc=lambda t: (gap(t), TAU - gap(t)), ref=FRONT,
                       mod=lambda a, t: 1 + (0.05 if style == 'bushy' else 0.025) * math.sin(11 * a + 3 * t) * (0.4 + t),
                       zoff=lambda a, t: -0.07 * t * (1 - math.cos(a)) / 2)
        G.add(v, f, 'hair', wfun=lambda p: G.weights(p, ['head', 'neck', 'chest']))
        G.add(v, rev(f), 'hair', wfun=lambda p: G.weights(p, ['head', 'neck', 'chest']))
        if style == 'bushy':
            for _ in range(40):
                a = rng.uniform(0.9, TAU - 0.9)
                t = rng.uniform(0.0, 0.85)
                c, rx, ry = rings[int(t * (nr - 1))]
                c = Vector(c)
                p = c + Vector((math.sin(a) * rx, -math.cos(a) * ry, 0)) * 0.98
                r = rng.uniform(0.035, 0.055)
                v, f = sphere(p, (r, r, r * 1.2), 6, 4)
                G.add(v, f, 'hair', wfun=lambda q: G.weights(q, ['head', 'neck', 'chest']))

    if style == 'bun':
        c = HAIR_C + Vector((0, HAIR_R.y * 0.9, 0.04))
        v, f = sphere(c, (0.06, 0.05, 0.055), 12, 8)
        G.add(v, f, 'hair', ['head'])
    if style == 'ponytail':
        c = HAIR_C + Vector((0, HAIR_R.y * 0.92, 0.0))
        v, f, _ = tube([(c, 0.03, 0.03), (c + Vector((0, 0.04, -0.08)), 0.035, 0.03), (c + Vector((0, 0.05, -0.2)), 0.025, 0.02),
                        (c + Vector((0, 0.04, -0.28)), 0.006, 0.006)], 8, cap1=True, ref=UP)
        G.add(v, f, 'hair', ['head'])


# ---------------------------------------------------------------- 鬍子
def beard_build(G, sp, HC, HR, surf_y, robe_at, rng):
    b = sp['beard']
    mat = 'beard'
    if sp['moustache'] == 'walrus':
        # 海象鬍：又厚又垂、蓋住上唇
        for s in (1, -1):
            pts = [((0.004 * s, surf_y(0.004, 1.685) - 0.01, 1.684), 0.016, 0.012), ((0.03 * s, surf_y(0.03, 1.676) - 0.009, 1.672), 0.022, 0.014),
                   ((0.055 * s, surf_y(0.05, 1.655) - 0.004, 1.646), 0.016, 0.011), ((0.062 * s, surf_y(0.055, 1.63), 1.625), 0.006, 0.005)]
            v, f, _ = tube(pts, 8, cap0=True, cap1=True, ref=UP)
            G.add(v, f, mat, ['head'])
    elif sp['moustache'] or b in ('long', 'bushy'):
        for s in (1, -1):
            pts = [((0.004 * s, surf_y(0.004, 1.681) - 0.006, 1.681), 0.008, 0.005), ((0.022 * s, surf_y(0.022, 1.676) - 0.005, 1.674), 0.011, 0.006),
                   ((0.04 * s, surf_y(0.04, 1.665) - 0.002, 1.656), 0.007, 0.004)]
            if b == 'long':
                pts.append(((0.05 * s, surf_y(0.045, 1.63) - 0.01, 1.62), 0.004, 0.003))
            v, f, _ = tube(pts, 6, cap0=True, cap1=True, ref=UP)
            G.add(v, f, mat, ['head'])
    if b is None:
        return
    end = sp['beard_len']
    if b == 'long':
        # 從下巴與兩頰垂下、越往下越尖，貼著胸前
        rings = []
        n = 10
        for i in range(n):
            t = i / (n - 1)
            z = lerp(1.652, end, t)
            if z > 1.56:
                y = surf_y(0, max(z, HC.z - HR.z * 0.92)) - 0.012
            else:
                y = robe_at(z, 0, 1.0).y - 0.03
            w = 0.1 * (1 - t) ** 0.7 + 0.008
            if t < 0.18:
                w = lerp(0.075, 0.1, t / 0.18)
            rings.append(((0, y + 0.02 * t, z), w, 0.045 * (1 - t) + 0.008))
        v, f, _ = tube(rings, 14, cap1=True, ref=FRONT, mod=lambda a, t: 1 + 0.06 * math.sin(9 * a + 5 * t))
        G.add(v, f, mat, wfun=lambda p: G.weights(p, ['head', 'neck', 'chest']))
    elif b == 'bushy':
        # 海格：蓋住雙頰、下巴的大鬍子，垂到胸前
        rings = []
        n = 8
        for i in range(n):
            t = i / (n - 1)
            z = lerp(1.705, end, t)
            qz = (z - HC.z) / HR.z
            hr = math.sqrt(max(0.0, 1 - min(0.9, qz * qz)))
            rx = max(HR.x * hr * 1.12, 0.1) * (1 + 0.25 * math.sin(math.pi * t))
            ry = max(HR.y * hr * 1.05, 0.08) * (1 + 0.2 * math.sin(math.pi * t))
            if z < 1.56:
                ry = max(ry, abs(robe_at(z, 0, 1.0).y) + 0.04)
                rx = lerp(rx, 0.06, smooth(1.5, end, z))
            rings.append(((0, HC.y + 0.01, z), rx, ry))
        v, f, _ = tube(rings, 18, arc=lambda t: (-1.75 + 0.2 * t, 1.75 - 0.2 * t), ref=FRONT,
                       mod=lambda a, t: 1 + 0.07 * math.sin(13 * a + 7 * t))
        G.add(v, f, mat, wfun=lambda p: G.weights(p, ['head', 'neck', 'chest']))
        G.add(v, rev(f), mat, wfun=lambda p: G.weights(p, ['head', 'neck', 'chest']))
        for _ in range(30):
            i = rng.randrange(1, n - 1)
            c, rx, ry = rings[i]
            a = rng.uniform(-1.5, 1.5)
            p = Vector(c) + Vector((math.sin(a) * rx, -math.cos(a) * ry, 0)) * 0.97
            r = rng.uniform(0.03, 0.05)
            v, f = sphere(p, (r, r * 0.8, r * 1.2), 6, 4)
            G.add(v, f, mat, wfun=lambda q: G.weights(q, ['head', 'neck', 'chest']))
    elif b == 'goatee':
        v, f, _ = tube([((0, surf_y(0, 1.646) - 0.006, 1.646), 0.022, 0.014), ((0, surf_y(0, 1.625) - 0.012, 1.615), 0.016, 0.012),
                        ((0, surf_y(0, 1.62) - 0.02, 1.585), 0.004, 0.004)], 8, cap0=True, cap1=True, ref=FRONT)
        G.add(v, f, mat, ['head'])
    elif b == 'stubble':
        v, f = sphere(HC + Vector((0, -0.005, -0.05)), (HR.x * 0.98, HR.y * 1.005, HR.z * 0.9), 16, 10,
                      keep=lambda p: p.z < 1.672 and p.y < HC.y - 0.02)
        G.add(v, f, mat, ['head'])
