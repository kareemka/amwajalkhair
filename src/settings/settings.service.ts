import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) { }

  async getSettings(): Promise<Setting> {
    const settings = await this.settingRepo.findOne({ where: { id: 1 } });

    if (!settings) {
      // إنشاء سجل واحد لأول مرة
      const newSettings = this.settingRepo.create({ deliveryPrice: 0 });
      return this.settingRepo.save(newSettings);
    }

    return settings;
  }

  async updateSettings(dto: UpdateSettingDto): Promise<Setting> {
    const settings = await this.getSettings();

    settings.deliveryPrice = dto.deliveryPrice;

    return this.settingRepo.save(settings);
  }


}
