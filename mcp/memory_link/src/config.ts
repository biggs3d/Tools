import { loadDatabaseConfig, IDatabaseConfig, DatabaseType } from '@mcp/database-services';
import dotenv from 'dotenv';

dotenv.config();

export interface EmbeddingConfig {
    model: string;
    batchSize: number;
    similarityThreshold: number;
}

export interface BackgroundProcessingConfig {
    maxOperationsPerRun: number;
    maxTimePerRun: number;
    enableEmbeddingBackfill: boolean;
    enableImportanceDecay: boolean;
}

export interface MCPResponseConfig {
    tokenLimit: number;
    tokenBuffer: number;
    fullMemoryTokenThreshold: number;
}

export function getAppConfig(): { 
    dbConfig: IDatabaseConfig; 
    embeddingConfig: EmbeddingConfig; 
    backgroundConfig: BackgroundProcessingConfig;
    mcpResponseConfig: MCPResponseConfig;
} {
    const dbConfig = loadDatabaseConfig();

    // Set default to json-file if not specified
    if (!process.env.DATABASE_TYPE) {
        dbConfig.type = DatabaseType.JsonFile;
        dbConfig.providerConfig = {
            jsonFile: {
                directoryPath: process.env.DATABASE_JSON_FILE_DIRECTORY || './data',
                useSingleFile: true,
                prettyPrint: true,
            },
        };
    }

    const embeddingConfig: EmbeddingConfig = {
        model: process.env.EMBEDDING_MODEL || 'text-embedding-004',
        batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10'),
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7')
    };

    // Phase 4: Centralized background processing configuration
    const backgroundConfig: BackgroundProcessingConfig = {
        maxOperationsPerRun: parseInt(process.env.BG_MAX_OPERATIONS || '5'),
        maxTimePerRun: parseInt(process.env.BG_MAX_TIME_MS || '2000'),
        enableEmbeddingBackfill: process.env.BG_ENABLE_EMBEDDING_BACKFILL !== 'false',
        enableImportanceDecay: process.env.BG_ENABLE_IMPORTANCE_DECAY !== 'false'
    };

    const mcpResponseConfig: MCPResponseConfig = {
        tokenLimit: parseInt(process.env.MCP_TOKEN_LIMIT || '25000'),
        tokenBuffer: parseInt(process.env.MCP_TOKEN_BUFFER || '2000'), // Increased safety margin from 1000 to 2000
        fullMemoryTokenThreshold: parseFloat(process.env.MCP_FULL_MEMORY_TOKEN_THRESHOLD || '0.7')
    };

    return {
        dbConfig,
        embeddingConfig,
        backgroundConfig,
        mcpResponseConfig,
    };
}