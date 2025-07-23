# Build Error Analysis Scripts

This directory contains scripts to help analyze and fix TypeScript build errors during framework migration.

## Scripts

### `count-build-errors.sh`
Count total TypeScript build errors or errors matching a pattern.

```bash
# Count all errors
./count-build-errors.sh

# Count errors containing "sdk-client"  
./count-build-errors.sh "sdk-client"
```

### `show-build-errors.sh`
Display build errors in clean format (without "Did you mean" suggestions).

```bash
# Show first 20 errors
./show-build-errors.sh

# Show first 10 errors
./show-build-errors.sh 10

# Show first 15 errors matching "sdk-client"
./show-build-errors.sh 15 "sdk-client"
```

### `find-import-errors.sh`
Find specific types of import-related errors.

```bash
# Find SDK client import errors
./find-import-errors.sh "sdk-client" 10

# Find specific type errors
./find-import-errors.sh "IEntityInteractor"

# Find export member errors
./find-import-errors.sh "has no exported member" 15
```

### `find-files-importing.sh`
Find files that import specific types from specific packages.

```bash
# Find files importing IEntityInteractor from sdk-client
./find-files-importing.sh "IEntityInteractor" "sdk-client"

# Find files importing Nullable from wrong package
./find-files-importing.sh "Nullable" "framework-shared-utils"
```

### `check-export-availability.sh`
Check if types are available in framework packages.

```bash
# Search all framework packages for IEntityInteractor
./check-export-availability.sh "IEntityInteractor"

# Check specific package for ComponentVMCollection
./check-export-availability.sh "ComponentVMCollection" "framework-visual-react-components"
```

### `generate-error-report.sh`
Generate comprehensive error report with categorized issues.

```bash
# Generate report with timestamp filename
./generate-error-report.sh

# Generate report with custom filename
./generate-error-report.sh "my-errors.txt"
```

## Usage Examples

### Typical workflow for fixing import errors:

1. **Get overview**: `./count-build-errors.sh`
2. **See top errors**: `./show-build-errors.sh 15`
3. **Find specific issues**: `./find-import-errors.sh "sdk-client" 10`
4. **Locate affected files**: `./find-files-importing.sh "IEntityInteractor" "sdk-client"`
5. **Find correct package**: `./check-export-availability.sh "IEntityInteractor"`
6. **Generate report**: `./generate-error-report.sh`

### Quick commands:

```bash
# Quick error count check
./count-build-errors.sh

# See what's left to fix
./show-build-errors.sh 10

# Check progress on SDK client migration
./count-build-errors.sh "sdk-client"
```