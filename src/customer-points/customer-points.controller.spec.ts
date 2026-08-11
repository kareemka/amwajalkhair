import { Test, TestingModule } from '@nestjs/testing';
import { CustomerPointsController } from './customer-points.controller';
import { CustomerPointsService } from './customer-points.service';

describe('CustomerPointsController', () => {
  let controller: CustomerPointsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerPointsController],
      providers: [CustomerPointsService],
    }).compile();

    controller = module.get<CustomerPointsController>(CustomerPointsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
