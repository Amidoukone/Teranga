'use strict';

// Lieux favoris du client (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 2). Liste strictement
// personnelle : pas de scope géo admin nécessaire, un utilisateur ne voit/gère que ses propres
// lieux enregistrés.

const { SavedLocation } = require('../../models');
const logger = require('../utils/logger');

exports.list = async (req, res) => {
  try {
    const locations = await SavedLocation.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json({ savedLocations: locations });
  } catch (e) {
    logger.error({ err: e }, 'savedLocation.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des lieux enregistrés' });
  }
};

exports.create = async (req, res) => {
  try {
    const { label, address, latitude, longitude } = req.body;

    const location = await SavedLocation.create({
      userId: req.user.id,
      label: label || null,
      address: String(address).trim(),
      latitude,
      longitude,
    });

    return res.status(201).json({ message: 'Lieu enregistré', savedLocation: location });
  } catch (e) {
    logger.error({ err: e }, 'savedLocation.create.failed');
    return res.status(500).json({ error: "Erreur lors de l'enregistrement du lieu" });
  }
};

exports.remove = async (req, res) => {
  try {
    const location = await SavedLocation.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'Lieu introuvable' });
    if (String(location.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Accès interdit pour ce lieu' });
    }

    await location.destroy();
    return res.status(200).json({ message: 'Lieu supprimé' });
  } catch (e) {
    logger.error({ err: e }, 'savedLocation.remove.failed');
    return res.status(500).json({ error: 'Erreur lors de la suppression du lieu' });
  }
};
