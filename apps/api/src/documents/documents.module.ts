import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsController } from './documents.controller';
import { DOCUMENT_STORAGE_PROVIDER } from './document-storage.provider';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorageProvider } from './local-document-storage.provider';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { CollectionModule } from '../collection/collection.module';
import { DocumentQueueService } from './document-queue.service';
import { DocumentProcessorService } from './document-processor.service';
import { DocumentWorkerService } from './document-worker.service';
import { OCR_PROVIDER } from './ocr/ocr.provider';
import { MockOcrProvider } from './ocr/mock-ocr.provider';
import { PaddleOcrProvider } from './ocr/paddle-ocr.provider';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    DatapointsModule,
    CollectionModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.get<number>(
            'MAX_DOCUMENT_UPLOAD_BYTES',
            10 * 1024 * 1024,
          ),
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    LocalDocumentStorageProvider,
    DocumentQueueService,
    DocumentProcessorService,
    DocumentWorkerService,
    MockOcrProvider,
    PaddleOcrProvider,
    {
      provide: OCR_PROVIDER,
      inject: [ConfigService, MockOcrProvider, PaddleOcrProvider],
      useFactory: (
        config: ConfigService,
        mock: MockOcrProvider,
        paddle: PaddleOcrProvider,
      ) => (config.get('OCR_PROVIDER', 'mock') === 'paddle' ? paddle : mock),
    },
    {
      provide: DOCUMENT_STORAGE_PROVIDER,
      useExisting: LocalDocumentStorageProvider,
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
