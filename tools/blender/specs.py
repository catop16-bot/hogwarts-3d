"""每位角色的外觀參數（預設值見 body.py 的 DEFAULTS）。

學院：0 葛來分多、1 赫夫帕夫、2 雷文克勞、3 史萊哲林（與遊戲的 HOUSES 順序一致）。
"""

STUDENT_SCALE = 0.95

SPECS = {
    # 玩家：原創的學生，不戴眼鏡、棕色短髮；學院顏色由遊戲切換
    'player': dict(scale=STUDENT_SCALE, hair_style='short', hair=0x5e3d24, iris=0x4f5f6d, gloves=True, hair_seed=5),

    # ---------------------------------------------------------- 學生
    'harry': dict(scale=STUDENT_SCALE, glasses='round', gloves=True, iris=0x2f7a3e, house=0),
    'ron': dict(scale=1.0, house=0, hair_style='short', hair=0xb4501f, hair_seed=3, skin=0xf2d0b6, iris=0x4a6f9c, nose=1.15,
                under=0x7a2c24),
    'hermione': dict(scale=0.92, house=0, female=True, hair_style='bushy', hair=0x6e4529, hair_len=1.38, hair_seed=21,
                     iris=0x5a3a22, lip=0xc47c70, skin=0xf0c9ab),

    # ---------------------------------------------------------- 教職員
    'dumbledore': dict(outfit='teacher', scale=1.02, robe=0x4b2b70, lining=0xb89a4a, under=0x5a3a7a, shirt=0x3d2752,
                       trousers=0x2a1f33, boot=0x3a2a1e, hat='wizard', hat_color=0x4b2b70, hat_tip=0.6,
                       hair_style='long', hair=0xdad8d2, hair_len=1.42, beard='long', beard_color=0xe4e2dc, beard_len=1.0,
                       brow='beard', glasses='half', nose=1.35, hook=0.6, skin=0xeac3a8, iris=0x5d87b8, wand=0x9a9282),
    'mcgonagall': dict(outfit='teacher', female=True, scale=0.98, shoulders=0.94, robe=0x1d4a33, lining=0x123020,
                       closed=True, dress=0x173a29, under=0x173a29, shirt=0x173a29, trousers=0x173a29, boot=0x1c1a18,
                       hat='witch', hat_color=0x1d4a33, hat_tip=0.4, hair_style='bun', hair=0x3c3631, glasses='square', mouth='flat',
                       skin=0xebc8b4, iris=0x3b5a4a, lip=0xb07468),
    'snape': dict(outfit='teacher', scale=1.03, girth=0.95, robe=0x141417, lining=0x0d0d10, closed=True, buttons=True,
                  under=0x101012, shirt=0x101012, trousers=0x101012, boot=0x111111, hair_style='long', hair=0x0e0d0d,
                  hair_len=1.5, fringe=False, mouth='flat', skin=0xdcc5a8, nose=1.35, hook=1.0, iris=0x141210),
    'hagrid': dict(outfit='coat', scale=1.45, girth=1.45, belly=0.06, robe=0x5b3b24, lining=0x3b2616, under=0x6a5a40,
                   shirt=0x8a7a5a, trousers=0x3a2c20, boot=0x3a2618, hood=False, hair_style='bushy', hair=0x1d1712,
                   hair_len=1.46, hair_seed=8, beard='bushy', beard_color=0x1d1712, beard_len=1.32, iris=0x0d0b09,
                   skin=0xe0b394, nose=1.2, prop='umbrella', prop_color=0xe08aab),

    # ---------------------------------------------------------- 第 2 批：教職員
    'flitwick': dict(outfit='teacher', scale=0.58, head=1.32, girth=1.05, robe=0x2a2a3a, lining=0x24305a, under=0x3a3a4a,
                     shirt=0xe8e4da, trousers=0x22222a, boot=0x1c1a18, hair_style='short', hair=0xe2e0da, hair_seed=41,
                     moustache=True, beard_color=0xe2e0da, iris=0x3a2a1a, skin=0xeec8ae, nose=1.15),
    'sprout': dict(outfit='teacher', female=True, scale=0.94, girth=1.28, belly=0.06, robe=0x55603a, lining=0x3a4426,
                   dress=0x4a5232, under=0x4a5232, shirt=0x4a5232, trousers=0x3a3a2a, boot=0x3a2a1c, closed=True,
                   apron=0x7a5a3a, hat='witch', hat_color=0x5a4a32, hat_tip=1.0, hair_style='bushy', hair=0x9a958c,
                   hair_len=1.6, skin=0xeec2a2, iris=0x4a6a3a, mouth='smile'),
    'lupin': dict(outfit='teacher', scale=1.0, girth=0.95, robe=0x5a5048, lining=0x463e38, under=0x6a6458, shirt=0xd8d2c4,
                  trousers=0x3e3a36, boot=0x3a2c22, hair_style='short', hair=0x8a7458, hair_seed=17, moustache=True,
                  beard_color=0x7a6a52, skin=0xe6c4a8, iris=0x6a5a3a, tie=False),
    'trelawney': dict(outfit='teacher', female=True, scale=0.94, girth=0.92, robe=0x6a4a6e, lining=0x8a5a3a, dress=0x7a5a46,
                      under=0x7a5a46, shirt=0x7a5a46, trousers=0x5a3e34, boot=0x3a2a20, closed=True, shawl=0xb89a5a,
                      hair_style='bushy', hair=0x8a6a4a, hair_len=1.45, hair_seed=27, glasses='big', iris=0x3a3a5a,
                      skin=0xf0d4c0, lip=0xb07070),
    'sinistra': dict(outfit='teacher', female=True, scale=0.97, robe=0x1a2448, lining=0x3a4a8a, closed=True, dress=0x141c38,
                     under=0x141c38, shirt=0x141c38, trousers=0x141c38, boot=0x161414, hair_style='bun', hair=0x0f0c0b,
                     skin=0x6b4630, lip=0x7a4a3a, iris=0x1a120c),
    'hooch': dict(outfit='teacher', female=True, scale=0.98, robe=0x2a2a2c, lining=0xe8e4dc, closed=True, dress=0x2a2a2c,
                  under=0x2a2a2c, shirt=0xe8e4dc, trousers=0x2a2a2c, boot=0x1c1a18, hair_style='spiky', hair=0xb8b4ac,
                  hair_seed=9, iris=0xd8a020, skin=0xe8c8b0, mouth='flat'),
    'pomfrey': dict(outfit='teacher', female=True, scale=0.96, robe=0x6e2a2e, lining=0x5a2024, closed=True, dress=0x6e2a2e,
                    under=0x6e2a2e, shirt=0xeeeae2, trousers=0x5a2024, boot=0x1c1a18, apron=0xf2efe8, hat='nurse',
                    hat_color=0xf2efe8, hair_style='bun', hair=0x6a5a4a, iris=0x4a5a6a, skin=0xf0cdb8),
    'pince': dict(outfit='teacher', female=True, scale=0.97, girth=0.88, robe=0x2c2a36, lining=0x1e1c26, closed=True,
                  dress=0x24222c, under=0x24222c, shirt=0x24222c, trousers=0x24222c, boot=0x161414, hair_style='bun',
                  hair=0x4a4440, nose=1.25, hook=0.7, iris=0x2a2a2a, skin=0xe8d0bc, mouth='frown'),
    'filch': dict(outfit='coat', scale=0.97, girth=0.95, robe=0x4a3c30, lining=0x34291f, under=0x5a5040, shirt=0x8a8070,
                  trousers=0x3a3028, boot=0x2a2018, hood=False, hair_style='bald', hair=0x8a8478, beard='stubble',
                  beard_color=0xb2a290, nose=1.2, hook=0.4, iris=0x5a5040, skin=0xd8bca0, mouth='frown', prop=None),
    'vector': dict(outfit='teacher', female=True, scale=0.96, robe=0x3a1e3e, lining=0x6a3a6e, closed=True, dress=0x2e1832,
                   under=0x2e1832, shirt=0x2e1832, trousers=0x2e1832, boot=0x161414, hair_style='bun', hair=0x1a1412,
                   glasses='square', iris=0x2a1a12, skin=0xeec6aa),
    'babbling': dict(outfit='teacher', female=True, scale=0.95, robe=0x1e4a4a, lining=0x2e6a6a, closed=True, dress=0x1a3a3a,
                     under=0x1a3a3a, shirt=0x1a3a3a, trousers=0x1a3a3a, boot=0x161414, hair_style='long', hair=0x6a4a2a,
                     hair_len=1.42, iris=0x3a5a4a, skin=0xf0cdb4),
    'burbage': dict(outfit='teacher', female=True, scale=0.95, robe=0x4a6a8a, lining=0xd8c8a0, closed=True, dress=0x3a5470,
                    under=0x3a5470, shirt=0x3a5470, trousers=0x3a5470, boot=0x2a2018, hair_style='bun', hair=0x9a9088,
                    glasses='round', iris=0x4a6a8a, skin=0xf0d0bc),
    'slughorn': dict(outfit='teacher', scale=0.98, girth=1.38, belly=0.13, robe=0x2e4a3a, lining=0x6a4a2a, under=0x7a5a2a,
                     shirt=0xe8e0cc, trousers=0x2a2a22, boot=0x2a1c14, hair_style='bald', hair=0xb8a07a,
                     moustache='walrus', beard_color=0xc8b088, skin=0xf0c8a8, iris=0x6a7a5a, nose=1.15),
    'lockhart': dict(outfit='teacher', scale=1.02, robe=0x8a6ac0, lining=0xd8b44a, under=0x6a4a9a, shirt=0xf2eee6,
                     trousers=0x3a2a52, boot=0x2a1c3a, hair_style='long', hair=0xd8b45a, hair_len=1.56, hair_seed=33,
                     fringe=False, iris=0x3a7ac8, skin=0xf2d2bc, mouth='smile'),
    'rosmerta': dict(outfit='teacher', female=True, scale=0.96, robe=0x7a3a52, lining=0x5a2a3c, closed=True, dress=0x6a3044,
                     under=0x6a3044, shirt=0xf2eee6, trousers=0x6a3044, boot=0x2a1c14, apron=0xf2eee6, hair_style='long',
                     hair=0x9a5a2a, hair_len=1.4, iris=0x4a6a3a, skin=0xf2d0b8, lip=0xc06a6a, prop=None),

    # ---------------------------------------------------------- 第 2 批：學生
    'neville': dict(scale=0.93, head=1.04, girth=1.1, house=0, hair_style='short', hair=0x5a3a22, hair_seed=12, iris=0x4a3a2a, skin=0xf2d0b8),
    'ginny': dict(scale=0.9, house=0, female=True, hair_style='long', hair=0xb24a1c, hair_len=1.35, iris=0x6a4a2a, skin=0xf4d6c0),
    'seamus': dict(scale=0.95, house=0, hair_style='short', hair=0xa8844a, hair_seed=14, iris=0x4a6a9a, skin=0xf3d2bc),
    'dean': dict(scale=1.0, house=0, hair_style='short', hair=0x141110, hair_seed=15, iris=0x1a120c, skin=0x5c3a28, lip=0x6a3a30),
    'fred': dict(scale=1.02, house=0, hair_style='short', hair=0xb4501f, hair_seed=31, iris=0x4a6f9c, skin=0xf2d0b6),
    'george': dict(scale=1.02, house=0, hair_style='short', hair=0xb4501f, hair_seed=32, iris=0x4a6f9c, skin=0xf2d0b6),
    'percy': dict(scale=1.03, house=0, hair_style='short', hair=0xa6481c, hair_seed=34, glasses='round', badge=True,
                  iris=0x4a6f9c, skin=0xf2d0b6, mouth='flat'),
    'wood': dict(scale=1.05, girth=1.05, house=0, hair_style='short', hair=0x4a3220, hair_seed=35, iris=0x4a3a2a),
    'draco': dict(scale=0.97, house=3, hair_style='short', hair=0xe6dfc4, hair_seed=36, fringe=False, iris=0x8a9098,
                  skin=0xf3ddce, mouth='flat'),
    'crabbe': dict(scale=1.0, girth=1.35, belly=0.08, house=3, hair_style='short', hair=0x1a1512, hair_seed=37, iris=0x2a1a12,
                   mouth='flat', head=0.96),
    'goyle': dict(scale=1.04, girth=1.3, house=3, hair_style='spiky', hair=0x3a2a1a, hair_seed=38, iris=0x2a1a12, mouth='flat'),
    'pansy': dict(scale=0.92, house=3, female=True, hair_style='long', hair=0x161210, hair_len=1.6, iris=0x2a1a12, mouth='flat'),
    'luna': dict(scale=0.9, house=2, female=True, hair_style='long', hair=0xd8c79a, hair_len=1.3, iris=0x8aa8c8, skin=0xf4dcc8),
    'cho': dict(scale=0.92, house=2, female=True, hair_style='long', hair=0x0f0d0c, hair_len=1.42, iris=0x2a1a10, skin=0xecc9a8),
    'cedric': dict(scale=1.04, house=1, hair_style='short', hair=0x5a3a20, hair_seed=39, iris=0x7a8088),
    'hannah': dict(scale=0.9, house=1, female=True, hair_style='ponytail', hair=0xd8b870, iris=0x4a6a8a, skin=0xf4d6c4),
    'ernie': dict(scale=0.97, house=1, hair_style='short', hair=0x6a4a2a, hair_seed=40, nose=1.1, iris=0x4a4a3a, mouth='flat'),
    'justin': dict(scale=0.96, house=1, hair_style='messy', hair=0x4a3022, hair_seed=42, iris=0x4a5a3a),

    # ---------------------------------------------------------- 第 3 批：幽靈（網頁端會換成半透明的銀藍色）
    'nick': dict(outfit='coat', scale=1.0, robe=0x3a3a4a, lining=0x2a2a36, under=0x4a3a5a, shirt=0xeeeae2, trousers=0x2a2a36,
                 boot=0x1c1a18, hood=False, ruff=True, hair_style='long', hair=0x6a5a4a, hair_len=1.52, moustache=True,
                 beard='goatee', mouth='smile', prop=None),
    'friar': dict(outfit='teacher', scale=0.98, girth=1.4, belly=0.12, robe=0x6a5038, lining=0x4a3826, closed=True,
                  under=0x6a5038, shirt=0x6a5038, trousers=0x5a4430, boot=0x3a2a1c, rope=True, hair_style='bald',
                  hair=0x8a7a6a, mouth='smile', prop=None),
    'baron': dict(outfit='teacher', scale=1.04, girth=0.95, robe=0x2a2a30, lining=0x3a1a1a, closed=True, buttons=True,
                  under=0x22222a, shirt=0x22222a, trousers=0x22222a, boot=0x161414, hair_style='long', hair=0x1a1818,
                  hair_len=1.5, beard='long', beard_len=1.42, nose=1.2, hook=0.6, mouth='frown', prop=None),
    'greylady': dict(outfit='teacher', female=True, scale=1.04, girth=0.9, robe=0x6a6a72, lining=0x8a8a92, closed=True,
                     dress=0x5a5a62, under=0x5a5a62, shirt=0x5a5a62, trousers=0x5a5a62, boot=0x3a3a3a, hair_style='long',
                     hair=0x2a2420, hair_len=1.15, mouth='flat', prop=None),
    'myrtle': dict(scale=0.88, house=2, female=True, hair_style='ponytail', hair=0x1e1a18, glasses='big', mouth='frown',
                   iris=0x3a3a3a, prop=None, bag=False),
    'binns': dict(outfit='teacher', scale=0.97, girth=0.92, robe=0x3a3a44, lining=0x2a2a32, closed=True, under=0x2a2a32,
                  shirt=0x2a2a32, trousers=0x2a2a32, boot=0x1c1a18, hair_style='bald', hair=0xc8c4bc, glasses='half',
                  nose=1.2, mouth='flat', prop=None),
    # 皮皮鬼：不透明、穿得花花綠綠的小個子
    'peeves': dict(outfit='coat', scale=0.74, head=1.18, robe=0xd8701a, lining=0x6a2a8a, under=0x6a2a8a, shirt=0xf0d040,
                   trousers=0x2a6a3a, boot=0x6a2a8a, hood=False, hat='wizard', hat_color=0xd8701a, hat_tip=1.6,
                   hair_style='spiky', hair=0xb4501f, mouth='smile', iris=0x0e0c0a, nose=1.25, prop=None),

    # ---------------------------------------------------------- 第 3 批：家庭小精靈
    'dobby': dict(outfit='elf', legs=0.72, scale=0.56, head=1.75, girth=0.75, shoulders=0.8, skin=0xb4b49a, trousers=0xb4b49a,
                  boot=0xa4a48a, under=0xd8d0c0, shirt=0xd8d0c0, hair_style='none', iris=0x3a8a3a, eyes=1.9, nose=1.6,
                  lip=0x8a7a6a, hat='cosy', hat_color=0x8a3a3a, house=1, prop=None),
    'winky': dict(outfit='elf', legs=0.72, female=True, scale=0.52, head=1.75, girth=0.75, shoulders=0.8, skin=0xc0b49a,
                  trousers=0xc0b49a, boot=0xb0a48a, under=0xb04a3a, shirt=0xb04a3a, hair_style='none', iris=0x6a4a2a,
                  eyes=1.9, nose=1.3, lip=0x9a7a6a, prop=None),
    'elf_a': dict(outfit='elf', legs=0.72, scale=0.54, head=1.75, girth=0.75, shoulders=0.8, skin=0xa8a890, trousers=0xa8a890,
                  boot=0x98987e, under=0xe2dccc, shirt=0xe2dccc, hair_style='none', iris=0x3a5a8a, eyes=1.8, nose=1.5,
                  lip=0x8a7a6a, prop=None),
    'elf_b': dict(outfit='elf', legs=0.72, scale=0.51, head=1.75, girth=0.75, shoulders=0.8, skin=0xbcb0a0, trousers=0xbcb0a0,
                  boot=0xaca090, under=0x6a8a5a, shirt=0x6a8a5a, hair_style='bald', hair=0xd8d4cc, iris=0x5a4a2a,
                  eyes=1.8, nose=1.7, lip=0x8a7a6a, prop=None),
    'elf_c': dict(outfit='elf', legs=0.72, female=True, scale=0.5, head=1.75, girth=0.75, shoulders=0.8, skin=0xb0ac94,
                  trousers=0xb0ac94, boot=0xa09c84, under=0x8a6a9a, shirt=0x8a6a9a, hair_style='none', iris=0x3a7a6a,
                  eyes=1.9, nose=1.4, lip=0x9a7a6a, prop=None),
}

NPC_BATCH1 = ['harry', 'ron', 'hermione', 'dumbledore', 'mcgonagall', 'snape', 'hagrid']

NPC_BATCH2 = ['flitwick', 'sprout', 'lupin', 'trelawney', 'sinistra', 'hooch', 'pomfrey', 'pince', 'filch', 'vector', 'babbling',
              'burbage', 'slughorn', 'lockhart', 'rosmerta', 'neville', 'ginny', 'seamus', 'dean', 'fred', 'george', 'percy',
              'wood', 'draco', 'crabbe', 'goyle', 'pansy', 'luna', 'cho', 'cedric', 'hannah', 'ernie', 'justin']
NPC_BATCH3 = ['nick', 'friar', 'baron', 'greylady', 'myrtle', 'binns', 'peeves', 'dobby', 'winky', 'elf_a', 'elf_b', 'elf_c']


# ---------------------------------------------------------- 第 4 批：路人學生（每學院 6 種外觀，固定亂數）
def _crowd():
    import random
    rng = random.Random(2024)
    HAIR = [0x16130f, 0x2a1e18, 0x3a2a1a, 0x5a3a22, 0x6e4529, 0x8a6a3a, 0xc8a868, 0xe2d4a8, 0xa6481c]
    SKIN = [0xf4d6c4, 0xf0c9ab, 0xeec4a2, 0xe0b090, 0xc89070, 0x9a6a4a, 0x6b4630, 0x5c3a28]
    IRIS = [0x3b2a1a, 0x4a6a9a, 0x3a5a4a, 0x5a3a22, 0x6a7a8a, 0x2a1a10]
    out = {}
    for h in range(4):
        for i in range(6):
            fem = i % 2 == 1
            style = rng.choice(['long', 'ponytail', 'bun', 'long', 'bushy']) if fem else rng.choice(['short', 'short', 'messy', 'spiky'])
            skin = rng.choice(SKIN)
            out[f'crowd_{h}_{i}'] = dict(
                scale=rng.uniform(0.86, 1.0), house=h, female=fem, hair_style=style, hair=rng.choice(HAIR),
                hair_len=rng.uniform(1.32, 1.55), hair_seed=rng.randrange(1000), skin=skin, iris=rng.choice(IRIS),
                lip=0x8a5a48 if skin in (0x6b4630, 0x5c3a28) else 0xc07a6a, girth=rng.uniform(0.95, 1.12),
                glasses='round' if rng.random() < 0.15 else None, bag=rng.random() < 0.6, dorm=None,
                mouth=rng.choice(['smile', 'smile', 'flat']),
            )
            out[f'crowd_{h}_{i}'].pop('dorm')
    return out


CROWD = _crowd()
SPECS.update(CROWD)
