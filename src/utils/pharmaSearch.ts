/**
 * محرك البحث الصيدلاني فائق السرعة والمتزامن (Ultra-Fast Concurrent Pharmacy Search Engine)
 * يدعم البحث المتزامن بالاسم التجاري (عربي / إنجليزي)، المادة الفعالة (عربي / إنجليزي)، والباركود
 * مع تطبيع الحروف العربية وتصحيح الأخطاء الإملائية والترتيب حسب الصلة.
 */

import { Product, Ingredient, Category, Manufacturer } from '../types/pharmacy';

/**
 * تطبيع النصوص العربية وإزالة التشكيل وتوحيد الحروف المتشابهة
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // إزالة التشكيل والتنوين
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // إزالة التطويل والكشيدة
    .replace(/\u0640/g, '')
    // توحيد جميع أشكال الألف (أ، إ، آ، ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // توحيد التاء المربوطة والهاء (ة -> ه)
    .replace(/ة/g, 'ه')
    // توحيد الألف المقصورة والياء (ى -> ي)
    .replace(/ى/g, 'ي')
    // تحويل للأحرف الصغيرة (للإنجليزية المختلطة)
    .toLowerCase()
    .trim();
}

/**
 * تطبيع نص البحث العام (عربي + إنجليزي)
 */
export function normalizeSearchQuery(text: string): string {
  if (!text) return '';
  return normalizeArabicText(text)
    // استبدال الرموز وعلامات الترقيم بمسافات
    .replace(/[-_.,/\\()[\]{}|:;+*]/g, ' ')
    // إزالة المسافات المتكررة
    .replace(/\s+/g, ' ')
    .trim();
}

export interface IndexedIngredient {
  id: string;
  nameAr: string;
  nameEn: string;
  normNameAr: string;
  normNameEn: string;
}

export interface IndexedProduct {
  product: Product;
  normNameAr: string;
  normNameEn: string;
  normBarcode: string;
  cleanBarcode: string;
  unitBarcodes: string[];
  ingredients: IndexedIngredient[];
  normIngredientsAr: string;
  normIngredientsEn: string;
  normManufacturer: string;
  normCountry: string;
  normCategory: string;
  normNotes: string;
  // فهرس موحد مسبق التجهيز للبحث السريع
  fullSearchIndex: string;
}

export type SearchMode = 'all' | 'trade' | 'ingredient' | 'barcode';

export interface SearchMatchDetails {
  matchedInTradeAr: boolean;
  matchedInTradeEn: boolean;
  matchedInIngredient: boolean;
  matchedIngredientNames: string[]; // أسماء المواد الفعالة التي تطابقت
  matchedInBarcode: boolean;
  matchScore: number;
}

export interface SearchResultItem {
  product: Product;
  matchDetails: SearchMatchDetails;
}

export interface SearchResult {
  items: SearchResultItem[];
  totalMatches: number;
  searchDurationMs: number;
}

/**
 * بناء فهرس البحث المسبق في الذاكرة (In-Memory Search Index)
 * يتم استدعاؤه مرة واحدة عند تحديث قائمة الأصناف أو المواد الفعالة
 */
export function buildPharmacySearchIndex(
  products: Product[],
  ingredients: Ingredient[],
  categories: Category[],
  manufacturers: Manufacturer[]
): IndexedProduct[] {
  const ingMap = new Map<string, IndexedIngredient>();
  for (const ing of ingredients) {
    ingMap.set(ing.id, {
      id: ing.id,
      nameAr: ing.nameAr,
      nameEn: ing.nameEn,
      normNameAr: normalizeArabicText(ing.nameAr),
      normNameEn: normalizeArabicText(ing.nameEn),
    });
  }

  const catMap = new Map(categories.map(c => [c.id, normalizeArabicText(c.name)]));
  const mfrMap = new Map(manufacturers.map(m => [m.id, {
    name: normalizeArabicText(m.name),
    country: normalizeArabicText(m.country),
  }]));

  return products.map(product => {
    const normNameAr = normalizeArabicText(product.nameAr);
    const normNameEn = normalizeArabicText(product.nameEn);
    const normBarcode = (product.barcode || '').trim().toLowerCase();
    const cleanBarcode = normBarcode.replace(/^0+/, '');
    const unitBarcodes = (product.units || [])
      .map(u => (u.barcode || '').trim().toLowerCase())
      .filter(Boolean);

    const productIngs: IndexedIngredient[] = [];
    if (product.ingredientIds && product.ingredientIds.length > 0) {
      for (const id of product.ingredientIds) {
        const found = ingMap.get(id);
        if (found) {
          productIngs.push(found);
        }
      }
    }

    const normIngredientsAr = productIngs.map(i => i.normNameAr).join(' ');
    const normIngredientsEn = productIngs.map(i => i.normNameEn).join(' ');
    const mfrData = mfrMap.get(product.manufacturerId);
    const normManufacturer = mfrData?.name || '';
    const normCountry = mfrData?.country || '';
    const normCategory = catMap.get(product.categoryId) || '';
    const normNotes = normalizeArabicText(product.notes || '');

    // جمع كل الكلمات المفتاحية في فهرس موحد
    const fullSearchIndex = [
      normNameAr,
      normNameEn,
      normBarcode,
      cleanBarcode,
      normIngredientsAr,
      normIngredientsEn,
      normManufacturer,
      normCategory,
      normNotes,
    ].join(' ');

    return {
      product,
      normNameAr,
      normNameEn,
      normBarcode,
      cleanBarcode,
      unitBarcodes,
      ingredients: productIngs,
      normIngredientsAr,
      normIngredientsEn,
      normManufacturer,
      normCountry,
      normCategory,
      normNotes,
      fullSearchIndex,
    };
  });
}

/**
 * تنفيذ البحث المتزامن وفائق السرعة
 */
export function executePharmacySearch(
  indexedProducts: IndexedProduct[],
  rawQuery: string,
  options?: {
    mode?: SearchMode;
    categoryId?: string;
    manufacturerId?: string;
    country?: string;
    onlyLowStock?: boolean;
    limit?: number;
  }
): SearchResult {
  const startTime = performance.now();
  const query = normalizeSearchQuery(rawQuery);
  const mode = options?.mode || 'all';

  if (!query) {
    // تصفية حسب الفلاتر الجانبية فقط بدون نص بحث
    const filtered: SearchResultItem[] = [];
    for (const item of indexedProducts) {
      if (options?.categoryId && item.product.categoryId !== options.categoryId) continue;
      if (options?.manufacturerId && item.product.manufacturerId !== options.manufacturerId) continue;
      if (options?.country && item.normCountry !== normalizeArabicText(options.country)) continue;
      if (options?.onlyLowStock && item.product.stock > (item.product.minStock ?? 5)) continue;

      filtered.push({
        product: item.product,
        matchDetails: {
          matchedInTradeAr: false,
          matchedInTradeEn: false,
          matchedInIngredient: false,
          matchedIngredientNames: [],
          matchedInBarcode: false,
          matchScore: 0,
        },
      });
      if (options?.limit && filtered.length >= options.limit) break;
    }

    const duration = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      items: filtered,
      totalMatches: filtered.length,
      searchDurationMs: duration,
    };
  }

  // تقسيم استعلام البحث إلى كلمات مفردة لمطابقة الأجزاء
  const tokens = query.split(/\s+/).filter(Boolean);
  const results: SearchResultItem[] = [];

  for (const item of indexedProducts) {
    // 1. الفلاتر الأساسية
    if (options?.categoryId && item.product.categoryId !== options.categoryId) continue;
    if (options?.manufacturerId && item.product.manufacturerId !== options.manufacturerId) continue;
    if (options?.country && item.normCountry !== normalizeArabicText(options.country)) continue;
    if (options?.onlyLowStock && item.product.stock > (item.product.minStock ?? 5)) continue;

    // 2. فحص المطابقة حسب النمط
    let matchedInTradeAr = false;
    let matchedInTradeEn = false;
    let matchedInIngredient = false;
    let matchedInBarcode = false;
    const matchedIngredientNames: string[] = [];
    let score = 0;

    // مطابقة تامة للباركود (أولوية قصوى)
    if (mode === 'all' || mode === 'barcode') {
      const qLower = query.toLowerCase();
      const qClean = qLower.replace(/^0+/, '');
      if (item.normBarcode === qLower || (qClean && item.cleanBarcode === qClean) || item.unitBarcodes?.includes(qLower)) {
        matchedInBarcode = true;
        score += 200;
      } else if (item.normBarcode.includes(qLower) || item.unitBarcodes?.some(b => b.includes(qLower))) {
        matchedInBarcode = true;
        score += 80;
      }
    }

    // مطابقة الاسم التجاري (عربي / إنجليزي)
    if (mode === 'all' || mode === 'trade') {
      // فحص كامل الاستعلام أو كلماته
      if (item.normNameAr.includes(query)) {
        matchedInTradeAr = true;
        score += item.normNameAr.startsWith(query) ? 120 : 90;
      }
      if (item.normNameEn.includes(query)) {
        matchedInTradeEn = true;
        score += item.normNameEn.startsWith(query) ? 120 : 90;
      }
    }

    // مطابقة المادة الفعالة (عربي / إنجليزي)
    if (mode === 'all' || mode === 'ingredient') {
      for (const ing of item.ingredients) {
        let ingMatch = false;
        if (ing.normNameAr.includes(query)) {
          ingMatch = true;
          score += ing.normNameAr.startsWith(query) ? 110 : 85;
        } else if (ing.normNameEn.includes(query)) {
          ingMatch = true;
          score += ing.normNameEn.startsWith(query) ? 110 : 85;
        }

        if (ingMatch) {
          matchedInIngredient = true;
          const displayLabel = `${ing.nameAr}${ing.nameEn && ing.nameEn !== ing.nameAr ? ` (${ing.nameEn})` : ''}`;
          if (!matchedIngredientNames.includes(displayLabel)) {
            matchedIngredientNames.push(displayLabel);
          }
        }
      }
    }

    // مطابقة متعددة الأجزاء (Multi-Token Matching): مثلاً "اكامول 500" أو "paracetamol بانادول"
    let allTokensMatched = true;
    if (!matchedInTradeAr && !matchedInTradeEn && !matchedInIngredient && !matchedInBarcode) {
      if (tokens.length > 1 && mode === 'all') {
        for (const token of tokens) {
          const inTrade = item.normNameAr.includes(token) || item.normNameEn.includes(token);
          let inIng = false;
          for (const ing of item.ingredients) {
            if (ing.normNameAr.includes(token) || ing.normNameEn.includes(token)) {
              inIng = true;
              const displayLabel = `${ing.nameAr}${ing.nameEn && ing.nameEn !== ing.nameAr ? ` (${ing.nameEn})` : ''}`;
              if (!matchedIngredientNames.includes(displayLabel)) {
                matchedIngredientNames.push(displayLabel);
              }
            }
          }
          const inBarcode = item.normBarcode.includes(token);
          const inNotes = item.normNotes.includes(token);

          if (inTrade) {
            matchedInTradeAr = true;
            score += 40;
          }
          if (inIng) {
            matchedInIngredient = true;
            score += 40;
          }
          if (inBarcode) {
            matchedInBarcode = true;
            score += 40;
          }

          if (!inTrade && !inIng && !inBarcode && !inNotes) {
            allTokensMatched = false;
            break;
          }
        }
      } else {
        allTokensMatched = false;
      }
    }

    const isMatch = (matchedInTradeAr || matchedInTradeEn || matchedInIngredient || matchedInBarcode) && allTokensMatched;

    if (isMatch) {
      // بونص إضافي للأصناف المتوفرة في المخزون
      if (item.product.stock > 0) {
        score += 15;
      }

      results.push({
        product: item.product,
        matchDetails: {
          matchedInTradeAr,
          matchedInTradeEn,
          matchedInIngredient,
          matchedIngredientNames,
          matchedInBarcode,
          matchScore: score,
        },
      });
    }
  }

  // فرز النتائج حسب درجة الصلة (Relevance Score) تنازلياً
  results.sort((a, b) => b.matchDetails.matchScore - a.matchDetails.matchScore);

  const finalItems = options?.limit ? results.slice(0, options.limit) : results;
  const duration = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    items: finalItems,
    totalMatches: results.length,
    searchDurationMs: duration,
  };
}
