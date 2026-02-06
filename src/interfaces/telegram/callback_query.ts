
let callbackData: Record<number, string> = {};

/**
 * Add Callback Query Data
 * @param ctx - The context object from the Telegram bot.
 */
async function addCallbackQuery(ctx: any): Promise<void> {
    const messageId = ctx.callbackQuery.message?.message_id;
    const data = ctx.callbackQuery.data;

    callbackData[messageId] = data;
    console.log(`Callback query added: messageId=${messageId}, data=${data}`);
}

/**
 * Get Callback Query Data
 * @param messageId - The message ID to retrieve the callback data for.
 * @returns {Promise<string | null>} - The callback data associated with the message ID, or null if not found.
 */
async function getCallbackQuery(messageId: number): Promise<string | null> {
    return callbackData[messageId] || null;
}

/**
 * Send user approval request on a high-risk action.
 * @param bot - The Telegram bot instance.
 * @param analysisResult - The analysis result containing details about the action.
 * @returns {Promise<any>} - The approval message if sent successfully, false if not.
 */
async function sendApprovalRequestToUser(bot: any, chatId: number, analysisResult: any) : Promise<any> {
    const approvalMessage = `⚠️ The analysis of your message indicates a HIGH risk level. Please review the analysis results and approve or reject the action.\n\n` +
        `Type: ${analysisResult.type}\n` +
        `Intent: ${analysisResult.intent}\n` +
        `Confidence: ${(analysisResult.confidence * 100).toFixed(2)}%\n` +
        `Summary: ${analysisResult.summary}\n` +
        `Requires Approval: ${analysisResult.requires_approval ? 'Yes' : 'No'}\n` +
        `Risk Level: ${analysisResult.risk_level}\n\n` +
        `Do you approve this action?`;

    try {
        const sentMessage = await bot.telegram.sendMessage(chatId, approvalMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Approve', callback_data: 'approve' },
                        { text: 'Reject', callback_data: 'reject' }
                    ]
                ]
            }
        });
        return sentMessage;
    } catch (error) {
        console.error('Error sending approval request:', error);
        return false;
    }
}








export { sendApprovalRequestToUser, addCallbackQuery, getCallbackQuery }

