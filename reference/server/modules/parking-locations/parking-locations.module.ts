import { Module } from '@nestjs/common';
import { ParkingLocationsController } from './parking-locations.controller';
import { ParkingLocationsService } from './parking-locations.service';

@Module({
  controllers: [ParkingLocationsController],
  providers: [ParkingLocationsService],
})
export class ParkingLocationsModule {}
