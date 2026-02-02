const { chatIterate } = require('../executor/chat_interaction.js');
const { runOthers } = require('../executor/othersRunner.js');

const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.action_rotator');


async function ActionRotator(planningResultJson, originalAnalysis) {
    switch (planningResultJson.type) {
        case "CHAT_INTERACTION":
            logger.info('Handling CHAT_INTERACTION');
            // For chat, pass the original user message, not the plan
            const userMessage = originalAnalysis?.parameters?.original_message || 
                               originalAnalysis?.summary || 
                               planningResultJson.goal;
            return await chatIterate(userMessage);
        case "WEB_AUTOMATION":
            logger.info('Handling WEB_AUTOMATION');
            return "Web Automation handled.";
        default:
            return await runOthers(planningResultJson, originalAnalysis);
    }
}

module.exports = { ActionRotator }; 