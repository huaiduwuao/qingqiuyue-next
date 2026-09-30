# 真人动捕 → 数字人的走 / 跑 / 待机

`public/mocap/{walk,run,idle}.json` 由这里的 `bvh2vrm.mjs` 从 CMU 动捕库(BVH,免费用于任何用途)转出来,
前端 `src/digital-human/vrm/mocap.ts` + `useVrmAnimation.ts` 播放。

BVH 原件在 node-1 `/data/liyang/blender/assets/mocap/cmu/`(清单见 qingqiuyue-go `scripts/blender/cmu_urls.txt`)。

```bash
node scripts/mocap/bvh2vrm.mjs 07_01.bvh public/mocap/walk.json --kind walk   # 正常走,一个步态 1.07 秒
node scripts/mocap/bvh2vrm.mjs 16_35.bvh public/mocap/run.json  --kind run    # 慢跑
node scripts/mocap/bvh2vrm.mjs 40_10.bvh public/mocap/idle.json --kind idle --len 5   # 等人时站着的 5 秒
```

- 重定向按骨骼**方向**对齐(CMU 静止姿态腿是撇开的,不是 VRM 的标准 T 字),输出 VRM 规范化骨骼的局部四元数。
- 走 / 跑自动截一个完整步态(左大腿往前摆的两次过零之间),去掉朝向漂移和水平位移;`stride` = 一个循环走多远(以腿长计),
  前端按人物实际走过的距离推进,脚不打滑。
- 待机自动找髋部水平移动最少的一段。
