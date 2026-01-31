const { runAI } = require("../brain/ai");    
const { CHAT_SYSTEM_PROMPT } = require("../../data/prompts/prompt_chat.js");    
const { createLogger } = require('../utils/logger');
const logger = createLogger('skills.chat');

async function generateRespond(message, editMessageCallback) {
    logger.info('generateRespond called', { message });
    const response = await runAI(message, CHAT_SYSTEM_PROMPT);
    logger.info('generateRespond response', response);
    return response;
};

module.exports = { generateRespond };