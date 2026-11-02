// server/src/ai-tutor/ai-tutor.llm.ts
// The one place that talks to Claude. The service depends on the abstract TutorLlm, so tests
// can swap in a fake and never call the API.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TURN_SCHEMA } from './ai-tutor.prompt';

export interface TutorLlmRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/** The model declined to answer (safety classifier) and no fallback model could either */
export class TutorRefusedError extends Error {
  constructor() {
    super('The AI partner could not answer that');
  }
}

/** The AI service is unreachable, overloaded or rate limited: worth trying again shortly */
export class TutorUnavailableError extends Error {
  constructor(message = 'The AI partner is busy right now') {
    super(message);
  }
}

export abstract class TutorLlm {
  abstract isConfigured(): boolean;
  /** Returns the model's JSON text (shaped by TURN_SCHEMA) */
  abstract complete(request: TutorLlmRequest): Promise<string>;
}

export const DEFAULT_TUTOR_MODEL = 'claude-opus-5-5';

@Injectable()
export class AnthropicTutorLlm extends TutorLlm {
  private readonly logger = new Logger(AnthropicTutorLlm.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    super();
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('AI_TUTOR_MODEL') || DEFAULT_TUTOR_MODEL;
    // A spoken conversation can't wait minutes: fail fast and let the learner retry
    this.client = apiKey ? new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete({ system, messages }: TutorLlmRequest): Promise<string> {
    if (!this.client) throw new TutorUnavailableError('The AI partner is not set up on this server');

    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 2000,
        system,
        messages,
        // Thinking is always on for this model; low effort keeps replies quick enough to talk to
        output_config: { effort: 'low', format: { type: 'json_schema', schema: TURN_SCHEMA as any } },
        // If a safety classifier declines, the API retries on its default fallback model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      if (response.stop_reason === 'refusal') throw new TutorRefusedError();
      if (response.stop_reason === 'max_tokens') this.logger.warn('Tutor reply hit max_tokens');

      const text = response.content.find((block) => block.type === 'text');
      return text && text.type === 'text' ? text.text : '';
    } catch (error) {
      if (error instanceof TutorRefusedError) throw error;
      // Connection and timeout errors are subclasses of APIError (without a status), so check them first
      if (error instanceof Anthropic.APIConnectionError) {
        this.logger.warn(`Claude request failed: ${error.message}`);
        throw new TutorUnavailableError();
      }
      if (error instanceof Anthropic.APIError) {
        this.logger.warn(`Claude request failed: ${error.status ?? 'no status'} ${error.message}`);
        // 429 and 5xx (including 529 overloaded) are temporary; anything else is our bug or config
        if (error.status === 429 || (error.status ?? 0) >= 500) throw new TutorUnavailableError();
        if (error.status === 401 || error.status === 403) {
          throw new TutorUnavailableError('The AI partner is not set up correctly on this server');
        }
      }
      throw error;
    }
  }
}
