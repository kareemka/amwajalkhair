import { OrderStatus } from './order-status.enum';

export function getOrderNotificationMessage(status: OrderStatus): string {
    switch (status) {
        case OrderStatus.UNCONFIRMED:
            return 'تم تسجيل الطلب وهو بانتظار التأكيد';

        case OrderStatus.REJECTED:
            return 'تم رفض الطلب';

        case OrderStatus.PROCESSING:
            return 'الطلب تبليغ أو معالجة';

        case OrderStatus.DELIVERING:
            return 'الطلب قيد التوصيل';

        case OrderStatus.DELIVERED:
            return 'تم تسليم الطلب بنجاح';

        case OrderStatus.RETURNED:
            return 'تم إرجاع الطلب';

        case OrderStatus.ARCHIVED_RETURNED:
            return 'تم أرشفة الطلب الراجع';

        case OrderStatus.ARCHIVED_DELIVERED:
            return 'تم أرشفة الطلب المسلم';

        default:
            return 'تم تحديث حالة الطلب';
    }
}
