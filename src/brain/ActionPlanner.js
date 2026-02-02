const { runAI } = require('../skills/ai');
const { PLANNER_SYSTEM_PROMPT } = require('../../data/prompts/ActionPlannerPrompt');
const { injectSystemContext } = require('../utils/system_context');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.planner');


const planAnalyze = async (message) => {
    logger.info('planAnalyze called', { message });
    
    // Inject system context and memory into the prompt
    const systemPrompt = await injectSystemContext(PLANNER_SYSTEM_PROMPT, { 
        position: 'end',
        compact: false,
        includeMemory: true
    });
    
    const response = await runAI(message, systemPrompt);
    logger.info('planAnalyze response', response);
    return response;
}

module.exports = { planAnalyze };
