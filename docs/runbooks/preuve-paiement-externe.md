# Paiement externe — procédure Teranga

Teranga n’intègre pas encore de prestataire de paiement. Toute transaction est déclarée dans l’application, mais le règlement est effectué par le canal convenu localement.

## Règle obligatoire

Une transaction ne peut être clôturée manuellement (`completed`) que si un reçu ou une preuve lisible est attaché. La preuve peut être une image ou un PDF et doit être conservée avec la transaction.

## Contrôle agent

- vérifier le montant, la devise, la date et la référence visibles ;
- vérifier que le bénéficiaire correspond à la demande ;
- refuser les captures illisibles ou incomplètes ;
- conserver le statut `pending` en cas de doute ;
- escalader tout doublon ou incohérence au responsable financier.

L’intégration d’une API de paiement sera décidée après observation des volumes et des méthodes réellement utilisées au Mali.
