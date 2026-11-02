import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { AnthropicTutorLlm, DEFAULT_TUTOR_MODEL, TutorRefusedError, TutorUnavailableError } from './ai-tutor.llm';
import { TURN_SCHEMA } from './ai-tutor.prompt';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

/** An SDK error of the given class and HTTP status, without a real request */
const apiError = (Ctor: any, status: number | undefined) => Object.assign(Object.create(Ctor.prototype), { status, message: 'boom' });

function withClient(values: Record<string, string> = { ANTHROPIC_API_KEY: 'test-key' }) {
  const llm = new AnthropicTutorLlm(config(values));
  const create = jest.fn();
  (llm as any).client = { beta: { messages: { create } } };
  return { llm, create };
}

const request = { system: 'sys', messages: [{ role: 'user' as const, content: 'hi' }] };

describe('AnthropicTutorLlm', () => {
  it('is configured only when there is an API key', () => {
    expect(new AnthropicTutorLlm(config({ ANTHROPIC_API_KEY: 'k' })).isConfigured()).toBe(true);
    expect(new AnthropicTutorLlm(config({})).isConfigured()).toBe(false);
  });

  it('refuses to run without a key', async () => {
    await expect(new AnthropicTutorLlm(config({})).complete(request)).rejects.toBeInstanceOf(TutorUnavailableError);
  });

  it('asks for structured JSON at low effort, with the default fallback, and returns the text', async () => {
    const { llm, create } = withClient();
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"reply":"hi"}' }] });

    expect(await llm.complete(request)).toBe('{"reply":"hi"}');

    const body = create.mock.calls[0][0];
    expect(body.model).toBe(DEFAULT_TUTOR_MODEL);
    expect(body.system).toBe('sys');
    expect(body.messages).toEqual(request.messages);
    expect(body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: TURN_SCHEMA } });
    expect(body.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(body.fallbacks).toBe('default');
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('temperature');
  });

  it('uses the model from AI_TUTOR_MODEL when set', async () => {
    const { llm, create } = withClient({ ANTHROPIC_API_KEY: 'k', AI_TUTOR_MODEL: 'claude-sonnet-5-5' });
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] });
    await llm.complete(request);
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
  });

  it('returns an empty string when the answer has no text block', async () => {
    const { llm, create } = withClient();
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [] });
    expect(await llm.complete(request)).toBe('');
  });

  it('reports a refusal', async () => {
    const { llm, create } = withClient();
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(llm.complete(request)).rejects.toBeInstanceOf(TutorRefusedError);
  });

  it.each([
    ['rate limit', apiError(Anthropic.APIError, 429)],
    ['overloaded', apiError(Anthropic.APIError, 529)],
    ['server error', apiError(Anthropic.APIError, 500)],
    ['bad key', apiError(Anthropic.APIError, 401)],
    ['no connection', apiError(Anthropic.APIConnectionError, undefined)],
    ['timeout', apiError(Anthropic.APIConnectionTimeoutError, undefined)],
  ])('turns a %s error into "unavailable"', async (_name, error) => {
    const { llm, create } = withClient();
    create.mockRejectedValue(error);
    await expect(llm.complete(request)).rejects.toBeInstanceOf(TutorUnavailableError);
  });

  it('lets other errors (our own bugs) through unchanged', async () => {
    const { llm, create } = withClient();
    const bad = apiError(Anthropic.APIError, 400);
    create.mockRejectedValue(bad);
    await expect(llm.complete(request)).rejects.toBe(bad);
  });
});
