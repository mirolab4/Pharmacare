import { ProductUnit } from '../types/pharmacy';

/**
 * دالة مساعدة لحساب شجرة الوحدات وتقسيم الأسعار تلقائياً:
 * - إذا أدخل المستخدم سعراً مخصصاً لأي وحدة (مثل الحبة أو الشريط)، يتم اعتماده (isCustomPrice = true).
 * - إذا لم يُكتب السعر أو كان صفراً، يتم تقسيمه تلقائياً من الوحدة الأكبر الحاوية لها (مثل العلبة -> الشريط -> الحبة)،
 *   أو اعتماده من آخر سعر بيع.
 */
export function recalculateUnitHierarchyPrices(
  units: ProductUnit[],
  changedUnitId?: string,
  newSalePrice?: number,
  newCostPrice?: number,
  lastSalePriceFallback?: number
): ProductUnit[] {
  if (!units || units.length === 0) return [];

  // Create mutable copy
  const updatedUnits = units.map(u => ({ ...u }));

  // If a specific unit's price was changed directly
  if (changedUnitId) {
    const target = updatedUnits.find(u => u.id === changedUnitId);
    if (target) {
      if (newSalePrice !== undefined && newSalePrice > 0) {
        target.salePrice = newSalePrice;
        target.isCustomPrice = true;
      }
      if (newCostPrice !== undefined && newCostPrice > 0) {
        target.costPrice = newCostPrice;
      }
    }
  }

  // Find the top-most parent unit (the largest unit, e.g. علبة, which has no parentUnitId or highest factor)
  // Or sort from largest factor to smallest factor to cascade down
  const sortedDesc = [...updatedUnits].sort((a, b) => b.factor - a.factor);

  for (const parent of sortedDesc) {
    // Find all children units whose parentUnitId is this unit
    const children = updatedUnits.filter(u => u.parentUnitId === parent.id);

    for (const child of children) {
      // Determine how many child units are inside this parent
      const containsCount = child.containsQty && child.containsQty > 0 
        ? child.containsQty 
        : (parent.factor / (child.factor || 1));

      if (containsCount > 0) {
        // Cascade cost price down automatically
        if (parent.costPrice > 0 && (!child.costPrice || child.costPrice === 0 || changedUnitId === parent.id)) {
          child.costPrice = Math.round((parent.costPrice / containsCount) * 100) / 100;
        }

        // Cascade sale price down if child has no custom price or was 0
        if (!child.isCustomPrice || child.salePrice === 0 || !child.salePrice) {
          if (parent.salePrice > 0) {
            child.salePrice = Math.round((parent.salePrice / containsCount) * 100) / 100;
          } else if (lastSalePriceFallback && lastSalePriceFallback > 0) {
            child.salePrice = Math.round((lastSalePriceFallback / (parent.factor / child.factor)) * 100) / 100;
          }
        }
      }
    }
  }

  // Fallback for any unit that still has 0 price: use base unit or fallback
  for (const u of updatedUnits) {
    if ((!u.salePrice || u.salePrice === 0) && lastSalePriceFallback) {
      u.salePrice = Math.round((lastSalePriceFallback * u.factor) * 100) / 100;
    }
  }

  return updatedUnits;
}

/**
 * حساب إجمالي عدد الوحدات الأساسية المتوفرة
 */
export function formatStockInAllUnits(stockInBaseUnit: number, units: ProductUnit[]): string {
  if (!units || units.length === 0) return `${stockInBaseUnit}`;

  // Sort from largest to smallest factor
  const sorted = [...units].sort((a, b) => b.factor - a.factor);
  const parts: string[] = [];
  let remaining = stockInBaseUnit;

  for (const u of sorted) {
    if (u.factor > 1 && remaining >= u.factor) {
      const count = Math.floor(remaining / u.factor);
      parts.push(`${count} ${u.name}`);
      remaining = remaining % u.factor;
    }
  }

  if (remaining > 0 || parts.length === 0) {
    const base = sorted.find(u => u.isBaseUnit || u.factor === 1) || sorted[sorted.length - 1];
    parts.push(`${remaining} ${base.name}`);
  }

  return parts.join(' و ');
}
