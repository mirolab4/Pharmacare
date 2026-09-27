/**
 * مولد رسائل الفواتير الإلكترونية عبر واتساب (WhatsApp e-Receipt)
 */

import { Invoice, Settings } from '../types/pharmacy';

export function formatWhatsAppInvoiceText(invoice: Invoice, settings: Settings): string {
  const currency = settings.currency || '₪';
  const pharmacyName = settings.pharmacyName || 'فارماكير بلس';
  const dateStr = new Date(invoice.date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const header = `🏥 *${pharmacyName}*\n🧾 *فاتورة مبيعات رقم:* ${invoice.invoiceNumber}\n📅 *التاريخ:* ${dateStr}\n`;
  const customerInfo = invoice.customerName ? `👤 *العميل:* ${invoice.customerName}\n` : '';

  const divider = `----------------------------------\n`;
  const itemsHeader = `💊 *تفاصيل الأصناف:*\n`;

  const itemsList = invoice.items.map((item, idx) => {
    return `${idx + 1}. *${item.productName}*\n   الكمية: ${item.quantity} ${item.unitName} × ${item.salePrice.toFixed(2)} = *${item.total.toFixed(2)} ${currency}*`;
  }).join('\n');

  let financialDetails = `\n` + divider;
  financialDetails += `المجموع الفرعي: ${invoice.subtotal.toFixed(2)} ${currency}\n`;
  if (invoice.discountAmount > 0) {
    financialDetails += `الخصم: -${invoice.discountAmount.toFixed(2)} ${currency}\n`;
  }
  if (invoice.taxAmount > 0) {
    financialDetails += `الضريبة (${invoice.taxRate}%): +${invoice.taxAmount.toFixed(2)} ${currency}\n`;
  }
  financialDetails += `💰 *الإجمالي المستحق:* ${invoice.totalAmount.toFixed(2)} ${currency}\n`;
  financialDetails += `💵 *المدفوع:* ${invoice.paidAmount.toFixed(2)} ${currency}\n`;

  if (invoice.remainingAmount > 0) {
    financialDetails += `⚠️ *المتبقي (آجل):* ${invoice.remainingAmount.toFixed(2)} ${currency}\n`;
  }

  const footer = divider + `🙏 *${settings.receiptFooterMessage || settings.receiptFooter || 'شكراً لتعاملكم معنا، ونتمنى لكم دوام الصحة والعافية!'}*\n📞 *للاستفسار:* ${settings.phone || ''}`;

  return header + customerInfo + divider + itemsHeader + itemsList + financialDetails + footer;
}

/**
 * فتح تطبيق الواتساب أو واتساب ويب مع نص الفاتورة ورقم الهاتف
 */
export function sendInvoiceViaWhatsApp(invoice: Invoice, settings: Settings, customerPhone?: string): void {
  const message = formatWhatsAppInvoiceText(invoice, settings);
  const encodedText = encodeURIComponent(message);
  
  // تنظيف رقم الهاتف (إزالة المسافات والشرطات والبادئة الصفرية إذا توفر مفتاح الدولة)
  let cleanPhone = (customerPhone || '').replace(/[^\d+]/g, '');
  if (cleanPhone.startsWith('0')) {
    // استبدال الصفر المحلي ببادئة افتراضية أو تركه إذا كان مدخلاً كاملاً
    cleanPhone = cleanPhone.replace(/^0/, '');
  }

  const url = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}` 
    : `https://wa.me/?text=${encodedText}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
