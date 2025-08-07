#!/usr/bin/env node

// Test script to check available Grok models
import 'dotenv/config';

const API_KEY = process.env.XAI_API_KEY;
const API_BASE_URL = process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1';

if (!API_KEY) {
    console.error('❌ XAI_API_KEY environment variable is required');
    console.error('Set it in your .env file or export it:');
    console.error('export XAI_API_KEY=your-key-here');
    process.exit(1);
}

console.log('🔍 Checking available Grok models...');
console.log(`API Base URL: ${API_BASE_URL}`);

async function checkModels() {
    try {
        // Try to fetch models list
        const response = await fetch(`${API_BASE_URL}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`❌ API returned ${response.status}: ${response.statusText}`);
            if (response.status === 403) {
                console.error('  403 Forbidden - Check your API key permissions');
                console.error('  Note: Some API keys may not have access to the models endpoint');
            } else if (response.status === 401) {
                console.error('  401 Unauthorized - Invalid API key');
            }
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        console.log('\n✅ Available models:');
        
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(model => {
                console.log(`  - ${model.id}`);
                if (model.created) {
                    console.log(`    Created: ${new Date(model.created * 1000).toISOString()}`);
                }
                console.log(`    Type: ${model.object}`);
            });
            console.log(`\nTotal models: ${data.data.length}`);
        } else {
            console.log('Raw response:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
    }
}

// Also test a simple completion with different model names
async function testModel(modelName) {
    console.log(`\n🧪 Testing model: ${modelName}`);
    
    try {
        const response = await fetch(`${API_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'user',
                        content: 'Say "Hello from Grok" and nothing else.'
                    }
                ],
                temperature: 0.1,
                max_tokens: 10
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.log(`  ❌ Failed: ${response.status} - ${error.substring(0, 100)}...`);
        } else {
            const data = await response.json();
            console.log(`  ✅ Success! Response: ${data.choices[0].message.content}`);
        }
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
    }
}

// Run tests
(async () => {
    await checkModels();
    
    // Test various model names
    const modelsToTest = [
        'grok-2-1212',
        'grok-2-vision-1212',
        'grok-beta',
        'grok-2',
        'grok',
        'grok-2-latest'
    ];
    
    console.log('\n🧪 Testing individual models...');
    for (const model of modelsToTest) {
        await testModel(model);
    }
})();