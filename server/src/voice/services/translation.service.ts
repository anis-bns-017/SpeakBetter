
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { OpenAI } from 'openai';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /** True when at least one translation provider has an API key */
  isConfigured(): boolean {
    return Boolean(this.openai || this.configService.get('GOOGLE_TRANSLATE_API_KEY'));
  }

  async translateText(text: string, targetLanguage: string, sourceLanguage?: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLanguage}. 
                     Keep the tone and context. Only return the translation, nothing else.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Translation failed: ${error.message}`);
      // Fallback to Google Translate API
      return this.googleTranslate(text, targetLanguage);
    }
  }

  private async googleTranslate(text: string, targetLanguage: string) {
    // Implement Google Translate API fallback
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${this.configService.get('GOOGLE_TRANSLATE_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            target: targetLanguage,
          }),
        },
      );
      const data = await response.json();
      return data.data.translations[0].translatedText;
    } catch (error) {
      this.logger.error(`Google Translate failed: ${error.message}`);
      return text; // Return original text if translation fails
    }
  }

  async translateTranscription(transcriptionId: string, targetLanguage: string) {
    const transcription = await this.prisma.voiceTranscription.findUnique({
      where: { id: transcriptionId },
    });

    if (!transcription) {
      throw new Error('Transcription not found');
    }

    const translatedText = await this.translateText(
      transcription.text,
      targetLanguage,
      transcription.language,
    );

    return this.prisma.voiceTranslation.create({
      data: {
        transcriptionId,
        sourceLanguage: transcription.language,
        targetLanguage,
        translatedText,
      },
    });
  }

  async getTranslatedTranscriptions(roomId: string, targetLanguage: string) {
    const transcriptions = await this.prisma.voiceTranscription.findMany({
      where: { roomId, isFinal: true },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const translated = await Promise.all(
      transcriptions.map(async (t) => {
        // Check if translation exists
        let translation = await this.prisma.voiceTranslation.findFirst({
          where: {
            transcriptionId: t.id,
            targetLanguage,
          },
        });

        if (!translation) {
          translation = await this.translateTranscription(t.id, targetLanguage);
        }

        return {
          original: t.text,
          translated: translation.translatedText,
          timestamp: t.timestamp,
        };
      }),
    );

    return translated;
  }
}