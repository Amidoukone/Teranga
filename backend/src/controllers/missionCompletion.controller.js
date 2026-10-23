'use strict';
const fs = require('fs');
const path = require('path');
const db = require('../../models');
const media = require('../services/mediaUpload.service');
const imageKit = require('../helpers/teranga-imagekit');
const { resolveUploadsRoot } = require('../utils/uploadsRoot');
const { getCompletionState } = require('../services/missionCompletion.service');
const logger = require('../utils/logger');

async function discardUpload(upload) {
  try {
    if (upload.fileId) await imageKit.deleteFile(upload.fileId);
    if (upload.url?.startsWith('/uploads/mission-completions/')) {
      const target = path.resolve(resolveUploadsRoot(), 'mission-completions', path.basename(upload.url));
      await fs.promises.unlink(target);
    }
  } catch (error) { logger.warn({ err: error }, 'completion.upload.cleanup.failed'); }
}

exports.submit = async (req, res) => {
  const uploaded = [];
  let persisted = false;
  try {
    const summary = String(req.body.summary || '').trim();
    const requestKey = String(req.body.requestKey || '');
    const kind = req.body.kind || null;
    if (summary.length < 20 || summary.length > 4000 || !/^[a-zA-Z0-9-]{8,80}$/.test(requestKey)) return res.status(400).json({ error: 'Un compte rendu de 20 à 4000 caractères et une référence de soumission sont requis' });
    if (kind && !['photo', 'document', 'receipt', 'other'].includes(kind)) return res.status(400).json({ error: 'Type de justificatif invalide' });
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
    if (files.length > 3) return res.status(400).json({ error: 'Trois fichiers maximum par envoi' });
    const service = await db.sequelize.transaction(async (transaction) => {
      const mission = await db.Service.findByPk(req.params.id, { transaction, lock: true });
      if (!mission) throw Object.assign(new Error('Mission introuvable'), { status: 404 });
      const provider = req.user.role === 'provider' ? await db.Provider.findOne({ where: { userId: req.user.id, status: 'active' }, transaction }) : null;
      const isExecutor = mission.executionType === 'provider' ? provider && String(provider.id) === String(mission.providerId) : req.user.role === 'agent' && String(mission.agentId) === String(req.user.id);
      if (!isExecutor) throw Object.assign(new Error('Seul l’exécutant affecté peut déposer ce compte rendu'), { status: 403 });
      const operation = await db.MissionCoordination.findOne({ where: { serviceId: mission.id }, transaction, lock: true });
      if (!operation) throw Object.assign(new Error('La coordination de cette mission doit être initialisée'), { status: 409 });
      if (operation.completionReport?.requestKey === requestKey) return mission;
      if (mission.missionStatus !== 'IN_PROGRESS' && !(!mission.missionStatus && mission.status === 'in_progress')) throw Object.assign(new Error('Le compte rendu doit être déposé pendant l’exécution de la mission'), { status: 409 });
      const evidenceIds = operation.completionReport?.reporterId === req.user.id ? [...operation.completionReport.evidenceIds] : [];
      if (evidenceIds.length + files.length > 15) throw Object.assign(new Error('Quinze justificatifs maximum pour un compte rendu'), { status: 400 });
      const fallback = media.resolveLocalFallbackPolicy({ moduleFallbackEnvVar: 'EVIDENCE_ALLOW_LOCAL_FALLBACK' });
      for (const file of files) {
        const fileName = media.buildFileName('completion', file.originalname, uploaded.length);
        let upload = null;
        if (media.isImageKitEnabled()) {
          try { upload = await media.uploadToImageKitWithRetry({ file: file.buffer, fileName, folder: '/teranga/mission-completions/' }); }
          catch (error) { if (!fallback.allowLocalFallback) throw error; }
        }
        if (!upload?.url) {
          if (!fallback.allowLocalFallback) throw Object.assign(new Error('Stockage durable des justificatifs indisponible'), { status: 503 });
          upload = await media.saveFileLocally(file, fileName, { subfolder: 'mission-completions' });
        }
        uploaded.push(upload);
        const evidenceKind = kind || media.guessKind(file.mimetype);
        if (evidenceKind === 'photo' && !String(file.mimetype).startsWith('image/')) throw Object.assign(new Error('Une photo doit être une image'), { status: 400 });
        const evidence = await db.Evidence.create({ serviceId: mission.id, uploaderId: req.user.id, kind: evidenceKind,
          filePath: upload.url, fileId: upload.fileId || null, originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size,
          countryId: mission.countryId, regionId: mission.regionId, notes: 'Compte rendu de fin de mission' }, { transaction });
        evidenceIds.push(evidence.id);
      }
      await operation.update({ completionReport: { requestKey, reporterId: req.user.id, summary, evidenceIds, submittedAt: new Date().toISOString() } }, { transaction });
      return mission;
    });
    persisted = true;
    return res.json({ completion: await getCompletionState(service) });
  } catch (error) {
    if (!persisted) await Promise.all(uploaded.map(discardUpload));
    logger.error({ err: error }, 'mission.completion.submit.failed');
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Impossible d’enregistrer le compte rendu' });
  }
};
