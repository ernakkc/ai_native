/**
 * Chat System Examples
 * Demonstrates the enhanced chat capabilities with memory and context
 */

const { chatIterate } = require('../src/executor/chat_interaction');
const { generateRespond } = require('../src/skills/chat');
const { getMemoryManager } = require('../src/utils/memory_manager');

async function example1_basicChat() {
    console.log('=== Example 1: Basic Chat ===\n');
    
    const response = await chatIterate('Hello! How are you today?');
    console.log('Response:', response);
    console.log();
}

async function example2_technicalQuestion() {
    console.log('=== Example 2: Technical Question ===\n');
    
    const response = await chatIterate('What programming languages are available on my system?');
    console.log('Response:', response);
    console.log();
}

async function example3_contextAwareChat() {
    console.log('=== Example 3: Context-Aware Chat ===\n');
    
    // First message
    const response1 = await chatIterate('My name is Eren and I love Python programming');
    console.log('Response 1:', response1);
    console.log();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second message - should remember the name
    const response2 = await chatIterate('What programming language do I like?');
    console.log('Response 2:', response2);
    console.log();
}

async function example4_systemInfo() {
    console.log('=== Example 4: System Information Query ===\n');
    
    const response = await chatIterate('Tell me about my system resources');
    console.log('Response:', response);
    console.log();
}

async function example5_withPlanObject() {
    console.log('=== Example 5: Chat with Plan Object ===\n');
    
    const planObject = {
        plan_id: 'test-123',
        type: 'CHAT_INTERACTION',
        goal: 'Explain how AI works in simple terms',
        summary: 'User wants to learn about AI'
    };
    
    const response = await chatIterate(planObject);
    console.log('Response:', response);
    console.log();
}

async function example6_errorHandling() {
    console.log('=== Example 6: Error Handling ===\n');
    
    try {
        // This should handle gracefully
        const response = await chatIterate('');
        console.log('Response:', response);
    } catch (error) {
        console.log('Caught error:', error.message);
    }
    console.log();
}

async function example7_conversationHistory() {
    console.log('=== Example 7: View Conversation History ===\n');
    
    const memory = getMemoryManager();
    const history = await memory.getRecentConversations(5);
    
    console.log(`Found ${history.length} conversations:\n`);
    history.forEach((conv, idx) => {
        console.log(`${idx + 1}. [${conv.created_at}]`);
        console.log(`   User: ${conv.user_message.substring(0, 60)}...`);
        console.log(`   AI: ${conv.ai_response.substring(0, 60)}...`);
        console.log();
    });
}

async function example8_multilingualChat() {
    console.log('=== Example 8: Multilingual Support ===\n');
    
    // Turkish
    const responseTR = await chatIterate('Merhaba! Nasılsın?');
    console.log('Turkish Response:', responseTR);
    console.log();
    
    // English
    const responseEN = await chatIterate('What can you help me with?');
    console.log('English Response:', responseEN);
    console.log();
}

async function example9_codeRequest() {
    console.log('=== Example 9: Code Request ===\n');
    
    const response = await chatIterate('Show me a simple Python function to calculate fibonacci numbers');
    console.log('Response:', response);
    console.log();
}

async function example10_memoryContext() {
    console.log('=== Example 10: Memory Context in Action ===\n');
    
    // Add some facts
    const memory = getMemoryManager();
    await memory.learnUserFact('name', 'Eren', 'example', 0.9);
    await memory.learnUserFact('location', 'Trabzon', 'example', 0.9);
    await memory.learnUserFact('profession', 'Developer', 'example', 0.8);
    
    // Now chat - should use this context
    const response = await chatIterate('What do you know about me?');
    console.log('Response:', response);
    console.log();
    
    // Get memory stats
    const stats = await memory.getStats();
    console.log('Memory Stats:', stats);
    console.log();
}

async function runAllExamples() {
    try {
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║       ENHANCED CHAT SYSTEM EXAMPLES              ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        
        await example1_basicChat();
        await example2_technicalQuestion();
        await example3_contextAwareChat();
        await example4_systemInfo();
        await example5_withPlanObject();
        await example6_errorHandling();
        await example7_conversationHistory();
        await example8_multilingualChat();
        await example9_codeRequest();
        await example10_memoryContext();
        
        console.log('✅ All chat examples completed!\n');
        
        // Close database
        const { getDatabase } = require('../src/utils/database');
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
    example1_basicChat,
    example2_technicalQuestion,
    example3_contextAwareChat,
    example4_systemInfo,
    example5_withPlanObject,
    example6_errorHandling,
    example7_conversationHistory,
    example8_multilingualChat,
    example9_codeRequest,
    example10_memoryContext,
    runAllExamples
};
