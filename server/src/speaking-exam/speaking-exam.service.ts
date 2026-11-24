// server/src/speaking-exam/speaking-exam.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CheckerBusyError, CheckerUnavailableError, LanguageToolClient } from '../writing/language-tool.client';
import type { CheckerMatch } from '../writing/writing.engine';
import {
  buildPaper,
  buildReport,
  scorePart,
  type ExamPaper,
  type ExamPart,
  type ExamReport,
  type GrammarSummary,
  type PartInput,
} from './exam.engine';

const MAX_PARTS = 9;
const MAX_TRANSCRIPT = 4000;
const MAX_QUESTION = 300;
/** The checker only gets this much text per test: enough for a whole exam, small enough for the shared free limit */
const MAX_GRAMMAR_CHARS = 3500;

/**
 * What a spoken transcript can fairly be marked on. Speech recognition returns no capitals or punctuation, so
 * rules about those would flag everything; only genuine grammar and word-choice slips are counted.
 */
export function countsAsSlip(match: CheckerMatch): boolean {
  const category = match.rule.category?.id ?? '';
  const id = match.rule.id ?? '';
  if (/^(UPPERCASE|SENTENCE_|COMMA|PUNCT|WHITESPACE|EN_UNPAIRED|DASH|APOS)/.test(id)) return false;
  return category === 'GRAMMAR' || category === 'CONFUSED_WORDS' || match.rule.issueType === 'grammar';
}

@Injectable()
export class SpeakingExamService {
  private readonly logger = new Logger(SpeakingExamService.name);

  constructor(private checker: LanguageToolClient) {}

  /** A fresh paper. Pass your own id to get the same paper again (for "try the same questions") */
  paper(examId?: string): ExamPaper {
    const id = examId && /^[a-z0-9]{6,32}$/i.test(examId) ? examId : randomBytes(5).toString('hex');
    return buildPaper(id);
  }

  async score(body: { parts?: unknown }): Promise<ExamReport & { grammarViaPublicServer: boolean }> {
    const inputs = this.validate(body?.parts);
    const parts = inputs.map(scorePart);
    const grammar = await this.checkGrammar(inputs, parts.reduce((n, p) => n + p.words, 0));
    return { ...buildReport(parts, grammar), grammarViaPublicServer: this.checker.usesPublicServer };
  }

  private validate(parts: unknown): PartInput[] {
    if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_PARTS) {
      throw new BadRequestException('Send between 1 and 9 answers');
    }
    return parts.map((raw, index) => {
      const p = raw as Record<string, unknown>;
      const part = Number(p?.part);
      if (part !== 1 && part !== 2 && part !== 3) throw new BadRequestException(`Answer ${index + 1}: part must be 1, 2 or 3`);
      const seconds = Number(p.seconds);
      if (!Number.isFinite(seconds) || seconds < 0) throw new BadRequestException(`Answer ${index + 1}: seconds must be a number`);
      return {
        part: part as ExamPart,
        question: String(p.question ?? '').slice(0, MAX_QUESTION),
        transcript: String(p.transcript ?? '').slice(0, MAX_TRANSCRIPT),
        seconds,
      };
    });
  }

  private async checkGrammar(inputs: PartInput[], words: number): Promise<GrammarSummary> {
    const text = inputs
      .map((i) => i.transcript.trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, MAX_GRAMMAR_CHARS);
    if (words < 25 || !text) return { checked: false, slipsPer100: null, examples: [] };

    try {
      const matches = (await this.checker.check(text, 'en-GB')).filter(countsAsSlip);
      const checkedWords = Math.max(1, text.split(/\s+/).filter(Boolean).length);
      return {
        checked: true,
        slipsPer100: Math.round((matches.length / checkedWords) * 1000) / 10,
        examples: matches.slice(0, 3).map((m) => ({
          text: text.slice(m.offset, m.offset + m.length),
          message: m.shortMessage || m.message,
          suggestion: m.replacements[0]?.value ?? null,
        })),
      };
    } catch (error) {
      if (!(error instanceof CheckerBusyError) && !(error instanceof CheckerUnavailableError)) throw error;
      this.logger.warn(`Grammar not checked for a speaking exam: ${(error as Error).message}`);
      return { checked: false, slipsPer100: null, examples: [] };
    }
  }
}
