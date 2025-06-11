# Database Services

## Testing Requirements

Some providers require additional setup to test:

- **SQLiteProvider**: Requires the `sqlite3` package to be installed
- **MongoDBProvider**: Requires the `mongodb` package to be installed and `mongodb-memory-server` for testing
- **IndexedDBProvider**: Can only be fully tested in a browser environment
- **GitSyncProvider**: Requires `simple-git` package and git to be installed

When running tests, you may see some failures for these providers if the dependencies are not available. The core providers (InMemory and JsonFile) should always pass their tests.

## 1. Purpose

The `database-services` package will provide a flexible and extensible module for interacting with various database systems. 
It aims to abstract the underlying database technologies, allowing other services (like `memory-services`) 
to consume database functionalities through a consistent interface. 
This will enable easy switching between different database backends and support for multiple database types based on requirements.

## 2. Goals

-   Provide a common interface for database operations (CRUD, querying, transactions).
-   Support multiple database backends (e.g., in-memory, file-based, NoSQL, SQL).
-   Allow for easy configuration and selection of database providers.
-   Ensure robust error handling and connection management.
-   Facilitate integration with other packages within the monorepo.

## 3. Proposed Architecture

For a concise overview of the architecture, please see the main points below. 
**For detailed implementation notes, class structures, and advanced considerations, please refer to the [IMPLEMENTATION.md](./IMPLEMENTATION.md) file.**

## 4. Database Provider Comparison

When selecting a database provider for your project, consider the following comparison of available options:

| Provider      | Persistence | Scalability | Query Capabilities | Transactions | Use Cases | Pros | Cons |
|---------------|-------------|-------------|-------------------|-------------|-----------|------|------|
| **InMemory**  | ❌ None | ⭐ | ⭐⭐ | ❌ | Development, testing, ephemeral caches | <ul><li>Fastest performance</li><li>No setup required</li><li>Perfect for tests</li></ul> | <ul><li>Data lost on restart</li><li>Limited by available memory</li><li>Not suitable for production</li></ul> |
| **JsonFile**  | ✅ File-based | ⭐ | ⭐⭐ | ⭐ (basic) | Small apps, config storage, simple data needs | <ul><li>Simple, human-readable storage</li><li>No dependencies</li><li>Easy debugging</li></ul> | <ul><li>No concurrent access</li><li>Poor performance at scale</li><li>Limited query capabilities</li></ul> |
| **SQLite**    | ✅ File-based | ⭐⭐ | ⭐⭐⭐ | ✅ | Desktop apps, mobile apps, embedded systems, moderate data needs | <ul><li>Full SQL support</li><li>ACID compliant</li><li>Single file storage</li><li>Zero server setup</li></ul> | <ul><li>Limited concurrent writes</li><li>Not ideal for distributed systems</li></ul> |
| **MongoDB**   | ✅ Server | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | Web apps, distributed systems, large datasets, complex queries | <ul><li>Schema flexibility</li><li>Horizontal scaling</li><li>Rich query language</li><li>Native JSON support</li></ul> | <ul><li>Requires server setup</li><li>More complex configuration</li><li>Higher resource usage</li></ul> |
| **IndexedDB** | ✅ Browser | ⭐⭐ | ⭐⭐⭐ | ✅ | Browser-based apps, offline-first applications, PWAs | <ul><li>Client-side storage</li><li>Works offline</li><li>Large storage limits</li><li>Index support</li></ul> | <ul><li>Browser-only</li><li>Complex API</li><li>Async only</li></ul> |
| **Git-Sync**  | ✅ File + Git | ⭐⭐ | ⭐⭐ (via base provider) | ✅ (Git atomicity; base provider dependent for DB transactions) | Config management, version-tracked data, collaborative editing | <ul><li>Built-in versioning</li><li>Conflict resolution</li><li>Distributed workflow</li><li>Audit trail</li></ul> | <ul><li>Performance overhead</li><li>Complex setup</li><li>Not suitable for high-frequency writes</li></ul> |

### Recommendations by Use Case

1. **Development & Testing**: InMemory
2. **Small applications with simple data needs**: JsonFile or SQLite  
3. **Applications requiring offline support**: IndexedDB (browser) or SQLite (desktop/mobile)
4. **Web applications with complex data requirements**: MongoDB
5. **Applications needing version history or distributed edits**: Git-Sync module
6. **Production deployments with high reliability needs**: MongoDB or SQLite (depending on scale)

For multiplatform applications, consider combining providers:
- Browser: IndexedDB
- Server: MongoDB/SQLite
- Sync layer: Custom implementation or Git-Sync
