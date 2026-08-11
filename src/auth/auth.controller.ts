import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateCustomerDto } from 'src/customer/dto/create-customer.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.loginEmployee(dto.username, dto.password);
  }


  @Post('customer-login')
  async customerLogin(@Body() dto: LoginDto) {
    return this.authService.customerLogin(dto.username, dto.password);
  }

  @Post('customer-register')
  async customerRegister(@Body() dto: CreateCustomerDto) {
    return this.authService.customerRegister(dto);
  }
}
