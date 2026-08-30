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

    @Post('v2/push/update-status')
    async handleWebhook(@Body() payload: any, @Headers() allHeaders: any) {
        const { token, system_code, updates } = payload;

        // Extract token from header if exists (remove 'Bearer ')
        const authHeader = allHeaders['authorization'];
        const headerToken = authHeader?.replace('Bearer ', '').trim();

        // The effective token can come from header, 'token' field, or 'system_code' field
        const receivedToken = headerToken || token || system_code;

        // Allowed tokens: new strong secret OR old system code
        const allowedTokens = [
            process.env.JENNI_WEBHOOK_SECRET,
            process.env.JENNI_SYSTEM_CODE
        ].filter(Boolean);

        if (!allowedTokens.includes(receivedToken)) {
            this.logger.error(`Unauthorized access attempt to Jenni webhook. Received Token: ${receivedToken}`);
            throw new UnauthorizedException('Invalid or missing security token');
        }

        this.logger.log(`Received Jenni webhook updates: ${updates?.length || 0}`);

        if (!updates || !Array.isArray(updates)) {
            return { success: false, message: 'Invalid payload' };
        }

        for (const update of updates) {
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
                treated_message
            } = update;

            const newStatus = this.jenniService.mapJenniStatus(action_code);

            if (newStatus === 'SKIPPED') {
                continue;
            }

            if (newStatus) {
                const message = [
                    action_name_ar || action_name,
                    current_step_ar || current_step,
                    postponed_reason,
                    return_reason,
                    treated_message
                ].filter(Boolean).join(' - ');

                this.logger.log(`Mapping Jenni shipment ${shipment_number} to Havana status ${newStatus} (${message})`);

                try {
                    // Extract numerical identifier (handling prefixes like 'HAV-', 'TEST-', etc.)
                    const rawIdentifier = update.shipment_number;
                    const orderIdentifier: number = parseInt(rawIdentifier.toString().replace(/\D/g, ''));

                    if (!isNaN(orderIdentifier)) {
                        await this.orderService.updateOrderStatusByOrderNumber(orderIdentifier, newStatus, `Jenni: ${message}`);
                    }
                } catch (error: any) {
                    this.logger.error(`Failed to update order status for ${shipment_number}: ${error.message}`);
                }
            } else {
                this.logger.warn(`Unknown action code from Jenni: ${action_code}`);
            }
        }

        return {
            success: true,
            message: `Successfully processed ${updates.length} update(s)`,
            received_count: updates.length
        };
    }
}
