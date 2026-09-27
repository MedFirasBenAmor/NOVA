import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EntityRelationType,
  EntityType,
  type DossierEntity,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

type RelationEntity = Pick<
  DossierEntity,
  'id' | 'customerFolderId' | 'entityType' | 'ordinal'
>;

@Injectable()
export class EntityRelationService {
  constructor(private readonly prisma: PrismaService) {}

  async assignPrimaryDriver(vehicleId: string, driverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { vehicle, driver } = await this.validateDriverVehicle(
        tx,
        vehicleId,
        driverId,
      );
      const existing = await tx.entityRelation.findFirst({
        where: {
          customerFolderId: vehicle.customerFolderId,
          fromEntityId: driver.id,
          toEntityId: vehicle.id,
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        },
      });
      if (existing) return existing;
      await tx.entityRelation.deleteMany({
        where: {
          customerFolderId: vehicle.customerFolderId,
          toEntityId: vehicle.id,
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        },
      });
      return tx.entityRelation.create({
        data: {
          customerFolderId: vehicle.customerFolderId,
          fromEntityId: driver.id,
          toEntityId: vehicle.id,
          relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
        },
      });
    });
  }

  async addOccasionalDriver(vehicleId: string, driverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { vehicle, driver } = await this.validateDriverVehicle(
        tx,
        vehicleId,
        driverId,
      );
      return tx.entityRelation.upsert({
        where: {
          customerFolderId_fromEntityId_toEntityId_relationType: {
            customerFolderId: vehicle.customerFolderId,
            fromEntityId: driver.id,
            toEntityId: vehicle.id,
            relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
          },
        },
        update: {},
        create: {
          customerFolderId: vehicle.customerFolderId,
          fromEntityId: driver.id,
          toEntityId: vehicle.id,
          relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
        },
      });
    });
  }

  async removeOccasionalDriver(vehicleId: string, driverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { vehicle, driver } = await this.validateDriverVehicle(
        tx,
        vehicleId,
        driverId,
      );
      await tx.entityRelation.deleteMany({
        where: {
          customerFolderId: vehicle.customerFolderId,
          fromEntityId: driver.id,
          toEntityId: vehicle.id,
          relationType: EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
        },
      });
    });
  }

  async primaryDriverForVehicle(vehicleId: string) {
    return this.prisma.entityRelation.findFirst({
      where: {
        toEntityId: vehicleId,
        relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
      },
      include: { fromEntity: true },
    });
  }

  async driversForVehicle(vehicleId: string) {
    return this.prisma.entityRelation.findMany({
      where: {
        toEntityId: vehicleId,
        relationType: {
          in: [
            EntityRelationType.DRIVER_VEHICLE_PRIMARY,
            EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
          ],
        },
      },
      include: { fromEntity: true },
      orderBy: [{ relationType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async vehiclesForDriver(driverId: string) {
    return this.prisma.entityRelation.findMany({
      where: {
        fromEntityId: driverId,
        relationType: {
          in: [
            EntityRelationType.DRIVER_VEHICLE_PRIMARY,
            EntityRelationType.DRIVER_VEHICLE_OCCASIONAL,
          ],
        },
      },
      include: { toEntity: true },
      orderBy: [{ relationType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async validateDriverVehicle(
    db: Db,
    vehicleId: string,
    driverId: string,
  ) {
    const [vehicle, driver] = await Promise.all([
      this.entity(db, vehicleId),
      this.entity(db, driverId),
    ]);
    if (vehicle.entityType !== EntityType.VEHICLE) {
      throw new BadRequestException('Vehicle entity must be VEHICLE');
    }
    if (driver.entityType !== EntityType.DRIVER) {
      throw new BadRequestException('Driver entity must be DRIVER');
    }
    if (vehicle.customerFolderId !== driver.customerFolderId) {
      throw new BadRequestException('Entities must belong to the same lead');
    }
    return { vehicle, driver };
  }

  private async entity(db: Db, id: string): Promise<RelationEntity> {
    const entity = await db.dossierEntity.findUnique({
      where: { id },
      select: {
        id: true,
        customerFolderId: true,
        entityType: true,
        ordinal: true,
      },
    });
    if (!entity) throw new BadRequestException('Entity not found');
    return entity;
  }
}
