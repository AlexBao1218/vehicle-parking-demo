import { Module } from '@nestjs/common';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

@Module({
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
})
export class ChangeRequestsModule {}