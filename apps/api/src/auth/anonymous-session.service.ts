import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnonymousSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(leadId: string) {
    const token = randomBytes(32).toString('base64url');
    const ttl = this.config.get<number>('ANONYMOUS_SESSION_TTL_SECONDS', 86400);
    const session = await this.prisma.anonymousSession.create({
      data: {
        leadId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    await this.audit('ANONYMOUS_SESSION_CREATED', leadId, session.id);
    return { token, expiresAt: session.expiresAt };
  }

  cookieName() {
    return this.config.get<string>(
      'ANONYMOUS_SESSION_COOKIE_NAME',
      'nova_session',
    );
  }

  async assertLead(token: string | undefined, leadId: string) {
    if (!token) throw new ForbiddenException('Anonymous session required');
    const session = await this.prisma.anonymousSession.findFirst({
      where: {
        tokenHash: this.hash(token),
        leadId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      await this.audit('ANONYMOUS_SESSION_REJECTED', leadId);
      throw new ForbiddenException('Invalid anonymous session');
    }
    await this.prisma.anonymousSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private audit(action: string, leadId: string, entityId?: string) {
    return this.prisma.auditEvent.create({
      data: {
        action,
        entityType: 'AnonymousSession',
        entityId: entityId ?? leadId,
      },
    });
  }
}
