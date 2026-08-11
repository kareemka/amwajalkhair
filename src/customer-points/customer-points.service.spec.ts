import { Test, TestingModule } from '@nestjs/testing';
import { CustomerPointsService } from './customer-points.service';

describe('CustomerPointsService', () => {
  let service: CustomerPointsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerPointsService],
    }).compile();

    service = module.get<CustomerPointsService>(CustomerPointsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
