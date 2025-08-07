# Adaptive Data Normalizer - Next Session Guide

## Current Status
Documentation has been updated based on comprehensive review feedback to address critical security and performance concerns. The architecture now features a clear control/data plane separation, WASM-compiled transformations, and proper plugin sandboxing.

## Key Architecture Changes Made
1. **Control/Data Plane Separation**: Node.js for control, Rust/Go for data processing
2. **WASM Compilation**: All transformations compile to WebAssembly for safety and speed
3. **Security Hardening**: Replaced vm2 with WASI sandbox, added plugin signing
4. **Performance Architecture**: Rust/Go workers for hot paths, multi-tier caching
5. **Query Federation**: Leveraging DataFusion instead of building from scratch
6. **ML Strategy**: Moved all ML/AI to offline control plane only

## Implementation Priority (MVP Path)

### Phase 1: Foundation (Week 1-2)
Start with the core transformation engine to prove the architecture works:

```bash
# Project structure
adaptive-data-normalizer/
├── control-plane/          # Node.js/TypeScript
│   ├── src/
│   │   ├── api/           # REST API endpoints
│   │   ├── schemas/       # Schema management
│   │   └── compiler/      # WASM compilation
│   └── package.json
├── data-plane/            # Rust
│   ├── src/
│   │   ├── transform/     # Transformation workers
│   │   ├── wasm/         # WASM runtime
│   │   └── parser/       # simdjson integration
│   └── Cargo.toml
└── shared/
    ├── schemas/          # Shared type definitions
    └── proto/           # Protocol buffers
```

**Key files to implement first:**

1. **data-plane/src/transform/worker.rs**
```rust
use serde_json::Value;
use simd_json;

pub struct TransformWorker {
    compiled_transforms: HashMap<String, WasmModule>,
}

impl TransformWorker {
    pub fn transform(&self, data: &[u8], transform_id: &str) -> Result<Vec<u8>, Error> {
        // Fast JSON parsing
        let mut data = data.to_vec();
        let parsed: Value = simd_json::from_slice(&mut data)?;
        
        // Get compiled WASM module
        let module = self.compiled_transforms.get(transform_id)
            .ok_or(Error::TransformNotFound)?;
        
        // Execute transformation
        module.call("transform", &parsed)
    }
}
```

2. **control-plane/src/compiler/wasm.ts**
```typescript
import { compile } from '@wasmcloud/wasmcloud-js';

export class WASMCompiler {
  async compileRules(rules: TransformRule[]): Promise<Buffer> {
    const rustCode = this.generateRustCode(rules);
    
    // Compile to WASM using wasm-pack
    const wasmModule = await this.compileToWASM(rustCode);
    
    // Sign for verification
    return this.signModule(wasmModule);
  }
  
  private generateRustCode(rules: TransformRule[]): string {
    // Generate Rust transformation code
    return `
      #[no_mangle]
      pub extern "C" fn transform(input: &[u8]) -> Vec<u8> {
        // Generated transformation logic
        ${this.generateTransformLogic(rules)}
      }
    `;
  }
}
```

### Phase 2: Basic API & Schema Management (Week 3)

3. **control-plane/src/api/routes.ts**
```typescript
// Implement core endpoints
POST   /schemas/learn       // Learn from samples
GET    /schemas/{id}        // Get schema
POST   /transform           // Transform single document
POST   /mappings            // Create transformation mapping
```

4. **Schema Registry with content-addressable IDs**
```typescript
class SchemaRegistry {
  async registerSchema(schema: Schema): Promise<string> {
    // Generate content-addressable ID
    const schemaId = crypto.createHash('sha256')
      .update(JSON.stringify(schema))
      .digest('hex');
    
    // Store with immutability
    await this.store.put(schemaId, schema, { immutable: true });
    
    return schemaId;
  }
}
```

### Phase 3: Plugin System (Week 4)

5. **WASI Plugin Sandbox**
```typescript
import { WASI } from '@wasmer/wasi';

class PluginSandbox {
  async loadPlugin(wasmPath: string): Promise<Plugin> {
    // Verify signature
    await this.verifySignature(wasmPath);
    
    // Load with strict limits
    const wasi = new WASI({
      args: [],
      env: {},
      preopens: {}, // No filesystem access
    });
    
    const module = await WebAssembly.compile(
      await fs.readFile(wasmPath)
    );
    
    return new Plugin(module, wasi);
  }
}
```

## Testing Strategy

### Unit Tests (Immediate)
```typescript
// test/transform.test.ts
describe('TransformWorker', () => {
  it('transforms GitHub user to unified format in <50ms', async () => {
    const start = Date.now();
    const result = await worker.transform(githubUser, 'github_to_unified');
    expect(Date.now() - start).toBeLessThan(50);
    expect(result).toHaveProperty('displayName');
  });
});
```

### Performance Benchmarks (Week 2)
```rust
// benches/transform_bench.rs
#[bench]
fn bench_transform_throughput(b: &mut Bencher) {
    let worker = TransformWorker::new();
    let data = generate_sample_data(1000);
    
    b.iter(|| {
        for item in &data {
            worker.transform(item, "test_transform");
        }
    });
}
```

### Chaos Testing (Week 3)
```typescript
// test/chaos.test.ts
describe('Chaos Testing', () => {
  it('handles malformed JSON gracefully', async () => {
    const malformed = '{"name": "test", "age": }'; // Invalid JSON
    await expect(normalizer.transform(malformed))
      .rejects.toThrow('Invalid JSON');
  });
  
  it('prevents infinite recursion', async () => {
    const circular = { a: {} };
    circular.a = circular; // Circular reference
    await expect(normalizer.transform(circular))
      .rejects.toThrow('Circular reference detected');
  });
});
```

## Development Commands

```bash
# Setup development environment
npm install        # Control plane dependencies
cd data-plane && cargo build  # Data plane build

# Run services
npm run dev:control    # Start control plane (port 3000)
cargo run --bin worker # Start data plane worker

# Testing
npm test              # Control plane tests
cargo test            # Data plane tests
cargo bench           # Performance benchmarks

# Build for production
npm run build         # TypeScript compilation
cargo build --release # Optimized Rust build
wasm-pack build       # Compile plugins to WASM
```

## Critical Dependencies

### Control Plane (package.json)
```json
{
  "dependencies": {
    "@wasmer/wasi": "^1.2.0",
    "@opentelemetry/api": "^1.7.0",
    "zod": "^3.22.0",
    "bull": "^4.11.0",
    "ioredis": "^5.3.0"
  }
}
```

### Data Plane (Cargo.toml)
```toml
[dependencies]
simd-json = "0.13"
wasmtime = "15.0"
tokio = { version = "1.35", features = ["full"] }
arrow = "49.0"
datafusion = "34.0"
```

## Environment Setup

### Required Tools
```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-wasi

# Install wasm-pack for compilation
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install Node.js 20+ and pnpm
nvm install 20
npm install -g pnpm
```

### Environment Variables (.env)
```env
# Control Plane
NODE_ENV=development
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://localhost:5432/normalizer
OPENAI_API_KEY=sk-... # For offline ML suggestions only

# Data Plane
RUST_LOG=info
WORKER_THREADS=4
MAX_MEMORY_MB=500
WASM_CACHE_DIR=/tmp/wasm-cache
```

## Verification Checklist

Before considering Phase 1 complete:
- [ ] Rust worker can parse JSON with simd-json
- [ ] Simple transformation compiles to WASM
- [ ] WASM executes in sandboxed environment
- [ ] Single document transforms in <50ms
- [ ] Basic schema learning from samples works
- [ ] REST API returns correct OpenAPI spec
- [ ] Unit tests pass for both planes
- [ ] Throughput benchmark shows >1K msg/sec per worker

## Open Questions for User

1. **Binary Format Priority**: Should we support Arrow/Parquet in MVP or defer to Phase 4?
2. **Query Engine Choice**: Start simple with basic SQL or integrate DataFusion immediately?
3. **Deployment Target**: Kubernetes, AWS Lambda, or traditional VMs?
4. **Monitoring Stack**: Use existing (Datadog/New Relic) or build on OpenTelemetry?

## Next Immediate Steps

1. Initialize Rust workspace: `cargo new --lib data-plane`
2. Set up Node.js project: `npm init` in control-plane/
3. Implement basic TransformWorker in Rust
4. Create WASM compilation proof-of-concept
5. Build simple REST API with Fastify/Express
6. Write first integration test

## Architecture Decision Records (ADRs)

### ADR-001: Use WASM for Transformation Compilation
**Status**: Accepted
**Context**: Need safe, fast transformation execution
**Decision**: Compile all transformations to WASM
**Consequences**: Higher complexity but better security and performance

### ADR-002: Rust for Data Plane
**Status**: Accepted
**Context**: Node.js alone can't hit 10K msg/sec
**Decision**: Use Rust for all hot path operations
**Consequences**: Two-language project but meets performance requirements

### ADR-003: DataFusion for Complex Queries
**Status**: Proposed
**Context**: Building query engine from scratch is complex
**Decision**: Use Apache Arrow DataFusion for federated queries
**Consequences**: Adds dependency but provides proven query capabilities

## Remember

- **Security First**: Every transformation runs in sandbox
- **Performance Critical**: Every millisecond counts in data plane
- **ML Offline Only**: Never run ML in transformation hot path
- **Human Review Required**: All auto-generated mappings need approval
- **Observability Built-in**: Traces and metrics from day one

This is a production-grade foundation for AI-driven interfaces. The complexity is justified by the performance and security requirements.