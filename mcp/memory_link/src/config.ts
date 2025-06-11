import { loadDatabaseConfig, IDatabaseConfig, DatabaseType } from '@mcp/database-services';
import dotenv from 'dotenv';

dotenv.config();

export function getAppConfig(): { dbConfig: IDatabaseConfig } {
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

    return {
        dbConfig,
    };
}