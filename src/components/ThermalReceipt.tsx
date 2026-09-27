import React from 'react';
import { Invoice, Settings } from '../types/pharmacy';

interface ThermalReceiptProps {
  invoice: Invoice | null;
  settings: Settings;
  onClose?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ invoice, settings, onClose }) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(invoice.date).toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between border-b bg-slate-100 px-4 py-3 text-slate-800">
          <span className="font-bold text-sm">معاينة إيصال حراري (58mm)</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700"
            >
              طباعة الآن 🖨️
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>

        {/* Printable thermal receipt view */}
        <div className="overflow-y-auto p-4 flex justify-center bg-slate-200">
          <div
            id="printable-receipt"
            className="w-[280px] bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-md border border-slate-300"
            dir="rtl"
          >
            {/* Pharmacy Header */}
            <div className="text-center pb-2 border-b border-dashed border-black">
              <div className="text-sm font-black tracking-wide">{settings.pharmacyName}</div>
              <div className="text-[10px] text-gray-700">{settings.address}</div>
              <div className="text-[10px] text-gray-700">هاتف: {settings.phone}</div>
              {settings.taxNumber && (
                <div className="text-[9px] text-gray-600">الرقم الضريبي: {settings.taxNumber}</div>
              )}
            </div>

            {/* Invoice Meta */}
            <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>رقم الفاتورة:</span>
                <span className="font-bold">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ والوقت:</span>
                <span>{formattedDate}</span>
              </div>
              {invoice.customerName && (
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-semibold">{invoice.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>طريقة الدفع:</span>
                <span className="font-semibold">
                  {invoice.paymentMethod === 'cash' && 'نقداً'}
                  {invoice.paymentMethod === 'card' && 'بطاقة دفع'}
                  {invoice.paymentMethod === 'bank' && (invoice.bankName || 'بنك / محفظة')}
                  {invoice.paymentMethod === 'credit' && 'آجل (ذمة حساب)'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-black">
              <div className="grid grid-cols-12 font-bold pb-1 text-[10px] border-b border-black">
                <div className="col-span-6 text-right">الصنف / الوحدة</div>
                <div className="col-span-2 text-center">الكمية</div>
                <div className="col-span-2 text-left">السعر</div>
                <div className="col-span-2 text-left">الإجمالي</div>
              </div>

              <div className="divide-y divide-gray-200 pt-1">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="py-1 text-[10px]">
                    <div className="font-bold text-gray-900">{item.productName}</div>
                    <div className="grid grid-cols-12 text-gray-700 text-[9px]">
                      <div className="col-span-6 text-right text-gray-600">[{item.unitName}]</div>
                      <div className="col-span-2 text-center font-semibold">{item.quantity}</div>
                      <div className="col-span-2 text-left">{item.salePrice.toFixed(2)}</div>
                      <div className="col-span-2 text-left font-bold text-black">{item.total.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{invoice.subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-black">
                  <span>الخصم:</span>
                  <span>- {invoice.discountAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}

              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>الضريبة ({invoice.taxRate}%):</span>
                  <span>+ {invoice.taxAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-black pt-1 border-t border-black">
                <span>الإجمالي النهائي:</span>
                <span>{invoice.totalAmount.toFixed(2)} {settings.currency}</span>
              </div>

              {invoice.paymentMethod === 'credit' ? (
                <>
                  <div className="flex justify-between">
                    <span>المدفوع نقداً:</span>
                    <span>{invoice.paidAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>المتبقي على الحساب:</span>
                    <span>{invoice.remainingAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>المبلغ المسدد:</span>
                  <span>{invoice.paidAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-3 space-y-1">
              {/* Monospace Simulated Barcode Lines */}
              <div className="flex justify-center items-center gap-[2px] h-8 py-1">
                {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 4, 1, 2, 1, 3, 2].map((w, i) => (
                  <span
                    key={i}
                    className="bg-black inline-block h-full"
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
              <div className="text-[9px] tracking-widest font-mono font-bold">{invoice.invoiceNumber}</div>
              <div className="text-[10px] text-gray-800 pt-1 font-sans">{settings.receiptFooterMessage}</div>
              <div className="text-[8px] text-gray-500 pt-0.5">نظام فارماكير بلس لإدارة الصيدليات - Offline POS</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
