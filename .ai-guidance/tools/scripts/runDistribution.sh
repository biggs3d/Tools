#!/bin/bash

# runDistribution.sh - Bash equivalent of runDistribution.mjs
# Runs docker compose files and copies configuration to hmi-server-distribution

set -e  # Exit on any error

# Default values
DIST_PATH="./"
COMPOSE_FILES=()

# Function to show usage
show_usage() {
    echo "Usage: $0 [DIST_PATH] [-f|--compose-file COMPOSE_FILE]..."
    echo ""
    echo "Arguments:"
    echo "  DIST_PATH                Distribution path (default: ./)"
    echo ""
    echo "Options:"
    echo "  -f, --compose-file FILE  Additional compose file(s) to include"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 /path/to/dist"
    echo "  $0 -f extra-compose.yml"
    echo "  $0 /path/to/dist -f extra1.yml -f extra2.yml"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--compose-file)
            if [[ -n "$2" && "$2" != -* ]]; then
                COMPOSE_FILES+=("$2")
                shift 2
            else
                echo "Error: --compose-file requires a file path"
                exit 1
            fi
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            echo "Error: Unknown option $1"
            show_usage
            exit 1
            ;;
        *)
            # First positional argument is DIST_PATH
            if [[ "$DIST_PATH" == "./" ]]; then
                DIST_PATH="$1"
            else
                echo "Error: Unexpected argument $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Convert to absolute path
DIST_PATH=$(realpath "$DIST_PATH")
DISTRIBUTION_COMPOSE_DIR="$DIST_PATH/compose"

# Check if compose directory exists
if [[ ! -d "$DISTRIBUTION_COMPOSE_DIR" ]]; then
    echo "Error: Missing $DISTRIBUTION_COMPOSE_DIR, go build the distribution."
    exit 1
fi

echo "Using distribution path: $DIST_PATH"
echo "Compose directory: $DISTRIBUTION_COMPOSE_DIR"

# Find all .yml files in the compose directory and sort them
COMPOSE_FILE_ARGS=()
while IFS= read -r -d '' file; do
    COMPOSE_FILE_ARGS+=("-f" "$file")
done < <(find "$DISTRIBUTION_COMPOSE_DIR" -name "*.yml" -type f -print0 | sort -z)

# Add any additional compose files specified via command line
for compose_file in "${COMPOSE_FILES[@]}"; do
    if [[ ! -f "$compose_file" ]]; then
        echo "Warning: Compose file $compose_file does not exist"
    else
        COMPOSE_FILE_ARGS+=("-f" "$compose_file")
    fi
done

if [[ ${#COMPOSE_FILE_ARGS[@]} -eq 0 ]]; then
    echo "Error: No compose files found"
    exit 1
fi

echo "Found compose files:"
for ((i=1; i<${#COMPOSE_FILE_ARGS[@]}; i+=2)); do
    echo "  ${COMPOSE_FILE_ARGS[$i]}"
done

# Run docker compose create with force recreate
echo ""
echo "Creating containers with force recreate..."
docker compose "${COMPOSE_FILE_ARGS[@]}" create --force-recreate

# Copy configuration to hmi-server-distribution container
CONFIGURATION_DIR="$DIST_PATH/configuration"
if [[ -d "$CONFIGURATION_DIR" ]]; then
    echo ""
    echo "Copying configuration from $CONFIGURATION_DIR to hmi-server-distribution container..."

    # Use docker compose cp with explicit source and destination
    if docker compose "${COMPOSE_FILE_ARGS[@]}" cp "$CONFIGURATION_DIR" hmi-server-distribution:/app/; then
        echo "Configuration copied successfully"
    else
        echo "Warning: Failed to copy configuration to hmi-server-distribution container"
        echo "Available containers:"
        docker compose "${COMPOSE_FILE_ARGS[@]}" ps
    fi
else
    echo "Warning: Configuration directory $CONFIGURATION_DIR does not exist"
fi

# Start all services
echo ""
echo "Starting services..."
docker compose "${COMPOSE_FILE_ARGS[@]}" up

echo ""
echo "Distribution started successfully!"
