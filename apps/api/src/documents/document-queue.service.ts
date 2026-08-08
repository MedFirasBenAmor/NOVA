import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export const DOCUMENT_QUEUE = 'document-processing';

@Injectable()
export class DocumentQueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  constructor(config: ConfigService) {
    this.queue = new Queue(DOCUMENT_QUEUE, {
      connection: {
        host: config.get<string>('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
      },
    });
  }
  enqueue(documentId: string) {
    return this.queue.add(
      'PROCESS_DOCUMENT',
      { documentId },
      { jobId: documentId, attempts: 3, removeOnComplete: true },
    );
  }
  onModuleDestroy() {
    return this.queue.close();
  }
}
