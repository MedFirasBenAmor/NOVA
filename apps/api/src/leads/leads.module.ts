import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { CollectionModule } from '../collection/collection.module';

@Module({
  imports: [DatapointsModule, CollectionModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
