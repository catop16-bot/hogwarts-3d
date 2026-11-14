"""共用骨架與動畫片段。所有人形角色用同一套骨頭名稱，動畫片段只有旋轉軌與臀部位移，
所以網頁端可以把同一份動畫套在不同身高、體型的角色上（臀部位移依身高縮放）。

姿勢一律用「骨架空間的軸」描述，與骨頭的 roll 無關：
  X：前後擺（負 = 往前：腿往前跨、手往前舉；膝蓋正 X 彎、手肘負 X 彎）；軀幹與頭正 X = 往前傾、低頭
  Y：側擺（左手往外 = 負，右手往外 = 正；軀幹側彎）
  Z：扭轉（左手臂正 Z = 往外轉）
"""
import math

import bpy
from mathutils import Euler, Vector

from lib import TAU

FPS = 30


def bone_list(hem=0.38):
    """(名稱, 頭, 尾, 父骨)；名稱裡的「.」在匯出前會換成底線（three.js 會把「.」拿掉）"""
    B = [
        ('root', (0, 0, 0), (0, 0, 0.12), None),
        ('hips', (0, 0, 0.95), (0, 0, 1.06), 'root'),
        ('spine', (0, 0, 1.06), (0, 0, 1.25), 'hips'),
        ('chest', (0, 0, 1.25), (0, 0, 1.46), 'spine'),
        ('neck', (0, 0.005, 1.47), (0, 0.008, 1.57), 'chest'),
        ('head', (0, 0.008, 1.57), (0, 0.008, 1.84), 'neck'),
        ('hood', (0, 0.13, 1.48), (0, 0.21, 1.36), 'chest'),
        ('bag', (0.13, -0.16, 1.0), (0.15, -0.19, 0.8), 'hips'),
    ]
    fl = 0.68 if hem < 0.6 else 0.82
    for s, sd in ((1, 'L'), (-1, 'R')):
        B += [
            (f'upperarm.{sd}', (0.2 * s, 0, 1.44), (0.25 * s, 0, 1.16), 'chest'),
            (f'forearm.{sd}', (0.25 * s, 0, 1.16), (0.285 * s, -0.02, 0.9), f'upperarm.{sd}'),
            (f'hand.{sd}', (0.285 * s, -0.02, 0.9), (0.295 * s, -0.02, 0.8), f'forearm.{sd}'),
            (f'thigh.{sd}', (0.088 * s, 0, 0.93), (0.088 * s, 0, 0.5), 'hips'),
            (f'shin.{sd}', (0.088 * s, 0, 0.5), (0.088 * s, 0.01, 0.1), f'thigh.{sd}'),
            (f'foot.{sd}', (0.088 * s, 0.01, 0.1), (0.088 * s, -0.13, 0.03), f'shin.{sd}'),
            (f'robe.F.{sd}.1', (0.12 * s, -0.11, 1.0), (0.18 * s, -0.17, fl), 'hips'),
            (f'robe.F.{sd}.2', (0.18 * s, -0.17, fl), (0.23 * s, -0.22, hem), f'robe.F.{sd}.1'),
        ]
    B += [
        ('robe.B.1', (0, 0.13, 1.0), (0, 0.21, fl), 'hips'),
        ('robe.B.2', (0, 0.21, fl), (0, 0.27, hem), 'robe.B.1'),
    ]
    return B


def nm(n):
    return n.replace('.', '_')


ARM_BONES = {'upperarm', 'forearm', 'hand'}


def S(p, k=1, off=0.0):
    return math.sin(TAU * (p * k + off))


def C(p, k=1, off=0.0):
    return math.cos(TAU * (p * k + off))


def pos(x):
    return max(0.0, x)


# ---------------------------------------------------------------- 姿勢
def gait(p, A, K, arm_a, fore, lean, bob, cloth, run):
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
        'robe_B_2': (0.02 * S(p, 1, 0.3), 0, 0),
    }
    return o, (0.012 * S(p, 1, 0.25), 0, 0.004 * b)


def walk(p):
    return gait(p, A=0.46, K=0.78, arm_a=0.32, fore=0.22, lean=0.05, bob=0.028, cloth=0.08, run=0)


def run(p):
    return gait(p, A=0.82, K=1.55, arm_a=0.68, fore=1.2, lean=0.22, bob=0.05, cloth=0.32, run=1)


def jump(p):
    w = S(p)
    o = {
        'thigh_L': (-0.75, 0, 0), 'thigh_R': (0.22, 0, 0), 'shin_L': (1.05, 0, 0), 'shin_R': (0.5, 0, 0),
        'foot_L': (-0.2, 0, 0), 'foot_R': (0.35, 0, 0),
        'upperarm_L': (0.15, -0.85 - 0.04 * w, 0), 'upperarm_R': (0.15, 0.85 + 0.04 * w, 0),
        'forearm_L': (-0.45, 0, 0), 'forearm_R': (-0.45, 0, 0), 'spine': (0.06, 0, 0), 'head': (-0.06, 0, 0),
        'robe_B_1': (0.18, 0, 0), 'robe_B_2': (0.12, 0, 0), 'robe_F_L_1': (-0.55, 0, 0), 'robe_F_R_1': (-0.1, 0, 0),
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
        'robe_F_L_2': (-0.3, 0, 0), 'robe_F_R_2': (-0.3, 0, 0), 'hood': (-0.3, 0, 0),
    }
    return o, (0, 0, 0)


def land(p):
    o = {
        'thigh_L': (-0.95, 0, -0.06), 'thigh_R': (-0.95, 0, 0.06), 'shin_L': (1.55, 0, 0), 'shin_R': (1.55, 0, 0),
        'foot_L': (-0.6, 0, 0), 'foot_R': (-0.6, 0, 0), 'hips': (0.12, 0, 0), 'spine': (0.22, 0, 0), 'chest': (0.1, 0, 0),
        'head': (-0.3, 0, 0), 'upperarm_L': (-0.45, -0.35, 0), 'upperarm_R': (-0.45, 0.35, 0),
        'forearm_L': (-0.5, 0, 0), 'forearm_R': (-0.5, 0, 0),
        'robe_F_L_1': (-0.45, 0, 0), 'robe_F_R_1': (-0.45, 0, 0), 'robe_B_1': (0.2, 0, 0),
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
    }
    return o, (0, 0, 0.012 * S(p, 2))


def lumos(p):
    o = {'upperarm_R': (-0.95, 0.1, 0), 'forearm_R': (-0.85, 0, 0), 'hand_R': (0.15, 0, 0)}
    return o, (0, 0, 0)


# ---- NPC 用的動作
SIT_LEGS = {
    'thigh_L': (-1.5, -0.06, 0), 'thigh_R': (-1.5, 0.06, 0), 'shin_L': (1.45, 0, 0), 'shin_R': (1.45, 0, 0),
    'foot_L': (0.05, 0, 0), 'foot_R': (0.05, 0, 0),
    # 坐下時長袍前襟順著大腿往前、後襬貼著椅面
    'robe_F_L_1': (-1.35, 0, -0.08), 'robe_F_R_1': (-1.35, 0, 0.08), 'robe_F_L_2': (1.25, 0, 0), 'robe_F_R_2': (1.25, 0, 0),
    'robe_B_1': (-0.2, 0, 0), 'robe_B_2': (0.2, 0, 0), 'bag': (-0.6, 0, 0),
}
SIT_LOC = (0, 0.03, -0.47)


def sit(p):
    """坐在長凳上，手肘靠桌面，偶爾轉頭"""
    b = S(p)
    o = dict(SIT_LEGS)
    o.update({
        'spine': (0.06 + 0.01 * b, 0, 0), 'chest': (0.04, 0, 0), 'head': (0.05, 0, 0.18 * S(p, 1, 0.1) * pos(S(p, 1, 0.1))),
        'upperarm_L': (-0.42, -0.12, 0.25), 'upperarm_R': (-0.42, 0.12, -0.25),
        'forearm_L': (-1.15 - 0.03 * b, 0, 0), 'forearm_R': (-1.05 - 0.05 * S(p, 2), 0, 0),
    })
    return o, SIT_LOC


def sit_talk(p):
    """坐著聊天：右手比劃、頭轉向旁邊的人"""
    o, loc = sit(p)
    o.update({
        'head': (0.02 + 0.05 * S(p, 3), 0, 0.35), 'neck': (0, 0, 0.12), 'chest': (0.02, 0, 0.1),
        'upperarm_R': (-0.55 + 0.1 * S(p, 2), 0.18, -0.2), 'forearm_R': (-1.35 + 0.25 * S(p, 3), 0, 0), 'hand_R': (0.25 * S(p, 3, 0.2), 0, 0),
    })
    return o, loc


def talk(p):
    """站著說話：右手比劃、點頭"""
    o, loc = idle(p)
    o.update({
        'head': (0.05 * S(p, 3), 0, 0.06 * S(p, 1)), 'neck': (0.03 * S(p, 3, 0.2), 0, 0),
        'upperarm_R': (-0.35 + 0.12 * S(p, 2), 0.16, -0.2), 'forearm_R': (-1.15 + 0.3 * S(p, 3), 0, 0), 'hand_R': (0.3 * S(p, 3, 0.2), 0, 0.2),
        'upperarm_L': (-0.12 + 0.05 * S(p, 2, 0.3), -0.1, 0), 'forearm_L': (-0.5 - 0.15 * S(p, 2, 0.3), 0, 0),
    })
    return o, loc


def teach(p):
    """講課：魔杖指向黑板，再轉回來對著學生"""
    o, loc = idle(p)
    k = 0.5 + 0.5 * S(p)
    o.update({
        'chest': (0.02, 0, 0.25 * k), 'spine': (0.01, 0, 0.1 * k), 'head': (-0.04, 0, 0.3 * k),
        'upperarm_R': (-1.25 * k - 0.3, 0.25 + 0.2 * k, 0), 'forearm_R': (-0.35 + 0.1 * S(p, 4), 0, 0), 'hand_R': (0.1, 0, 0),
        'upperarm_L': (-0.3, -0.15, 0.3), 'forearm_L': (-1.3, 0, 0),
    })
    return o, loc


def wave(p):
    o, loc = idle(p)
    w = S(p, 3)
    o.update({'upperarm_R': (-0.25, 2.5, 0), 'forearm_R': (-0.25 - 0.35 * w, 0, 0), 'hand_R': (0, 0.2 * w, 0), 'head': (-0.05, 0, 0)})
    return o, loc


def cast(p):
    """揮杖施咒：往後蓄力再往前刺"""
    o, loc = idle(p)
    k = pos(S(p)) ** 0.6
    o.update({
        'upperarm_R': (-0.5 - 0.9 * k, 0.15, 0), 'forearm_R': (-1.2 + 1.0 * k, 0, 0), 'hand_R': (0.2 * k, 0, 0),
        'chest': (0.05 * k, 0, -0.15 * k), 'thigh_R': (0.15 * k, 0, 0), 'thigh_L': (-0.15 * k, 0, 0),
    })
    return o, loc


def stir(p):
    """攪拌坩堝：右手畫圈"""
    o, loc = idle(p)
    o.update({
        'spine': (0.12, 0, 0), 'head': (0.25, 0, 0),
        'upperarm_R': (-0.55 + 0.12 * C(p), 0.12 + 0.1 * S(p), -0.2), 'forearm_R': (-1.05 + 0.12 * S(p), 0, 0),
        'upperarm_L': (-0.3, -0.15, 0.2), 'forearm_L': (-1.0, 0, 0),
    })
    return o, loc


def read(p):
    """雙手捧書低頭看"""
    o, loc = idle(p)
    o.update({
        'head': (0.38 + 0.02 * S(p), 0, 0.04 * S(p, 1, 0.3)), 'neck': (0.12, 0, 0),
        'upperarm_L': (-0.35, -0.08, 0.35), 'upperarm_R': (-0.35, 0.08, -0.35),
        'forearm_L': (-1.4, 0, 0), 'forearm_R': (-1.4, 0, 0), 'hand_L': (0.3, 0, 0), 'hand_R': (0.3, 0, 0),
    })
    return o, loc


def sit_read(p):
    o, loc = sit(p)
    r, _ = read(p)
    for k in ('head', 'neck', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'):
        o[k] = r[k]
    return o, loc


def sleep(p):
    """仰躺在床上（錨點放在床的中央，高度是床面）"""
    b = S(p)
    o = {
        'hips': (-1.57, 0, 0), 'chest': (0.01 * b, 0, 0), 'head': (0.15, 0, 0.25),
        'upperarm_L': (0, -0.2, 0), 'upperarm_R': (-0.4, 0.15, -0.3), 'forearm_R': (-1.3, 0, 0),
        'thigh_L': (0.0, -0.04, 0), 'thigh_R': (-0.1, 0.06, 0), 'shin_R': (0.25, 0, 0), 'foot_L': (0.6, 0, 0), 'foot_R': (0.6, 0, 0),
        'robe_B_1': (-0.9, 0, 0), 'robe_B_2': (0, 0, 0), 'robe_F_L_1': (0.3, 0, 0), 'robe_F_R_1': (0.3, 0, 0), 'hood': (-0.6, 0, 0),
    }
    # 臀部從站姿的 0.95 公尺降到床面上 0.12 公尺，往後挪到床中央
    return o, (0, 0.0, -0.83)


def float_(p):
    """幽靈飄浮：腳往後拖、手臂鬆垂，整個人緩緩上下"""
    b = S(p)
    o = {
        'spine': (0.04, 0, 0.03 * S(p, 1, 0.2)), 'head': (-0.02 * b, 0, 0),
        'thigh_L': (0.12 + 0.05 * b, 0, 0), 'thigh_R': (0.2 - 0.05 * b, 0, 0), 'shin_L': (0.35, 0, 0), 'shin_R': (0.45, 0, 0),
        'foot_L': (0.6, 0, 0), 'foot_R': (0.6, 0, 0),
        'upperarm_L': (-0.1 + 0.06 * S(p, 1, 0.3), -0.18, 0), 'upperarm_R': (-0.1 + 0.06 * S(p, 1, 0.5), 0.18, 0),
        'forearm_L': (-0.4, 0, 0), 'forearm_R': (-0.4, 0, 0),
        'robe_B_1': (0.25 + 0.06 * S(p, 2), 0, 0), 'robe_B_2': (0.2 + 0.1 * S(p, 2, -0.2), 0, 0),
        'robe_F_L_2': (0.1 * S(p, 2, -0.1), 0, 0), 'robe_F_R_2': (0.1 * S(p, 2, -0.3), 0, 0),
    }
    return o, (0, 0, 0.05 * b)


def arms_crossed(p):
    o, loc = idle(p)
    b = S(p)
    o.update({
        'upperarm_L': (-0.42, -0.08, -0.85), 'upperarm_R': (-0.47, 0.08, 0.85),
        'forearm_L': (-1.85, 0, 0), 'forearm_R': (-1.8, 0, 0), 'head': (-0.04 + 0.02 * b, 0, 0.05 * S(p, 1, 0.2)),
    })
    return o, loc


def hands_back(p):
    """雙手背在身後，慢慢看四周"""
    o, loc = idle(p)
    o.update({
        'upperarm_L': (0.38, -0.1, 0.5), 'upperarm_R': (0.38, 0.1, -0.5),
        'forearm_L': (-1.25, 0, 0), 'forearm_R': (-1.25, 0, 0),
        'head': (-0.03, 0, 0.3 * S(p)), 'chest': (-0.03, 0, 0.06 * S(p)),
    })
    return o, loc


PLAYER_ACTIONS = [('idle', idle, 75), ('walk', walk, 24), ('run', run, 18), ('jump', jump, 30), ('fall', fall, 24),
                  ('land', land, 2), ('broom', broom_ride, 60), ('swim', swim, 36), ('lumos', lumos, 2)]
NPC_ACTIONS = [('idle', idle, 75), ('walk', walk, 24), ('run', run, 18), ('broom', broom_ride, 60),
               ('sit', sit, 120), ('sit_talk', sit_talk, 90), ('sit_read', sit_read, 120), ('talk', talk, 90),
               ('teach', teach, 150), ('wave', wave, 30), ('cast', cast, 45), ('stir', stir, 45), ('read', read, 120),
               ('sleep', sleep, 150), ('float', float_, 120), ('arms_crossed', arms_crossed, 120), ('hands_back', hands_back, 240)]


# ---------------------------------------------------------------- 骨架物件與動畫片段
def make_armature(name, bones, coll):
    arm_data = bpy.data.armatures.new(f'{name}_rig')
    arm = bpy.data.objects.new(name, arm_data)
    coll.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, h, t, par in bones:
        eb = arm_data.edit_bones.new(bn)
        eb.head, eb.tail = Vector(h), Vector(t)
        eb.roll = 0
        if par:
            eb.parent = arm_data.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def bake_actions(arm, actions, scene, loc_scale=1.0):
    scene.render.fps = FPS
    REST = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}

    def basis_quat(name, e):
        R = Euler(e, 'XYZ').to_matrix()
        Rest = REST[name]
        return (Rest.inverted() @ R @ Rest).to_quaternion()

    ad = arm.animation_data_create()
    pbs = arm.pose.bones
    for b in pbs:
        b.rotation_mode = 'QUATERNION'

    def apply_pose(fn, p):
        o, loc = fn(p)
        for b in pbs:
            b.rotation_quaternion = basis_quat(b.name, o.get(b.name, (0, 0, 0)))
            b.location = (0, 0, 0)
        pbs['hips'].location = REST['hips'].inverted() @ (Vector(loc) * loc_scale)

    made = {}
    for name, fn, n in actions:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ad.action = act
        frs = sorted(set(list(range(0, n + 1, 2)) + [n]))
        for fr in frs:
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
    return made


def set_action(arm, act, frame, scene):
    ad = arm.animation_data
    ad.action = act
    if act is not None and hasattr(ad, 'action_slot') and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    scene.frame_set(frame)
    bpy.context.view_layer.update()


def clear_pose(arm):
    if arm.animation_data:
        arm.animation_data.action = None
    for b in arm.pose.bones:
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)
