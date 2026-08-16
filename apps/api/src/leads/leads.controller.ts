import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';
import { SelectProductDto } from './dto/select-product.dto';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateLeadDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { sessionToken, ...safe } = await this.leads.create(dto);
    response.cookie(
      this.config.get<string>('ANONYMOUS_SESSION_COOKIE_NAME', 'nova_session'),
      sessionToken,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get('NODE_ENV') === 'production',
        maxAge:
          this.config.get<number>('ANONYMOUS_SESSION_TTL_SECONDS', 86400) *
          1000,
        path: '/',
      },
    );
    return safe;
  }

  @Post(':leadId/product')
  @UseGuards(AnonymousSessionGuard)
  selectProduct(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: SelectProductDto,
  ) {
    return this.leads.selectProduct(leadId, dto.product);
  }
}
