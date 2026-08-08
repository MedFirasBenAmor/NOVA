import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { AuditModule } from './audit/audit.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CustomerFolderModule } from './customer-folder/customer-folder.module';
import { CustomersModule } from './customers/customers.module';
import { DatapointsModule } from './datapoints/datapoints.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentsModule } from './documents/documents.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        API_PORT: Joi.number().port().default(3001),
        WEB_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
        DATABASE_URL: Joi.string().uri().required(),
        AI_PROVIDER: Joi.string().valid('mock', 'gemini').default('mock'),
        GEMINI_API_KEY: Joi.string().allow('').optional(),
        GEMINI_MODEL: Joi.string().default('gemini-2.0-flash'),
        DOCUMENT_STORAGE_PROVIDER: Joi.string().valid('local').default('local'),
        DOCUMENT_STORAGE_PATH: Joi.string().default('./var/documents'),
        MAX_DOCUMENT_UPLOAD_BYTES: Joi.number()
          .integer()
          .positive()
          .default(10485760),
        ANONYMOUS_SESSION_TTL_SECONDS: Joi.number()
          .integer()
          .positive()
          .default(86400),
        ANONYMOUS_SESSION_COOKIE_NAME: Joi.string().default('nova_session'),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().port().default(6379),
        OCR_PROVIDER: Joi.string().valid('mock', 'paddle').default('mock'),
        PADDLE_OCR_URL: Joi.string().uri().allow('').optional(),
      }),
    }),
    PrismaModule,
    HealthModule,
    CustomersModule,
    LeadsModule,
    ConversationsModule,
    DatapointsModule,
    IntelligenceModule,
    CustomerFolderModule,
    AuditModule,
    DocumentsModule,
    AuthModule,
  ],
})
export class AppModule {}
