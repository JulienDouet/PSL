-- Migration pour les nouvelles catégories PSL
-- Ce script doit être exécuté sur la base de données Supabase avant le db push

-- 1. Ajouter les nouvelles valeurs d'enum
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'GP_FR';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'MS_EN';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'NOFILTER_FR';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'NOFILTER_EN';

-- 2. Migrer les anciennes données vers les nouvelles catégories
-- GP -> GP_FR (français par défaut)
UPDATE "UserCategoryMMR" SET category = 'GP_FR' WHERE category = 'GP';
UPDATE "Match" SET category = 'GP_FR' WHERE category = 'GP';
UPDATE "MMRHistory" SET category = 'GP_FR' WHERE category = 'GP';

-- NOFILTER -> NOFILTER_FR (français par défaut)
UPDATE "UserCategoryMMR" SET category = 'NOFILTER_FR' WHERE category = 'NOFILTER';
UPDATE "Match" SET category = 'NOFILTER_FR' WHERE category = 'NOFILTER';
UPDATE "MMRHistory" SET category = 'NOFILTER_FR' WHERE category = 'NOFILTER';

-- 3. Ajouter la colonne isAdmin sur User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT FALSE;

-- 4. Note: On ne peut pas supprimer les anciennes valeurs d'enum tant que Prisma ne le supporte pas correctement
-- Les valeurs GP, NOFILTER, MUSIC, MOVIES, GAMES resteront dans l'enum mais ne seront plus utilisées

-- 5. Mettre à jour les valeurs par défaut si nécessaire
ALTER TABLE "Match" ALTER COLUMN "category" SET DEFAULT 'GP_FR';
ALTER TABLE "MMRHistory" ALTER COLUMN "category" SET DEFAULT 'GP_FR';
