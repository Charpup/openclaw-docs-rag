# Trigger Keywords (ZH) - Claw-Doc

用于技能描述、路由提示与社区传播时的中文场景词。

## 核心触发词

- OpenClaw
- 配置 / 设定 / 参数
- 网关 / Gateway
- 命令行 / CLI / 指令
- 自动化 / 定时任务 / Cron
- Webhook / Hooks
- 频道接入 / Discord / Telegram / Slack / Signal / 飞书
- 故障排查 / 报错 / 日志
- 插件 / 技能 / Tools
- 会话 / Memory / Context
- 模型 / Provider / Failover

## 场景化句式（示例）

- “OpenClaw 配置文件怎么改？”
- “网关连接不上怎么排查？”
- “cron 定时任务怎么写？”
- “Discord 频道路由怎么配置？”
- “这个报错在文档哪里有说明？”
- “OpenClaw 的 sessions 命令怎么用？”

## 设计原则

1. 中文词触发 → 映射到英文文档核心词（例如 “配置”→ config/configuration）
2. 保持中英兼容，不牺牲英文检索召回率
3. 优先覆盖高频运维场景：配置、自动化、渠道接入、排障
