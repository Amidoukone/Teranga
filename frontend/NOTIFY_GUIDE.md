# Guide Notifications `notify`

## Objectif
- Standardiser les retours utilisateur avec des toasts non bloquants.
- Interdire `alert()` via ESLint pour éviter les popups natives.

## Règle de qualité
- Règle active: `no-alert` (voir `frontend/package.json`).
- Si un flux legacy a besoin de `window.confirm`, documenter l'exception avec:
  - `/* eslint-disable-next-line no-alert */`
  - juste au-dessus de la ligne concernée.

## API disponible
- Import:
```js
import { notify } from "../utils/notify";
```

- Variantes:
```js
notify.success("Opération réussie");
notify.error("Une erreur est survenue");
notify.info("Information");
notify.warning("Attention");
```

- Variante générique:
```js
notify("Message simple", { type: "info", durationMs: 3000 });
```

## Bonnes pratiques
- Succès backend: `notify.success(...)`.
- Erreur backend/API: `notify.error(...)`.
- Information non critique: `notify.info(...)`.
- Risque ou validation métier: `notify.warning(...)`.

## À éviter
- `alert(...)` dans les pages/components.
- Multiples toasts identiques dans une même boucle de rendu.

## Confirm Modal unifiée
- Import:
```js
import { confirmAction } from "../utils/confirm";
```

- Usage (actions destructives):
```js
const ok = await confirmAction({
  message: t("projects.alerts.deleteConfirm"),
  danger: true,
});
if (!ok) return;
```

- Convention:
- Utiliser `confirmAction(...)` au lieu de `window.confirm(...)`.
- Pour suppression/irréversible, passer `danger: true`.
