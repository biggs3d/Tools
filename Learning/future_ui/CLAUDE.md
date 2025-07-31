# CLAUDE.md - Future UI Project Guidelines

This file contains specific instructions for Claude Code when working within the Future UI project directories.

## Project Context

This is the implementation phase of "The Future of UI: From Interfaces to Intelligence" whitepaper. We're building 24
modular components that combine to create AI-driven, spatial, intelligent interfaces.

## Development Guidelines

### Architecture Considerations

When implementing any Future UI project, always consider these architectural paths:

1. **Distributed Specialist** (default) - Modular microservices approach
2. **Hive Mind Monolith** - Single unified AI with internal specializations
3. **P2P Mesh Network** - Decentralized, no central servers
4. **No-UI Data Whispers** - Audio/haptic only, no visual interface

Choose based on the specific use case and deployment constraints.

### Performance Requirements

All projects must meet these benchmarks:

- **Response Time**: Sub-100ms for UI generation (sub-50ms for edge deployment)
- **Memory Usage**: Graceful degradation when memory constrained
- **Multi-Agent Sync**: No "consensus thrashing" - implement timeout/circuit breakers
- **Spatial Rendering**: 60fps minimum, with LOD fallbacks

### Testing Philosophy

Every project needs:

1. **Smoke tests** - Basic functionality verification
2. **A/B tests** - Especially for spatial vs 2D interfaces (Project 19 is built for this)
3. **Chaos tests** - Non-deterministic UI behavior (use Project 14's framework)
4. **Bio-feedback tests** - When applicable, test cognitive load (Project 20's domain)

### Integration Patterns

Projects are designed to be composable. When building:

- Export clear interfaces (TypeScript types preferred)
- Use event-driven architecture for loose coupling
- Implement health check endpoints
- Support both REST and GraphQL where applicable
- Consider WebSocket/SSE for real-time features

### Spatial UI Guidelines

**Critical**: Not everything should be 3D! Before implementing spatial features:

1. Run the Spatial Skeptic Simulator (Project 19) tests
2. Identify specific benefits over 2D (don't just add 3D because it's cool)
3. Always include 2D fallback for accessibility
4. Use spatial metaphors that match mental models (e.g., timeline = river)

### Memory and Context Management

- Implement "forgetting" algorithms - not all data should persist
- Use vector embeddings for semantic search (Project 10 pattern)
- Give users control over their data (Project 9 pattern)
- Tag memories with importance scores and decay rates

### AI Personality Guidelines

When implementing AI interactions:

- Default to helpful but not sycophantic
- Build in "friction" to prevent skill atrophy
- Cultural adaptation is critical for global deployment
- Test personality variants with A/B framework (Project 7)

### Security and Compliance

Every project must consider:

- GDPR compliance for memory systems
- HIPAA when handling health data (bio-feedback)
- SOX for financial visualizations
- Audit trails for all AI decisions (Project 15 pattern)

## Project-Specific Notes

### Projects 1-3 (Integration Engine)

- Focus on reliability over features
- These are foundation - other projects depend on them
- Extensive error handling and retry logic required

### Projects 4-6 (UI Factory)

- Performance is critical - these run in tight loops
- Consider WebAssembly for compute-intensive parts
- Cache aggressively but invalidate intelligently

### Projects 7-9 (Governance Layer)

- User trust is paramount
- Every decision must be explainable
- "Safe mode" should truly be safe

### Projects 10-12 (Memory Core)

- Privacy by design, not afterthought
- Federated learning preferred over centralized
- Consider homomorphic encryption for sensitive data

### Projects 13-15 (Trust Foundation)

- These enable enterprise adoption
- Compliance and audit features are not optional
- Build for "five 9s" reliability

### Projects 16-18 (Spatial Layer)

- Start with 2D, enhance to 3D
- WebXR for maximum compatibility
- Consider motion sickness in all designs

### Projects 19-21 (Reality Check)

- These keep us honest about the vision
- Data-driven decisions only
- Measure actual productivity, not perceived coolness

### Projects 22-24 (Future Stack)

- Bleeding edge is expected here
- Consider experimental APIs
- Document limitations clearly

## Common Pitfalls to Avoid

1. **Over-spatializing** - Not every dataset needs 3D representation
2. **Under-testing chaos** - Non-deterministic UIs are hard to test, don't skip it
3. **Ignoring bio-feedback** - User stress is real, especially with information overload
4. **Forgetting forgetting** - Memory systems that never forget become unwieldy
5. **Single architecture mindset** - Consider all four paths, not just distributed

## Quick Decision Framework

When starting a new feature, ask:

1. Does this truly need AI, or is it deterministic logic?
2. Would this benefit from spatial representation, or is 2D clearer?
3. How does this handle failure modes?
4. What's the privacy impact?
5. Can users understand and control what's happening?

## Remember

The goal is augmenting human capability, not replacing human judgment. Every feature should make users more powerful,
not more dependent.