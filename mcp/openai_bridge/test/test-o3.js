#!/usr/bin/env node

// Test script for o3 model
import 'dotenv/config';
import OpenAI from 'openai';
import { readFile } from 'fs/promises';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION_ID || undefined
});

async function testO3Model() {
    console.log('🚀 Testing OpenAI o3 model...\n');
    
    try {
        // Read the server.js file for analysis
        const serverCode = await readFile('./server.js', 'utf-8');
        
        // Create a prompt for o3 to analyze
        const prompt = `Analyze this MCP server implementation and provide insights on:
1. Code architecture and design patterns used
2. Potential improvements or optimizations
3. Security considerations
4. Any innovative features you notice

Here's the code:

${serverCode.substring(0, 5000)}... (truncated for testing)

Please provide a concise but insightful analysis focusing on the most interesting aspects.`;

        console.log('Sending request to o3 model...\n');
        
        const completion = await openai.chat.completions.create({
            model: 'o3',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
            // o3 doesn't support temperature parameter
        });
        
        console.log('📝 o3 Analysis:\n');
        console.log(completion.choices[0].message.content);
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testO3Model();