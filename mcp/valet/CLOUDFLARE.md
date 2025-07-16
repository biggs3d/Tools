# Cloudflare Integration Guide

This document outlines the planned integration of Cloudflare R2 storage into the Valet MCP server using the database-services package, enabling machine-independent data storage and cross-device synchronization.

## Overview

The Valet MCP server currently uses local file storage for todos, daily planners, journals, and settings. To make Valet truly machine-independent, we're integrating Cloudflare R2 storage through the `database-services` package's `CloudflareR2Provider`.

## Architecture

### Current Storage Pattern
```
valet-data/
├── _global_todo.json          # Global todo list
├── days/                      # Daily files
│   ├── YYYY-MM-DD-planner.json
│   └── YYYY-MM-DD-journal.json
├── archive/                   # Archived daily files
│   └── YYYY-MM-DD.json
└── settings.json              # User preferences
```

### Proposed Database-Services Integration
```
Collections in R2:
├── todos                      # Global todo items
├── daily_planners             # Daily planner entries
├── daily_journals             # Daily journal entries  
├── archived_days              # Archived daily data
└── user_settings              # User preferences and config
```

## Integration Strategy

### Phase 1: Storage Provider Abstraction
1. Create `StorageProvider` interface in `lib/core/storage-provider.js`
2. Implement `LocalFileProvider` wrapping existing FileHandler
3. Implement `CloudflareR2StorageProvider` using database-services
4. Add storage provider configuration to settings.json

### Phase 2: Todo Migration
1. Migrate `TodoManager` to use storage provider abstraction
2. Implement collection-based todo storage with R2
3. Add migration utility to move existing todos to R2
4. Test cross-device todo synchronization

### Phase 3: Daily Files Migration
1. Migrate `DailyOps` to use storage provider abstraction
2. Implement date-based collections for planners/journals
3. Add migration utility for existing daily files
4. Enable cross-device daily data access

### Phase 4: Settings & Archive Migration
1. Migrate settings storage to R2
2. Implement archive collection with proper indexing
3. Add bulk migration utilities
4. Full machine-independence achieved

## Implementation Details

### Storage Provider Interface
```javascript
// lib/core/storage-provider.js
export class StorageProvider {
  async connect() { throw new Error('Not implemented'); }
  async disconnect() { throw new Error('Not implemented'); }
  
  // Collection operations
  async createItem(collection, item) { throw new Error('Not implemented'); }
  async readItem(collection, id) { throw new Error('Not implemented'); }
  async updateItem(collection, id, item) { throw new Error('Not implemented'); }
  async deleteItem(collection, id) { throw new Error('Not implemented'); }
  async listItems(collection, options = {}) { throw new Error('Not implemented'); }
  
  // Migration support
  async migrateLegacyData(legacyData) { throw new Error('Not implemented'); }
}
```

### Configuration Integration
```javascript
// Extended settings.json schema
{
  "storage": {
    "provider": "local" | "cloudflare-r2",
    "cloudflare": {
      "endpoint": "https://account.r2.cloudflarestorage.com",
      "bucketName": "valet-data",
      "keyPrefix": "user-{userId}", // Optional user isolation
      "enableSync": true,
      "syncInterval": 30000 // 30 seconds
    },
    "local": {
      "dataPath": "./valet-data",
      "enableBackup": true
    }
  }
}
```

### Database-Services Integration
```javascript
// lib/core/cloudflare-r2-storage-provider.js
import { DatabaseService } from '@tools/database-services';
import { CloudflareR2Provider } from '@tools/database-services';

export class CloudflareR2StorageProvider extends StorageProvider {
  constructor(config) {
    super();
    this.dbService = new DatabaseService(new CloudflareR2Provider(config));
  }
  
  async connect() {
    await this.dbService.connect();
  }
  
  async createItem(collection, item) {
    return await this.dbService.create(collection, item);
  }
  
  // ... implement other methods
}
```

## Data Migration Strategy

### Migration Utilities
Create migration utilities in `lib/migration/`:
- `todo-migrator.js` - Migrate todos from JSON to R2 collections
- `daily-migrator.js` - Migrate daily files to R2 collections
- `settings-migrator.js` - Migrate settings to R2
- `archive-migrator.js` - Migrate archived files to R2

### Migration Process
1. **Backup existing data** before migration
2. **Gradual migration** - migrate one collection at a time
3. **Dual operation** - write to both local and R2 during transition
4. **Verification** - compare local vs R2 data integrity
5. **Cutover** - switch to R2-only operations
6. **Cleanup** - remove local files after successful migration

## Collection Schemas

### Todos Collection
```javascript
{
  id: string,           // UUID
  content: string,      // Todo description
  status: 'pending' | 'in_progress' | 'completed',
  priority: 'high' | 'medium' | 'low',
  category: string,     // Optional category
  due: string,          // ISO date string
  notes: string[],      // Sub-notes
  createdAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp
  completedAt: string   // ISO timestamp (when completed)
}
```

### Daily Planners Collection
```javascript
{
  id: string,           // Format: YYYY-MM-DD
  date: string,         // ISO date string
  tasks: object[],      // Planned tasks
  data_stash: object,   // Temporary data storage
  ongoing_summary: string, // Day summary
  reflections: string,  // End-of-day reflections
  personal_reminders: string[], // Personal notes
  createdAt: string,    // ISO timestamp
  updatedAt: string     // ISO timestamp
}
```

### Daily Journals Collection
```javascript
{
  id: string,           // Format: YYYY-MM-DD
  date: string,         // ISO date string
  entries: object[],    // Journal entries
  mood: string,         // Daily mood tracking
  highlights: string[], // Day highlights
  challenges: string[], // Day challenges
  lessons: string[],    // Lessons learned
  createdAt: string,    // ISO timestamp
  updatedAt: string     // ISO timestamp
}
```

## Configuration & Environment

### Required Environment Variables

**Global R2 Configuration** (from `packages/database-services/.env`):
```bash
# Cloudflare R2 Configuration - Account-level settings
CLOUDFLARE_R2_ENDPOINT=https://account.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_REGION=auto
```

**Project-Specific Configuration** (valet MCP server `.env`):
```bash
# Valet-specific R2 Configuration
CLOUDFLARE_R2_BUCKET_NAME=mcp-server-valet-storage
```

### Storage Provider Configuration
```javascript
// lib/core/config-loader.js - Extended configuration
export const loadStorageConfig = () => {
  const config = loadConfig();
  
  if (config.storage.provider === 'cloudflare-r2') {
    return {
      // Account-level config from database-services
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      region: process.env.CLOUDFLARE_R2_REGION || 'auto',
      
      // Project-specific config
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'mcp-server-valet-storage',
      keyPrefix: config.storage.cloudflare.keyPrefix || 'valet'
    };
  }
  
  return config.storage.local;
};
```

## Error Handling & Fallback

### Connection Resilience
- **Auto-retry** - Retry failed operations with exponential backoff
- **Graceful degradation** - Fall back to local storage if R2 unavailable
- **Conflict resolution** - Handle concurrent edits across devices
- **Data validation** - Validate data integrity before storage

### Fallback Strategy
```javascript
export class HybridStorageProvider extends StorageProvider {
  constructor(primaryProvider, fallbackProvider) {
    super();
    this.primary = primaryProvider;
    this.fallback = fallbackProvider;
  }
  
  async createItem(collection, item) {
    try {
      return await this.primary.createItem(collection, item);
    } catch (error) {
      console.warn('Primary storage failed, using fallback:', error);
      return await this.fallback.createItem(collection, item);
    }
  }
  
  // ... implement other methods with fallback logic
}
```

## Testing Strategy

### Unit Tests
- Test storage provider implementations
- Test migration utilities
- Test error handling and fallback logic
- Test data validation and schema compliance

### Integration Tests
- Test end-to-end workflows with R2
- Test cross-device synchronization
- Test migration from local to R2 storage
- Test performance with large datasets

### Performance Tests
- Benchmark R2 operations vs local storage
- Test concurrent access patterns
- Test large collection handling
- Test network resilience

## Security Considerations

### Data Encryption
- **Transit encryption** - All R2 API calls use HTTPS
- **At-rest encryption** - R2 provides server-side encryption
- **Access control** - Use IAM policies for R2 bucket access

### Authentication
- **API keys** - Secure storage of R2 credentials
- **User isolation** - Use keyPrefix for multi-user environments
- **Audit logging** - Log all storage operations for security

### Data Privacy
- **Personal data** - Ensure compliance with data protection regulations
- **Data retention** - Implement appropriate retention policies
- **Data portability** - Provide export/import capabilities

## Monitoring & Observability

### Metrics
- **Operation latency** - Track R2 operation performance
- **Success rates** - Monitor operation success/failure rates
- **Storage usage** - Track R2 storage consumption
- **Sync conflicts** - Monitor cross-device sync issues

### Logging
- **Structured logging** - Use consistent log format
- **Error tracking** - Comprehensive error logging
- **Performance tracking** - Log operation timings
- **Audit trail** - Log all data modifications

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Implement storage provider abstraction
- [ ] Create LocalFileProvider wrapper
- [ ] Set up database-services integration
- [ ] Add storage configuration to settings

### Week 3-4: Todo Migration
- [ ] Implement CloudflareR2StorageProvider
- [ ] Create todo migration utilities
- [ ] Test todo operations with R2
- [ ] Implement hybrid storage with fallback

### Week 5-6: Daily Files Migration
- [ ] Migrate DailyOps to storage provider
- [ ] Create daily file migration utilities
- [ ] Test daily operations with R2
- [ ] Implement cross-device sync

### Week 7-8: Settings & Polish
- [ ] Migrate settings storage to R2
- [ ] Implement archive collection
- [ ] Add monitoring and error handling
- [ ] Complete testing and documentation

## Future Enhancements

### Advanced Features
- **Real-time sync** - WebSocket-based live updates
- **Conflict resolution** - Automatic merge of concurrent edits
- **Offline support** - Queue operations when offline
- **Data analytics** - Insights from historical data

### Integration Possibilities
- **Multi-user support** - Shared todos and planners
- **Team collaboration** - Shared workspaces
- **Mobile apps** - Native mobile clients
- **Web interface** - Browser-based access

## Conclusion

This integration will transform Valet from a local-only tool into a truly machine-independent productivity system. The phased approach ensures stability while the storage provider abstraction maintains flexibility for future enhancements.

Key benefits:
- ✅ **Machine independence** - Access data from any device
- ✅ **Data durability** - Cloud-based backup and redundancy
- ✅ **Cross-device sync** - Real-time synchronization
- ✅ **Scalability** - Handle large datasets efficiently
- ✅ **Flexibility** - Easy to add new storage providers

The database-services package provides the perfect foundation for this integration, offering robust R2 support with proper error handling, validation, and performance optimization.