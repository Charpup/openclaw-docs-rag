---
name: claw-doc
description: OpenClaw 文档实时检索技能（llms.txt + markdown 拉取）。适用于 OpenClaw 配置、网关、CLI、自动化、频道接入、故障排查等场景；支持中英文关键词触发。
version: 5.0.0
---

# Claw-Doc (v5.x)

面向 OpenClaw 官方文档的实时检索技能（无本地向量库、无同步任务依赖）。

## 适用场景（中文触发）

- 配置 / 设定 / settings
- OpenClaw / 网关 / gateway
- 命令行 / CLI / 命令
- 自动化 / 定时任务 / cron / webhook
- 频道接入（Discord / Telegram / Slack / Signal / Feishu）
- 故障排查 / 报错 / troubleshooting
- 插件 / 技能 / tools

## Core Flow

1. 拉取并解析 `https://docs.openclaw.ai/llms.txt`
2. 关键词匹配相关页面（含中文语义扩展）
3. 获取目标页面内容（markdown 优先）
4. 返回上下文与来源链接

## Quick Usage

```bash
./query-docs.sh "如何配置 cron 定时任务"
node index.js query "openclaw gateway configuration"
node index.js status
node index.js clear-cache
```

## References

- [README](./README.md)
- [CHANGELOG](./CHANGELOG.md)
- [Trigger Keywords (ZH)](./references/trigger-keywords-zh.md)
