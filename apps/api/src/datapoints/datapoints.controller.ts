import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { CompletenessQueryDto } from './dto/completeness-query.dto';
import { UpsertDatapointDto } from './dto/upsert-datapoint.dto';
import { DatapointsService } from './datapoints.service';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';

@Controller()
export class DatapointsController {
  constructor(private readonly datapoints: DatapointsService) {}

  @Get('datapoints/definitions')
  definitions(@Query('product', new ParseEnumPipe(Product)) product: Product) {
    return this.datapoints.definitions(product);
  }

  @Get('leads/:leadId/datapoints')
  @UseGuards(AnonymousSessionGuard)
  values(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.datapoints.values(leadId);
  }

  @Put('leads/:leadId/datapoints')
  @UseGuards(AnonymousSessionGuard)
  upsert(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: UpsertDatapointDto,
  ) {
    return this.datapoints.upsert(leadId, dto);
  }

  @Get('leads/:leadId/completeness')
  @UseGuards(AnonymousSessionGuard)
  completeness(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query() query: CompletenessQueryDto,
  ) {
    return this.datapoints.completenessForSelected(leadId, query.product);
  }
}
