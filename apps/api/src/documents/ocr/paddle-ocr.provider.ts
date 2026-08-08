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
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(
          this.config.get<number>('OCR_TIMEOUT_MS', 30_000),
        ),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError')
        throw new ServiceUnavailableException('OCR_TIMEOUT');
      throw new ServiceUnavailableException('OCR_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok)
      throw new ServiceUnavailableException('OCR_PROVIDER_UNAVAILABLE');
    const result = (await response.json()) as OcrResult & {
      blocks?: OcrResult['textBlocks'];
    };
    const textBlocks = result.textBlocks ?? result.blocks;
    if (!Array.isArray(textBlocks))
      throw new ServiceUnavailableException(
        'PaddleOCR returned an invalid result',
      );
    return { ...result, textBlocks, provider: result.provider ?? 'PADDLE_OCR' };
  }
}
