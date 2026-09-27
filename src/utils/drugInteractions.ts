/**
 * محرك الفحص السريري للتعارضات والتداخلات الدوائية (Clinical Drug-Drug Interactions)
 */

import { Product, Ingredient, InvoiceItem } from '../types/pharmacy';

export interface DrugInteractionAlert {
  id: string;
  drugA: string;
  drugB: string;
  severity: 'danger' | 'warning' | 'duplicate';
  title: string;
  description: string;
  recommendation: string;
}

// قواعد البيانات الطبية للتعارضات
interface InteractionRule {
  keywordsA: string[];
  keywordsB: string[];
  severity: 'danger' | 'warning' | 'duplicate';
  title: string;
  description: string;
  recommendation: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  // 1. تكرار الباراسيتامول (خطر تسمم الكبد)
  {
    keywordsA: ['باراسيتامول', 'paracetamol', 'acetaminophen', 'بانادول', 'panadol', 'ريفانين', 'فيفادول', 'أدول'],
    keywordsB: ['باراسيتامول', 'paracetamol', 'acetaminophen', 'بانادول', 'panadol', 'ريفانين', 'فيفادول', 'أدول'],
    severity: 'duplicate',
    title: 'تكرار علاجي مفرط (باراسيتامول)',
    description: 'يحتوي كلا الصنفين على مادة الباراسيتامول، مما يرفع خطر تجاوز الجرعة القصوى اليومية (4 غرام) ويسبب تسمماً كبدياً حاداً.',
    recommendation: 'اكتفِ بصنف واحد فقط أو نبّه المريض لعدم تناولهما معاً في نفس الفترة.',
  },

  // 2. مضادات الالتهاب غير الستيرويدية معاً (NSAID + NSAID)
  {
    keywordsA: ['إيبوبروفين', 'ibuprofen', 'بروفين', 'ديكلوفيناك', 'diclofenac', 'فولتارين', 'رومافين', 'كتوفان', 'كيتوبروفين', 'نابروكسين', 'naproxen', 'ميلوكسيكام', 'اندوميثاسين'],
    keywordsB: ['إيبوبروفين', 'ibuprofen', 'بروفين', 'ديكلوفيناك', 'diclofenac', 'فولتارين', 'رومافين', 'كتوفان', 'كيتوبروفين', 'نابروكسين', 'naproxen', 'ميلوكسيكام', 'اندوميثاسين'],
    severity: 'danger',
    title: 'تعارض خطير: جمع مسكنين من عائلة NSAIDs',
    description: 'الجمع بين مسكنين من عائلة مضادات الالتهاب غير الستيرويدية يضاعف خطر قرحة المعدة والنزيف المعوي والفشل الكلوي دون أي فائدة تسكينية إضافية.',
    recommendation: 'يجب إلغاء أحد المسكنين والاكتفاء بمسكن واحد، أو استبدال أحدهما بالباراسيتامول.',
  },

  // 3. أسبرين أو وارفارين مع NSAIDs
  {
    keywordsA: ['أسبرين', 'aspirin', 'وارفارين', 'warfarin', 'كومادين', 'بلافيكس', 'كلوبيدوغريل', 'clopidogrel', 'ريفاروكسابان', 'زاريلتو'],
    keywordsB: ['إيبوبروفين', 'ibuprofen', 'ديكلوفيناك', 'diclofenac', 'فولتارين', 'نابروكسين', 'كيتوبروفين'],
    severity: 'danger',
    title: 'خطر نزيف حاد (مميع دم + مسكن NSAID)',
    description: 'تناول مسكنات NSAIDs مع مميعات الدم ومضادات التخثر يرفع بشدة احتمالية حدوث نزيف هضمي أو نزيف داخلي مهدد للحياة.',
    recommendation: 'يُفضل استخدام الباراسيتامول كمسكن آمن لمريض مميعات الدم، أو إضافة واقي معدة (PPI) ومراجعة الطبيب.',
  },

  // 4. أدوية الضغط (ACEi / ARBs) مع مدرات البوتاسيوم
  {
    keywordsA: ['كابتوبريل', 'captopril', 'إينالابريل', 'enalapril', 'راميبريل', 'ramipril', 'لوزارتان', 'losartan', 'فالسارتان', 'valsartan'],
    keywordsB: ['سبيرونولاكتون', 'spironolactone', 'الداكتون', 'بوتاسيوم', 'potassium'],
    severity: 'danger',
    title: 'خطر فرط بوتاسيوم الدم الحاد (Hyperkalemia)',
    description: 'الجمع بين مثبطات ACE أو حاصرات ARBs مع سبيرونولاكتون أو مكملات البوتاسيوم قد يسبب ارتفاعاً خطيراً في بوتاسيوم الدم مما يهدد بنوبات قلبية.',
    recommendation: 'يتطلب فحصاً دورياً لمستوى البوتاسيوم ووظائف الكلى واستشارة الطبيب المعالج.',
  },

  // 5. النترات مع أدوية الضعف الجنسي (PDE5 Inhibitors)
  {
    keywordsA: ['نيتروغليسرين', 'nitroglycerin', 'إيزوسوربيد', 'isosorbide', 'انجيسيد', 'مونوماك'],
    keywordsB: ['سيلدينافيل', 'sildenafil', 'فياجرا', 'viagra', 'تادالافيل', 'tadalafil', 'سياليس', 'cialis', 'فاردينافيل'],
    severity: 'danger',
    title: 'تعارض مميت: نترات القلب مع منشطات PDE5',
    description: 'الجمع بين موسعات الشرايين التاجية (النترات) ومثبطات PDE5 يؤدي إلى هبوط حاد وكارثي في ضغط الدم قد يفضي إلى الوفاة.',
    recommendation: 'ممنوع منعاً باتاً صرفهما معاً ويجب التنبيه الصارم للمريض.',
  },

  // 6. سيبروفلوكساسين / مضادات حيوية مع مضادات الحموضة والكالسيوم
  {
    keywordsA: ['سيبروفلوكساسين', 'ciprofloxacin', 'سيبرو', 'سبرودار', 'ليفوفلوكساسين', 'levofloxacin', 'دوكسيسيكلين', 'doxycycline'],
    keywordsB: ['كالسيوم', 'calcium', 'حديد', 'iron', 'فيروسان', 'مضاد حموضة', 'antacid', 'مالوكس', 'ريني', 'rennie', 'ألومنيوم', 'ماغنيسيوم'],
    severity: 'warning',
    title: 'تثبيط امتصاص المضاد الحيوي (Cheation)',
    description: 'ترتبط المعادن الثنائية والثلاثية (كالسيوم، حديد، ماغنيسيوم) بالمضاد الحيوي وتشكل مركباً غير قابل للامتصاص، مما يفقد المضاد فاعليته بالكامل.',
    recommendation: 'يجب الفصل التام بين جرعة المضاد الحيوي ومكملات الكالسيوم أو مضادات الحموضة بفاصل ساعتين على الأقل قبل أو 4 ساعات بعد.',
  },

  // 7. الستاتين (أدوية الكوليسترول) مع الماكروليد
  {
    keywordsA: ['أتورفاستاتين', 'atorvastatin', 'ليبيتور', 'سيمفاستاتين', 'simvastatin', 'زوكور'],
    keywordsB: ['كلاريثروميسين', 'clarithromycin', 'كلاسيد', 'إريثرومايسين', 'erythromycin'],
    severity: 'warning',
    title: 'تسمم عضلي (انحلال الربيدات Rhabdomyolysis)',
    description: 'يثبط المضاد الحيوي إنزيم CYP3A4 الكبدي مما يرفع تركيز الستاتين في الدم بشكل سام ويسبب آلاماً عضلية حادة وتلفاً كلوياً.',
    recommendation: 'يُنصح بإيقاف الستاتين مؤقتاً طوال فترة كورس المضاد الحيوي أو اختيار مضاد بديل كالأزيثروميسين.',
  },

  // 8. مهدئات / منومات مع مضادات الهستامين المهدئة
  {
    keywordsA: ['ديازيبام', 'diazepam', 'فاليوم', 'ألبرازولام', 'alprazolam', 'زاناكس', 'لورازيبام', 'ترامادول', 'tramadol'],
    keywordsB: ['كلورفينيرامين', 'chlorpheniramine', 'دايفينهيدرامين', 'diphenhydramine', 'هيستوب', 'فينيرغان', 'موتيفال'],
    severity: 'warning',
    title: 'تثبيط عصبي وتنفسي مفرط',
    description: 'الجمع يسبب نعاساً شديداً، فقدان التوازن، وبطء الاستجابة المنعكسة، وخطر تثبيط مركز التنفس.',
    recommendation: 'تحذير المريض من قيادة السيارة أو تشغيل الآلات وتعديل الجرعة تحت إشراف طبي.',
  }
];

/**
 * فحص الفاتورة أو السلة للكشف عن أي تداخلات أو تعارضات دوائية
 */
export function checkCartDrugInteractions(
  cartItems: InvoiceItem[],
  allProducts: Product[],
  allIngredients: Ingredient[]
): DrugInteractionAlert[] {
  if (cartItems.length < 2) return [];

  // تجميع تفاصيل كل صنف في السلة مع مواده الفعالة
  const itemDetails = cartItems.map(item => {
    const prod = allProducts.find(p => p.id === item.productId);
    const prodIngredients = prod 
      ? prod.ingredientIds.map(ingId => allIngredients.find(i => i.id === ingId)?.nameAr || '').filter(Boolean)
      : [];
    
    const searchTokens = [
      item.productName.toLowerCase(),
      prod?.nameAr.toLowerCase() || '',
      prod?.nameEn.toLowerCase() || '',
      ...prodIngredients.map(i => i.toLowerCase()),
    ].join(' ');

    return {
      itemId: item.id,
      productName: item.productName,
      searchTokens,
    };
  });

  const alerts: DrugInteractionAlert[] = [];
  const checkedPairs = new Set<string>();

  for (let i = 0; i < itemDetails.length; i++) {
    for (let j = i + 1; j < itemDetails.length; j++) {
      const itemA = itemDetails[i];
      const itemB = itemDetails[j];
      const pairKey = [itemA.itemId, itemB.itemId].sort().join('___');

      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // فحص القواعد
      for (const rule of INTERACTION_RULES) {
        const matchesA = rule.keywordsA.some(kw => itemA.searchTokens.includes(kw.toLowerCase()));
        const matchesB = rule.keywordsB.some(kw => itemB.searchTokens.includes(kw.toLowerCase()));

        // فحص بالاتجاه العكسي إن لزم
        const reverseMatchesA = rule.keywordsA.some(kw => itemB.searchTokens.includes(kw.toLowerCase()));
        const reverseMatchesB = rule.keywordsB.some(kw => itemA.searchTokens.includes(kw.toLowerCase()));

        if ((matchesA && matchesB) || (reverseMatchesA && reverseMatchesB)) {
          alerts.push({
            id: `alert-${pairKey}-${rule.title}`,
            drugA: itemA.productName,
            drugB: itemB.productName,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            recommendation: rule.recommendation,
          });
          break; // alert once per pair rule
        }
      }
    }
  }

  return alerts;
}
