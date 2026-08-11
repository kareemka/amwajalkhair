export enum OrderStatus {
    UNCONFIRMED = 'UNCONFIRMED',          // غير مؤكد
    REJECTED = 'REJECTED',          //  مرفوض
    DELIVERING = 'DELIVERING',            // قيد التوصيل
    PROCESSING = 'PROCESSING',            // تبليغ أو معالجة
    RETURNED = 'RETURNED',                // راجع
    DELIVERED = 'DELIVERED',              // تم التسليم
    ARCHIVED_RETURNED = 'ARCHIVED_RETURNED',  // أرشيف راجع
    ARCHIVED_DELIVERED = 'ARCHIVED_DELIVERED', // أرشيف واصل
}
