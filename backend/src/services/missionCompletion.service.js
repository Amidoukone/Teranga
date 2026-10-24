'use strict';
const { Op } = require('sequelize');
const db = require('../../models');
async function getCompletionState(service, { transaction } = {}) {
  if (!db.MissionCoordination) return null;
  let operation;
  try { operation = await db.MissionCoordination.findOne({ where: { serviceId: service.id }, transaction }); }
  catch (error) {
    if (error.original?.code === 'ER_NO_SUCH_TABLE' || error.parent?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
  if (!operation) return null;
  const stored = operation.completionReport;
  const provider = stored && service.executionType === 'provider' && service.providerId ? await db.Provider.findByPk(service.providerId, { attributes: ['userId'], transaction }) : null;
  const reporterId = service.executionType === 'provider' ? provider?.userId : service.agentId;
  const report = stored && String(stored.reporterId) === String(reporterId) ? stored : null;
  const attachments = report?.evidenceIds?.length ? await db.Evidence.findAll({
    where: { id: { [Op.in]: report.evidenceIds }, serviceId: service.id, uploaderId: report.reporterId },
    attributes: ['id', 'kind', 'originalName', 'filePath', 'createdAt'],
    transaction,
  }) : [];
  return { required: operation.policy?.completionReportRequired === true && !service.parentServiceId,
    expectedOutcome: operation.policy?.serviceOutcome || null,
    requiredEvidenceTypes: operation.policy?.requiredEvidenceTypes || [],
    report: report ? { summary: report.summary, submittedAt: report.submittedAt, attachments } : null };
}
async function assertCompletionReady(service, options) {
  const state = await getCompletionState(service, options);
  if (!state?.required) return;
  const kinds = new Set((state.report?.attachments || []).map((evidence) => evidence.kind));
  const missing = state.requiredEvidenceTypes.filter((kind) => !kinds.has(kind));
  if (!state.report?.summary || missing.length) {
    throw Object.assign(new Error('Déposez le compte rendu et les justificatifs attendus avant de terminer la mission.'), { status: 400, code: 'COMPLETION_REPORT_REQUIRED' });
  }
}
module.exports = { getCompletionState, assertCompletionReady };
