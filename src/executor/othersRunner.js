const { runAI } = require('../skills/ai');
const { runCommand } = require('../skills/commandRunner');

const { createLogger } = require('../utils/logger');
const logger = createLogger('executor.others_runner');


async function runOthers(actionRotatorJson, originalAnalysis) {
    logger.info('runOthers called', { actionRotatorJson });
    
    try {
        // Include original analysis details for better context
        const contextPrompt = originalAnalysis 
            ? `Original Analysis Details: ${JSON.stringify(originalAnalysis)}\n\nPlanning Steps: ${actionRotatorJson}\n\n`
            : `Planning Steps: ${actionRotatorJson}\n\n`;
        
        const commandsJson = await runAI(contextPrompt, "Extract the commands to be executed in JSON format. Use the original analysis details (especially script_content, file paths, and other parameters) to generate accurate commands. The JSON should have a 'commands' field which is an array of command strings. Return only the JSON object. Do not include any explanations or additional text. If there are no commands to execute, return an empty array for the 'commands' field. Example: {\"commands\": [\"ls -la\", \"pwd\"]}. If packages are not installed, include installation commands. Complete the task accurately using all provided details.");
        logger.info('runOthers result', commandsJson);
        

        let result = "";

        for (const command of commandsJson.commands || []) {
            logger.info(`Executing command: ${command}`);
            const commandResult = await runCommand(command);
            result += `Command: ${command}, Result: ${JSON.stringify(commandResult)}\n\n`;
            logger.info(`Command result: ${JSON.stringify(commandResult)}`);
        }

        return result;
    } catch (error) {
        logger.error('runOthers Error:', error);
        return { 
            type: "OTHER_INTERACTION", 
            summary: "Error in executing other interaction", 
            confidence: 0 
        };
    }
}

module.exports = { runOthers };