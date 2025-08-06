# Adaptive Data Normalizer - Technical Specification

## API Specification

### Base URL
```
https://data-normalizer.{environment}.app/v1
```

### Authentication
Uses JWT tokens with tenant isolation:
```
Authorization: Bearer <jwt-token>
X-Tenant-ID: tenant_123
```

## Core Endpoints

### 1. Schema Learning & Pattern Detection

#### Learn from Sample Data (Async)
```http
POST /schemas/learn
Content-Type: application/json

{
  "sourceId": "github_api",
  "samples": [
    {
      "endpoint": "https://api.github.com/users/{username}",
      "response": { /* actual API response */ },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "options": {
    "detectDateFormats": true,
    "inferTypes": true,
    "trackVariations": true,
    "generateTypes": ["typescript", "python", "graphql"],
    "async": true  // For large sample sets
  }
}

Response: 202 Accepted (for async mode)
{
  "jobId": "job_abc123",
  "status": "processing",
  "statusUrl": "/schemas/learn/jobs/job_abc123",
  "estimatedCompletion": "2024-01-15T10:30:05Z"
}

Response: 201 Created (for sync mode with small samples)
{
  "schemaId": "schema_xGh5kL9mN3pQ",
  "sourceId": "github_api",
  "patterns": {
    "dateFields": ["created_at", "updated_at"],
    "dateFormats": ["ISO8601"],
    "nestedObjects": ["owner", "permissions"],
    "arrays": ["labels", "assignees"],
    "nullable": ["bio", "company", "blog"]
  },
  "confidence": 0.95,
  "samplesAnalyzed": 1,
  "generatedTypes": {
    "typescript": "interface GitHubUser { ... }",
    "python": "class GitHubUser(TypedDict): ...",
    "graphql": "type GitHubUser { ... }"
  }
}
```

#### Check Learning Job Status
```http
GET /schemas/learn/jobs/{jobId}

Response: 200 OK (still processing)
{
  "jobId": "job_abc123",
  "status": "processing",
  "progress": 0.75,
  "currentStep": "analyzing_patterns",
  "estimatedCompletion": "2024-01-15T10:30:05Z"
}

Response: 200 OK (completed)
{
  "jobId": "job_abc123",
  "status": "completed",
  "result": {
    "schemaId": "schema_xGh5kL9mN3pQ",
    "sourceId": "github_api",
    "patterns": { /* ... */ },
    "confidence": 0.98,
    "samplesAnalyzed": 1000
  }
}
```

#### Update Schema with More Samples
```http
PATCH /schemas/{schemaId}/learn
Content-Type: application/json

{
  "samples": [
    /* additional samples to improve pattern detection */
  ]
}

Response: 200 OK
{
  "schemaId": "schema_xGh5kL9mN3pQ",
  "confidence": 0.98,
  "samplesAnalyzed": 25,
  "variations": [
    {
      "field": "permissions",
      "types": ["object", "null"],
      "frequency": {"object": 0.8, "null": 0.2}
    }
  ]
}
```

### 2. Data Transformation

#### Transform Single Payload
```http
POST /transform
Content-Type: application/json

{
  "sourceSchema": "schema_xGh5kL9mN3pQ",
  "targetFormat": "unified_v1",
  "data": {
    /* raw API response */
  },
  "options": {
    "handleMissing": "default",
    "dateFormat": "unix",
    "flattenNested": false,
    "preserveOriginal": true
  }
}

Response: 200 OK
{
  "transformed": {
    "id": "user_123",
    "displayName": "John Doe",
    "email": "john@example.com",
    "createdAt": 1705316400,
    "metadata": {
      "source": "github",
      "originalId": "12345"
    }
  },
  "original": { /* preserved if requested */ },
  "transformations": [
    {"field": "name", "to": "displayName", "type": "rename"},
    {"field": "created_at", "to": "createdAt", "type": "date_conversion"}
  ]
}
```

#### Streaming Transformation
```http
POST /transform/stream
Content-Type: application/json

{
  "sourceSchema": "schema_xGh5kL9mN3pQ",
  "targetFormat": "unified_v1",
  "streamConfig": {
    "source": "websocket://api.example.com/events",
    "batchSize": 100,
    "flushInterval": 5000
  }
}

Response: 200 OK
{
  "streamId": "stream_abc123",
  "status": "active",
  "endpoint": "wss://normalizer.app/streams/stream_abc123",
  "statistics": {
    "messagesPerSecond": 0,
    "totalTransformed": 0
  }
}
```

### 3. Unified Query Language

#### Query Across Multiple Sources
```http
POST /query
Content-Type: application/json

{
  "query": "SELECT user.name, repo.stars FROM github, gitlab WHERE user.created > '2024-01-01' AND repo.language = 'TypeScript'",
  "sources": [
    {"type": "github", "schema": "schema_github"},
    {"type": "gitlab", "schema": "schema_gitlab"}
  ],
  "options": {
    "limit": 100,
    "cache": true,
    "parallel": true
  }
}

Response: 200 OK
{
  "results": [
    {
      "user.name": "John Doe",
      "repo.stars": 1250,
      "_source": "github"
    }
  ],
  "metadata": {
    "sources": ["github", "gitlab"],
    "totalResults": 42,
    "queryTime": 234,
    "cacheHit": false
  }
}
```

#### GraphQL-style Query
```http
POST /query/graphql
Content-Type: application/json

{
  "query": "
    query UnifiedData {
      users(source: [GITHUB, GITLAB]) {
        name
        email
        repositories {
          name
          stars
          language
        }
      }
    }
  "
}

Response: 200 OK
{
  "data": {
    "users": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "repositories": [
          {
            "name": "awesome-project",
            "stars": 500,
            "language": "TypeScript"
          }
        ]
      }
    ]
  }
}
```

### 4. Format Conversion

#### Convert Between Formats
```http
POST /convert
Content-Type: application/json

{
  "from": "json",
  "to": "xml",
  "data": { /* JSON data */ },
  "options": {
    "rootElement": "data",
    "attributePrefix": "@",
    "cdataKeys": ["description", "content"]
  }
}

Response: 200 OK
{
  "converted": "<?xml version=\"1.0\"?><data>...</data>",
  "format": "xml",
  "encoding": "UTF-8"
}
```

#### Markdown Table Generation (for LLMs)
```http
POST /convert/markdown
Content-Type: application/json

{
  "data": [
    {"name": "Alice", "role": "Engineer", "level": 3},
    {"name": "Bob", "role": "Designer", "level": 2}
  ],
  "options": {
    "includeHeaders": true,
    "alignment": "left",
    "maxColumnWidth": 50
  }
}

Response: 200 OK
{
  "markdown": "| Name  | Role     | Level |\n|-------|----------|-------|\n| Alice | Engineer | 3     |\n| Bob   | Designer | 2     |",
  "format": "markdown_table"
}
```

### 5. Type Generation

#### Generate Types from Schema
```http
GET /schemas/{schemaId}/types?language=typescript&options=strict

Response: 200 OK
{
  "language": "typescript",
  "version": "5.0",
  "types": "
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    bio?: string;
    avatar?: string;
    location?: string;
  };
  repositories: Repository[];
}

export interface Repository {
  id: string;
  name: string;
  description?: string;
  stars: number;
  language: string;
  isPrivate: boolean;
}
  ",
  "imports": [
    "import { z } from 'zod';",
    "import { Repository } from './repository';"
  ]
}
```

### 6. Mapping Management

#### Create Custom Mapping
```http
POST /mappings
Content-Type: application/json

{
  "name": "GitHub to Internal User",
  "sourceSchema": "schema_github",
  "targetSchema": "internal_user_v2",
  "rules": [
    {
      "source": "login",
      "target": "username",
      "transform": "lowercase"
    },
    {
      "source": "created_at",
      "target": "registrationDate",
      "transform": {
        "type": "date",
        "from": "ISO8601",
        "to": "unix"
      }
    },
    {
      "source": "email",
      "target": "contactEmail",
      "condition": "email != null",
      "default": "no-email@example.com"
    }
  ]
}

Response: 201 Created
{
  "mappingId": "map_xyz789",
  "name": "GitHub to Internal User",
  "status": "active",
  "rulesCount": 3,
  "validation": {
    "coverage": 0.85,
    "unmappedFields": ["bio", "twitter_username"]
  }
}
```

### 7. Analytics & Monitoring

#### Get Transformation Statistics
```http
GET /analytics/transformations?period=24h

Response: 200 OK
{
  "period": "24h",
  "statistics": {
    "totalTransformations": 150000,
    "successRate": 0.998,
    "averageLatency": 12,
    "bySource": {
      "github": 80000,
      "gitlab": 40000,
      "jira": 30000
    },
    "errors": [
      {
        "type": "missing_field",
        "count": 234,
        "example": "Field 'email' missing in 2% of GitHub responses"
      }
    ]
  },
  "patterns": {
    "mostTransformed": ["user", "repository", "issue"],
    "dateFormatsEncountered": ["ISO8601", "unix", "MM/DD/YYYY"],
    "commonTransformations": ["snake_case to camelCase", "date normalization"]
  }
}
```

## Plugin Interface Specification

```typescript
// Base normalizer plugin interface
interface NormalizerPlugin {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedFormats: string[];
  
  // Pattern Detection
  detectPatterns(samples: any[]): Promise<DataPattern>;
  suggestTransformations(source: any, target: SchemaDefinition): TransformRule[];
  
  // Transformation
  transform(data: any, rules: TransformRule[]): Promise<any>;
  validate(data: any, schema: SchemaDefinition): ValidationResult;
  
  // Type Generation
  generateTypes(schema: SchemaDefinition, language: string): string;
  inferSchema(samples: any[]): SchemaDefinition;
  
  // Format Conversion
  canConvert(from: string, to: string): boolean;
  convert(data: any, from: string, to: string, options?: any): Promise<any>;
}

// Date normalizer plugin example
class DateNormalizerPlugin implements NormalizerPlugin {
  readonly id = 'date_normalizer';
  readonly name = 'Date Format Normalizer';
  readonly version = '1.0.0';
  readonly supportedFormats = ['ISO8601', 'unix', 'RFC3339', 'custom'];
  
  private readonly patterns = [
    { regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO8601' },
    { regex: /^\d{10}$/, format: 'unix' },
    { regex: /^\d{13}$/, format: 'unix_ms' }
  ];
  
  async detectPatterns(samples: any[]): Promise<DataPattern> {
    const dateFields = new Map<string, Set<string>>();
    
    for (const sample of samples) {
      this.findDateFields(sample, '', dateFields);
    }
    
    return {
      type: 'date',
      fields: Array.from(dateFields.entries()).map(([field, formats]) => ({
        path: field,
        formats: Array.from(formats),
        confidence: this.calculateConfidence(formats)
      }))
    };
  }
  
  // ... implementation
}
```

## Data Models

### Schema Definition
```typescript
interface SchemaDefinition {
  id: string;
  version: string;
  source: string;
  fields: FieldDefinition[];
  metadata: {
    created: Date;
    updated: Date;
    samplesAnalyzed: number;
    confidence: number;
  };
}

interface FieldDefinition {
  name: string;
  path: string;
  type: DataType;
  nullable: boolean;
  variations?: TypeVariation[];
  transformations?: TransformRule[];
  statistics?: {
    nullRate: number;
    uniqueValues?: number;
    commonValues?: any[];
  };
}
```

### Transform Rules
```typescript
interface TransformRule {
  id: string;
  source: string | string[];
  target: string;
  type: TransformType;
  transform?: TransformFunction | string;
  condition?: string;
  default?: any;
  options?: Record<string, any>;
}

type TransformType = 
  | 'rename'
  | 'type_cast'
  | 'date_format'
  | 'case_change'
  | 'flatten'
  | 'nest'
  | 'aggregate'
  | 'custom';
```

## Output Format Targets

### For LLMs (Markdown/XML)
```typescript
interface LLMFormat {
  markdown: {
    tables: boolean;
    codeBlocks: boolean;
    headers: boolean;
    lists: boolean;
  };
  xml: {
    structured: boolean;
    attributes: boolean;
    cdata: boolean;
    namespace: string;
  };
}
```

### For Applications (JSON/GraphQL)
```typescript
interface AppFormat {
  json: {
    camelCase: boolean;
    flattenDepth: number;
    includeNull: boolean;
  };
  graphql: {
    schema: string;
    resolvers: boolean;
  };
}
```

## Error Responses

Standard error format:
```json
{
  "error": {
    "code": "SCHEMA_MISMATCH",
    "message": "Input data doesn't match expected schema",
    "details": {
      "missingFields": ["email", "username"],
      "typeMismatches": [
        {"field": "age", "expected": "number", "received": "string"}
      ]
    },
    "suggestions": [
      "Update schema with more samples",
      "Add transformation rule for type conversion"
    ],
    "requestId": "req_xY9mK3pL",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

Common error codes:
- `SCHEMA_NOT_FOUND` - Referenced schema doesn't exist
- `SCHEMA_MISMATCH` - Data doesn't match schema
- `TRANSFORM_FAILED` - Transformation rule failed
- `INVALID_QUERY` - Query syntax error
- `FORMAT_UNSUPPORTED` - Requested format not supported
- `PATTERN_DETECTION_FAILED` - Couldn't detect patterns
- `RATE_LIMITED` - Too many requests

## Performance Requirements

Per CLAUDE.md guidelines:
- Response time: < 100ms for single document transformation
- Streaming: Support 10K messages/second
- Schema learning: < 5 seconds for 1000 samples
- Type generation: < 500ms
- Query across sources: < 2 seconds for complex queries

## Security Considerations

### Data Privacy
- PII detection and optional masking
- Data retention policies (samples stored encrypted)
- Audit logging for all transformations
- GDPR compliance for data processing

### Access Control
- Schema-level permissions
- Transformation audit trail
- Rate limiting per tenant
- API key rotation support

## Integration Points

### With Other Future UI Projects
1. **Project 1 (Auth Broker)**: Use normalized credentials
2. **Project 3 (Event Mesh)**: Stream normalized events
3. **Project 4 (Component Engine)**: Provide consistent data shape
4. **Project 10 (Memory Bank)**: Store normalized patterns
5. **Project 11 (Multi-Agent Bus)**: Share schemas between agents

## Production Enhancements (Based on Peer Review)

### Schema Governance & Lifecycle

```http
POST /schemas/{schemaId}/lifecycle
Content-Type: application/json

{
  "state": "ACTIVE",  // DRAFT, ACTIVE, DEPRECATED
  "reason": "Promoted after successful testing",
  "deprecationDate": null,
  "migrationPath": null
}

Response: 200 OK
{
  "schemaId": "schema_xGh5kL9mN3pQ",
  "state": "ACTIVE",
  "previousState": "DRAFT",
  "transitionDate": "2024-01-15T10:30:00Z"
}
```

### Dead Letter Queue & Replay

```http
GET /dlq/failed-transformations?from=2024-01-15&limit=100

Response: 200 OK
{
  "failures": [
    {
      "id": "fail_123",
      "timestamp": "2024-01-15T10:30:00Z",
      "sourceSchema": "schema_github",
      "targetFormat": "unified_v1",
      "error": "Missing required field: email",
      "originalPayload": { /* ... */ },
      "retryCount": 2
    }
  ]
}

POST /dlq/replay
{
  "failureIds": ["fail_123", "fail_124"],
  "updatedRules": { /* optional rule overrides */ }
}
```

### Enhanced LLM Formats

```http
POST /convert/llm-optimized
Content-Type: application/json

{
  "data": { /* large dataset */ },
  "format": "smart",  // auto-selects best format
  "options": {
    "maxTokens": 4000,
    "includeStatistics": true,
    "semanticChunking": true,
    "highlightFields": ["revenue", "errors"],
    "outputFormats": ["markdown", "csv", "json_mode"]
  }
}

Response: 200 OK
{
  "formats": {
    "markdown": "## Statistical Summary\n- Total records: 10,000\n- Key insight: Revenue up 23%\n\n| Top 5 Records | Revenue | Status |\n|---|---|---|\n| Record 1 | **$50K** | Active |\n\n_[9,995 more records summarized]_",
    "csv": "name,revenue,status\nRecord 1,50000,Active\n...",
    "json_mode": { /* strict JSON for GPT json_mode */ }
  },
  "metadata": {
    "estimatedTokens": 3850,
    "compressionRatio": 0.12,
    "chunksCreated": 3
  }
}
```

### Observability Endpoints

```http
GET /observability/traces?traceId=abc123

Response: 200 OK
{
  "traceId": "abc123",
  "spans": [
    {
      "spanId": "span_1",
      "operation": "schema_lookup",
      "duration": 5,
      "service": "schema_service"
    },
    {
      "spanId": "span_2",
      "operation": "transform",
      "duration": 45,
      "service": "transform_service"
    }
  ],
  "totalDuration": 52,
  "status": "success"
}

GET /metrics/prometheus
# Prometheus format metrics
normalizer_transformations_total{source="github",status="success"} 150000
normalizer_transformation_duration_seconds{quantile="0.95"} 0.089
normalizer_schema_cache_hits_total 280000
normalizer_dlq_messages_total 234
```

## Migration & Compatibility

### Version Strategy
- Semantic versioning for schemas
- Backward compatible transformations
- Migration tools for schema updates
- Deprecation warnings 30 days in advance