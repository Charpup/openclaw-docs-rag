# OpenClaw Claw-Doc v5.0

Claw-Doc 是 OpenClaw 官方文档实时检索技能：基于 `llms.txt` 动态索引 + 页面实时抓取，无需本地向量库。

## Why v5.0

- ✅ 去除“RAG”命名，定位更清晰（文档检索助手）
- ✅ 新增中文语义触发（配置、网关、命令行、自动化、排障等）
- ✅ 保留轻量架构：无 DB、无 embeddings、无定时同步依赖

## Quick Start

```bash
git clone https://github.com/Charpup/openclaw-claw-doc.git ~/.openclaw/skills/claw-doc
cd ~/.openclaw/skills/claw-doc
npm install

./query-docs.sh "OpenClaw 配置怎么改"
./query-docs.sh "discord channel routing"
```

## Usage

```bash
node index.js query "如何配置 cron 定时任务"
node index.js status
node index.js clear-cache
```

## Chinese Trigger Scenarios

见：`references/trigger-keywords-zh.md`

## Architecture

```
User Query -> llms.txt Fetch -> Keyword Matching -> Page Fetch -> Context Output
               (TTL cache)      (EN + ZH hints)    (markdown-first)
```

## License

MIT

## Changelog
- 2026-03-11: Skill audit upgrade — normalized SKILL.md frontmatter to `name` + `description`, revalidated trigger wording, and rechecked lightweight lint/smoke compatibility with OpenClaw.
