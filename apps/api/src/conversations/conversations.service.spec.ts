import { ConversationMessageRole } from '@prisma/client';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  it('stores a customer message against the lead conversation without auditing content', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'message-id' });
    const audit = jest.fn().mockResolvedValue({});
    const service = new ConversationsService({
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conversation-id' }),
      },
      conversationMessage: { create },
      auditEvent: { create: audit },
    } as never);

    await service.addCustomerMessage('lead-id', 'private synthetic message');

    expect(create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conversation-id',
        role: ConversationMessageRole.CUSTOMER,
        content: 'private synthetic message',
      },
    });
    expect(JSON.stringify(audit.mock.calls)).not.toContain(
      'private synthetic message',
    );
  });
});
