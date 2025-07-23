#!/bin/bash
# Generate a comprehensive build error report
# Usage: ./generate-error-report.sh [output_file]
# Example: ./generate-error-report.sh
# Example: ./generate-error-report.sh errors-$(date +%Y%m%d).txt

cd "$(dirname "$0")/../.." || exit 1

OUTPUT_FILE=${1:-"build-errors-$(date +%Y%m%d-%H%M).txt"}

echo "Generating build error report to $OUTPUT_FILE..."

{
    echo "=== BUILD ERROR REPORT ==="
    echo "Generated: $(date)"
    echo "Total errors: $(npm run build-hmi-client 2>&1 | grep -E "error" | wc -l)"
    echo ""
    
    echo "=== TOP 20 ERRORS ==="
    npm run build-hmi-client 2>&1 | grep -E "error" | sed 's/Did you mean.*//' | head -20
    echo ""
    
    echo "=== SDK-CLIENT IMPORT ERRORS ==="
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "sdk-client" | sed 's/Did you mean.*//' | head -10
    echo ""
    
    echo "=== EXPORT MEMBER ERRORS ==="
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "has no exported member" | sed 's/Did you mean.*//' | head -10
    echo ""
    
    echo "=== TYPE DECLARATION ERRORS ==="
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "declares.*locally.*not exported" | sed 's/Did you mean.*//' | head -5
    echo ""
    
} > "$OUTPUT_FILE"

echo "Report saved to $OUTPUT_FILE"
echo "Error count: $(npm run build-hmi-client 2>&1 | grep -E "error" | wc -l)"