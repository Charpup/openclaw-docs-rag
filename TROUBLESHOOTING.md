# Troubleshooting Guide

This guide documents common issues and their solutions for the openclaw-docs-rag skill.

---

## Case 1: pyenv Lock Blocking Shell Execution

**Symptoms:**
- All `exec` commands timeout after 5-60 seconds
- Error message: `pyenv: cannot rehash: couldn't acquire lock /root/.pyenv/shims/.pyenv-shim for 60 seconds`
- Shell becomes completely unresponsive

**Root Cause:**
The `.bashrc` file contains `eval "$(pyenv init -)"` which triggers a rehash on every shell startup. When the pyenv shim lock file gets stuck, all bash processes hang waiting for the lock.

**Impact:**
- OpenClaw exec commands fail (timeout)
- Cannot diagnose via normal shell commands
- System appears resource-starved when it's actually a lock contention issue

**Solution:**
```bash
# Clear the stuck lock file
rm -f /root/.pyenv/shims/.pyenv-shim
pyenv rehash
```

**Prevention:**
- Monitor pyenv lock file age
- Consider lazy-loading pyenv only when needed

---

## Case 2: Missing Environment Variables in Scripts

**Symptoms:**
- `query-docs.sh` fails with: `Embedding API error: {"error":{"message":"[undefined]无效的令牌"}}`
- `sync-docs.sh` fails with: `Error: OPENAI_API_KEY not set`
- Database connection fails: `password authentication failed for user "memu"`

**Root Cause:**
Shell scripts don't automatically load the `.env` file. They expect environment variables to be pre-exported in the shell.

**Solution:**
Add automatic `.env` loading to scripts:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi
```

**Alternative - Hardcode Passwords (Cloud VM):**
For cloud VMs with isolation, hardcode passwords in source:
```javascript
// src/store.js
password: config.password || process.env.PGPASSWORD || 'memu_secure_password'
```

---

## Case 3: Database Not Initialized

**Symptoms:**
- Query fails with: `relation "openclaw_docs_chunks" does not exist`
- Sync appears to succeed but data is not queryable

**Solution:**
Run initialization before first sync:
```bash
npm run init-db
```

This creates:
- pgvector extension
- `openclaw_docs_chunks` table
- Vector similarity search index

---

## Case 4: Background Agents Overwhelming System

**Symptoms:**
- Exec commands randomly fail or timeout
- Multiple overlapping cron jobs
- High CPU/memory usage with no apparent cause
- Session list shows many "isolated" subagents

**Root Cause:**
Too many concurrent cron jobs with short intervals (10-15 minutes) spawn isolated sessions faster than they complete.

**Diagnosis:**
```bash
# Check active sessions
openclaw sessions list

# Check process list
ps aux --sort=-%cpu | head -20

# Check cron jobs
openclaw cron list
```

**Solution:**
1. Disable overlapping jobs:
```bash
openclaw cron update <job-id> --enabled=false
```

2. Increase intervals (hours instead of minutes):
```bash
openclaw cron update <job-id> --every 3600000  # 1 hour
```

3. Use longer timeouts for heavy operations:
```bash
openclaw cron update <job-id> --timeout 300  # 5 minutes
```

---

## Case 5: Embedding API Authentication Failures

**Symptoms:**
- Sync fails mid-way with API errors
- Query returns empty results or auth errors
- Error: `无效的令牌` (Invalid token)

**Diagnosis:**
Check API connectivity:
```bash
curl -s https://api.apiyi.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"test"}'
```

**Common Causes:**
1. API key not exported in environment
2. Wrong base URL (default vs apiyi)
3. Rate limiting (add delays between requests)

**Solution:**
Ensure `.env` is loaded or variables are exported before running scripts.

---

## Debug Checklist

When docs-rag fails, check in order:

1. **Shell health**: `echo test` → should return instantly
2. **Docker status**: `docker ps | grep postgres` → should show "Up"
3. **Database connectivity**: `psql -h localhost -U memu -d memu_db -c "SELECT 1"`
4. **API key validity**: Test with curl (see Case 5)
5. **Table exists**: `SELECT COUNT(*) FROM openclaw_docs_chunks`
6. **Data present**: Check `deploy-status.json` for sync stats

---

*Last updated: 2026-02-12*
