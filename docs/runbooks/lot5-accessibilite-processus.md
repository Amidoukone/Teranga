# Lot 5 — Référentiel de qualité produit

## Définition de terminé

Chaque écran critique doit respecter les contrôles suivants avant mise en production :

- navigation clavier complète, avec lien d’évitement vers `#main-content` ;
- focus visible et ordre de tabulation cohérent ;
- intitulés accessibles pour les champs, boutons et icônes ;
- états de chargement, erreur et succès annoncés textuellement ;
- contraste AA et interface utilisable à 200 % de zoom ;
- respect de `prefers-reduced-motion` ;
- parcours testé en français et en anglais sur mobile et desktop.

## Contrôle de release

Le propriétaire de la fonctionnalité joint au ticket :

1. la checklist du parcours ;
2. une preuve de test clavier et lecteur d’écran ;
3. les KPI avant/après (SLA, complétude, erreurs) ;
4. les incidents connus et leur date de correction.

Un défaut bloquant d’accessibilité, de périmètre territorial ou de sécurité empêche le go-live.
