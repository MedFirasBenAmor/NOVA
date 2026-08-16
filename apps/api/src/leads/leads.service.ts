import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { AnonymousSessionService } from '../auth/anonymous-session.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from '../datapoints/requirement-profile.service';
import { CollectionStrategyService } from '../collection/collection-strategy.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AnonymousSessionService,
    private readonly profiles: RequirementProfileService,
    private readonly strategy: CollectionStrategyService,
  ) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        source: dto.source,
        folder: { create: {} },
        conversations: { create: {} },
      },
      include: { folder: true, conversations: true },
    });
    const session = await this.sessions.create(lead.id);
    return {
      ...lead,
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async selectProduct(leadId: string, product: SelectedProduct) {
    const selectedProduct = await this.profiles.selectForLead(leadId, product);
    return {
      selectedProduct,
      profile: await this.profiles.forProduct(selectedProduct),
      nextAction: await this.strategy.selectForLead(leadId),
    };
  }
}
