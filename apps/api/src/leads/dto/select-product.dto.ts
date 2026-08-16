import { Product } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

export class SelectProductDto {
  @IsEnum(Product)
  @IsIn([Product.AUTO, Product.HOME, Product.AUTO_HOME])
  product!: Extract<Product, 'AUTO' | 'HOME' | 'AUTO_HOME'>;
}
