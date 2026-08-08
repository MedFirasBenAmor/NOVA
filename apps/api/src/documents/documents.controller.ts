import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService, type UploadFile } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';

@Controller('leads/:leadId/documents')
@UseGuards(AnonymousSessionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.documents.list(leadId);
  }

  @Get(':documentId/status')
  status(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.status(leadId, documentId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @UploadedFile() file: UploadFile | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) throw new BadRequestException('A document file is required');
    return this.documents.upload(leadId, file, dto);
  }
}
