import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerPoint, CustomerPointType } from './entities/customer-point.entity';
import { CreateCustomerPointDto } from './dto/create-customer-point.dto';
import { Employee } from 'src/employee/entities/employee.entity';
import * as ExcelJS from 'exceljs';



@Injectable()
export class CustomerPointsService {

  constructor(
    @InjectRepository(CustomerPoint)
    private pointRepo: Repository<CustomerPoint>,


    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) { }

  async addPoint(dto: CreateCustomerPointDto) {
    const employee = await this.employeeRepo.findOneBy({ id: dto.employeeId });
    if (!employee) throw new NotFoundException('Employee not found');

    const p = this.pointRepo.create({
      points: dto.points,
      type: dto.type,
      employee,
    });

    return this.pointRepo.save(p);
  }


  async getEmployeePointsPaginated(
    employeeId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    // جلب البيانات المصفحة
    const [records, count] = await this.pointRepo.findAndCount({
      where: { employee: { id: employeeId } },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // حساب مجموع النقاط لجميع السجلات للموظف باستخدام استعلام SUM
    const totalPointsRow = await this.pointRepo
      .createQueryBuilder('p')
      .select(`
      SUM(
        CASE
          WHEN p.type = '${CustomerPointType.ADD}' THEN p.points
          WHEN p.type = '${CustomerPointType.SUBTRACT}' THEN -p.points
          ELSE 0
        END
      )`, 'total')
      .where('p.employeeId = :id', { id: employeeId })
      .getRawOne();

    const totalPoints = Number(totalPointsRow?.total || 0);

    return {
      page,
      limit,
      totalRecords: count,
      lastPage: Math.ceil(count / limit),
      totalPoints,
      records,
    };
  }



  async exportExcel(ids: number[]) {
    // 1) جلب البيانات
    const records = await this.pointRepo.find({
      where: { id: In(ids) },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    // 2) إنشاء ملف Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Havana System';

    const sheet = workbook.addWorksheet('Customer Points', {
      views: [{ rightToLeft: true }],   // 👈 دعم RTL
    });

    // 3) عنوان الجدول
    sheet.addRow([]);
    const titleRow = sheet.addRow(['سجل النقاط للموظفين']);
    titleRow.font = { bold: true, size: 16 };
    sheet.mergeCells('A2:E2');
    titleRow.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // 4) رؤوس الأعمدة
    sheet.addRow([
      'رقم السجل',
      'اسم الموظف',
      'اسم المستخدم',
      'النقاط',
      'نوع العملية',
      'التاريخ',
    ]);

    const header = sheet.getRow(sheet.lastRow.number);
    header.font = { bold: true, size: 12 };
    header.alignment = { horizontal: 'center' };

    // 5) تعبئة البيانات
    records.forEach((rec) => {
      sheet.addRow([
        rec.id,
        rec.employee?.name || '',
        rec.employee?.username || '',
        rec.points,
        rec.type === 'ADD' ? 'إضافة' : 'خصم',
        rec.createdAt.toLocaleString('ar-EG', {
          hour12: true,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      ]);
    });

    // 6) تنسيق الأعمدة
    sheet.columns = [
      { width: 15 }, // id
      { width: 20 }, // employee name
      { width: 20 }, // employee username
      { width: 10 }, // points
      { width: 15 }, // type
      { width: 25 }, // date
    ];

    // 7) إخراج الملف Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }




  async deleteOne(id: number) {
    const point = await this.pointRepo.findOneBy({ id });
    if (!point) throw new NotFoundException('Point record not found');

    await this.pointRepo.delete(id);
    return { message: 'Record deleted successfully', id };
  }

  async deleteBulk(ids: number[]) {
    if (!ids || ids.length === 0) return { message: 'No IDs provided' };

    await this.pointRepo.delete(ids);

    return { message: 'Bulk deletion completed', deletedIds: ids };
  }



}
