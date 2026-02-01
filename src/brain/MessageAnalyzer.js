const { runAI } = require('../skills/ai');
const { ANALYZER_SYSTEM_PROMPT } = require('../../data/prompts/MessageAnalyzerPrompt');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.analyzer');


const analyzeMessage = async (message) => {
    logger.info('analyzeMessage called', { message });
    const response = await runAI(message, ANALYZER_SYSTEM_PROMPT);
    logger.info('analyzeMessage response', response);
    return response;
}

module.exports = { analyzeMessage };
