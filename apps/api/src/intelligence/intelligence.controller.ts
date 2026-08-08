import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { IntelligenceService } from './intelligence.service';

@Controller('leads/:leadId/interactions')
@UseGuards(AnonymousSessionGuard)
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Post()
  analyze(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateInteractionDto,
  ) {
    return this.intelligence.analyze(leadId, dto);
  }
}
