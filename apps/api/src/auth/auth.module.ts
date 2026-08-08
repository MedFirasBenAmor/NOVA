import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AnonymousSessionGuard } from './anonymous-session.guard';
import { AnonymousSessionService } from './anonymous-session.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AnonymousSessionService, AnonymousSessionGuard],
  exports: [AnonymousSessionService, AnonymousSessionGuard],
})
export class AuthModule {}
