/**
 * Memory Manager Usage Examples
 * Demonstrates how to use the memory and database features
 */

const { getMemoryManager } = require('../src/utils/memory_manager');
const { getDatabase } = require('../src/utils/database');

async function example1_saveConversation() {
    console.log('=== Example 1: Save Conversation ===\n');
    
    const memory = getMemoryManager();
    
    await memory.saveConversation({
        userMessage: 'My name is Eren and I live in Istanbul',
        aiResponse: 'Nice to meet you Eren! How can I help you today?',
        intentType: 'CHAT_INTERACTION',
        intentCategory: 'GREETING',
        metadata: { confidence: 0.95 }
    });
    
    console.log('✓ Conversation saved\n');
}

async function example2_learnFacts() {
    console.log('=== Example 2: Learn User Facts ===\n');
    
    const memory = getMemoryManager();
    
    await memory.learnUserFact('name', 'Eren', 'conversation', 0.9);
    await memory.learnUserFact('location', 'Istanbul', 'conversation', 0.9);
    await memory.learnUserFact('profession', 'Developer', 'conversation', 0.8);
    await memory.learnUserFact('language', 'Turkish', 'conversation', 0.95);
    
    console.log('✓ User facts learned\n');
}

async function example3_getUserFacts() {
    console.log('=== Example 3: Get User Facts ===\n');
    
    const memory = getMemoryManager();
    
    const allFacts = await memory.getUserFacts();
    console.log('All facts:', JSON.stringify(allFacts, null, 2));
    
    const locationFacts = await memory.getUserFacts('location');
    console.log('\nLocation facts:', JSON.stringify(locationFacts, null, 2));
    console.log();
}

async function example4_recentConversations() {
    console.log('=== Example 4: Recent Conversations ===\n');
    
    const memory = getMemoryManager();
    
    const recent = await memory.getRecentConversations(5);
    console.log(`Found ${recent.length} recent conversations:\n`);
    
    recent.forEach((convo, idx) => {
        console.log(`${idx + 1}. [${convo.created_at}]`);
        console.log(`   User: ${convo.user_message.substring(0, 60)}...`);
        console.log(`   Type: ${convo.intent_type}/${convo.intent_category}`);
        console.log();
    });
}

async function example5_generateMemoryContext() {
    console.log('=== Example 5: Generate Memory Context for AI ===\n');
    
    const memory = getMemoryManager();
    
    const context = await memory.generateMemoryContext();
    console.log(context);
    console.log();
}

async function example6_compactMemoryContext() {
    console.log('=== Example 6: Compact Memory Context ===\n');
    
    const memory = getMemoryManager();
    
    const context = await memory.generateCompactMemoryContext();
    console.log(context);
    console.log();
}

async function example7_preferences() {
    console.log('=== Example 7: User Preferences ===\n');
    
    const memory = getMemoryManager();
    
    await memory.setPreference('theme', 'dark');
    await memory.setPreference('language', 'tr');
    await memory.setPreference('notifications', 'enabled');
    
    const theme = await memory.getPreference('theme');
    console.log('Theme preference:', theme);
    
    const lang = await memory.getPreference('language');
    console.log('Language preference:', lang);
    console.log();
}

async function example8_extractInsights() {
    console.log('=== Example 8: Extract Insights from Message ===\n');
    
    const memory = getMemoryManager();
    
    const insights = await memory.extractInsights(
        "Hi! My name is John and I'm from London. I work as a data scientist and I love Python programming.",
        { type: 'CHAT_INTERACTION', intent: 'GREETING', confidence: 0.9 }
    );
    
    console.log('Extracted insights:', JSON.stringify(insights, null, 2));
    console.log();
}

async function example9_stats() {
    console.log('=== Example 9: Memory Statistics ===\n');
    
    const memory = getMemoryManager();
    
    const stats = await memory.getStats();
    console.log('Memory Stats:', JSON.stringify(stats, null, 2));
    console.log();
}

async function example10_clearMemory() {
    console.log('=== Example 10: Clear Memory (Commented Out) ===\n');
    console.log('To clear all memory, uncomment the line below:');
    console.log('// await memory.clearAllMemory();');
    console.log();
}

async function runAllExamples() {
    try {
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║     MEMORY MANAGER EXAMPLES                      ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        
        await example1_saveConversation();
        await example2_learnFacts();
        await example3_getUserFacts();
        
        // Add more conversations for testing
        const memory = getMemoryManager();
        await memory.saveConversation({
            userMessage: 'Create a Python script on Desktop',
            aiResponse: 'Creating Python script...',
            intentType: 'OTHERS',
            intentCategory: 'CREATE_FILE'
        });
        
        await example4_recentConversations();
        await example5_generateMemoryContext();
        await example6_compactMemoryContext();
        await example7_preferences();
        await example8_extractInsights();
        await example9_stats();
        await example10_clearMemory();
        
        console.log('✅ All examples completed!\n');
        
        // Close database connection
        const db = getDatabase();
        await db.close();
        
    } catch (error) {
        console.error('❌ Error running examples:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runAllExamples();
}

module.exports = {
    example1_saveConversation,
    example2_learnFacts,
    example3_getUserFacts,
    example4_recentConversations,
    example5_generateMemoryContext,
    example6_compactMemoryContext,
    example7_preferences,
    example8_extractInsights,
    example9_stats,
    runAllExamples
};
