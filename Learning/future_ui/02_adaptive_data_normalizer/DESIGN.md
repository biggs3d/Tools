# Adaptive Data Normalizer - Design Document

## Overview

The Adaptive Data Normalizer is a foundational service that learns from API responses to automatically transform any data format into a consistent, unified structure. It acts as intelligent middleware that eliminates the chaos of dealing with inconsistent data formats across different services, enabling AI agents and applications to work with predictable data shapes.

## Core Requirements

### Functional Requirements

1. **Pattern Learning & Detection**
   - Analyze sample API responses to detect patterns
   - Identify date formats, nested structures, arrays
   - Track variations and nullable fields
   - Build confidence scores based on sample size
   - Auto-detect common formats (JSON, XML, CSV, YAML)

2. **Intelligent Transformation**
   - Transform data between any formats
   - Handle missing fields gracefully
   - Apply smart defaults based on learned patterns
   - Support streaming transformations for real-time data
   - Preserve original data when requested

3. **Type Generation**
   - Auto-generate TypeScript interfaces
   - Create Python TypedDict/Pydantic models
   - Generate GraphQL schemas
   - Support Zod schemas for runtime validation
   - Include JSDoc/docstring documentation

4. **Unified Query Language**
   - SQL-like syntax across different data sources
   - GraphQL interface for flexible queries
   - Join data from multiple sources
   - Support aggregations and filtering
   - Cache query results intelligently

5. **Format Optimization for LLMs**
   - Convert to markdown tables for readability
   - Generate structured XML for parsing
   - Create concise summaries of large datasets
   - Support token-optimized formats

### Performance Requirements (per CLAUDE.md)

- **Response Time**: < 100ms for single document transformation
- **Throughput**: 10K messages/second for streaming
- **Schema Learning**: < 5 seconds for 1000 samples
- **Memory Usage**: Graceful degradation with large datasets
- **Caching**: Intelligent caching with < 10ms cache hits

### Non-Functional Requirements

1. **Scalability**
   - Horizontal scaling for transformation workers
   - Distributed schema storage
   - Partitioned streaming pipelines
   - CDN for generated types

2. **Reliability**
   - 99.9% uptime for transformation service
   - Graceful handling of malformed data
   - Automatic retry with exponential backoff
   - Circuit breakers for external sources

3. **Intelligence**
   - ML-based pattern recognition
   - Adaptive learning from corrections
   - Anomaly detection in data streams
   - Smart suggestions for mappings

## Architecture Approach

Following CLAUDE.md guidelines, using **Distributed Specialist** architecture:

```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                            │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
     ┌────────▼────────┐         ┌───────▼────────┐
     │  Schema Service │         │Transform Service│
     │                 │         │                 │
     │ - Learn         │         │ - Single doc   │
     │ - Store         │         │ - Streaming    │
     │ - Version       │         │ - Batch        │
     └────────┬────────┘         └───────┬────────┘
              │                           │
     ┌────────▼────────┐         ┌───────▼────────┐
     │ Pattern Engine  │◄────────┤  Rule Engine   │
     │                 │         │                 │
     │ - ML models     │         │ - Transform    │
     │ - Detectors     │         │ - Validate     │
     └────────┬────────┘         └───────┬────────┘
              │                           │
     ┌────────▼───────────────────────────▼────────┐
     │           Distributed Cache (Redis)          │
     └──────────────────────────────────────────────┘
              │                           │
     ┌────────▼────────┐         ┌───────▼────────┐
     │ Schema Store    │         │  Query Engine  │
     │ (PostgreSQL)    │         │  (ClickHouse)  │
     └─────────────────┘         └─────────────────┘
```

## Key Design Decisions

### 1. Plugin Architecture for Formats

Each data format/pattern is a plugin:

```typescript
interface FormatPlugin {
  // Detection
  canHandle(data: unknown): number; // 0-1 confidence
  detectStructure(data: unknown): StructureDefinition;
  
  // Transformation
  parse(input: string | Buffer): unknown;
  serialize(data: unknown, options?: any): string | Buffer;
  
  // Optimization
  optimize(data: unknown, target: 'llm' | 'storage' | 'transfer'): unknown;
}

// Example: Date format plugin
class DateFormatPlugin implements FormatPlugin {
  private patterns = [
    { regex: /\d{4}-\d{2}-\d{2}/, format: 'YYYY-MM-DD', parser: parseISO },
    { regex: /\d{2}\/\d{2}\/\d{4}/, format: 'MM/DD/YYYY', parser: parseUS },
    // ... more patterns
  ];
  
  detectStructure(value: unknown): StructureDefinition {
    if (typeof value !== 'string') return null;
    
    for (const pattern of this.patterns) {
      if (pattern.regex.test(value)) {
        return {
          type: 'date',
          format: pattern.format,
          confidence: 0.9
        };
      }
    }
    return null;
  }
}
```

### 2. Schema Learning Pipeline

Multi-stage learning process:

```typescript
class SchemaLearner {
  async learn(samples: any[]): Promise<LearnedSchema> {
    // Stage 1: Structure detection
    const structure = await this.detectStructure(samples);
    
    // Stage 2: Pattern recognition
    const patterns = await this.recognizePatterns(structure);
    
    // Stage 3: Variation analysis
    const variations = await this.analyzeVariations(samples, structure);
    
    // Stage 4: Type inference
    const types = await this.inferTypes(structure, patterns);
    
    // Stage 5: Confidence scoring
    const confidence = this.calculateConfidence(samples.length, variations);
    
    return {
      structure,
      patterns,
      variations,
      types,
      confidence,
      metadata: {
        samplesAnalyzed: samples.length,
        learningDate: new Date()
      }
    };
  }
  
  private async detectStructure(samples: any[]): Promise<Structure> {
    // Use tree-based algorithm to find common structure
    const tree = new StructureTree();
    
    for (const sample of samples) {
      tree.addSample(sample);
    }
    
    return tree.getCommonStructure();
  }
}
```

### 3. Transformation Engine

Rule-based with ML fallback:

```typescript
class TransformationEngine {
  async transform(
    data: unknown,
    sourceSchema: Schema,
    targetSchema: Schema,
    options?: TransformOptions
  ): Promise<TransformResult> {
    // Try direct mapping first
    const directMapping = this.findDirectMapping(sourceSchema, targetSchema);
    if (directMapping) {
      return this.applyMapping(data, directMapping);
    }
    
    // Try learned transformations
    const learnedRules = await this.getLearnedRules(sourceSchema, targetSchema);
    if (learnedRules.confidence > 0.8) {
      return this.applyRules(data, learnedRules);
    }
    
    // Fall back to ML-based transformation
    return this.mlTransform(data, sourceSchema, targetSchema);
  }
  
  private async mlTransform(
    data: unknown,
    source: Schema,
    target: Schema
  ): Promise<TransformResult> {
    // Use embeddings to find semantic similarity
    const sourceEmbeddings = await this.embed(source);
    const targetEmbeddings = await this.embed(target);
    
    // Generate transformation based on embedding similarity
    const transformation = await this.generateTransformation(
      sourceEmbeddings,
      targetEmbeddings
    );
    
    return this.applyTransformation(data, transformation);
  }
}
```

### 4. Unified Query Engine

Cross-source query compilation:

```typescript
class UnifiedQueryEngine {
  async query(sql: string, sources: DataSource[]): Promise<QueryResult> {
    // Parse SQL into AST
    const ast = this.parseSQL(sql);
    
    // Optimize query plan
    const plan = this.optimizePlan(ast, sources);
    
    // Execute in parallel where possible
    const subResults = await Promise.all(
      plan.subQueries.map(sq => this.executeSubQuery(sq))
    );
    
    // Merge results
    return this.mergeResults(subResults, plan.mergeStrategy);
  }
  
  private optimizePlan(ast: AST, sources: DataSource[]): QueryPlan {
    // Determine which sources can handle which parts
    const capabilities = sources.map(s => s.getCapabilities());
    
    // Push down filters and projections
    const optimized = this.pushDown(ast, capabilities);
    
    // Identify parallelizable operations
    const parallel = this.findParallelOps(optimized);
    
    return {
      subQueries: this.generateSubQueries(optimized, sources),
      mergeStrategy: this.determineMergeStrategy(parallel)
    };
  }
}
```

### 5. LLM Optimization

Format data for AI consumption:

```typescript
class LLMFormatter {
  format(data: unknown, options: LLMFormatOptions): string {
    const { 
      maxTokens = 4000,
      format = 'markdown',
      includeSummary = true 
    } = options;
    
    // Estimate token usage
    const estimatedTokens = this.estimateTokens(data);
    
    if (estimatedTokens > maxTokens) {
      // Intelligently truncate/summarize
      data = this.summarize(data, maxTokens);
    }
    
    switch (format) {
      case 'markdown':
        return this.toMarkdown(data, includeSummary);
      case 'xml':
        return this.toStructuredXML(data);
      case 'json-ld':
        return this.toJSONLD(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }
  
  private toMarkdown(data: unknown, includeSummary: boolean): string {
    let result = '';
    
    if (includeSummary) {
      result += `## Summary\n${this.generateSummary(data)}\n\n`;
    }
    
    if (Array.isArray(data)) {
      result += this.arrayToMarkdownTable(data);
    } else if (typeof data === 'object') {
      result += this.objectToMarkdownList(data);
    }
    
    return result;
  }
}
```

## Data Storage Design

### Schema Storage (PostgreSQL)

```sql
-- Learned schemas
CREATE TABLE schemas (
  id UUID PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  structure JSONB NOT NULL,
  patterns JSONB NOT NULL,
  confidence DECIMAL(3,2),
  samples_analyzed INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_id, version)
);

-- Transformation mappings
CREATE TABLE mappings (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  source_schema_id UUID REFERENCES schemas(id),
  target_schema_id UUID REFERENCES schemas(id),
  rules JSONB NOT NULL,
  auto_generated BOOLEAN DEFAULT FALSE,
  success_rate DECIMAL(3,2),
  usage_count INTEGER DEFAULT 0
);

-- Query cache
CREATE TABLE query_cache (
  query_hash VARCHAR(64) PRIMARY KEY,
  query_text TEXT NOT NULL,
  result JSONB NOT NULL,
  sources TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

### Stream Processing (Apache Kafka/Redis Streams)

```typescript
interface StreamConfig {
  source: string;
  schema: string;
  transformations: TransformRule[];
  output: {
    type: 'kafka' | 'redis' | 'webhook';
    destination: string;
  };
  options: {
    batchSize: number;
    flushInterval: number;
    errorHandling: 'skip' | 'retry' | 'dlq';
  };
}
```

## Intelligence Features

### 1. Pattern Recognition ML

Using lightweight ML models for pattern detection:

```python
class PatternRecognizer:
    def __init__(self):
        self.date_classifier = self.load_model('date_patterns')
        self.structure_classifier = self.load_model('structure_patterns')
        
    def recognize_patterns(self, samples):
        features = self.extract_features(samples)
        
        patterns = {
            'dates': self.date_classifier.predict(features['strings']),
            'structures': self.structure_classifier.predict(features['objects']),
            'arrays': self.detect_array_patterns(features['arrays'])
        }
        
        return patterns
```

### 2. Anomaly Detection

Detect when data doesn't match learned patterns:

```typescript
class AnomalyDetector {
  async detect(data: unknown, schema: Schema): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    // Check structure
    const structureScore = this.compareStructure(data, schema);
    if (structureScore < 0.7) {
      anomalies.push({
        type: 'structure',
        severity: 'high',
        message: 'Data structure significantly differs from schema'
      });
    }
    
    // Check value ranges
    const valueAnomalies = this.checkValueRanges(data, schema);
    anomalies.push(...valueAnomalies);
    
    // Check patterns
    const patternAnomalies = this.checkPatterns(data, schema);
    anomalies.push(...patternAnomalies);
    
    return anomalies;
  }
}
```

## Integration Points

### With Other Future UI Projects

1. **Project 1 (Auth Broker)**
   - Normalize authentication responses
   - Transform tokens into unified format

2. **Project 3 (Event Mesh)**
   - Stream normalized events
   - Transform webhooks in real-time

3. **Project 4 (Component Engine)**
   - Provide consistent data shape for UI generation
   - Transform component props

4. **Project 10 (Memory Bank)**
   - Store normalized data patterns
   - Learn from historical transformations

5. **Project 11 (Multi-Agent Bus)**
   - Share schemas between agents
   - Ensure consistent data format for agent communication

## Development Phases

### Phase 1: Core Transformation (MVP)
- Basic JSON transformation
- Simple pattern detection
- Manual mapping creation
- REST API

### Phase 2: Learning Engine
- ML-based pattern recognition
- Auto-generate mappings
- Confidence scoring
- Type generation (TypeScript, Python)

### Phase 3: Streaming & Scale
- Real-time stream processing
- Distributed transformation
- Advanced caching
- GraphQL interface

### Phase 4: Intelligence Layer
- Anomaly detection
- Self-improving transformations
- Cost optimization
- Natural language mapping creation

## Testing Strategy

Following CLAUDE.md requirements:

1. **Smoke Tests**
   ```typescript
   describe('Basic transformation', () => {
     it('transforms GitHub user to unified format', async () => {
       const result = await normalizer.transform(githubUser, 'unified_v1');
       expect(result).toHaveProperty('displayName');
     });
   });
   ```

2. **Chaos Tests**
   - Malformed JSON
   - Infinite recursion in nested objects
   - Huge arrays (1M+ elements)
   - Random data types

3. **Performance Tests**
   - 10K transformations/second
   - < 100ms latency P99
   - Memory usage under 1GB for 100K schemas

4. **Learning Tests**
   - Accuracy of pattern detection
   - Type inference correctness
   - Confidence score calibration

## Security Considerations

### Data Privacy
- PII detection using regex and ML
- Optional field-level encryption
- Data masking for sensitive fields
- Audit logs with data lineage
- GDPR compliance with data deletion APIs

### Access Control
- Schema-level permissions
- Transformation rate limiting (token bucket per tenant)
- API key per tenant with rotation support
- Role-based access (read/write/admin)

### Critical Security Enhancements (From Peer Review)

#### Sandboxed Expression Evaluation
```typescript
// NEVER use eval() or Function() constructor directly
import { Expression } from 'jexl';  // Safe expression language

class SafeExpressionEvaluator {
  private jexl: Expression;
  
  constructor() {
    this.jexl = new Expression();
    // Whitelist safe functions only
    this.jexl.addFunction('lowercase', (str) => str.toLowerCase());
    this.jexl.addFunction('uppercase', (str) => str.toUpperCase());
    // No access to process, require, fs, network, etc.
  }
  
  evaluate(expression: string, context: any): any {
    try {
      // Parse to AST first for validation
      const ast = this.jexl.compile(expression);
      // Execute in sandboxed environment
      return ast.eval(context);
    } catch (error) {
      throw new Error(`Invalid expression: ${error.message}`);
    }
  }
}
```

#### Input Validation & Limits
```typescript
interface SecurityLimits {
  maxNestingDepth: 10;
  maxFieldCount: 1000;
  maxArrayLength: 10000;
  maxStringLength: 1_000_000;
  maxRequestSize: 10_485_760; // 10MB
  transformTimeout: 5000; // 5 seconds
}

class InputValidator {
  validateSchema(data: any, depth = 0): void {
    if (depth > SecurityLimits.maxNestingDepth) {
      throw new Error('Maximum nesting depth exceeded');
    }
    
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length > SecurityLimits.maxFieldCount) {
        throw new Error('Maximum field count exceeded');
      }
      
      for (const value of Object.values(data)) {
        this.validateSchema(value, depth + 1);
      }
    }
  }
}
```

#### Plugin Sandboxing
```typescript
import { VM } from 'vm2';  // Secure VM for untrusted code

class PluginSandbox {
  async executePlugin(pluginCode: string, data: any): Promise<any> {
    const vm = new VM({
      timeout: 1000,
      sandbox: {
        data,
        console: {
          log: (...args) => this.logSecurely(args)
        }
        // No access to require, process, __dirname, etc.
      }
    });
    
    return vm.run(pluginCode);
  }
  
  private logSecurely(args: any[]): void {
    // Redact sensitive data before logging
    const sanitized = this.redactPII(args);
    console.log('[Plugin]', ...sanitized);
  }
}
```

## Observability Stack (Production Critical)

### Distributed Tracing with OpenTelemetry
```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

class TransformService {
  private tracer = trace.getTracer('transform-service');
  
  async transform(data: any, rules: any): Promise<any> {
    const span = this.tracer.startSpan('transform', {
      attributes: {
        'transform.source_schema': rules.sourceSchema,
        'transform.target_format': rules.targetFormat,
        'tenant.id': context.getValue('tenantId')
      }
    });
    
    try {
      // Create child spans for each stage
      const schemaSpan = this.tracer.startSpan('fetch_schema', { parent: span });
      const schema = await this.fetchSchema(rules.sourceSchema);
      schemaSpan.end();
      
      const transformSpan = this.tracer.startSpan('apply_rules', { parent: span });
      const result = await this.applyRules(data, schema, rules);
      transformSpan.end();
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Metrics with Prometheus
```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

const metrics = {
  transformationCounter: new Counter({
    name: 'normalizer_transformations_total',
    help: 'Total transformations',
    labelNames: ['source', 'target', 'status', 'tenant']
  }),
  
  transformationDuration: new Histogram({
    name: 'normalizer_transformation_duration_seconds',
    help: 'Transformation duration',
    labelNames: ['source', 'target'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
  }),
  
  schemaCacheHitRate: new Gauge({
    name: 'normalizer_schema_cache_hit_rate',
    help: 'Schema cache hit rate',
    labelNames: ['cache_type']
  }),
  
  dlqSize: new Gauge({
    name: 'normalizer_dlq_size',
    help: 'Dead letter queue size',
    labelNames: ['queue_name']
  })
};

// Expose metrics endpoint
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### Structured Logging
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'adaptive-data-normalizer',
    version: process.env.VERSION
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Always include trace context
function log(level: string, message: string, meta?: any) {
  const span = trace.getActiveSpan();
  logger.log(level, message, {
    ...meta,
    traceId: span?.spanContext().traceId,
    spanId: span?.spanContext().spanId,
    tenantId: context.getValue('tenantId')
  });
}

## Success Metrics

- **Learning Accuracy**: > 95% correct type inference
- **Transformation Speed**: < 100ms P95 latency
- **Developer Satisfaction**: < 10 minutes to integrate new API
- **Memory Efficiency**: < 10MB per schema
- **Uptime**: 99.9% availability

## Open Questions

1. Should we support binary formats (Protocol Buffers, Avro)?
2. How deep should nested object flattening go by default?
3. Build custom ML models or use existing (GPT for pattern detection)?
4. Support for streaming protocols (WebSocket, SSE, gRPC)?

## Next Steps

1. Implement core transformation engine
2. Build pattern detection for common formats
3. Create plugin system for extensibility
4. Design schema versioning strategy
5. Set up performance benchmarking