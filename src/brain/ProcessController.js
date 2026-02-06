const { analyzeMessage } = require('./MessageAnalyzer');
const { planAnalyze } = require('./ActionPlanner');
const { ActionRotator } = require('./ActionRotator');
const { getMemoryManager } = require('../utils/memory_manager');
const { editMessage } = require('../interfaces/telegram/bot');
const { getCallbackData } = require('../interfaces/telegram/bot');

const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.runner');

// Minimum confidence threshold for proceeding with actions
const MIN_CONFIDENCE_THRESHOLD = 0.7;


/**
 * Request user approval for high-risk operations
 * @param {Object} analysis - Analysis result from MessageAnalyzer
 * @param {Object} plan - Plan from ActionPlanner
 * @returns {Boolean} - true if approved, false otherwise
 */
const requestApproval = async (analysis, plan) => {
    const approvalInfo = {
        request_id: analysis.request_id,
        plan_id: plan.plan_id,
        type: plan.type,
        risk_level: plan.risk_level,
        goal: plan.goal,
        reason: plan.approval.reason,
        summary: analysis.summary
    };

    logger.warn('APPROVAL REQUIRED', approvalInfo);


    // Default: Auto-approve for now (should be changed in production)
    logger.warn('No approval callback set. Auto-approving (unsafe for production!)');
    return true;
};

/**
 * Validate analysis result
 * @param {Object} analysis - Analysis result from MessageAnalyzer
 * @returns {Object} - { valid: boolean, reason: string }
 */
const validateAnalysis = (analysis) => {
    // Check if analysis object exists
    if (!analysis || typeof analysis !== 'object') {
        return { valid: false, reason: 'Invalid analysis object' };
    }

    // Check required fields
    const requiredFields = ['request_id', 'type', 'intent', 'confidence', 'summary'];
    for (const field of requiredFields) {
        if (!analysis[field]) {
            return { valid: false, reason: `Missing required field: ${field}` };
        }
    }

    // Check confidence threshold
    if (analysis.confidence < MIN_CONFIDENCE_THRESHOLD) {
        return { 
            valid: false, 
            reason: `Low confidence (${analysis.confidence}). Threshold: ${MIN_CONFIDENCE_THRESHOLD}` 
        };
    }

    // Check valid type
    const validTypes = ['OTHERS', 'WEB_AUTOMATION', 'CHAT_INTERACTION'];
    if (!validTypes.includes(analysis.type)) {
        return { valid: false, reason: `Invalid type: ${analysis.type}` };
    }

    return { valid: true, reason: 'Analysis validated successfully' };
};

/**
 * Validate plan result
 * @param {Object} plan - Plan from ActionPlanner
 * @returns {Object} - { valid: boolean, reason: string }
 */
const validatePlan = (plan) => {
    // Check if plan object exists
    if (!plan || typeof plan !== 'object') {
        return { valid: false, reason: 'Invalid plan object' };
    }

    // Check required fields
    const requiredFields = ['plan_id', 'source_request_id', 'type', 'goal', 'steps'];
    for (const field of requiredFields) {
        if (!plan[field]) {
            return { valid: false, reason: `Missing required field: ${field}` };
        }
    }

    // Check steps array
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
        return { valid: false, reason: 'Plan must contain at least one step' };
    }

    // Validate each step
    for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        if (!step.step_id || !step.name || !step.type || !step.tool) {
            return { 
                valid: false, 
                reason: `Invalid step ${i + 1}: missing required fields` 
            };
        }
    }

    return { valid: true, reason: 'Plan validated successfully' };
};

/**
 * Main process controller
 * @param {Object} ctx - Telegram context object
 * @returns {String} - Final execution result
 */
const startProcess = async(ctx) => {
    const message = ctx.message.text;

    try {
        logger.info('startProcess called', { message });

        // =========================
        // STEP 1: ANALYZE MESSAGE
        // =========================
        logger.info('Step 1: Analyzing user message...');
        await editMessage(ctx, null, 'Step 1: Analyzing user message...', true);
        const analysis = await analyzeMessage(message);
        logger.info('Analysis result', analysis);
        await editMessage(
            ctx, null, `✓ Analysis Complete\n` +
            `Type: ${analysis.type}\n` +
            `Intent: ${analysis.intent}\n` +
            `Confidence: ${(analysis.confidence * 100).toFixed(0)}%\n` +
            `Risk: ${analysis.risk_level}\n` +
            `Summary: ${analysis.summary}`, true
        );

        // Validate analysis
        const analysisValidation = validateAnalysis(analysis);
        if (!analysisValidation.valid) {
            logger.error('Analysis validation failed', analysisValidation);
            
            // Check if we should ask for clarification
            if (analysis.type === 'CHAT_INTERACTION' && analysis.intent === 'CLARIFICATION') {
                return analysis.fallback?.message || 'Could you please clarify your request?';
            }
            
            return `Analysis failed: ${analysisValidation.reason}. Please rephrase your request.`;
        }

        // Check if this is pure chat interaction (no action needed)
        if (analysis.type === 'CHAT_INTERACTION') {
            logger.info('Pure chat interaction detected, routing to chat handler');
            
            if (typeof editMessageCallback === 'function') {
                await editMessageCallback('💬 Generating response...');
            }
            
            // Route to chat handler with original user message
            const { chatIterate } = require('../executor/chat_interaction');
            const chatResponse = await chatIterate(message, editMessageCallback);
            
            // Save conversation to memory
            const memoryManager = getMemoryManager();
            await memoryManager.saveConversation({
                userMessage: message,
                aiResponse: chatResponse,
                intentType: 'CHAT_INTERACTION',
                intentCategory: analysis.intent,
                metadata: {
                    request_id: analysis.request_id,
                    confidence: analysis.confidence
                }
            });
            
            return chatResponse;
        }

        // =========================
        // STEP 2: CREATE EXECUTION PLAN
        // =========================
        logger.info('Step 2: Creating execution plan...');
        const analysisJson = JSON.stringify(analysis);
        const planningResult = await planAnalyze(analysisJson);
        logger.info('Planning result', planningResult);
        
        if (typeof editMessageCallback === 'function') {
            await editMessageCallback(`✓ Plan Created\n` +
                `Plan ID: ${planningResult.plan_id}\n` +
                `Goal: ${planningResult.goal}\n` +
                `Steps: ${planningResult.steps.length}\n` +
                `Risk: ${planningResult.risk_level}\n` +
                `Approval Required: ${planningResult.approval?.required ? 'Yes' : 'No'}`
            );
        }

        // Validate plan
        const planValidation = validatePlan(planningResult);
        if (!planValidation.valid) {
            logger.error('Plan validation failed', planValidation);
            return `Planning failed: ${planValidation.reason}. ${analysis.fallback?.message || 'Please try again.'}`;
        }

        // =========================
        // STEP 3: APPROVAL CHECK
        // =========================
        if (planningResult.approval?.required === true) {
            logger.info('Step 3: Requesting approval...');
            
            if (typeof editMessageCallback === 'function') {
                await editMessageCallback(`⚠️ Approval Required\n` +
                    `Risk Level: ${planningResult.risk_level}\n` +
                    `Reason: ${planningResult.approval.reason}\n` +
                    `Awaiting confirmation...`
                );
            }

            const approved = await requestApproval(analysis, planningResult);
            
            if (!approved) {
                logger.warn('Operation not approved by user');
                return `Operation cancelled: ${planningResult.approval.reason}. User approval was denied.`;
            }

            logger.info('Operation approved by user');
            if (typeof editMessageCallback === 'function') {
                await editMessageCallback(`✓ Approved - Proceeding with execution`);
            }
        }

        // =========================
        // STEP 4: UPDATE PLAN STATUS
        // =========================
        planningResult.status = 'EXECUTING';
        logger.info('Step 4: Plan status updated to EXECUTING');

        // =========================
        // STEP 5: EXECUTE PLAN
        // =========================
        logger.info('Step 5: Executing action plan...');
        
        if (typeof editMessageCallback === 'function') {
            await editMessageCallback(`⚙️ Executing...\n` +
                `Processing ${planningResult.steps.length} steps`
            );
        }

        const planningResultJson = JSON.stringify(planningResult);
        let finalResponse = await ActionRotator(planningResultJson, analysis);

        // =========================
        // STEP 6: FINALIZE & SAVE TO MEMORY
        // =========================
        planningResult.status = 'COMPLETED';
        planningResult.result.success = true;
        
        // Save conversation to memory
        const memoryManager = getMemoryManager();
        await memoryManager.saveConversation({
            userMessage: prompt,
            aiResponse: finalResponse,
            intentType: analysis.type,
            intentCategory: analysis.intent,
            metadata: {
                request_id: analysis.request_id,
                plan_id: planningResult.plan_id,
                confidence: analysis.confidence,
                risk_level: planningResult.risk_level
            }
        });
        
        logger.info('startProcess completed successfully', {
            request_id: analysis.request_id,
            plan_id: planningResult.plan_id,
            type: analysis.type
        });

        if (typeof editMessageCallback === 'function') {
            await editMessageCallback(`✓ Execution Complete`);
        }

        return finalResponse;

    } catch (error) {
        logger.error('startProcess Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Update plan status if available
        if (planningResult) {
            planningResult.status = 'FAILED';
            planningResult.result.success = false;
            planningResult.result.error = error.message;
        }

        if (typeof editMessageCallback === 'function') {
            await editMessageCallback(`✗ Error: ${error.message}`);
        }

        // Return user-friendly error message
        return `An error occurred: ${error.message}. Please try again or rephrase your request.`;
    }
};

module.exports = { startProcess };