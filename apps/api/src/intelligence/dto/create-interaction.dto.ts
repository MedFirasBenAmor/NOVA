import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { IntelligenceEntityType } from '@nova/shared-types';

const entityTypes: IntelligenceEntityType[] = [
  'CUSTOMER',
  'VEHICLE',
  'DRIVER',
  'PROPERTY',
  'CLAIM',
  'CO_APPLICANT',
  'REQUEST',
];

class CurrentDatapointContextDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsIn(entityTypes)
  entityType!: IntelligenceEntityType;

  @IsOptional()
  @ValidateIf((_, value) => value !== 'ROOT')
  @IsUUID()
  entityId?: string;
}

class EntityContextDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  claimId?: string;

  @IsOptional()
  @IsUUID()
  coApplicantId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CurrentDatapointContextDto)
  currentDatapoint?: CurrentDatapointContextDto;
}

export class CreateInteractionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EntityContextDto)
  entityContext?: EntityContextDto;
}
