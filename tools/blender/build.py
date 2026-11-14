"""角色模型產生器的入口：在背景執行 Blender（不需要開視窗）。

  B=/Applications/Blender.app/Contents/MacOS/Blender
  # 玩家角色（含掃帚、魔杖尖端、玩家用的 9 個動畫片段）
  $B -b --factory-startup -P tools/blender/build.py -- --player --out public/models/student.glb
  # NPC：每人一個輕量模型（不含動畫），預覽圖輸出到 --preview 開頭的路徑
  $B -b --factory-startup -P tools/blender/build.py -- --npc harry,ron --outdir public/models/npc --preview /tmp/npc
  # NPC 共用的動畫片段
  $B -b --factory-startup -P tools/blender/build.py -- --anims public/models/npc/anims.glb --preview /tmp/anims
"""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from lib import UP, Geo, lin, tube  # noqa: E402
from rig import NPC_ACTIONS, PLAYER_ACTIONS, bake_actions, bone_list, clear_pose, make_armature, nm, set_action  # noqa: E402
import body  # noqa: E402
import animals  # noqa: E402
from specs import NPC_BATCH1, NPC_BATCH2, NPC_BATCH3, SPECS  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--player', action='store_true')
ap.add_argument('--out', default='public/models/student.glb')
ap.add_argument('--npc', default='')
ap.add_argument('--outdir', default='public/models/npc')
ap.add_argument('--anims', default='')
ap.add_argument('--animals', default='', help='動物：all 或逗號分隔')
ap.add_argument('--preview', default='')
ap.add_argument('--ratio', type=float, default=0.42, help='NPC 減面比例')
ap.add_argument('--blend', default='')
args = ap.parse_args(argv)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def make_material(name, hexc, rough, double):
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
    return m


def mesh_object(name, G, mats, arm, coll):
    """把 Geo 變成蒙皮網格：只放用到的材質（順序照 mats）"""
    used = [m for m in mats if m[0] in set(G.fm)]
    idx = {m[0]: i for i, m in enumerate(used)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in G.v], [], G.f)
    for n, c, r, d in used:
        me.materials.append(make_material(n, c, r, d))
    me.polygons.foreach_set('material_index', [idx[m] for m in G.fm])
    me.polygons.foreach_set('use_smooth', [True] * len(G.f))
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    groups = {}
    for i, ws in enumerate(G.w):
        for b, w in ws.items():
            b = nm(b)
            if b not in groups:
                groups[b] = ob.vertex_groups.new(name=b)
            groups[b].add([i], w, 'REPLACE')
    if arm is not None:
        ob.parent = arm
        mod = ob.modifiers.new('rig', 'ARMATURE')
        mod.object = arm
    return ob


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def build_character(key, scene, decimate=None):
    G, bones, mats, extra = body.build(SPECS[key])
    bones = [(nm(a), h, t, nm(p) if p else None) for a, h, t, p in bones]
    coll = scene.collection
    arm = make_armature(key, bones, coll)
    ob = mesh_object(f'{key}_body', G, mats, None, coll)
    if decimate:
        # 減面：網頁上同時會有幾十個人，每人壓到幾千個三角形
        dm = ob.modifiers.new('lod', 'DECIMATE')
        dm.ratio = decimate
        dm.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=dm.name)
    ob.parent = arm
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    return arm, ob, mats, extra


# ---------------------------------------------------------------- 預覽
def setup_render(scene):
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_cavity = True
    sh.show_shadows = True
    world = bpy.data.worlds.new('bg')
    world.color = (0.62, 0.66, 0.7)
    scene.world = world
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 85
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
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
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass
    print(f'[build] preview {out_path}')


def render_turnaround(scene, prefix, height, head_z):
    cam = setup_render(scene)
    scene.render.resolution_x = 440
    scene.render.resolution_y = 760
    h = height
    paths = []
    for name, ang in (('front', 0), ('tq', -0.75), ('side', -math.pi / 2), ('back', math.pi), ('face', -0.35)):
        if name == 'face':
            dist, tgt = 1.25 * head_z / 1.72, Vector((0, 0, head_z - 0.03 * head_z / 1.72))
        else:
            dist, tgt = 5.6 * h / 1.84, Vector((0, 0, h * 0.5))
        aim(cam, tgt, ang, dist, 0.05 if name == 'face' else 0.12)
        scene.render.filepath = f'{prefix}_{name}.png'
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet(paths, f'{prefix}_sheet.png')
    bpy.data.objects.remove(cam)


def render_anims(scene, arm, made, shots, prefix, broom=None):
    cam = setup_render(scene)
    scene.render.resolution_x = 360
    scene.render.resolution_y = 600
    paths = []
    for i, (name, fr, ang) in enumerate(shots):
        set_action(arm, made[name], fr, scene)
        if broom is not None:
            broom.hide_render = name != 'broom'
        aim(cam, Vector((0, 0, 0.85)), ang, 5.4)
        scene.render.filepath = f'{prefix}_{i:02d}.png'
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet(paths, f'{prefix}_anim.png')
    set_action(arm, None, 0, scene)
    clear_pose(arm)
    bpy.data.objects.remove(cam)


def export(objs, out, animations):
    for ob in bpy.data.objects:
        ob.select_set(ob in objs)
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kw = dict(filepath=out, export_format='GLB', use_selection=True)
    if animations:
        kw['export_animation_mode'] = 'ACTIONS'
    else:
        kw['export_animations'] = False
    bpy.ops.export_scene.gltf(**kw)
    print(f'[build] exported {out} {os.path.getsize(out) / 1024:.0f} KB')


# ---------------------------------------------------------------- 玩家
def build_player():
    scene = reset()
    arm, ob, mats, extra = build_character('player', scene)
    coll = scene.collection
    # 掃帚：獨立物件掛在 root 骨，網頁端切換顯示
    bG = Geo({})
    v, f, _ = tube([((0, -1.05, 0.8), 0.016, 0.016), ((0, 0.2, 0.8), 0.019, 0.019), ((0, 0.66, 0.8), 0.021, 0.021)], 10, cap0=True, cap1=True, ref=UP)
    bG.add(v, f, 'wood', ['root'])
    v, f, _ = tube([((0, 0.58, 0.8), 0.046, 0.046), ((0, 0.665, 0.8), 0.046, 0.046)], 12, cap0=True, cap1=True, ref=UP)
    bG.add(v, f, 'wood', ['root'])
    v, f, _ = tube([((0, 0.6, 0.8), 0.04, 0.04), ((0, 0.75, 0.8), 0.085, 0.085), ((0, 0.98, 0.8), 0.118, 0.115), ((0, 1.22, 0.8), 0.1, 0.095)],
                   20, cap1=True, ref=UP, mod=lambda a, t: 1 + 0.14 * t * math.sin(13 * a))
    bG.add(v, f, 'straw', ['root'])
    broom = mesh_object('broom', bG, mats, None, coll)
    broom.vertex_groups.clear()
    tip = bpy.data.objects.new('wand_tip', None)
    tip.empty_display_size = 0.03
    coll.objects.link(tip)
    bpy.context.view_layer.update()
    for o, bone, world in ((broom, 'root', Matrix.Identity(4)), (tip, 'hand_R', Matrix.Translation(extra['wand_tip']))):
        o.parent = arm
        o.parent_type = 'BONE'
        o.parent_bone = bone
        bpy.context.view_layer.update()
        o.matrix_world = world
    bpy.context.view_layer.update()
    print(f'[build] player tris={tris_of(ob) + tris_of(broom)} materials={len(ob.data.materials)}')
    made = bake_actions(arm, PLAYER_ACTIONS, scene, 1.0)
    if args.preview:
        broom.hide_render = True
        render_turnaround(scene, f'{args.preview}_player', extra['height'], extra['head_z'])
        render_anims(scene, arm, made, [('walk', 0, -1.15), ('walk', 6, -1.15), ('run', 5, -1.15), ('idle', 0, -1.15),
                                        ('jump', 0, -1.15), ('broom', 0, -1.15), ('swim', 9, -1.15), ('lumos', 0, -1.15)],
                     f'{args.preview}_player', broom)
        broom.hide_render = False
    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    arm.animation_data.action = None
    export([arm, ob, broom, tip], args.out, True)


# ---------------------------------------------------------------- NPC
def build_npc(key):
    scene = reset()
    arm, ob, mats, extra = build_character(key, scene, args.ratio)
    print(f'[build] {key} tris={tris_of(ob)} verts={len(ob.data.vertices)} materials={len(ob.data.materials)} height={extra["height"]:.2f}')
    if args.preview:
        render_turnaround(scene, f'{args.preview}_{key}', extra['height'], extra['head_z'])
    export([arm, ob], os.path.join(args.outdir, f'{key}.glb'), False)


def build_anims(out):
    scene = reset()
    # 參考角色：用 Harry 的外觀（預覽用），匯出時只留一個小三角形讓骨架以蒙皮的形式匯出
    arm, ob, mats, extra = build_character('harry', scene, args.ratio)
    made = bake_actions(arm, NPC_ACTIONS, scene, 1.0)
    if args.preview:
        shots = [(n, 0, -1.15) for n, _, _ in NPC_ACTIONS if n not in ('walk', 'run', 'broom')]
        shots.insert(0, ('walk', 6, -1.15))
        shots.append(('sit', 0, -0.4))
        shots.append(('arms_crossed', 0, -0.3))
        shots.append(('hands_back', 0, 2.6))
        render_anims(scene, arm, made, shots, args.preview)
    tG = Geo({})
    tG.add([(0, 0, 0), (0.01, 0, 0), (0, 0, 0.01)], [(0, 1, 2)], 'skin', ['root'])
    stub = mesh_object('stub', tG, [('skin', 0xffffff, 0.8, False)], arm, scene.collection)
    bpy.data.objects.remove(ob)
    arm.animation_data.action = None
    export([arm, stub], out, True)


def build_animal(key):
    scene = reset()
    G, bones, mats, acts, height = animals.build_animal(key)
    coll = scene.collection
    arm = make_armature(key, bones, coll)
    ob = mesh_object(f'{key}_body', G, mats, arm, coll)
    made = bake_actions(arm, acts, scene, 1.0)
    print(f'[build] {key} tris={tris_of(ob)} verts={len(ob.data.vertices)} height={height:.2f} clips={list(made)}')
    if args.preview:
        render_turnaround(scene, f'{args.preview}_{key}', max(height, 0.3), height * 0.8)
        shots = [(n, 4, -1.4) for n in made]
        render_anims_scaled(scene, arm, made, shots, f'{args.preview}_{key}', height)
    arm.animation_data.action = None
    export([arm, ob], os.path.join(args.outdir, f'{key}.glb'), True)


def render_anims_scaled(scene, arm, made, shots, prefix, height):
    cam = setup_render(scene)
    scene.render.resolution_x = 360
    scene.render.resolution_y = 360
    paths = []
    for i, (name, fr, ang) in enumerate(shots):
        set_action(arm, made[name], fr, scene)
        aim(cam, Vector((0, 0, height * 0.45)), ang, max(height, 0.4) * 5.5, 0.25)
        scene.render.filepath = f'{prefix}_{i:02d}.png'
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    sheet(paths, f'{prefix}_anim.png')
    set_action(arm, None, 0, scene)
    clear_pose(arm)
    bpy.data.objects.remove(cam)


if args.player:
    build_player()
if args.npc:
    from specs import CROWD
    keys = list(CROWD) if args.npc == 'crowd' else NPC_BATCH1 if args.npc == 'batch1' else NPC_BATCH2 if args.npc == 'batch2' else NPC_BATCH3 if args.npc == 'batch3' else (list(k for k in SPECS if k != 'player') if args.npc == 'all' else args.npc.split(','))
    for k in keys:
        build_npc(k)
if args.anims:
    build_anims(args.anims)
if args.animals:
    for k in (list(animals.ANIMALS) if args.animals == 'all' else args.animals.split(',')):
        build_animal(k)
