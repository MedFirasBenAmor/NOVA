import { Product } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import type { SelectedProduct } from '../requirement-profile.service';

export class CompletenessQueryDto {
  @IsOptional()
  @IsEnum(Product)
  @IsIn([Product.AUTO, Product.HOME, Product.AUTO_HOME])
  product: SelectedProduct = Product.AUTO;
}
