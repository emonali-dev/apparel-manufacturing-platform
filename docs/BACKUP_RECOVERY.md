# Backup and recovery

## What holds data
- Postgres tables `public.apparel_*` (buyers, RFQs, quotations, orders, production, QC, CRM, files metadata, content, audit…)
- Storage buckets `apparel-files` (private: artwork, documents, QC photos) and `apparel-media` (public: product/fabric/collection images)
- The website itself is in Git — every published version can be restored with `git revert` / redeploying an older commit.

## Backups
- Supabase takes daily backups on paid plans (Dashboard → Database → Backups). Point-in-time recovery is an add-on.
- Before every migration, export the apparel tables:
  ```
  pg_dump "$DB_URL" --data-only --table='public.apparel_*' > apparel-$(date +%F).sql
  pg_dump "$DB_URL" --schema-only --table='public.apparel_*' > apparel-schema-$(date +%F).sql
  ```
- Storage: download both buckets periodically (Dashboard, or `supabase storage cp -r ss:///apparel-files ./backup/` with the CLI).

## Recovery
1. Website broken → redeploy the previous commit on `main` (GitHub Pages republishes automatically).
2. Bad data change → restore rows from the latest dump into a scratch schema and copy back the affected rows; every admin action is recorded in `apparel_audit` (who, what, when) to find them.
3. Migration failure → migrations run in a transaction; a failed migration leaves the database unchanged. If a deployed migration must be undone, restore the schema + data dumps taken right before it.
4. Lost storage object → re-upload from the storage backup; file metadata rows in `apparel_files` keep the original path.
