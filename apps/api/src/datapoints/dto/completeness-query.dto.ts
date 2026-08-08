import { Product } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class CompletenessQueryDto {
  @IsOptional()
  @IsEnum(Product)
  product: Product = Product.AUTO;
}
