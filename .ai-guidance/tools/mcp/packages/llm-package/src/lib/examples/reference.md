Here’s a concise rundown of the key points:

* Install the official SDK via `npm install openai`. ([npmjs.com][1])
* The core method is `client.chat.completions.create`, which takes a typed request object and returns a `Promise` of a `ChatCompletionResponse`.;
* You must supply a `model` name and an array of `messages`; other parameters (`temperature`, `max_tokens`, `functions`, etc.) are all optional API options.;
* To stream partial results, include `stream: true` and iterate the returned async iterable of chunks.;
* For Azure OpenAI users, using `new AzureOpenAI()` yields the same `chat.completions.create` signature.;

---

## Method Signature

In TypeScript, the call looks roughly like this:&#x20;

```ts
async create(
  params: {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'function';
      content?: string;
      name?: string;                    // required if role==='function'
      function_call?: {
        name: string;
        arguments: string;
      };
    }>;
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
    functions?: Array<{
      name: string;
      description?: string;
      parameters: Record<string, any>;  // JSON Schema
    }>;
    function_call?: 'auto' | 'none' | { name: string };
  },
  options?: {
    timeout?: number;
    maxRetries?: number;
    httpAgent?: any;
  }
): Promise<{
  id: string;
  object: string;
  created: number;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  choices: Array<{
    index: number;
    message: { role: string; content?: string; function_call?: { name: string; arguments: string } };
    finish_reason: string;
  }>;
}>;
```

## Usage Examples

### Basic Chat Completion

A minimal example creates a single completion with default settings.;

```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user',   content: 'What is the capital of France?' },
  ],
});

console.log(completion.choices[0].message.content);
```

### Streaming Chat Completion

To stream responses, set `stream: true` and iterate the returned async generator.;

```ts
const stream = await client.chat.completions.create(
  { model: 'gpt-4o', messages, stream: true },
);

for await (const chunk of stream) {
  console.log(chunk.choices[0].delta?.content);
}
```

### Function Calling

For function calling, include a `functions` array and optionally a `function_call` directive.;

```ts
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'What’s the weather like in Boston?' },
  ],
  functions: [
    {
      name: 'getWeather',
      description: 'Get the current weather in a given city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' }
        },
        required: ['city']
      }
    }
  ],
  function_call: 'auto'
});
```

## Options & Parameters

Other parameters like `temperature`, `top_p`, `n`, `stop`, `max_tokens`, and `presence_penalty` map directly to OpenAI API options.;

## Response Shape

The resolved response includes an `id`, `model`, optional `usage` metrics, and a `choices` array where each choice has an `index`, `message`, and `finish_reason`.;

## Common Pitfall

> Passing a bare `prompt` field instead of the required `messages` array will throw an unexpected-argument error.;

[1]: https://www.npmjs.com/package/openai "openai - NPM"
