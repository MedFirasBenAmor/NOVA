import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationMessageRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async addCustomerMessage(leadId: string, content: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
    if (!conversation)
      throw new NotFoundException(`Conversation not found for lead: ${leadId}`);
    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: ConversationMessageRole.CUSTOMER,
        content,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        action: 'CONVERSATION_MESSAGE_CREATED',
        entityType: 'ConversationMessage',
        entityId: message.id,
      },
    });
    return message;
  }

  async forLead(leadId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });
    if (!conversation)
      throw new NotFoundException(`Conversation not found for lead: ${leadId}`);
    return conversation;
  }
}
