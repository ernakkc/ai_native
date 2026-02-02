const { runAI } = require('../skills/ai');
const { ANALYZER_SYSTEM_PROMPT } = require('../../data/prompts/MessageAnalyzerPrompt');
const { injectSystemContext } = require('../utils/system_context');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.analyzer');


const analyzeMessage = async (message) => {
    logger.info('analyzeMessage called', { message });
    
    // Inject system context into the prompt
    const systemPrompt = await injectSystemContext(ANALYZER_SYSTEM_PROMPT, { 
        position: 'end',
        compact: false 
    });
    
    const response = await runAI(message, systemPrompt);
    logger.info('analyzeMessage response', response);
    return response;
}

module.exports = { analyzeMessage };
