# Migration Data: Mojibake Cleanup

## Objective
Repair historical mojibake text corruption in database records without changing business logic.

The command is idempotent:
- running it multiple times does not re-corrupt data
- only rows with detectable mojibake markers are updated

## Commands

Dry-run (recommended first):

```bash
npm run data:fix-mojibake
```

Apply changes:

```bash
npm run data:fix-mojibake:apply
```

Silent mode (no SQL `Executing ...` logs):

```bash
npm run data:fix-mojibake:silent
npm run data:fix-mojibake:apply:silent
```

Target specific models:

```bash
node scripts/fix-mojibake-data.js --apply --model=Task,Service
```

Advanced mode (all text fields):

```bash
node scripts/fix-mojibake-data.js --apply --all-text-fields
```

Disable JSON field processing:

```bash
node scripts/fix-mojibake-data.js --apply --no-json
```

Silent mode via CLI flag:

```bash
node scripts/fix-mojibake-data.js --apply --silent
```

## Safety Workflow
1. Run dry-run and review `rowsWithFix`, `fieldsUpdated`, and samples.
2. Create DB backup/snapshot.
3. Run apply mode.
4. Re-run dry-run to confirm `rowsWithFix=0` (or near 0 if new data was added).

## Notes
- Default mode scans curated business fields only.
- JSON fields are included by default because user text can exist in metadata and addresses.
- Use `--all-text-fields` only when you need an exhaustive technical pass.
- For Render one-off maintenance jobs (PlanetScale backend), prefer `*:silent` scripts to keep logs focused on summary lines.
