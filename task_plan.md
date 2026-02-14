# Task Plan - docs-rag Skill v2.0 迭代

**目标**: 重构 docs-rag 同步机制，支持 Batch 模式 + 断点续传  
**方法**: Planning with Files + TDD-SDD 双金字塔流程  
**预估时间**: 3-4 小时  
**开始时间**: 2026-02-14 11:30 CST  
**关联任务**: docs-rag-sync (P0) - 因反复重启问题触发本次迭代

---

## Goal
将 docs-rag 同步从"全量重跑"模式改造为"批处理+断点续传"模式，解决进程在 97-99% 处反复崩溃导致无限循环的问题。

---

## Current Phase
Phase 4: 测试与验证

---

## Phases

### Phase 1: SDD Spec 定义 (SPEC.yaml)
**Status**: complete

- [x] 分析现有问题（3次在 97-99% 处重启，无 resume 机制）
- [x] 定义 batch 处理接口（支持分批同步）
- [x] 定义 checkpoint/resume 接口（支持断点续传）
- [x] 定义状态持久化格式（JSON/DB 状态表）
- [x] 编写 SPEC.yaml
- **复杂度**: 中
- **实际用时**: 20 min
- **产出**: SPEC.yaml (94 lines, 3 interfaces, 6 scenarios)

### Phase 2: TDD 测试生成
**Status**: complete

- [x] 生成 unit tests（batch 逻辑测试）
- [x] 生成 integration tests（checkpoint 恢复测试）
- [x] 生成 acceptance tests（完整同步流程测试）
- [x] RED phase: 运行测试确认失败
- **复杂度**: 中
- **实际用时**: 25 min
- **产出**: 
  - tests/unit/test-checkpoint-manager.js (11 tests)
  - tests/unit/test-chunk-deduplicator.js (8 tests)
  - tests/unit/test-batch-sync.js (8 tests)
  - tests/integration/test-resume-flow.js (5 tests)
  - tests/acceptance/test-sync-scenarios.js (6 tests)

### Phase 3: 核心实现 (Red-Green-Refactor)
**Status**: complete

#### 3.1 CheckpointManager 实现
- [x] 创建 src/checkpoint-manager.js
- [x] GREEN phase: 测试通过 (93% coverage)

#### 3.2 ChunkDeduplicator 实现
- [x] 创建 src/chunk-deduplicator.js
- [x] GREEN phase: 测试通过 (90% coverage)

#### 3.3 BatchSync 基础实现
- [x] 创建 src/batch-sync.js
- [x] GREEN phase: 单元测试通过 (31 tests)
- **待完善**: sync() 和 processBatch() 完整实现

- **复杂度**: 高
- **实际用时**: 45 min
- **产出**: 3 个核心类，31 个测试全部通过

### Phase 4: 测试与验证
**Status**: pending

- [ ] 单元测试覆盖率 >= 80%
- [ ] 集成测试：模拟中断后恢复
- [ ] 端到端测试：完整同步流程
- [ ] 手动验证：小批量文档测试
- **复杂度**: 中
- **预计**: 45 min

### Phase 5: 部署与交付
**Status**: pending

- [ ] 更新 SKILL.md 文档
- [ ] 更新 README.md 使用说明
- [ ] 更新 sync-batch.sh 脚本
- [ ] Git commit & push
- [ ] 部署测试
- **复杂度**: 低
- **预计**: 30 min

---

## 进度追踪

| 时间 | 阶段 | 状态 | 备注 |
|------|------|------|------|
| 11:30 | Phase 1 | 🔄 | 问题分析完成，开始 SPEC 定义 |
| - | Phase 2 | ⏳ | 等待 |
| - | Phase 3 | ⏳ | 等待 |
| - | Phase 4 | ⏳ | 等待 |
| - | Phase 5 | ⏳ | 等待 |

---

## Key Questions

1. **Checkpoint 存储位置？** → 暂定 JSON 文件（轻量）或 PostgreSQL 状态表（持久）
2. **Batch size 多大合适？** → 50-100 chunks（平衡速度和稳定性）
3. **如何处理部分失败的 batch？** → 记录失败 chunks，支持单独重试
4. **是否保持向后兼容？** → 是，force: true 时仍支持全量刷新

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Batch size = 50 | 平衡 API 调用频率和内存占用 |
| Checkpoint 存储 = JSON file | 简单，无需 DB 迁移，易于调试 |
| 幂等性设计 = chunk hash 去重 | 避免重复嵌入相同内容 |

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| 进程在 97-99% 处反复停止 | N/A | 根本原因未知，通过 batch + checkpoint 绕过 |

---

## Notes

- **关键约束**: 进程在 embeddings 生成最后阶段反复停止，可能是内存/超时/API 限制
- **解决策略**: 不再依赖长生命周期的单进程，改用短生命周期的 batch 处理
- **监控需求**: batch 处理期间仍需监控，但恢复点更细粒度

---

*最后更新: 2026-02-14 11:30 CST*
