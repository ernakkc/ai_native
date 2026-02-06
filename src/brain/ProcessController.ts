import { editMessage } from "../interfaces/telegram/helpers/editMessage.js";
import { sendMessage } from "../interfaces/telegram/helpers/sendMessage.js";
import { getCallbackQuery } from "../interfaces/telegram/callback_query.js";
import { sendApprovalRequestToUser } from "../interfaces/telegram/callback_query.js";

import { analyzeMessage } from "./workers/MessageAnalyzer.js";
import { AnalysisResult } from "./prompts/MessageAnalyzerPrompt.js";
import { config } from "../config.js";

import { message } from "telegraf/filters";

/**
 * Main process controller for AI tasks.
 * @param bot - The Telegram bot instance.
 * @param ctx - The context object from the Telegram bot.
 * @returns {Promise<string>} - The AI-generated response.
 */
async function startAiProcessing(bot: any, ctx: any): Promise<string> {
    const userMessage = ctx.message.text;
    let telegramSendedMessage: any = null;
    let telegramSendedMessageID: number = 0;

    telegramSendedMessage = await sendMessage(
        bot,
        ctx.chat.id,
        "**🤖 Starting AI processing...**",
    );

    // =========================
    // STEP 1: ANALYZE MESSAGE
    // =========================
    telegramSendedMessage = await editMessage(
        bot,
        ctx.chat.id,
        telegramSendedMessage.message_id,
        "Analyzing your message...",
        telegramSendedMessage.text,
    );
    const analysisResult: AnalysisResult = await analyzeMessage(userMessage);
    await sendMessage(
        bot,
        ctx.chat.id,
        `✓ Analysis Complete\n` +
        `Type: ${analysisResult.type}\n` +
        `Intent: ${analysisResult.intent}\n` +
        `Confidence: ${(analysisResult.confidence * 100).toFixed(2)}%\n` +
        `Summary: ${analysisResult.summary}\n` +
        `Requires Approval: ${analysisResult.requires_approval ? "Yes" : "No"}\n` +
        `Risk Level: ${analysisResult.risk_level}\n` +
        `Tool Suggestion: ${analysisResult.tool_suggestion}\n\n` +
        `Parameters: ${JSON.stringify(analysisResult.parameters, null, 2)}\n\n` +
        `Context: ${JSON.stringify(analysisResult.context, null, 2)}`,
    );

    if (analysisResult.confidence < config.aiSettings.minConfidenceThreshold) {
        await sendMessage(
            bot,
            ctx.chat.id,
            `⚠️ Low confidence in analysis result. Please rephrase your message or provide more details.`,
        );
        return "Analysis confidence too low.";
    } else if (analysisResult.risk_level === "HIGH") {
        let isApproved = await requestUserApproval(
            bot,
            ctx.chat.id,
            analysisResult,
        );
        if (!isApproved) {
        }
    }

    // =========================
    // STEP 2: ACTION PLANNER
    // =========================
    return "Son";
}

async function requestUserApproval(
    bot: any,
    chatId: number,
    analysisResult: AnalysisResult,
): Promise<boolean> {
    // Send User Approval Request
    if (!(await sendApprovalRequestToUser(bot, chatId, analysisResult))) {
        await sendMessage(
            bot,
            chatId,
            "❌ Failed to send approval request. Please try again later.",
        );
        return false;
    }
    // Check is approved by user
    while (true) {
        const callbackQuery = await getCallbackQuery(chatId);
        console.log(`Received callback query for approval: ${callbackQuery}`);
        if (callbackQuery) {
            if (callbackQuery.includes("approve")) {
                await sendMessage(
                    bot,
                    chatId,
                    "✅ Action approved by user. Proceeding with execution.",
                );
                return true;
            } else if (callbackQuery.includes("reject")) {
                await sendMessage(bot, chatId, "❌ Action rejected by user.");
                return false;
            }
        } else {
            await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for 0.5 second before checking again
        }
    }
}

export { startAiProcessing };
