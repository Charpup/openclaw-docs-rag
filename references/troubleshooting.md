# Troubleshooting

Common issues and solutions for openclaw-docs-rag.

## Quick Checklist

When docs-rag fails, check in order:

1. **Shell health**: `echo test` → should return instantly
2. **Docker status**: `docker ps | grep postgres` → should show "Up"
3. **Database connectivity**: `psql -h localhost -U memu -d memu_db -c "SELECT 1"`
4. **API key validity**: Test with curl (see Case 5)
5. **Table exists**: `SELECT COUNT(*) FROM openclaw_docs_chunks`
6. **Data present**: Check `deploy-status.json` for sync stats

---

## Common Issues

### Issue 1: Missing Environment Variables

**Symptoms:**
- `query-docs.sh` fails with: `Embedding API error: {"error":{"message":"[undefined]无效的令牌"}}`
- `sync-docs.sh` fails with: `Error: OPENAI_API_KEY not set`

**Solution:**
Scripts auto-load `.env` file. Ensure it exists:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Or export manually:
```bash
export OPENAI_API_KEY="sk-..."
export MEMU_DB_PASSWORD="memu_secure_password"
```

---

### Issue 2: Database Not Initialized

**Symptoms:**
- Query fails with: `relation "openclaw_docs_chunks" does not exist`
- Sync appears to succeed but data is not queryable

**Solution:**
```bash
npm run init-db
```

---

### Issue 3: pyenv Lock Blocking Shell

**Symptoms:**
- All `exec` commands timeout
- Error: `pyenv: cannot rehash: couldn't acquire lock`

**Solution:**
```bash
rm -f /root/.pyenv/shims/.pyenv-shim
pyenv rehash
```

---

### Issue 4: Embedding API Failures

**Symptoms:**
- Sync fails with API errors
- Error: `无效的令牌` (Invalid token)

**Diagnosis:**
```bash
curl -s https://api.apiyi.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"test"}'
```

**Solution:**
Ensure `.env` is loaded or variables are exported before running scripts.

---

### Issue 5: Sync Interrupted / Resume Needed

**Symptoms:**
- Sync stopped mid-way
- Want to resume without re-processing

**Solution:**
Checkpoint is auto-saved. Just re-run:
```bash
npm run sync
# Automatically resumes from checkpoint
```

To force fresh sync:
```bash
npm run sync -- --force
```

---

## Debug Commands

```bash
# Check database stats
node -e "const s=require('./src/store');new s().init().then(s=>s.getStats().then(c=>console.log(c)))"

# Test query
./query-docs.sh "how to configure cron jobs"

# Check sync status
cat deploy-status.json

# View sync logs
tail -f sync.log
```
