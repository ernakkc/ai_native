const { runAI } = require('../skills/ai');
const { runCommand } = require('../skills/commandRunner');
const { OtherRunnersPrompt } = require('../../data/prompts/OthersRunnerPrompt.js');

const { createLogger } = require('../utils/logger');
const logger = createLogger('executor.others_runner');

/**
 * Execute a single step with retry logic
 * @param {Object} step - Step object from execution plan
 * @param {Number} attemptNumber - Current attempt number (for logging)
 * @param {Object} stepOutputs - Previous step outputs for placeholder replacement
 * @param {Object} userInputs - User inputs collected during execution
 * @returns {Object} - { success: boolean, output: any, error: string }
 */
async function executeStep(step, attemptNumber = 1, stepOutputs = {}, userInputs = {}) {
    logger.info('Executing step', { 
        step_id: step.step_id, 
        name: step.name, 
        attempt: attemptNumber,
        type: step.type,
        tool: step.tool
    });

    /**
     * Process placeholders in strings
     * @param {String} str - String with potential placeholders
     * @returns {String} - Processed string
     */
    const processPlaceholders = (str) => {
        if (!str || typeof str !== 'string') return str;

        let processed = str;

        // Replace {{output_of_step_X}} placeholders
        const stepOutputRegex = /\{\{output_of_step_(\d+)\}\}/g;
        processed = processed.replace(stepOutputRegex, (match, stepId) => {
            const output = stepOutputs[parseInt(stepId)];
            if (output !== undefined) {
                return String(output);
            }
            logger.warn('Step output placeholder not found', { stepId });
            return match; // Keep original if not found
        });

        // Replace {{user_input}} placeholder with collected user input
        if (processed.includes('{{user_input}}')) {
            const userInput = userInputs.latest || userInputs[step.step_id - 1] || '';
            processed = processed.replace(/\{\{user_input\}\}/g, userInput);
        }

        // Replace other common placeholders
        processed = processed.replace(/\{\{timestamp\}\}/g, new Date().toISOString());
        processed = processed.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
        processed = processed.replace(/\{\{time\}\}/g, new Date().toTimeString().split(' ')[0]);

        return processed;
    };

    try {
        // Check if this step requires user input
        if (step.parameters?.requires_user_input === true || step.type === 'USER_INPUT') {
            logger.info('Step requires user input', { prompt: step.parameters.prompt });
            
            // For now, return a prompt message (in a real implementation, this would collect input)
            const promptMessage = step.parameters.prompt || step.parameters.message || 'Please provide input:';
            
            return {
                success: true,
                output: promptMessage,
                requiresInput: true,
                notification: true
            };
        }

        // Determine execution method based on step type and tool
        if (step.tool === 'TERMINAL' && step.type === 'TERMINAL_COMMAND') {
            let cmd = step.parameters.cmd;
            
            if (!cmd) {
                throw new Error('No command specified in step parameters');
            }

            // Process placeholders in command
            cmd = processPlaceholders(cmd);

            logger.debug('Running terminal command', { cmd: cmd.substring(0, 100) });
            const result = await runCommand(cmd);

            // Check if command execution was successful
            if (result.success) {
                return {
                    success: true,
                    output: result.stdout || result.stderr || 'Command executed successfully',
                    command: cmd,
                    exitCode: result.exitCode || 0
                };
            } else {
                return {
                    success: false,
                    output: result.stderr || result.error || 'Command execution failed',
                    error: result.error || 'Unknown error',
                    command: cmd,
                    exitCode: result.exitCode
                };
            }
        } else if (step.tool === 'FS' && step.type === 'FILE_OPERATION') {
            // File system operations (direct file manipulation)
            let { path, content, action } = step.parameters;
            
            // Process placeholders
            path = processPlaceholders(path);
            content = processPlaceholders(content);
            
            // Use terminal commands for file operations
            let cmd;
            switch (action) {
                case 'create':
                case 'write':
                    // Escape content for shell
                    cmd = `cat > "${path}" << 'EOFCONTENT'\n${content}\nEOFCONTENT`;
                    break;
                case 'read':
                    cmd = `cat "${path}"`;
                    break;
                case 'delete':
                    cmd = `rm -f "${path}"`;
                    break;
                default:
                    throw new Error(`Unsupported file action: ${action}`);
            }

            logger.debug('File operation', { action, path });
            const result = await runCommand(cmd);

            return {
                success: result.success,
                output: result.stdout || `File ${action} operation completed`,
                error: result.error,
                command: cmd
            };
        } else if (step.type === 'VALIDATION') {
            // Validation steps - run command and check output
            let cmd = step.parameters.cmd;
            const validation = step.parameters.validation;

            // Process placeholders
            cmd = processPlaceholders(cmd);

            logger.debug('Validation step', { validation });
            const result = await runCommand(cmd);

            return {
                success: result.success,
                output: result.stdout || result.stderr,
                validation: validation,
                command: cmd
            };
        } else if (step.type === 'NOTIFICATION') {
            // Notification steps - just return the message
            let message = step.parameters.message;
            
            // Process placeholders in notification message
            message = processPlaceholders(message);
            
            logger.info('Notification', { message });
            return {
                success: true,
                output: message,
                notification: true
            };
        } else {
            logger.warn('Unsupported step configuration', { type: step.type, tool: step.tool });
            return {
                success: false,
                output: '',
                error: `Unsupported step type: ${step.type} with tool: ${step.tool}`
            };
        }
    } catch (error) {
        logger.error('Step execution error', { step_id: step.step_id, error: error.message });
        return {
            success: false,
            output: '',
            error: error.message
        };
    }
}

/**
 * Execute an action plan with detailed steps
 * @param {String} actionRotatorJson - JSON string of the execution plan
 * @param {Object} originalAnalysis - Original analysis from MessageAnalyzer
 * @returns {String} - Formatted execution results
 */
async function runOthers(actionRotatorJson, originalAnalysis) {
    logger.info('runOthers called', { actionRotatorJson });
    
    try {
        // Parse the execution plan
        let plan;
        try {
            plan = typeof actionRotatorJson === 'string' 
                ? JSON.parse(actionRotatorJson) 
                : actionRotatorJson;
        } catch (parseError) {
            logger.error('Failed to parse execution plan', parseError);
            throw new Error(`Invalid execution plan format: ${parseError.message}`);
        }

        // Validate plan structure
        if (!plan.steps || !Array.isArray(plan.steps)) {
            logger.error('Invalid plan structure: missing or invalid steps array');
            
            // Fallback: Use AI to generate commands
            logger.info('Falling back to AI command generation');
            const contextPrompt = originalAnalysis 
                ? `Original Analysis Details: ${JSON.stringify(originalAnalysis)}\n\nPlanning Steps: ${actionRotatorJson}\n\n`
                : `Planning Steps: ${actionRotatorJson}\n\n`;
            
            const commandsJson = await runAI(contextPrompt, OtherRunnersPrompt);
            logger.info('AI fallback result', commandsJson);
            
            let fallbackResult = "";
            for (const command of commandsJson.commands || []) {
                logger.info(`Executing fallback command: ${command}`);
                const commandResult = await runCommand(command);
                fallbackResult += `Command: ${command}\nResult: ${JSON.stringify(commandResult)}\n\n`;
            }
            return fallbackResult || "No commands executed";
        }

        logger.info(`Executing plan ${plan.plan_id} with ${plan.steps.length} steps`);
        logger.info(`Strategy: ${plan.strategy?.mode || 'SEQUENTIAL'}, Stop on error: ${plan.strategy?.stop_on_error !== false}`);

        const results = [];
        const stepOutputs = {}; // Store outputs by step_id for reference
        const userInputs = {}; // Store user inputs
        let planSuccess = true;
        let executionStopped = false;

        // Execute steps
        for (const step of plan.steps) {
            if (executionStopped) {
                logger.warn(`Skipping step ${step.step_id} due to previous failure`);
                results.push({
                    step_id: step.step_id,
                    name: step.name,
                    status: 'SKIPPED',
                    reason: 'Previous step failed and stop_on_error is true'
                });
                continue;
            }

            let stepResult;
            let retryCount = 0;
            const maxRetries = step.on_failure?.retry_count || 0;

            // Retry loop
            while (retryCount <= maxRetries) {
                stepResult = await executeStep(step, retryCount + 1, stepOutputs, userInputs);

                if (stepResult.success) {
                    break; // Success, exit retry loop
                }

                retryCount++;
                if (retryCount <= maxRetries) {
                    logger.warn(`Step ${step.step_id} failed, retrying (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                }
            }

            // Process step result
            if (stepResult.success) {
                // Store output for potential references
                stepOutputs[step.step_id] = stepResult.output;
                
                // If this was a user input step, store the input
                if (stepResult.requiresInput) {
                    // In a real implementation, this would wait for user input
                    // For now, we'll use a placeholder or default value
                    userInputs.latest = step.parameters.default_value || '';
                    userInputs[step.step_id] = userInputs.latest;
                    
                    logger.info(`User input step completed with default: ${userInputs.latest}`);
                }
                
                results.push({
                    step_id: step.step_id,
                    name: step.name,
                    status: 'SUCCESS',
                    output: stepResult.output,
                    command: stepResult.command
                });
            } else {
                // Handle failure based on strategy
                const failureAction = step.on_failure?.action || 'STOP';
                
                results.push({
                    step_id: step.step_id,
                    name: step.name,
                    status: 'FAILED',
                    error: stepResult.error,
                    output: stepResult.output,
                    command: stepResult.command,
                    failure_action: failureAction,
                    fallback_message: step.on_failure?.fallback_message
                });

                planSuccess = false;

                // Decide next action
                if (failureAction === 'STOP') {
                    logger.error(`Step ${step.step_id} failed with STOP action. Halting execution.`);
                    if (plan.strategy?.stop_on_error !== false) {
                        executionStopped = true;
                    }
                } else if (failureAction === 'SKIP') {
                    logger.warn(`Step ${step.step_id} failed but action is SKIP. Continuing...`);
                } else if (failureAction === 'FALLBACK') {
                    logger.warn(`Step ${step.step_id} failed. Fallback: ${step.on_failure?.fallback_message}`);
                } else if (failureAction === 'RETRY') {
                    logger.info(`Step ${step.step_id} retry attempts exhausted.`);
                }
            }
        }

        // Format results for return
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        const failedCount = results.filter(r => r.status === 'FAILED').length;
        const skippedCount = results.filter(r => r.status === 'SKIPPED').length;

        logger.info('Plan execution completed', {
            plan_id: plan.plan_id,
            success: planSuccess,
            total: results.length,
            succeeded: successCount,
            failed: failedCount,
            skipped: skippedCount
        });

        // Build beautiful output
        let output = '';
        output += `╔════════════════════════════════════════════════════════════════════════════╗\n`;
        output += `║ 📋 EXECUTION SUMMARY                                                        ║\n`;
        output += `╠════════════════════════════════════════════════════════════════════════════╣\n`;
        output += `║ Goal: ${plan.goal.substring(0, 68).padEnd(68)} ║\n`;
        output += `║ Plan ID: ${plan.plan_id.substring(0, 64).padEnd(64)} ║\n`;
        output += `║ Status: ${(planSuccess ? '✅ SUCCESS' : '❌ FAILED').padEnd(67)} ║\n`;
        output += `║ Steps: ${String(successCount).padStart(2)}/${String(results.length).padStart(2)} succeeded, ${String(failedCount).padStart(2)} failed, ${String(skippedCount).padStart(2)} skipped${' '.repeat(28)} ║\n`;
        output += `╚════════════════════════════════════════════════════════════════════════════╝\n\n`;

        // Step details
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const stepNum = i + 1;
            
            // Status icon
            const statusIcon = result.status === 'SUCCESS' ? '✅' : 
                              result.status === 'FAILED' ? '❌' : '⏭️';
            
            output += `${statusIcon} Step ${stepNum}: ${result.name}\n`;
            output += `${'─'.repeat(80)}\n`;
            
            if (result.command) {
                output += `  💻 Command: ${result.command}\n`;
            }
            
            if (result.output) {
                // Smart truncation - show first part
                const maxLength = 800;
                if (result.output.length > maxLength) {
                    const lines = result.output.split('\n');
                    let truncated = '';
                    let currentLength = 0;
                    
                    for (const line of lines) {
                        if (currentLength + line.length > maxLength) {
                            truncated += `\n  ... (${result.output.length - currentLength} more characters)`;
                            break;
                        }
                        truncated += (truncated ? '\n' : '') + line;
                        currentLength += line.length + 1;
                    }
                    
                    output += `  📄 Output:\n${truncated.split('\n').map(l => '    ' + l).join('\n')}\n`;
                } else {
                    output += `  📄 Output:\n${result.output.split('\n').map(l => '    ' + l).join('\n')}\n`;
                }
            }
            
            if (result.error) {
                output += `  ⚠️  Error: ${result.error}\n`;
            }
            
            if (result.fallback_message) {
                output += `  💡 Note: ${result.fallback_message}\n`;
            }
            
            if (result.reason) {
                output += `  📌 Reason: ${result.reason}\n`;
            }
            
            output += `\n`;
        }

        // Final summary line
        output += `${'═'.repeat(80)}\n`;
        if (planSuccess) {
            output += `✅ All tasks completed successfully!\n`;
        } else {
            output += `⚠️  Some tasks failed or were skipped. Check details above.\n`;
        }

        return output;

    } catch (error) {
        logger.error('runOthers Error:', error);
        return `Execution Error: ${error.message}\n\nPlease check the logs for more details.`;
    }
}

module.exports = { runOthers, executeStep };