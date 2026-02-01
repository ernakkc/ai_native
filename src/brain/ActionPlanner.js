const { runAI } = require('../skills/ai');
const { PLANNER_SYSTEM_PROMPT } = require('../../data/prompts/ActionPlannerPrompt');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.planner');


const planAnalyze = async (message) => {
    logger.info('planAnalyze called', { message });
    const response = await runAI(message, PLANNER_SYSTEM_PROMPT);
    logger.info('planAnalyze response', response);
    return response;
}

module.exports = { planAnalyze };
