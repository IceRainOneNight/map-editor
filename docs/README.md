# 地图编辑器 — 项目文档索引

## 文档结构

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [requirements.md](./requirements.md) | 功能需求、用户故事、验收标准 |
| 技术规范 | [tech-spec.md](./tech-spec.md) | 技术选型、架构设计、依赖清单 |
| 设计规范 | [design-spec.md](./design-spec.md) | UI 布局、交互规范、组件层级 |
| 开发计划 | [development-plan.md](./development-plan.md) | 分阶段执行计划、里程碑、任务分解 |

## 开发日志

开发过程中自动记录完成事项和待办：
- 日志目录：[devlog/](../devlog/)
- 日志索引：[devlog/README.md](../devlog/README.md)

## 快速开始

1. 阅读 [requirements.md](./requirements.md) 了解完整功能需求
2. 阅读 [tech-spec.md](./tech-spec.md) 了解技术选型和架构
3. 阅读 [design-spec.md](./design-spec.md) 了解 UI/UX 设计
4. 按 [development-plan.md](./development-plan.md) 的 Phase 顺序推进开发

## 项目仓库

```
workmap/
├── docs/                   # 项目文档
│   ├── README.md           # ← 当前文件
│   ├── requirements.md     # 需求文档
│   ├── tech-spec.md        # 技术规范
│   ├── design-spec.md      # 设计规范
│   └── development-plan.md # 开发计划
├── devlog/                 # 开发日志
│   ├── README.md
│   └── YYYY-MM-DD.md
└── src/                    # 源代码（Phase 1 创建）
    ├── components/
    ├── hooks/
    ├── store/
    ├── utils/
    └── App.tsx
```
