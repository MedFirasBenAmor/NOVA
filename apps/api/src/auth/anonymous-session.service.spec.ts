import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AnonymousSessionService } from './anonymous-session.service';

describe('AnonymousSessionService', () => {
  it('stores only a token hash and authorizes the owning lead', async () => {
    type CreateArgs = { data: { tokenHash: string; expiresAt: Date } };
    type FindArgs = { where: { tokenHash: string; leadId: string } };
    let storedHash = '';
    const prisma = {
      anonymousSession: {
        create: jest.fn().mockImplementation(({ data }: CreateArgs) => {
          storedHash = data.tokenHash;
          return Promise.resolve({
            id: '00000000-0000-4000-8000-000000000010',
            expiresAt: data.expiresAt,
          });
        }),
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: FindArgs) =>
            Promise.resolve(
              where.tokenHash === storedHash && where.leadId === 'lead-a'
                ? { id: 'session-a' }
                : null,
            ),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AnonymousSessionService(
      prisma as never,
      {
        get: jest.fn((_key: string, fallback: number | string) => fallback),
      } as never,
    );
    const session = await service.create('lead-a');
    expect(storedHash).toBe(
      createHash('sha256').update(session.token).digest('hex'),
    );
    expect(storedHash).not.toContain(session.token);
    await expect(
      service.assertLead(session.token, 'lead-a'),
    ).resolves.toBeUndefined();
    await expect(service.assertLead(session.token, 'lead-b')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertLead(undefined, 'lead-a')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertLead('invalid-token', 'lead-a')).rejects.toThrow(
      ForbiddenException,
    );
    const lookup = prisma.anonymousSession.findFirst.mock.calls[0] as [
      { where: { expiresAt: { gt: Date }; revokedAt: null } },
    ];
    expect(lookup[0].where.expiresAt.gt).toBeInstanceOf(Date);
    expect(lookup[0].where.revokedAt).toBeNull();
  });
});
