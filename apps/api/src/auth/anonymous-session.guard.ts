import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AnonymousSessionService } from './anonymous-session.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnonymousSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: AnonymousSessionService,
    private readonly config: ConfigService,
  ) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const rawLeadId = request.params.leadId;
    const leadId = Array.isArray(rawLeadId) ? rawLeadId[0] : rawLeadId;
    if (!leadId) return false;
    const cookieHeader = request.headers.cookie ?? '';
    const token = cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .find(
        ([name]) =>
          name ===
          this.config.get('ANONYMOUS_SESSION_COOKIE_NAME', 'nova_session'),
      )?.[1];
    return this.sessions
      .assertLead(typeof token === 'string' ? token : undefined, leadId)
      .then(() => true);
  }
}
