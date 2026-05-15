# Project Memory

## 项目信息
- **项目名称**：地图编辑器 (Map Editor)
- **类型**：纯前端 SPA
- **技术栈**：React 18 + TypeScript + Vite + MapLibre GL JS + Zustand + Tailwind CSS
- **创建日期**：2026-05-15

## 关键决策
- **地图引擎**：MapLibre GL JS（开源、高性能、矢量瓦片支持）
- **状态管理**：Zustand + zundo（轻量、支持 undo middleware）
- **UI 参考**：QGIS 风格三栏布局（左图层面板 + 中地图 + 右属性面板）
- **开发策略**：5 Phase 分阶段推进，每个 Phase 可独立运行
- **SHP 处理**：纯前端 shpjs 读取 / shp-write 写入，大文件性能有天花板
- **底图系统**：多底图叠加系统（basemapStore），支持高德/必应 × 标准/卫星，可叠加多个底图图层，每个可独立控制可见性和透明度，按 order 堆叠
- **坐标系**：支持 WGS84、GCJ-02、BD-09 互转（自定义数学实现，不依赖 proj4）
- **编辑功能**：点/线/面绘制（GeoJSON存储，工具切换自动新建图层）、节点拖拽编辑（显式编辑/完成模式开关）、选中高亮（自动同步激活图层）、属性面板编辑（要素属性 + 图层属性：点半径/线宽线型/面填充透明度/面边界独立颜色线宽线型/图层名称）、Undo/Redo（zundo editStore）
- **进度**：Phase 1-4 完成，底图图层系统重构完成，黑屏修复完成，GeoJSON加载修复，属性面板三模式重构完成，GeoJSON按feature拆分图层

## 文档体系
- 需求：[docs/requirements.md](../../docs/requirements.md)
- 技术：[docs/tech-spec.md](../../docs/tech-spec.md)
- 设计：[docs/design-spec.md](../../docs/design-spec.md)
- 计划：[docs/development-plan.md](../../docs/development-plan.md)
- 日志：[devlog/](../../devlog/)
