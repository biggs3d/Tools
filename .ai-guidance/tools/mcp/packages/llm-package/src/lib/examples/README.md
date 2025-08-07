# LLM Package Examples

## Test CLI Tool

The `test-llm-cli.mjs` script demonstrates how to use the LLM package with different providers and validates your environment configuration.

### Setup

1. Make sure you have a `.env` file with your API keys in one of these locations:
   - In this directory (`src/examples/.env`)
   - In the src directory (`src/.env`)
   - In the package root directory (`llm-package/.env`)

2. Make sure you've built the package first:
   ```
   cd ../.. && npm run build
   ```

### Usage

Run the script with Node.js:

```bash
# Use OpenAI (default provider)
node test-llm-cli.mjs

# Use Anthropic/Claude
node test-llm-cli.mjs --provider=anthropic

# Use Azure OpenAI
node test-llm-cli.mjs --provider=azure-openai

# Additional options
node test-llm-cli.mjs --provider=openai --prompt="Explain quantum computing in one sentence" --model="gpt-4" --debug=true
```

### Command Line Options

- `--provider=<provider>`: Specify the LLM provider (openai, anthropic, azure-openai)
- `--prompt=<text>`: Custom prompt to send to the LLM
- `--model=<model>`: Override the model specified in environment variables
- `--apiKey=<key>`: Override the API key specified in environment variables
- `--debug=true`: Show detailed configuration information

### What the Test CLI Does

1. Validates that required environment variables are set
2. Creates an LLM client with the specified provider
3. Displays information about the configured client
4. Runs a test completion with a prompt
5. Tests token counting if supported
6. Tests memory-specific functions like importance scoring and similarity rating

## Other Examples

- `memory-integration.ts`: Demonstrates how to use LLM memory functions with a sample dataset.

## Environment Variables

Each provider requires specific environment variables:

### OpenAI
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, defaults to gpt-4-turbo)
- `OPENAI_ORGANIZATION` (optional)

### Anthropic (Claude)
- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_MODEL` (optional, defaults to claude-3-opus-20240229)

### Azure OpenAI
- `AZURE_OPENAI_API_KEY` (required)
- `AZURE_OPENAI_DEPLOYMENT_NAME` (required)
- `AZURE_OPENAI_RESOURCE_NAME` (required)
- `AZURE_OPENAI_API_VERSION` (optional, defaults to 2023-05-15)
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (optional, for embeddings)