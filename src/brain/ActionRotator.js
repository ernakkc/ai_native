const { chatIterate } = require('../executor/chat_interaction.js');
const { runOthers } = require('../executor/othersRunner.js');

const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.action_rotator');


async function ActionRotator(planningResultJson, originalAnalysis) {
    switch (planningResultJson.type) {
        case "CHAT_INTERACTION":
            logger.info('Handling CHAT_INTERACTION');
            return await chatIterate(planningResultJson);
        case "WEB_AUTOMATION":
            logger.info('Handling WEB_AUTOMATION');
            return "Web Automation handled.";
        default:
            return await runOthers(planningResultJson, originalAnalysis);
    }
}

module.exports = { ActionRotator }; 