import { Controller, Post, Body, Logger, Headers, UnauthorizedException } from '@nestjs/common';
import { JenniService } from './jenni.service';
import { OrderService } from '../order/order.service';

@Controller()
export class JenniController {
    private readonly logger = new Logger(JenniController.name);

    constructor(
        private readonly jenniService: JenniService,
        private readonly orderService: OrderService,
    ) { }

    @Post([
        'jenni/webhook/v2/push/update-status',
        'v2/push/update-status',
    ])
    async handleWebhook(@Body() payload: any, @Headers() allHeaders: any) {
        // استخراج التوكن من الـ Authorization Header
        const authHeader = allHeaders['authorization'];
        const receivedToken = authHeader?.replace('Bearer ', '').trim();

        // التوكن الصحيح من البيئة (نفسه المستخدم في API)
        const validToken = process.env.JENNI_WEBHOOK_SECRET;

        // التحقق: يجب أن يكون التوكن موجوداً ومطابقاً
        if (!receivedToken || receivedToken !== validToken) {
            this.logger.error(`Unauthorized webhook attempt. Received Token: ${receivedToken}`);
            throw new UnauthorizedException('Invalid or missing security token');
        }

        this.logger.log(`Received Jenni webhook updates: ${payload?.updates?.length || 0}`);

        if (!payload?.updates || !Array.isArray(payload.updates)) {
            return { success: false, message: 'Invalid payload' };
        }

        // معالجة التحديثات
        for (const update of payload.updates) {
            const {
                shipment_number,
                action_code,
                action_name,
                action_name_ar,
                current_step,
                current_step_ar,
                note,
                postponed_reason,
                return_reason,
                treated_message,
            } = update;

            const newStatus = this.jenniService.mapJenniStatus(action_code);

            if (newStatus === 'SKIPPED') {
                this.logger.log(`Skipping status update for ${shipment_number} (action: ${action_code})`);
                continue;
            }

            if (newStatus) {
                const message = [
                    action_name_ar || action_name,
                    current_step_ar || current_step,
                    postponed_reason,
                    return_reason,
                    treated_message,
                ]
                    .filter(Boolean)
                    .join(' - ');

                this.logger.log(
                    `Mapping Jenni shipment ${shipment_number} to status ${newStatus} (${message})`,
                );

                try {
                    const rawIdentifier = update.shipment_number;
                    const orderIdentifier: number = parseInt(
                        rawIdentifier.toString().replace(/\D/g, ''),
                        10,
                    );

                    if (!isNaN(orderIdentifier)) {
                        await this.orderService.updateOrderStatusByOrderNumber(
                            orderIdentifier,
                            newStatus,
                            `Jenni: ${message}`,
                        );
                    } else {
                        this.logger.warn(
                            `Could not extract numeric ID from shipment_number: ${rawIdentifier}`,
                        );
                    }
                } catch (error: any) {
                    this.logger.error(
                        `Failed to update order status for ${shipment_number}: ${error.message}`,
                    );
                }
            } else {
                this.logger.warn(`Unknown action code from Jenni: ${action_code}`);
            }
        }

        return {
            success: true,
            message: `Successfully processed ${payload.updates.length} update(s)`,
            received_count: payload.updates.length,
        };
    }
}