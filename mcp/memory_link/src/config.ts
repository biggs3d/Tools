import { loadDatabaseConfig, IDatabaseConfig, DatabaseType } from '@mcp/database-services';
import dotenv from 'dotenv';

dotenv.config();

export interface EmbeddingConfig {
    model: string;
    batchSize: number;
    similarityThreshold: number;
}

export function getAppConfig(): { dbConfig: IDatabaseConfig; embeddingConfig: EmbeddingConfig } {
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

    return {
        dbConfig,
        embeddingConfig,
    };
}