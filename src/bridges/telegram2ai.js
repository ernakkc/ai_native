const { startProcess } = require('../brain/ProcessController');
const { createLogger } = require('../utils/logger');
const logger = createLogger('bridges.telegram2ai');


/* Bridge function to handle messages from Telegram to AI services
 * @param {string} message - The message received from Telegram
 * @returns {string} - The response from the AI services
*/
const telegramMessageBridge = async (message, editMessageCallback) => {
    logger.info('Received message from Telegram', message);
    const aiResponse  = await startProcess(message, editMessageCallback);
    logger.info('AI response from startProcess', aiResponse);
    return aiResponse;
};

module.exports = { telegramMessageBridge };