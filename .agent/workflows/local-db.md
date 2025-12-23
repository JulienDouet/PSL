---
description: Setup local database with production data for safe testing
---

# Setup DB de Dev pour Tests

## Option A: Supabase Dev (Recommandé)

### 1. Créer un projet Supabase de dev
- Va sur [supabase.com/dashboard](https://supabase.com/dashboard)
- **New Project** → Nom: `psl-dev`
- Copie la **Connection String** (Settings → Database → URI)

### 2. Créer les fichiers d'env
```bash
# .env.local - pointe vers la DB de dev
echo 'DATABASE_URL="postgresql://postgres:DEV_PASSWORD@aws-xxx.pooler.supabase.com:5432/postgres"' > .env.local

# .env.prod - pour syncer (NE PAS COMMIT!)
echo 'DATABASE_URL="ta_url_prod_supabase"' > .env.prod
```

// turbo
### 3. Appliquer les migrations sur la DB de dev
```bash
npx prisma migrate deploy
```

### 4. Syncer les données de prod
```bash
node scripts/sync-from-prod.js
```

### 5. Lancer le dev
```bash
npm run dev
```

---

## Option B: PostgreSQL Local

### 1. Créer la base locale
```bash
sudo -u postgres createdb psl_dev
sudo -u postgres psql -c "CREATE USER psl_user WITH PASSWORD 'psl_local_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE psl_dev TO psl_user;"
```

### 2. Configurer .env.local
```bash
echo 'DATABASE_URL="postgresql://psl_user:psl_local_password@localhost:5432/psl_dev"' > .env.local
```

// turbo
### 3. Appliquer les migrations
```bash
npx prisma migrate dev
```

### 4. Syncer les données
```bash
node scripts/sync-from-prod.js
```

---

## Notes
- La queue reste in-memory (isolée de prod)
- La DB de dev est une copie snapshot de prod
- Tu peux tout casser sans risque !
