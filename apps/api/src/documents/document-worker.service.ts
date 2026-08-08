import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { DOCUMENT_QUEUE } from './document-queue.service';
import { DocumentProcessorService } from './document-processor.service';

@Injectable()
export class DocumentWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService,
    private readonly processor: DocumentProcessorService,
  ) {}
  onModuleInit() {
    this.worker = new Worker(
      DOCUMENT_QUEUE,
      (job: Job<{ documentId: string }>) =>
        this.processor.process(job.data.documentId),
      {
        connection: {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
        },
      },
    );
  }
  onModuleDestroy() {
    return this.worker?.close();
  }
}
