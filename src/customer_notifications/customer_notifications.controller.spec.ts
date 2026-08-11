import { Test, TestingModule } from '@nestjs/testing';
import { CustomerNotificationsController } from './customer_notifications.controller';
import { CustomerNotificationsService } from './customer_notifications.service';

describe('CustomerNotificationsController', () => {
  let controller: CustomerNotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerNotificationsController],
      providers: [CustomerNotificationsService],
    }).compile();

    controller = module.get<CustomerNotificationsController>(CustomerNotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
