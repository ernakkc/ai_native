const { generateRespond } = require('../skills/chat');
const { createLogger } = require('../utils/logger');
const logger = createLogger('executor.chat_interaction');

async function chatIterate(message, editMessageCallback) {
    logger.info('chatIterate called', { message });
    const response = await generateRespond(message, editMessageCallback);
    logger.info('chatIterate response', response);
    return response;
}

module.exports = { chatIterate };

module.exports = { chatIterate };