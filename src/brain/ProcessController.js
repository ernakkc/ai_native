const { analyzeMessage } = require('./MessageAnalyzer');
const { planAnalyze } = require('./ActionPlanner');
const { ActionRotator } = require('./ActionRotator');

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

    // Convert the analysis to json
    const analysisJson = JSON.stringify(analysis);

    const planningResult = await planAnalyze(analysisJson);
    logger.info('Planning result', planningResult);
    if (typeof editMessageCallback === 'function') {
        await editMessageCallback(`Planning Complete:\n${JSON.stringify(planningResult, null, 2)}`);
    }

    // Convert the planning result to json
    const planningResultJson = JSON.stringify(planningResult);

    let finalResponse = "No Response";

    finalResponse = await ActionRotator(planningResultJson);

    logger.info('startProcess completed');
    return finalResponse;
    }







module.exports = { startProcess };