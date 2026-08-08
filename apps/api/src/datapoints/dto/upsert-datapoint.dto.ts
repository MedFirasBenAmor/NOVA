import {
  CollectionMethod,
  DatapointStatus,
  EntityType,
  SourceType,
} from '@prisma/client';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpsertDatapointDto {
  @IsString()
  key: string;

  @IsDefined()
  value: unknown;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsEnum(SourceType)
  sourceType: SourceType;

  @IsEnum(CollectionMethod)
  collectionMethod: CollectionMethod;

  @IsOptional()
  @IsString()
  sourceReferenceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsEnum(DatapointStatus)
  status?: DatapointStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
