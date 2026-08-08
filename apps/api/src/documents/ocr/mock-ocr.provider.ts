import { Injectable } from '@nestjs/common';
import type { OcrProvider } from './ocr.provider';

@Injectable()
export class MockOcrProvider implements OcrProvider {
  name = 'mock';
  recognize() {
    return Promise.resolve({
      textBlocks: [
        { text: 'NOM / SURNAME: TREMBLAY', confidence: 0.99, page: 1 },
        { text: 'PRENOM / GIVEN NAME: ALEX', confidence: 0.99, page: 1 },
        {
          text: 'DATE DE NAISSANCE / DOB: 1990-05-17',
          confidence: 0.98,
          page: 1,
        },
      ],
    });
  }
}
