import { Injectable, NotFoundException } from '@nestjs/common';
import { Product, type DatapointDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SelectedProduct = Extract<Product, 'AUTO' | 'HOME' | 'AUTO_HOME'>;

export const SELECTABLE_PRODUCTS: SelectedProduct[] = [
  Product.AUTO,
  Product.HOME,
  Product.AUTO_HOME,
];

@Injectable()
export class RequirementProfileService {
  constructor(private readonly prisma: PrismaService) {}

  productsFor(product: SelectedProduct): Product[] {
    if (product === Product.AUTO) return [Product.COMMON, Product.AUTO];
    if (product === Product.HOME) return [Product.COMMON, Product.HOME];
    return [Product.COMMON, Product.AUTO, Product.HOME];
  }

  isSelectable(product: Product): product is SelectedProduct {
    return SELECTABLE_PRODUCTS.includes(product as SelectedProduct);
  }

  async forProduct(product: SelectedProduct): Promise<DatapointDefinition[]> {
    return this.prisma.datapointDefinition.findMany({
      where: { product: { in: this.productsFor(product) }, active: true },
      orderBy: [{ product: 'asc' }, { category: 'asc' }, { key: 'asc' }],
    });
  }

  async selectedForLead(leadId: string): Promise<SelectedProduct | undefined> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { selectedProduct: true },
    });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    const product = lead.selectedProduct;
    return product && this.isSelectable(product) ? product : undefined;
  }

  async selectForLead(
    leadId: string,
    product: SelectedProduct,
  ): Promise<SelectedProduct> {
    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: { selectedProduct: product },
      select: { selectedProduct: true },
    });
    return lead.selectedProduct as SelectedProduct;
  }
}
