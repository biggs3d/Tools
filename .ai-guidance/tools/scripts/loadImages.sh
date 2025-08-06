#!/bin/bash

# Default distribution path (relative to the script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DIST_PATH="$(dirname "$SCRIPT_DIR")"

# Parse command line arguments
DIST_PATH="$DEFAULT_DIST_PATH"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dist-path)
            DIST_PATH="$2"
            shift 2
            ;;
        --dist-path=*)
            DIST_PATH="${1#*=}"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--dist-path <path>]"
            echo "  --dist-path  Path to the distribution directory (default: parent of script directory)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Resolve absolute path
IMAGES_DIR="$(realpath "$DIST_PATH/images")"

# Check if images directory exists
if [[ ! -d "$IMAGES_DIR" ]]; then
    echo "Error: Images directory not found at $IMAGES_DIR"
    exit 1
fi

echo "Loading Docker images from: $IMAGES_DIR"

# Counter for loaded images
loaded_count=0

# Loop through all .tar.gz files in the images directory
for image_file in "$IMAGES_DIR"/*.tar.gz; do
    # Check if the file exists (handles case where no .tar.gz files exist)
    if [[ -f "$image_file" ]]; then
        echo "Loading image: $(basename "$image_file")"
        if docker image load -i "$image_file"; then
            ((loaded_count++))
            echo "Successfully loaded: $(basename "$image_file")"
        else
            echo "Error loading: $(basename "$image_file")"
            exit 1
        fi
    fi
done

if [[ $loaded_count -eq 0 ]]; then
    echo "No .tar.gz image files found in $IMAGES_DIR"
    exit 1
else
    echo "Successfully loaded $loaded_count Docker image(s)"
fi
