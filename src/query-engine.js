/**
 * query-engine.js - Keyword-based document selection engine
 *
 * Supports English + Chinese query expansion for OpenClaw docs retrieval.
 */

class QueryEngine {
  constructor(options = {}) {
    this.stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
      'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'am', 'it', 'its', 'we', 'our', 'ours',
      'you', 'your', 'yours', 'they', 'them', 'their', 'theirs', 'i', 'me',
      'my', 'mine', 'he', 'him', 'his', 'she', 'her', 'hers', 'openclaw'
    ]);

    this.zhSemanticHints = {
      '配置': ['config', 'configuration', 'settings', 'gateway'],
      '设定': ['config', 'configuration', 'settings'],
      '安装': ['install', 'setup', 'onboard'],
      '部署': ['deploy', 'gateway', 'docker'],
      '网关': ['gateway', 'remote', 'authentication'],
      '命令': ['cli', 'command', 'reference'],
      '命令行': ['cli', 'command', 'reference'],
      '通道': ['channels', 'channel', 'routing'],
      '频道': ['channels', 'discord', 'telegram', 'slack', 'signal'],
      '机器人': ['bot', 'channels', 'message'],
      '自动化': ['automation', 'cron', 'hooks', 'webhook'],
      '定时': ['cron', 'automation', 'schedule'],
      '定时任务': ['cron', 'automation', 'schedule'],
      '排障': ['troubleshooting', 'debugging', 'doctor', 'logs'],
      '故障': ['troubleshooting', 'debugging', 'doctor', 'logs'],
      '报错': ['troubleshooting', 'debugging', 'logs'],
      '模型': ['models', 'providers', 'failover'],
      '记忆': ['memory', 'session', 'context'],
      '会话': ['session', 'sessions', 'context'],
      '权限': ['auth', 'oauth', 'security', 'secrets'],
      '安全': ['security', 'secrets', 'sandbox'],
      '插件': ['plugins', 'skills', 'tools'],
      '技能': ['skills', 'plugins'],
      '浏览器': ['browser', 'cdp'],
      '节点': ['node', 'nodes', 'pairing'],
      '更新': ['update', 'upgrade', 'release'],
      '文档': ['docs', 'reference', 'help']
    };

    this.categoryWeights = {
      'CLI Reference': 1.2,
      'Channels': 1.1,
      'Automation': 1.1,
      'Configuration': 1.0,
      'General': 1.0
    };
  }

  extractQueryKeywords(query) {
    const queryLower = (query || '').toLowerCase();
    const keywordSet = new Set();

    // English/word tokens (unicode-aware)
    const wordTokens = queryLower.match(/[\p{L}\p{N}_-]+/gu) || [];
    for (const token of wordTokens) {
      if (token.length > 2 && !this.stopWords.has(token)) {
        keywordSet.add(token);
      }
    }

    // Chinese semantic expansion: if phrase appears in raw query, inject mapped English hints
    for (const [zhKey, hints] of Object.entries(this.zhSemanticHints)) {
      if (query.includes(zhKey)) {
        hints.forEach(h => keywordSet.add(h));
      }
    }

    return Array.from(keywordSet);
  }

  calculateRelevance(queryKeywords, doc) {
    let score = 0;
    const docKeywords = new Set(doc.keywords || []);
    const titleLower = doc.title.toLowerCase();
    const categoryLower = (doc.category || '').toLowerCase();

    for (const keyword of queryKeywords) {
      if (titleLower.includes(keyword)) {
        score += 10;
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (wordBoundaryRegex.test(titleLower)) {
          score += 5;
        }
      }

      if (docKeywords.has(keyword)) {
        score += 3;
      }

      if (categoryLower.includes(keyword)) {
        score += 2;
      }

      for (const docKeyword of docKeywords) {
        if (docKeyword.includes(keyword) || keyword.includes(docKeyword)) {
          score += 1;
        }
      }
    }

    const categoryWeight = this.categoryWeights[doc.category] || 1.0;
    score *= categoryWeight;

    return score;
  }

  search(query, documents, options = {}) {
    const topK = options.topK || 5;
    const minScore = options.minScore || 1;

    const queryKeywords = this.extractQueryKeywords(query);

    if (queryKeywords.length === 0) {
      return documents.slice(0, topK).map(doc => ({
        ...doc,
        score: 1
      }));
    }

    const scored = documents.map(doc => ({
      ...doc,
      score: this.calculateRelevance(queryKeywords, doc)
    }));

    return scored
      .filter(doc => doc.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  formatContext(results) {
    if (!results || results.length === 0) {
      return 'No relevant documentation found.';
    }

    const sections = results.map((result, index) => {
      const content = result.content
        ? result.content.slice(0, 3000)
        : 'Content not available';

      return `## Document ${index + 1}: ${result.title}
**Category:** ${result.category}
**Relevance:** ${result.score.toFixed(2)}
**URL:** ${result.url}

${content}
`;
    });

    return sections.join('\n---\n\n');
  }

  getSources(results) {
    return results.map((result, index) => ({
      index: index + 1,
      title: result.title,
      url: result.url,
      category: result.category,
      score: result.score
    }));
  }
}

module.exports = { QueryEngine };
