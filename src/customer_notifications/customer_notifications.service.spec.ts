import { Test, TestingModule } from '@nestjs/testing';
import { CustomerNotificationsService } from './customer_notifications.service';

describe('CustomerNotificationsService', () => {
  let service: CustomerNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerNotificationsService],
    }).compile();

    service = module.get<CustomerNotificationsService>(CustomerNotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
