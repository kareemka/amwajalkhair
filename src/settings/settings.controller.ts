import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) { }

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateSettingDto) {
    return this.settingsService.updateSettings(dto);
  }
}
