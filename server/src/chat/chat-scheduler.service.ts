import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatFeaturesService } from './chat-features.service';
import { ChatGateway } from './chat.gateway';

const TICK_MS = 15_000;

/**
 * Background chat jobs: sends scheduled messages when they're due and removes
 * disappearing messages whose timer ran out — both pushed live to open chats.
 */
@Injectable()
export class ChatSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private features: ChatFeaturesService,
    private gateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const result of await this.features.sendDueScheduled()) {
        if (result.message) {
          this.gateway.emitToChat(result.chatId, 'message:new', result.message);
          this.gateway.emitToUser(result.senderId, 'scheduled:sent', {
            id: result.scheduledId,
            chatId: result.chatId,
          });
        } else {
          this.gateway.emitToUser(result.senderId, 'scheduled:failed', {
            id: result.scheduledId,
            chatId: result.chatId,
            error: result.error,
          });
        }
      }

      for (const [chatId, messageIds] of await this.features.sweepExpired()) {
        this.gateway.emitToChat(chatId, 'messages:expired', { chatId, messageIds });
      }
    } catch (error: any) {
      this.logger.error(`Chat scheduler tick failed: ${error?.message || error}`);
    } finally {
      this.running = false;
    }
  }
}
