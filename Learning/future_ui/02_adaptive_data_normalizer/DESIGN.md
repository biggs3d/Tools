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

Following CLAUDE.md guidelines, using **Distributed Specialist** architecture with explicit **Control Plane / Data Plane separation** for performance and security:

```
┌──────────────────────────────────────────────────────────────┐
│                    CONTROL PLANE (Node.js/TypeScript)         │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │Schema Service│  │Pattern Engine│  │Schema Registry│       │
│  │             │  │              │  │               │       │
│  │- Learn      │  │- ML Models   │  │- Immutable IDs│       │
│  │- Version    │  │- Offline only│  │- Governance   │       │
│  │- Governance │  │- Suggestions │  │- Lifecycle    │       │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘       │
│         │                 │                  │                │
│  ┌──────▼─────────────────▼──────────────────▼────────┐      │
│  │          Control Plane Storage (PostgreSQL)         │      │
│  └─────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Schema Cache     │
                    │  (CDN + Redis +    │
                    │   Local Process)   │
                    └─────────┬──────────┘
                              │
┌──────────────────────────────────────────────────────────────┐
│                    DATA PLANE (Rust/Go + WASM)                │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │Transform Workers│  │ WASM Runtime    │  │Stream Processor│ │
│  │                │  │                 │  │               │ │
│  │- Rust/Go core  │  │- Compiled rules │  │- Backpressure │ │
│  │- simdjson      │  │- Sandboxed      │  │- Batching     │ │
│  │- Zero-copy     │  │- Deterministic  │  │- Kafka/Redis  │ │
│  └────────┬───────┘  └────────┬────────┘  └───────┬───────┘ │
│           │                    │                    │         │
│  ┌────────▼────────────────────▼────────────────────▼──────┐ │
│  │              Query Federation Engine                     │ │
│  │         (DataFusion/Arrow or Trino for complex)          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Control Plane (Node.js/TypeScript)
- Schema learning and governance
- ML models for pattern detection (offline only)
- API management and orchestration
- Plugin lifecycle management
- Monitoring and observability

### Data Plane (Rust/Go + WASM)
- High-performance transformation execution
- WASM-compiled transformation rules
- Stream processing with backpressure
- Query federation and execution
- Minimal latency, maximum throughput

## Key Design Decisions

### 1. Compiled Transformation Architecture

**Core Principle**: All transformations compile to WASM for safety and performance.

```typescript
// Transformation Compiler (Control Plane)
class TransformationCompiler {
  async compileToWASM(rules: TransformRule[]): Promise<WASMModule> {
    // Generate Rust code from rules
    const rustCode = this.generateRustCode(rules);
    
    // Compile to WASM with wasm-pack
    const wasmModule = await this.compileRust(rustCode, {
      optimizationLevel: 3,
      simd: true,
      bulkMemory: true
    });
    
    // Sign the module for verification
    const signedModule = await this.signModule(wasmModule);
    
    return signedModule;
  }
  
  private generateRustCode(rules: TransformRule[]): string {
    return `
      use serde_json::Value;
      use chrono::DateTime;
      
      #[no_mangle]
      pub extern "C" fn transform(input: &[u8]) -> Vec<u8> {
        // Fast JSON parsing with simd-json
        let data: Value = simd_json::from_slice(input).unwrap();
        
        // Apply compiled transformation rules
        ${this.generateTransformCode(rules)}
        
        // Serialize result
        simd_json::to_vec(&result).unwrap()
      }
    `;
  }
}

// Runtime Executor (Data Plane)
class WASMTransformExecutor {
  private runtime: Wasmtime.Engine;
  private compiledTransforms: Map<string, WASMInstance>;
  
  async execute(data: Buffer, transformId: string): Promise<Buffer> {
    const instance = this.compiledTransforms.get(transformId);
    if (!instance) {
      throw new Error('Transform not found or not compiled');
    }
    
    // Execute in sandboxed WASM environment
    // No access to filesystem, network, or system calls
    const result = await instance.call('transform', data);
    
    return result;
  }
}
```

### 2. Plugin Architecture for Formats

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

### 3. Schema Learning Pipeline (Control Plane Only)

**Important**: ML and pattern learning run ONLY in the control plane, never in the data path.

Multi-stage learning process with incremental Bayesian updates:

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
    
    // Incremental Bayesian learning for confidence
    const bayesianEstimator = new BayesianTypeEstimator();
    const structure = tree.getCommonStructure();
    
    // Update confidence with Bayesian inference
    for (const field of structure.fields) {
      field.typeProb = bayesianEstimator.updateProbability(
        field.observedTypes,
        samples.length
      );
      field.nullProb = bayesianEstimator.updateNullability(
        field.nullCount,
        samples.length
      );
    }
    
    return structure;
  }
}
```

### 4. High-Performance Transformation Engine

Compiled transformations with zero ML in hot path:

```typescript
class TransformationEngine {
  private compiledTransforms: Map<string, WASMModule>;
  private rustWorkerPool: WorkerPool; // Rust workers for CPU-intensive ops
  
  async transform(
    data: Buffer,
    transformId: string,
    options?: TransformOptions
  ): Promise<TransformResult> {
    // Get pre-compiled WASM transformation
    const wasmModule = this.compiledTransforms.get(transformId);
    if (!wasmModule) {
      throw new Error(`Transform ${transformId} not compiled`);
    }
    
    // Execute in Rust worker for maximum performance
    const worker = await this.rustWorkerPool.acquire();
    try {
      const result = await worker.execute({
        module: wasmModule,
        data,
        options: {
          streaming: options?.streaming || false,
          validateOutput: options?.validate || true
        }
      });
      
      return {
        transformed: result.data,
        metrics: {
          executionTime: result.duration,
          bytesProcessed: data.length,
          throughput: data.length / result.duration
        }
      };
    } finally {
      this.rustWorkerPool.release(worker);
    }
  }
  
  // ML suggestions happen offline in control plane
  async suggestTransformation(
    sourceSchema: Schema,
    targetSchema: Schema
  ): Promise<TransformSuggestion> {
    // This runs in control plane only, not in data path
    const analyzer = new SchemaAnalyzer();
    const suggestions = await analyzer.findMappings(
      sourceSchema,
      targetSchema
    );
    
    // Human review required before compilation
    return {
      suggestions,
      requiresReview: true,
      confidence: suggestions.confidence
    };
  }
}
```

### 5. Query Federation Engine

Leveraging DataFusion for distributed query execution:

```typescript
import { DataFusion } from 'datafusion-node';
import { ArrowTable } from 'apache-arrow';

class QueryFederationEngine {
  private datafusion: DataFusion;
  private queryPlanner: QueryPlanner;
  
  constructor() {
    this.datafusion = new DataFusion();
    this.queryPlanner = new SubstraitPlanner(); // For complex queries
  }
  
  async query(sql: string, sources: DataSource[]): Promise<QueryResult> {
    // For simple queries, use direct execution
    if (this.isSimpleQuery(sql)) {
      return this.executeSimple(sql, sources[0]);
    }
    
    // For complex queries, use DataFusion
    const ctx = this.datafusion.createContext();
    
    // Register data sources as Arrow tables
    for (const source of sources) {
      const arrowTable = await this.sourceToArrow(source);
      ctx.registerTable(source.name, arrowTable);
    }
    
    // Parse and optimize with DataFusion's query planner
    const logicalPlan = await ctx.sql(sql);
    const physicalPlan = await ctx.createPhysicalPlan(logicalPlan);
    
    // Execute with pushdown optimizations
    const result = await ctx.execute(physicalPlan);
    
    return this.arrowToResult(result);
  }
  
  private async sourceToArrow(source: DataSource): Promise<ArrowTable> {
    // Convert source data to Arrow columnar format
    // This enables vectorized operations and zero-copy
    const schema = await source.getSchema();
    const data = await source.getData({
      format: 'arrow',
      pushdownFilters: this.queryPlanner.getFilters()
    });
    
    return ArrowTable.from(data);
  }
  
  private isSimpleQuery(sql: string): boolean {
    // Simple SELECT from single source
    return /^SELECT .+ FROM \w+ WHERE .+$/i.test(sql) &&
           !sql.includes('JOIN') &&
           !sql.includes('GROUP BY');
  }
}
```

### 6. LLM Format Optimization

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
- Basic JSON transformation with Rust/Go workers
- WASM compilation for simple rules
- Manual mapping creation with validation
- REST API with OpenAPI spec
- Two-tier caching (Redis + local)

### Phase 2: Security & Performance
- Full WASI plugin sandbox
- Plugin signing and registry
- Schema registry with immutable IDs
- Compiled transformations for all rules
- Performance benchmarks (10k msg/sec target)

### Phase 3: Learning & Governance
- ML-based pattern recognition (offline only)
- Schema governance workflows
- Incremental Bayesian learning
- Type generation (TypeScript, Python, Zod)
- Dead letter queue with replay

### Phase 4: Scale & Federation
- DataFusion query engine integration
- Stream processing with backpressure
- Multi-tier caching with CDN
- GraphQL interface
- Binary format support (Arrow, Parquet)

### Phase 5: Intelligence Layer
- Anomaly detection with drift alerts
- LLM-assisted mapping suggestions (human review required)
- Cost optimization
- Cross-source query federation

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

#### Plugin Sandboxing with WASI
```typescript
import { WASI } from '@wasmer/wasi';
import { lowerI64Imports } from '@wasmer/wasm-transformer';

class PluginSandbox {
  private wasiEnv: WASI;
  
  constructor() {
    // Initialize WASI with minimal capabilities
    this.wasiEnv = new WASI({
      args: [],
      env: {},
      bindings: {
        // Only allow specific, safe bindings
        ...this.getSafeBindings()
      },
      preopens: {} // No filesystem access
    });
  }
  
  async executePlugin(wasmModule: WebAssembly.Module, data: any): Promise<any> {
    // Create isolated instance with resource limits
    const instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: this.wasiEnv.wasiImport,
      env: {
        memory: new WebAssembly.Memory({
          initial: 1, // 64KB pages
          maximum: 10, // Max 640KB
          shared: false
        })
      }
    });
    
    // Set execution timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Plugin timeout')), 1000)
    );
    
    // Execute with timeout
    return Promise.race([
      instance.exports.transform(data),
      timeoutPromise
    ]);
  }
  
  private getSafeBindings() {
    return {
      // Whitelist only safe operations
      log: (msg: string) => this.logSecurely(msg),
      now: () => Date.now(),
      random: () => Math.random()
      // No fs, network, process access
    };
  }
}

// Plugin verification and signing
class PluginRegistry {
  private trustedKeys: Set<string>;
  
  async verifyAndLoad(pluginPath: string): Promise<WebAssembly.Module> {
    const pluginData = await fs.readFile(pluginPath);
    const signature = await fs.readFile(`${pluginPath}.sig`);
    
    // Verify signature
    if (!await this.verifySignature(pluginData, signature)) {
      throw new Error('Invalid plugin signature');
    }
    
    // Compile with safety checks
    return WebAssembly.compile(pluginData);
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