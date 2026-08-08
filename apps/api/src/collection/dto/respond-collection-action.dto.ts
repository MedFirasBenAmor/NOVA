import { IsIn } from 'class-validator';

export class RespondCollectionActionDto {
  @IsIn(['ACCEPTED', 'DECLINED', 'SKIPPED'])
  decision!: 'ACCEPTED' | 'DECLINED' | 'SKIPPED';
}
