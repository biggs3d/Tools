import { buildServer } from '../src/index.js';
import type { FastifyInstance } from 'fastify';

console.log('🔥 Universal Auth Broker - Smoke Test\n');

let server: FastifyInstance;

async function setup() {
  console.log('⚙️  Setting up server...');
  server = await buildServer();
  return server;
}

async function teardown() {
  console.log('\n🧹 Cleaning up...');
  if (server) {
    await server.close();
  }
}

async function testHealthEndpoint() {
  console.log('\n📍 Testing /health endpoint...');
  const response = await server.inject({
    method: 'GET',
    url: '/health'
  });

  if (response.statusCode !== 200) {
    throw new Error(`Health check failed with status ${response.statusCode}`);
  }

  const body = JSON.parse(response.body);
  console.log('✅ Health check passed:', body);
}

async function testPluginsList() {
  console.log('\n📍 Testing /v1/plugins endpoint...');
  const response = await server.inject({
    method: 'GET',
    url: '/v1/plugins'
  });

  if (response.statusCode !== 200) {
    throw new Error(`Plugin list failed with status ${response.statusCode}`);
  }

  const body = JSON.parse(response.body);
  console.log(`✅ Found ${body.plugins.length} plugins:`, 
    body.plugins.map((p: any) => p.name).join(', '));
}

async function testAuthDetection() {
  console.log('\n📍 Testing auth detection...');
  const response = await server.inject({
    method: 'POST',
    url: '/v1/plugins/detect',
    payload: {
      endpoint: 'https://api.github.com'
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Auth detection failed with status ${response.statusCode}`);
  }

  const body = JSON.parse(response.body);
  console.log('✅ Auth detection result:', body);
}

async function testConnectionCreation() {
  console.log('\n📍 Testing connection creation...');
  const response = await server.inject({
    method: 'POST',
    url: '/v1/connections',
    payload: {
      name: 'Test GitHub Connection',
      service: 'github',
      endpoint: 'https://api.github.com',
      authConfig: {
        type: 'oauth2',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['read:user', 'repo']
      }
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`Connection creation failed with status ${response.statusCode}: ${response.body}`);
  }

  const body = JSON.parse(response.body);
  console.log('✅ Connection created:', body);
}

async function runTests() {
  try {
    await setup();
    
    await testHealthEndpoint();
    await testPluginsList();
    await testAuthDetection();
    await testConnectionCreation();
    
    console.log('\n🎉 All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();