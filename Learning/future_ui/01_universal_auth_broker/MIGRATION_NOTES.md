# Dependency Migration Notes

## Conservative Update (Current package.json)

### Production Dependencies Updated:
- **fastify**: 4.28.1 → 4.29.1 (patch update)
- **jose**: 5.9.6 → 5.10.0 (minor update)
- **pino**: 9.5.0 → 9.7.0 (minor update)
- **zod**: 3.23.8 → 3.25.76 (patch updates)
- **dotenv**: 16.4.5 → 16.6.1 (patch update)
- **@prisma/client**: 5.21.1 → 5.22.0 (minor update)

### Dev Dependencies Updated:
- **@types/node**: 22.9.0 → 22.17.0 (minor update)
- **typescript**: 5.6.3 → 5.7.3 (minor update)
- **vitest**: 2.1.5 → 2.1.9 (patch update)
- **prisma**: 5.21.1 → 5.22.0 (minor update)

### Security Issues:
- 2 moderate vulnerabilities from fast-jwt (via @fastify/jwt)
- 5 moderate vulnerabilities from esbuild (via vitest)

## Aggressive Update (package-aggressive.json)

### Major Breaking Changes:

#### 1. Fastify v4 → v5
- Plugin registration API changes
- Request/Reply decorators need review
- Error handling improvements
- Migration guide: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/

#### 2. @fastify/jwt v8 → v9
- Fixes fast-jwt vulnerability
- JWT signing/verification API changes
- Token format compatibility maintained
- Review custom JWT handlers

#### 3. Jose v5 → v6
- API restructuring for better tree-shaking
- Import paths may change
- Cryptographic operations remain compatible
- Check custom key management code

#### 4. ESLint v8 → v9
- Flat config format required
- Plugin compatibility issues possible
- May need to update .eslintrc to eslint.config.js
- TypeScript ESLint v8 required for compatibility

#### 5. Prisma v5 → v6
- Client generation improvements
- Some query syntax changes
- Migration should be straightforward
- Check custom Prisma middleware

#### 6. Vitest v2 → v3
- Fixes esbuild vulnerability
- Config format changes
- Test API mostly compatible
- May need to update test setup files

### Migration Steps:

1. **Backup current setup**:
   ```bash
   cp package.json package.json.backup
   cp package-lock.json package-lock.json.backup
   ```

2. **Test in branch**:
   ```bash
   git checkout -b deps-update-aggressive
   cp package-aggressive.json package.json
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Fix breaking changes**:
   - Update Fastify plugins to v5 syntax
   - Migrate ESLint config to flat format
   - Test JWT operations thoroughly
   - Verify Prisma queries work correctly

4. **Run full test suite**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run test:smoke
   ```

### Recommended Approach:

1. **Phase 1**: Apply conservative updates (current package.json)
   - Low risk, maintains compatibility
   - Still has some vulnerabilities

2. **Phase 2**: Selective major updates
   - Update @fastify/jwt to v9 (fixes vulnerability)
   - Update vitest to v3 (fixes vulnerability)
   - Keep other majors for later

3. **Phase 3**: Full aggressive update
   - After thorough testing
   - When ready for breaking changes
   - Consider for v0.2.0 release

### Quick Decision:

- **For immediate deployment**: Use conservative update
- **For new development branch**: Use aggressive update
- **For security compliance**: At minimum update @fastify/jwt and vitest