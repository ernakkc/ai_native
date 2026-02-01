const { runAI } = require('../skills/ai');
const { runCommand } = require('../skills/commandRunner');

const { createLogger } = require('../utils/logger');
const logger = createLogger('executor.others_runner');


async function runOthers(actionRotatorJson) {
    logger.info('runOthers called', { actionRotatorJson });
    
    try {
        const commandsJson = await runAI(actionRotatorJson, "Extract the commands to be executed in JSON format. The JSON should have a 'commands' field which is an array of command strings. Return only the JSON object. Do not include any explanations or additional text. If there are no commands to execute, return an empty array for the 'commands' field. Example: {\"commands\": [\"ls -la\", \"pwd\"]}. Maybe your commands are cannot installed the system think about that also and generate command for that. Complate the task as easy as possible.");
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