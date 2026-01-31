const { analyzeMessage } = require('./analyzer');
const { planAnalyze } = require('./planner');
const { chatIterate } = require('../executor/chat_interaction');
const {} = require('../executor/os_operation');
const {} = require('../executor/web_automation');
const {} = require('../executor/memory_op');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.runner');


const startProcess = async(message, editMessageCallback) => {

    logger.info('startProcess called', { message });

    // Kullanıcının Ne istediğini analiz et
    const analysis = await analyzeMessage(message);
    logger.info('Analysis result', analysis);
    if (typeof editMessageCallback === 'function') {
        await editMessageCallback(`Analysis Complete:\n${JSON.stringify(analysis, null, 2)}`);
    }

    const planningResult = await planAnalyze(analysis);
    logger.info('Planning result', planningResult);
    if (typeof editMessageCallback === 'function') {
        await editMessageCallback(`Planning Complete:\n${JSON.stringify(planningResult, null, 2)}`);
    }


    let finalResponse = "";

    switch (planningResult.type) {
        case "CHAT_INTERACTION":
            logger.info('Handling CHAT_INTERACTION');
            finalResponse = await chatIterate(planningResult);
            break;
        case "OS_OPERATION":
            logger.info('Handling OS_OPERATION');
            break;
        case "WEB_AUTOMATION":
            logger.info('Handling WEB_AUTOMATION');
            break;
        case "MEMORY_OP":
            logger.info('Handling MEMORY_OP');
            break;
    }

    logger.info('startProcess completed');
    return finalResponse;
    }







module.exports = { startProcess };