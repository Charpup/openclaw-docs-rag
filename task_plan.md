# Docs-RAG LLMs.txt Refactor - Task Plan

## Project Overview
废弃本地 RAG，重构为基于 llms.txt 的实时检索方案

## Phase 1: 立即停止并备份 (立即执行)
- [ ] 1.1 停止所有 docs-rag 同步进程
  - Kill sync-daemon.sh
  - Kill any running sync-docs.sh processes
  - Remove cron jobs
- [ ] 1.2 停止系统 crontab
  - Backup current crontab
  - Remove docs-rag related entries
- [ ] 1.3 备份 checkpoint 和数据库
  - Backup sync-checkpoint.json
  - Backup PostgreSQL database
  - Store backups with timestamp
- [ ] 1.4 标记旧代码为 deprecated
  - Move old src/ to src-deprecated/
  - Create deprecation notice

**Dependencies**: None  
**Estimated Complexity**: 2

## Phase 2: 开发实时检索方案
- [ ] 2.1 创建新的 fetcher-llms.js
  - Fetch llms.txt from docs.openclaw.ai
  - Parse llms.txt format
  - Extract document URLs
  - Cache document list (5min TTL)
- [ ] 2.2 创建新的 query-engine.js
  - Keywords matching algorithm
  - Document relevance scoring
  - Select top-K relevant docs
  - Simple in-memory cache
- [ ] 2.3 更新 index.js
  - Replace sync logic with real-time fetch
  - Integrate new fetcher and query engine
  - Maintain same API interface
  - Add cache management
- [ ] 2.4 添加简单缓存机制 (5分钟 TTL)
  - In-memory cache for llms.txt
  - In-memory cache for fetched docs
  - TTL cleanup

**Dependencies**: Phase 1  
**Estimated Complexity**: 5

## Phase 3: 测试与验证
- [ ] 3.1 测试实时检索功能
  - Test fetcher-llms.js
  - Test query-engine.js
  - Test end-to-end query
- [ ] 3.2 验证查询质量
  - Compare results with old RAG
  - Check relevance scores
  - Verify document coverage
- [ ] 3.3 性能测试
  - Measure query latency
  - Test concurrent queries
  - Verify cache effectiveness

**Dependencies**: Phase 2  
**Estimated Complexity**: 3

## Phase 4: 部署与清理
- [ ] 4.1 更新 SKILL.md 文档
  - Document new architecture
  - Update usage examples
  - Add troubleshooting section
- [ ] 4.2 推送 GitHub
  - Commit all changes
  - Push to main branch
- [ ] 4.3 创建 Release
  - Tag v4.0.0
  - Write release notes
- [ ] 4.4 设置 5分钟 cron 监控
  - Create simple health check script
  - Add to crontab
- [ ] 4.5 清理旧代码和数据库
  - Remove src-deprecated/
  - Clean up old database tables
  - Remove checkpoint files

**Dependencies**: Phase 3  
**Estimated Complexity**: 3

## DAG Dependencies
```
Phase 1 → Phase 2 → Phase 3 → Phase 4
```

## Output Requirements
- [ ] All code changes
- [ ] Updated README.md
- [ ] GitHub Release v4.0.0
- [ ] Development log (development-log.md)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| llms.txt unavailable | High | Fallback to cached version |
| Query quality degradation | Medium | A/B testing with old system |
| Performance issues | Low | Cache + rate limiting |
