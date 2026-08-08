import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OcrProvider, OcrResult } from './ocr.provider';

@Injectable()
export class PaddleOcrProvider implements OcrProvider {
  name = 'paddle';
  constructor(private readonly config: ConfigService) {}

  async recognize(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<OcrResult> {
    const url = this.config.get<string>('PADDLE_OCR_URL');
    if (!url)
      throw new ServiceUnavailableException(
        'PaddleOCR helper is not configured',
      );
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      'document',
    );
    const response = await fetch(url, { method: 'POST', body: form });
    if (!response.ok)
      throw new ServiceUnavailableException('PaddleOCR helper failed');
    const result = (await response.json()) as OcrResult;
    if (!Array.isArray(result.textBlocks))
      throw new ServiceUnavailableException(
        'PaddleOCR returned an invalid result',
      );
    return result;
  }
}
