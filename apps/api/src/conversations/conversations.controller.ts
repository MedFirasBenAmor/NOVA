import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';
import { ConversationsService } from './conversations.service';

@Controller('leads/:leadId/conversation')
@UseGuards(AnonymousSessionGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  get(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.conversations.forLead(leadId);
  }
}
