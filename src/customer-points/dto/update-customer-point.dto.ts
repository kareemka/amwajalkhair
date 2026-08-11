import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerPointDto } from './create-customer-point.dto';

export class UpdateCustomerPointDto extends PartialType(CreateCustomerPointDto) {}
