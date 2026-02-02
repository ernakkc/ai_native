const { getDatabase } = require('./database');
const { createLogger } = require('./logger');
const logger = createLogger('utils.memory_manager');

class MemoryManager {
    constructor() {
        this.db = getDatabase();
        this.initialized = false;
    }

    /**
     * Initialize memory manager
     */
    async initialize() {
        if (this.initialized) return;
        
        await this.db.initialize();
        this.initialized = true;
        logger.info('Memory manager initialized');
    }

    /**
     * Save conversation to history
     * @param {Object} conversation - Conversation data
     * @returns {Promise<number>} - Inserted ID
     */
    async saveConversation(conversation) {
        await this.initialize();
        
        const { userMessage, aiResponse, intentType, intentCategory, metadata } = conversation;
        
        const sql = `
            INSERT INTO conversation_history 
            (user_message, ai_response, intent_type, intent_category, metadata)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await this.db.run(sql, [
            userMessage,
            aiResponse || null,
            intentType || null,
            intentCategory || null,
            metadata ? JSON.stringify(metadata) : null
        ]);
        
        // Keep only last 10 conversations
        await this.db.cleanupHistory(10);
        
        logger.info('Conversation saved', { id: result.lastID });
        return result.lastID;
    }

    /**
     * Get recent conversations
     * @param {number} limit - Number of conversations to retrieve
     * @returns {Promise<Array>}
     */
    async getRecentConversations(limit = 10) {
        await this.initialize();
        
        const sql = `
            SELECT * FROM conversation_history 
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        
        const rows = await this.db.all(sql, [limit]);
        
        // Parse metadata
        return rows.map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));
    }

    /**
     * Learn and store user fact
     * @param {string} factType - Type of fact (name, preference, location, etc.)
     * @param {string} factValue - The actual fact
     * @param {string} source - Where this fact came from
     * @param {number} confidence - Confidence level (0-1)
     * @returns {Promise<number>}
     */
    async learnUserFact(factType, factValue, source = 'conversation', confidence = 0.7) {
        await this.initialize();
        
        // Check if fact already exists
        const existing = await this.db.get(
            'SELECT * FROM user_facts WHERE fact_type = ? AND fact_value = ?',
            [factType, factValue]
        );
        
        if (existing) {
            // Update confidence if exists
            const newConfidence = Math.min(1, existing.confidence + 0.1);
            await this.db.run(
                'UPDATE user_facts SET confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newConfidence, existing.id]
            );
            logger.info('Updated user fact confidence', { factType, factValue, confidence: newConfidence });
            return existing.id;
        } else {
            // Insert new fact
            const sql = `
                INSERT INTO user_facts (fact_type, fact_value, source, confidence)
                VALUES (?, ?, ?, ?)
            `;
            const result = await this.db.run(sql, [factType, factValue, source, confidence]);
            logger.info('Learned new user fact', { factType, factValue, confidence });
            return result.lastID;
        }
    }

    /**
     * Get all user facts by type
     * @param {string} factType - Type of facts to retrieve
     * @returns {Promise<Array>}
     */
    async getUserFacts(factType = null) {
        await this.initialize();
        
        let sql, params;
        if (factType) {
            sql = 'SELECT * FROM user_facts WHERE fact_type = ? ORDER BY confidence DESC, updated_at DESC';
            params = [factType];
        } else {
            sql = 'SELECT * FROM user_facts ORDER BY confidence DESC, updated_at DESC';
            params = [];
        }
        
        return await this.db.all(sql, params);
    }

    /**
     * Save or update user preference
     * @param {string} key - Preference key
     * @param {string} value - Preference value
     * @returns {Promise<number>}
     */
    async setPreference(key, value) {
        await this.initialize();
        
        const sql = `
            INSERT INTO user_preferences (preference_key, preference_value)
            VALUES (?, ?)
            ON CONFLICT(preference_key) DO UPDATE SET
                preference_value = excluded.preference_value,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const result = await this.db.run(sql, [key, value]);
        logger.info('User preference saved', { key, value });
        return result.lastID;
    }

    /**
     * Get user preference
     * @param {string} key - Preference key
     * @returns {Promise<string|null>}
     */
    async getPreference(key) {
        await this.initialize();
        
        const row = await this.db.get(
            'SELECT preference_value FROM user_preferences WHERE preference_key = ?',
            [key]
        );
        
        return row ? row.preference_value : null;
    }

    /**
     * Extract insights from user message using AI
     * @param {string} message - User message
     * @param {Object} analysis - Intent analysis from MessageAnalyzer
     * @returns {Promise<Object>}
     */
    async extractInsights(message, analysis = null) {
        const insights = {
            facts: [],
            preferences: [],
            context: []
        };

        try {
            // Use AI to extract facts from the message
            const { runAI } = require('../skills/ai');
            const { AI_FACT_EXTRACTION_PROMPT } = require('../../data/prompts/FactExtractionPrompt');
            
            logger.info('Extracting insights using AI', { messageLength: message.length });
            
            // Get AI analysis
            const extractionResult = await runAI(message, AI_FACT_EXTRACTION_PROMPT, { expectJson: true });
            
            if (extractionResult && extractionResult.facts && Array.isArray(extractionResult.facts)) {
                logger.info('AI extracted facts', { count: extractionResult.facts.length });
                
                // Process each extracted fact
                for (const fact of extractionResult.facts) {
                    const { type, value, confidence } = fact;
                    
                    // Validate confidence threshold
                    if (confidence >= 0.6) {
                        insights.facts.push({ type, value, confidence });
                        
                        // Save to database
                        await this.learnUserFact(type, value, 'ai_extraction', confidence);
                        
                        logger.info('Learned user fact from AI', { type, value, confidence });
                    } else {
                        logger.debug('Skipped low confidence fact', { type, value, confidence });
                    }
                }
            } else {
                logger.warn('No facts extracted from message');
            }
        } catch (error) {
            logger.error('Error extracting insights with AI', error);
            // Don't throw - continue with empty insights
        }

        // Extract context from analysis
        if (analysis) {
            insights.context.push({
                intent_type: analysis.type,
                intent_category: analysis.intent,
                confidence: analysis.confidence
            });
        }

        return insights;
    }

    /**
     * Generate memory context for AI prompts
     * @returns {Promise<string>}
     */
    async generateMemoryContext() {
        await this.initialize();
        
        // Get recent conversations
        const recentConvos = await this.getRecentConversations(10);
        
        // Get user facts
        const facts = await this.getUserFacts();
        
        let context = '\n## USER MEMORY & CONTEXT\n\n';
        
        // Add user facts
        if (facts.length > 0) {
            context += '**Known Facts About User:**\n';
            
            // Group facts by type
            const factsByType = {};
            facts.forEach(fact => {
                if (!factsByType[fact.fact_type]) {
                    factsByType[fact.fact_type] = [];
                }
                factsByType[fact.fact_type].push(fact);
            });
            
            for (const [type, typeFacts] of Object.entries(factsByType)) {
                const bestFact = typeFacts[0]; // Highest confidence
                context += `- ${type}: ${bestFact.fact_value} (confidence: ${(bestFact.confidence * 100).toFixed(0)}%)\n`;
            }
            context += '\n';
        }
        
        // Add recent conversation history
        if (recentConvos.length > 0) {
            context += '**Recent Conversation History:**\n';
            recentConvos.reverse().forEach((convo, idx) => {
                const timestamp = new Date(convo.created_at).toLocaleString('tr-TR');
                context += `${idx + 1}. [${timestamp}] User: "${convo.user_message.substring(0, 100)}${convo.user_message.length > 100 ? '...' : ''}"\n`;
                if (convo.intent_type) {
                    context += `   → Intent: ${convo.intent_type}/${convo.intent_category || 'unknown'}\n`;
                }
            });
            context += '\n';
        }
        
        if (facts.length === 0 && recentConvos.length === 0) {
            context += '*No previous context available. This appears to be a new conversation.*\n\n';
        }
        
        context += '**Instructions:**\n';
        context += '- Use this context to provide more personalized responses\n';
        context += '- Reference previous conversations when relevant\n';
        context += '- Learn and remember new facts from current conversation\n';
        context += '- Be consistent with known user preferences\n';
        
        return context;
    }

    /**
     * Get compact memory context (for shorter prompts)
     * @returns {Promise<string>}
     */
    async generateCompactMemoryContext() {
        await this.initialize();
        
        const facts = await this.getUserFacts();
        const recentConvos = await this.getRecentConversations(3);
        
        let context = '\n## MEMORY: ';
        
        if (facts.length > 0) {
            const factStrings = facts.slice(0, 3).map(f => `${f.fact_type}:${f.fact_value}`);
            context += factStrings.join(', ');
        } else {
            context += 'New user';
        }
        
        if (recentConvos.length > 0) {
            context += ` | Recent: ${recentConvos[0].intent_type || 'chat'}`;
        }
        
        context += '\n';
        
        return context;
    }

    /**
     * Clear all memory (use with caution!)
     * @returns {Promise<void>}
     */
    async clearAllMemory() {
        await this.initialize();
        
        await this.db.run('DELETE FROM conversation_history');
        await this.db.run('DELETE FROM user_facts');
        await this.db.run('DELETE FROM user_preferences');
        await this.db.run('DELETE FROM user_profile');
        
        logger.warn('All memory cleared');
    }

    /**
     * Get memory statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        await this.initialize();
        
        const conversationCount = await this.db.get(
            'SELECT COUNT(*) as count FROM conversation_history'
        );
        const factsCount = await this.db.get(
            'SELECT COUNT(*) as count FROM user_facts'
        );
        const preferencesCount = await this.db.get(
            'SELECT COUNT(*) as count FROM user_preferences'
        );
        
        return {
            conversations: conversationCount.count,
            facts: factsCount.count,
            preferences: preferencesCount.count
        };
    }
}

// Singleton instance
let memoryInstance = null;

/**
 * Get memory manager instance (singleton)
 * @returns {MemoryManager}
 */
function getMemoryManager() {
    if (!memoryInstance) {
        memoryInstance = new MemoryManager();
    }
    return memoryInstance;
}

module.exports = { MemoryManager, getMemoryManager };
