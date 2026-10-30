import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatFeaturesService } from './chat-features.service';
import { ChatPrivacyService } from './chat-privacy.service';
import { ChatGateway } from './chat.gateway';
import {
  ChatMediaQueryDto,
  ForwardMessagesDto,
  MessageIdsDto,
  ReportDto,
  SaveMessageDto,
  ScheduleMessageDto,
  SetChatPinDto,
  SetDisappearingDto,
  UpdateChatPrivacyDto,
  UpdateChatStateDto,
  VerifyChatPinDto,
} from './dto/chat-features.dto';

/**
 * Premium chat features. Every route has at least two segments after /chat so
 * none can collide with ChatController's GET /chat/:chatId.
 */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatFeaturesController {
  constructor(
    private features: ChatFeaturesService,
    private privacy: ChatPrivacyService,
    private gateway: ChatGateway,
  ) {}

  // ============ PRIVACY & CHAT LOCK ============

  @Get('me/privacy')
  getPrivacy(@Request() req) {
    return this.privacy.getView(req.user.id);
  }

  @Put('me/privacy')
  updatePrivacy(@Request() req, @Body() dto: UpdateChatPrivacyDto) {
    return this.privacy.update(req.user.id, dto);
  }

  @Put('me/pin')
  setPin(@Request() req, @Body() dto: SetChatPinDto) {
    return this.privacy.setPin(req.user.id, dto.pin, dto.currentPin);
  }

  @Post('me/pin/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Request() req, @Body() dto: VerifyChatPinDto) {
    await this.privacy.verifyPin(req.user.id, dto.pin);
    return { ok: true };
  }

  @Post('me/pin/remove')
  @HttpCode(HttpStatus.OK)
  removePin(@Request() req, @Body() dto: VerifyChatPinDto) {
    return this.privacy.removePin(req.user.id, dto.pin);
  }

  @Get('me/saved')
  getAllSaved(@Request() req) {
    return this.features.getSaved(req.user.id);
  }

  @Post('me/report')
  @HttpCode(HttpStatus.OK)
  report(@Request() req, @Body() dto: ReportDto) {
    return this.features.report(req.user.id, dto);
  }

  // ============ CHAT STATE ============

  @Put(':chatId/state')
  updateState(@Request() req, @Param('chatId') chatId: string, @Body() dto: UpdateChatStateDto) {
    return this.features.updateChatState(req.user.id, chatId, dto);
  }

  @Post(':chatId/clear')
  @HttpCode(HttpStatus.OK)
  clearHistory(@Request() req, @Param('chatId') chatId: string) {
    return this.features.clearHistory(req.user.id, chatId);
  }

  @Post(':chatId/read-all')
  @HttpCode(HttpStatus.OK)
  markChatRead(@Request() req, @Param('chatId') chatId: string) {
    return this.features.markChatRead(req.user.id, chatId);
  }

  @Put(':chatId/disappearing')
  async setDisappearing(@Request() req, @Param('chatId') chatId: string, @Body() dto: SetDisappearingDto) {
    const result = await this.features.setDisappearing(req.user.id, chatId, dto.seconds);
    if (result.message) {
      this.gateway.emitToChat(chatId, 'chat:updated', { chatId, disappearingSeconds: result.seconds || null });
      this.gateway.emitToChat(chatId, 'message:new', result.message);
    }
    return result;
  }

  @Get(':chatId/media')
  getMedia(@Request() req, @Param('chatId') chatId: string, @Query() query: ChatMediaQueryDto) {
    return this.features.getMedia(req.user.id, chatId, query.kind, query.before);
  }

  @Get(':chatId/saved')
  getSaved(@Request() req, @Param('chatId') chatId: string) {
    return this.features.getSaved(req.user.id, chatId);
  }

  // ============ SCHEDULED MESSAGES ============

  @Get(':chatId/scheduled')
  listScheduled(@Request() req, @Param('chatId') chatId: string) {
    return this.features.listScheduled(req.user.id, chatId);
  }

  @Post(':chatId/scheduled')
  schedule(@Request() req, @Param('chatId') chatId: string, @Body() dto: ScheduleMessageDto) {
    return this.features.schedule(req.user.id, chatId, dto);
  }

  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  cancelScheduled(@Request() req, @Param('id') id: string) {
    return this.features.cancelScheduled(req.user.id, id);
  }

  // ============ MESSAGES ============

  /** Delete for me: hidden only for this user */
  @Post('messages/hide')
  @HttpCode(HttpStatus.OK)
  hideMessages(@Request() req, @Body() dto: MessageIdsDto) {
    return this.features.hideMessages(req.user.id, dto.messageIds);
  }

  @Post('messages/forward')
  @HttpCode(HttpStatus.OK)
  async forward(@Request() req, @Body() dto: ForwardMessagesDto) {
    const { sent, failed } = await this.features.forward(req.user.id, dto.messageIds, dto.chatIds);
    for (const { chatId, message } of sent) {
      this.gateway.emitToChat(chatId, 'message:new', message);
    }
    return { sent: sent.length, failed, chatIds: [...new Set(sent.map((s) => s.chatId))] };
  }

  @Put('messages/:messageId/save')
  save(@Request() req, @Param('messageId') messageId: string, @Body() dto: SaveMessageDto) {
    return this.features.setSaved(req.user.id, messageId, dto.saved);
  }

  @Get('messages/:messageId/info')
  info(@Request() req, @Param('messageId') messageId: string) {
    return this.features.getMessageInfo(req.user.id, messageId);
  }

  @Post('messages/:messageId/view-once')
  @HttpCode(HttpStatus.OK)
  async openViewOnce(@Request() req, @Param('messageId') messageId: string) {
    const result = await this.features.openViewOnce(req.user.id, messageId);
    if (result.message.chatId) {
      this.gateway.emitToChat(result.message.chatId, 'message:updated', result.message);
    }
    return { url: result.url, type: result.type };
  }

  @Post('messages/:messageId/transcribe')
  @HttpCode(HttpStatus.OK)
  transcribe(@Request() req, @Param('messageId') messageId: string) {
    return this.features.transcribe(req.user.id, messageId);
  }

  @Post('messages/:messageId/translate-transcript')
  @HttpCode(HttpStatus.OK)
  translateTranscript(@Request() req, @Param('messageId') messageId: string) {
    return this.features.translateTranscript(req.user.id, messageId);
  }
}
