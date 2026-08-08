import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnswerDatapointDto {
  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
