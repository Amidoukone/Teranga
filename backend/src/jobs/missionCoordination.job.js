'use strict';
const cron = require('node-cron');
const { runMissionCoordination } = require('../services/missionCoordination.service');
const { runWorkCoordination } = require('../services/workCoordination.service');
const logger = require('../utils/logger');
let scheduledTask = null;
let running = false;
function startMissionCoordinationJob() {
  if (scheduledTask || process.env.MISSION_COORDINATION_ENABLED === 'false') return scheduledTask;
  scheduledTask = cron.schedule('*/1 * * * *', async () => {
    if (running) return;
    running = true;
    try { await runMissionCoordination(); await runWorkCoordination(); }
    catch (error) { logger.error({ err: error }, 'coordination.job.failed'); }
    finally { running = false; }
  });
  return scheduledTask;
}
function stopMissionCoordinationJob() {
  scheduledTask?.stop(); scheduledTask = null;
}
module.exports = { startMissionCoordinationJob, stopMissionCoordinationJob };
