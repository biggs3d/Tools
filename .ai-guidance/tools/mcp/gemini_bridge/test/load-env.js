// Simple .env loader for tests (avoids adding dotenv dependency)
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export async function loadEnv() {
  try {
    const envPath = resolve('.env');
    const envContent = await readFile(envPath, 'utf-8');
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          // Only set if not already in environment
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    }
  } catch (error) {
    // .env file doesn't exist or can't be read - that's okay
    console.error(`Note: Could not load .env file: ${error.message}`);
  }
}