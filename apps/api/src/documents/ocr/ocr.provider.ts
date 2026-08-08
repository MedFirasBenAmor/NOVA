export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
export type OcrTextBlock = { text: string; confidence: number; page: number };
export type OcrResult = { textBlocks: OcrTextBlock[] };
export interface OcrProvider {
  name: string;
  recognize(input: { buffer: Buffer; mimeType: string }): Promise<OcrResult>;
}
