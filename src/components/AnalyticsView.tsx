import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Percent, 
  Layers, 
  CreditCard, 
  EyeOff, 
  Flame,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  PackageX,
  Clock,
  Archive,
  AlertCircle,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Invoice, Product, Category, Settings } from '../types/pharmacy';

interface AnalyticsViewProps {
  invoices: Invoice[];
  products: Product[];
  categories: Category[];
  settings: Settings;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'all';
type ChartType = 'area' | 'bar';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: {
      label: string;
      fullDate: string;
      amount: number;
      profit: number;
      count: number;
    };
  }>;
  label?: string;
  currency: string;
  hideProfit: boolean;
}

const CustomWeeklyTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  currency,
  hideProfit,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl bg-slate-900/95 text-white p-3 shadow-xl border border-slate-700 backdrop-blur-sm text-xs space-y-1.5 min-w-[170px]" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1 font-bold text-sky-300">
          <span>{data.label}</span>
          <span className="text-[10px] text-slate-400 font-normal">{data.fullDate}</span>
        </div>
        <div className="flex justify-between items-center text-slate-200">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
            إجمالي المبيعات:
          </span>
          <span className="font-extrabold text-white">
            {data.amount.toFixed(2)} {currency}
          </span>
        </div>
        {!hideProfit && (
          <div className="flex justify-between items-center text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
              صافي الأرباح:
            </span>
            <span className="font-extrabold text-emerald-400">
              +{data.profit.toFixed(2)} {currency}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-slate-400 text-[11px] pt-0.5 border-t border-slate-800">
          <span>عدد الفواتير:</span>
          <span className="font-bold text-slate-300">{data.count} فاتورة</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  invoices,
  products,
  categories,
  settings,
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'overview' | 'dead_stock'>('overview');
  const [period, setPeriod] = useState<Period>('all');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [deadStockSearch, setDeadStockSearch] = useState('');
  const [deadStockDaysFilter, setDeadStockDaysFilter] = useState<'all' | '90' | '60' | 'never'>('all');

  // Dead Stock & Slow Moving Items Analysis (تقرير الأدوية الراكدة وبطيئة الحركة)
  const deadStockAnalysis = useMemo(() => {
    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Map of product ID to last sale timestamp
    const lastSaleMap = new Map<string, number>();
    invoices.forEach(inv => {
      if (inv.status === 'active' && inv.type === 'sale') {
        const time = new Date(inv.date).getTime();
        inv.items.forEach(item => {
          const prev = lastSaleMap.get(item.productId) || 0;
          if (time > prev) {
            lastSaleMap.set(item.productId, time);
          }
        });
      }
    });

    const items = products.map(prod => {
      const lastTime = lastSaleMap.get(prod.id);
      const daysSinceSale = lastTime 
        ? Math.floor((now - lastTime) / MS_PER_DAY)
        : Math.floor((now - new Date(prod.createdAt || Date.now()).getTime()) / MS_PER_DAY);
      
      const defaultUnit = prod.units[0];
      const unitCost = defaultUnit?.costPrice || prod.lastCostPrice || 0;
      const unitPrice = defaultUnit?.salePrice || prod.lastSalePrice || 0;
      const tiedUpCapital = prod.stock * unitCost;

      let status: 'severe' | 'moderate' | 'active';
      if (!lastTime || daysSinceSale >= 90) {
        status = 'severe'; // راكد شديد (> 90 يوم أو لم يُبع قط)
      } else if (daysSinceSale >= 30) {
        status = 'moderate'; // بطيء الحركة (30 - 90 يوم)
      } else {
        status = 'active'; // نشط (< 30 يوم)
      }

      return {
        product: prod,
        hasSoldBefore: !!lastTime,
        lastSaleDate: lastTime ? new Date(lastTime).toLocaleDateString('ar-EG') : 'لم يُبع قط',
        daysSinceSale,
        status,
        tiedUpCapital,
        unitCost,
        unitPrice,
      };
    });

    // We only care about items that are in stock and either severe or moderate
    const deadOrSlowItems = items.filter(i => i.status !== 'active' && i.product.stock > 0);
    const totalTiedUpCapital = deadOrSlowItems.reduce((acc, i) => acc + i.tiedUpCapital, 0);
    const severeCount = deadOrSlowItems.filter(i => i.status === 'severe').length;
    const moderateCount = deadOrSlowItems.filter(i => i.status === 'moderate').length;

    return {
      allItems: deadOrSlowItems.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital),
      totalTiedUpCapital,
      severeCount,
      moderateCount,
    };
  }, [invoices, products]);

  // Filter Invoices by selected period
  const periodInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return invoices.filter(inv => {
      const invTime = new Date(inv.date).getTime();

      if (period === 'today') {
        return invTime >= todayStart;
      }
      if (period === 'week') {
        const weekStart = todayStart - (7 * 86400000);
        return invTime >= weekStart;
      }
      if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return invTime >= monthStart;
      }
      if (period === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
        return invTime >= yearStart;
      }
      return true; // 'all'
    });
  }, [invoices, period]);

  // Active (non-cancelled) vs Cancelled
  const activeInvoices = useMemo(() => {
    return periodInvoices.filter(i => i.status === 'active');
  }, [periodInvoices]);

  const cancelledInvoices = useMemo(() => {
    return periodInvoices.filter(i => i.status === 'cancelled');
  }, [periodInvoices]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const count = activeInvoices.length;
    const totalSales = activeInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCost = activeInvoices.reduce((sum, i) => sum + i.totalCost, 0);
    const totalProfit = activeInvoices.reduce((sum, i) => sum + i.totalProfit, 0);
    const cancelledTotal = cancelledInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const avgInvoice = count > 0 ? totalSales / count : 0;
    const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0';

    return {
      count,
      totalSales,
      totalCost,
      totalProfit,
      cancelledTotal,
      cancelledCount: cancelledInvoices.length,
      avgInvoice,
      profitMargin,
    };
  }, [activeInvoices, cancelledInvoices]);

  // Top 10 Best Selling Items (Quantity & Revenue)
  const topSellingProducts = useMemo(() => {
    const itemMap = new Map<string, { id: string; name: string; qty: number; revenue: number }>();

    activeInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const existing = itemMap.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += item.total;
        } else {
          itemMap.set(item.productId, {
            id: item.productId,
            name: item.productName,
            qty: item.quantity,
            revenue: item.total,
          });
        }
      });
    });

    const list = Array.from(itemMap.values());
    list.sort((a, b) => b.revenue - a.revenue);
    return list.slice(0, 10);
  }, [activeInvoices]);

  const maxProductRevenue = useMemo(() => {
    if (topSellingProducts.length === 0) return 1;
    return Math.max(...topSellingProducts.map(p => p.revenue), 1);
  }, [topSellingProducts]);

  // Sales by Category
  const salesByCategory = useMemo(() => {
    const catMap = new Map<string, number>();
    const prodCatMap = new Map(products.map(p => [p.id, p.categoryId]));

    activeInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const catId = prodCatMap.get(item.productId) || 'other';
        const current = catMap.get(catId) || 0;
        catMap.set(catId, current + item.total);
      });
    });

    const categoriesMap = new Map(categories.map(c => [c.id, c.name]));
    const result: { id: string; name: string; amount: number; percentage: number }[] = [];
    const total = metrics.totalSales || 1;

    catMap.forEach((amount, id) => {
      result.push({
        id,
        name: categoriesMap.get(id) || 'أصناف متنوعة',
        amount,
        percentage: Number(((amount / total) * 100).toFixed(1)),
      });
    });

    return result.sort((a, b) => b.amount - a.amount);
  }, [activeInvoices, products, categories, metrics.totalSales]);

  // Sales by Payment Method
  const paymentMethodBreakdown = useMemo(() => {
    const breakdown = {
      cash: 0,
      card: 0,
      bank: 0,
      credit: 0,
    };

    activeInvoices.forEach(inv => {
      if (inv.paymentMethod in breakdown) {
        breakdown[inv.paymentMethod as keyof typeof breakdown] += inv.totalAmount;
      }
    });

    const total = metrics.totalSales || 1;
    return [
      { key: 'cash', label: 'نقدي (Cash)', amount: breakdown.cash, color: '#10b981', pct: Number(((breakdown.cash / total) * 100).toFixed(1)) },
      { key: 'card', label: 'بطاقة بنكية', amount: breakdown.card, color: '#0ea5e9', pct: Number(((breakdown.card / total) * 100).toFixed(1)) },
      { key: 'bank', label: 'بنوك ومحافظ', amount: breakdown.bank, color: '#6366f1', pct: Number(((breakdown.bank / total) * 100).toFixed(1)) },
      { key: 'credit', label: 'آجل (ذمم زبائن)', amount: breakdown.credit, color: '#f59e0b', pct: Number(((breakdown.credit / total) * 100).toFixed(1)) },
    ];
  }, [activeInvoices, metrics.totalSales]);

  // Last 7 Days Sales Trend for Recharts
  const last7DaysTrend = useMemo(() => {
    const days: { 
      dateStr: string; 
      label: string; 
      fullDate: string; 
      amount: number; 
      profit: number; 
      count: number 
    }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('ar-EG', { weekday: 'short' });
      const fullDate = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

      // sum for this day
      const dayInvoices = invoices.filter(inv => inv.status === 'active' && inv.date.startsWith(dStr));
      const daySales = dayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const dayProfit = dayInvoices.reduce((sum, inv) => sum + inv.totalProfit, 0);

      days.push({
        dateStr: dStr,
        label: dayName,
        fullDate,
        amount: Math.round(daySales * 100) / 100,
        profit: Math.round(dayProfit * 100) / 100,
        count: dayInvoices.length,
      });
    }

    const totalWeekSales = days.reduce((sum, d) => sum + d.amount, 0);
    const totalWeekProfit = days.reduce((sum, d) => sum + d.profit, 0);
    const totalWeekInvoices = days.reduce((sum, d) => sum + d.count, 0);

    return { days, totalWeekSales, totalWeekProfit, totalWeekInvoices };
  }, [invoices]);

  return (
    <div className="space-y-4">
      {/* Analytics Tabs: Overview vs Dead Stock Report */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveViewTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeViewTab === 'overview'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>المؤشرات والتقارير المالية العامة</span>
          </button>
          <button
            onClick={() => setActiveViewTab('dead_stock')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeViewTab === 'dead_stock'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <PackageX className="w-4 h-4" />
            <span>تقرير الأدوية الراكدة وبطيئة الحركة ({deadStockAnalysis.allItems.length}) 🧊</span>
          </button>
        </div>

        {activeViewTab === 'dead_stock' && (
          <div className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900">
            رأس المال المجمد: <strong>{deadStockAnalysis.totalTiedUpCapital.toFixed(2)} {settings.currency}</strong>
          </div>
        )}
      </div>

      {/* VIEW 1: OVERVIEW */}
      {activeViewTab === 'overview' && (
        <>
          {/* Period Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sky-600" />
                <span>لوحة المؤشرات والتقارير المالية</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">تحليل المبيعات، الأرباح، والأصناف الأكثر حركة في الصيدلية</p>
            </div>

            {/* Period Buttons */}
            <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['today', 'week', 'month', 'year', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    period === p
                      ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-900 dark:text-sky-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {p === 'today' && 'اليوم'}
                  {p === 'week' && 'الأسبوع'}
                  {p === 'month' && 'الشهر'}
                  {p === 'year' && 'السنة'}
                  {p === 'all' && 'الكل'}
                </button>
              ))}
            </div>
          </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Invoices */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">الفواتير المنفذة</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.count}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">متوسط: {metrics.avgInvoice.toFixed(1)} {settings.currency}</div>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">إجمالي المبيعات</div>
          <div className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {metrics.totalSales.toFixed(2)} {settings.currency}
          </div>
          <div className="text-[10px] text-sky-700 dark:text-sky-300 mt-0.5">قبل خصم التكاليف</div>
        </div>

        {/* Gross Profit (or hidden) */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">الربح الإجمالي</div>
          {!settings.hideCostAndProfit ? (
            <>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                +{metrics.totalProfit.toFixed(2)} {settings.currency}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">هامش: {metrics.profitMargin}%</div>
            </>
          ) : (
            <div className="text-sm font-bold text-slate-400 flex items-center gap-1 mt-2">
              <EyeOff className="h-4 w-4" />
              <span>مخفي للخصوصية</span>
            </div>
          )}
        </div>

        {/* Total Cost (or hidden) */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">تكلفة البضاعة المباعة</div>
          {!settings.hideCostAndProfit ? (
            <>
              <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1">
                {metrics.totalCost.toFixed(2)} {settings.currency}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">التكلفة الفعلية</div>
            </>
          ) : (
            <div className="text-sm font-bold text-slate-400 flex items-center gap-1 mt-2">
              <EyeOff className="h-4 w-4" />
              <span>مخفي</span>
            </div>
          )}
        </div>

        {/* Returns / Cancellations */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">الفواتير الملغاة</div>
          <div className="text-xl font-black text-rose-600 mt-1">{metrics.cancelledCount}</div>
          <div className="text-[10px] text-rose-500 mt-0.5">{metrics.cancelledTotal.toFixed(2)} {settings.currency}</div>
        </div>

        {/* Average Invoice */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">متوسط الفاتورة</div>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {metrics.avgInvoice.toFixed(2)} {settings.currency}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">لكل زبون</div>
        </div>
      </div>

      {/* Recharts: Last 7 Days Sales Trend Curve */}
      <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>منحنى مبيعات الأسبوع الأخير (Recharts)</span>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  7 أيام
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تتبع مسار الإيرادات اليومية وتذبذب حركة البيع الفعلي في الصيدلية
              </p>
            </div>
          </div>

          {/* Quick Metrics & Chart Type Toggles */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Chart Type Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartType === 'area'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-900 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <LineChartIcon className="h-3.5 w-3.5" />
                <span>منحنى انسيابي</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartType === 'bar'
                    ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-900 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>أعمدة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Stats Header */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">إجمالي مبيعات الأسبوع:</span>
            <span className="text-base font-black text-sky-700 dark:text-sky-400">
              {last7DaysTrend.totalWeekSales.toFixed(2)} {settings.currency}
            </span>
          </div>
          {!settings.hideCostAndProfit && (
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">صافي أرباح الأسبوع:</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                +{last7DaysTrend.totalWeekProfit.toFixed(2)} {settings.currency}
              </span>
            </div>
          )}
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">إجمالي فواتير الأسبوع:</span>
            <span className="text-base font-black text-slate-800 dark:text-slate-200">
              {last7DaysTrend.totalWeekInvoices} فاتورة
            </span>
          </div>
        </div>

        {/* Recharts Interactive Curve */}
        <div className="w-full h-72 sm:h-80 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart
                data={last7DaysTrend.days}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke="#cbd5e1" 
                  strokeOpacity={0.4} 
                />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip 
                  content={
                    <CustomWeeklyTooltip 
                      currency={settings.currency} 
                      hideProfit={settings.hideCostAndProfit} 
                    />
                  } 
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="المبيعات"
                  stroke="#0284c7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                  activeDot={{ r: 6, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                />
                {!settings.hideCostAndProfit && (
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="الأرباح"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#profitGrad)"
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart
                data={last7DaysTrend.days}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke="#cbd5e1" 
                  strokeOpacity={0.4} 
                />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  content={
                    <CustomWeeklyTooltip 
                      currency={settings.currency} 
                      hideProfit={settings.hideCostAndProfit} 
                    />
                  } 
                />
                <Bar 
                  dataKey="amount" 
                  name="المبيعات" 
                  fill="#0284c7" 
                  radius={[6, 6, 0, 0]} 
                />
                {!settings.hideCostAndProfit && (
                  <Bar 
                    dataKey="profit" 
                    name="الأرباح" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend Notes */}
        <div className="flex items-center justify-center gap-6 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-sky-600 inline-block"></span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">منحنى المبيعات الإجمالية</span>
          </div>
          {!settings.hideCostAndProfit && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">منحنى الأرباح الصافية</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Charts Grid: Top Selling & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. Top 10 Best Selling Items (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>أفضل 10 أصناف مبيعاً (كمية وقيمة)</span>
            </h3>
            <span className="text-xs text-slate-400">حسب الإيراد الإجمالي</span>
          </div>

          {topSellingProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">لا توجد مبيعات كافية في هذه الفترة</div>
          ) : (
            <div className="space-y-2.5">
              {topSellingProducts.map((p, idx) => {
                const widthPct = Math.max(5, (p.revenue / maxProductRevenue) * 100);
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                        <strong className="text-slate-400 mr-1">#{idx + 1}</strong> {p.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-normal">({p.qty} وحدة)</span>
                        <span className="font-bold text-sky-700 dark:text-sky-400">{p.revenue.toFixed(2)} {settings.currency}</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Payment Methods Breakdown (5 cols) with Recharts Donut & Details */}
        <div className="lg:col-span-5 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <PieChartIcon className="h-4 w-4 text-indigo-500" />
              <span>المبيعات حسب طريقة الدفع</span>
            </h3>
            <span className="text-xs text-slate-400">نقد، بطاقة، بنوك، آجل</span>
          </div>

          {/* Recharts Mini Pie / Donut Chart */}
          <div className="h-36 w-full flex items-center justify-center" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodBreakdown.filter(p => p.amount > 0)}
                  dataKey="amount"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={4}
                >
                  {paymentMethodBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`${Number(val).toFixed(2)} ${settings.currency}`, 'المبلغ']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {paymentMethodBreakdown.map(item => (
              <div key={item.key} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {item.amount.toFixed(2)} {settings.currency} ({item.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Sales by Category */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
          توزيع المبيعات حسب التصنيفات والأقسام
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {salesByCategory.map(c => (
            <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.name}</div>
              <div className="text-base font-black text-sky-700 dark:text-sky-400 mt-1">
                {c.amount.toFixed(2)} {settings.currency}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{c.percentage}% من إجمالي المبيعات</div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* VIEW 2: DEAD STOCK & SLOW MOVING REPORT (تقرير الأدوية الراكدة وبطيئة الحركة) */}
      {activeViewTab === 'dead_stock' && (
        <div className="space-y-4">
          {/* Header & KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-xs border border-rose-200 dark:bg-slate-900 dark:border-rose-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">أصناف راكدة شديدة (&gt; 90 يوم)</span>
                <span className="p-2 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                  <PackageX className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
                {deadStockAnalysis.severeCount} صنف
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                لم تتحرك منذ 3 أشهر أو لم تُبع قط
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-xs border border-amber-200 dark:bg-slate-900 dark:border-amber-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">أصناف بطيئة الحركة (30-90 يوم)</span>
                <span className="p-2 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {deadStockAnalysis.moderateCount} صنف
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                حركة بيع ضعيفة جداً بحاجة لمتابعة
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-xs border border-emerald-200 dark:bg-slate-900 dark:border-emerald-950 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي رأس المال المجمد بالبضاعة الراكدة</span>
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {deadStockAnalysis.totalTiedUpCapital.toFixed(2)} {settings.currency}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                سيولة نقدية محتجزة على الرفوف يمكن استردادها عبر التخفيضات والإرجاع للموردين
              </p>
            </div>
          </div>

          {/* Pharmacist Action Recommendations Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 dark:from-slate-900 dark:to-slate-850 dark:border-amber-900/60 p-4">
            <h4 className="font-extrabold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2 mb-1.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>إرشادات الصيدلي لتسييل البضاعة الراكدة وحماية رأس المال:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-amber-900 dark:text-amber-300 mt-2">
              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                <strong className="block font-bold mb-0.5">1. تفعيل عروض وتخفيضات:</strong>
                تخفيض هامش الربح أو عمل باقات دوائية لتشجيع المرضى على الشراء قبل انتهاء الصلاحية.
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                <strong className="block font-bold mb-0.5">2. إرجاع للموردين ومستودعات الأدوية:</strong>
                استغلال سياسات استرجاع البضائع مع شركات الأدوية واستبدالها بأصناف سريعة الدوران.
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                <strong className="block font-bold mb-0.5">3. إيقاف إعادة الشراء:</strong>
                تجميد أوامر الشراء التلقائية لهذه الأصناف حتى تصفية الكميات الموجودة بالكامل.
              </div>
            </div>
          </div>

          {/* Filter & Search Bar for Dead Stock */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setDeadStockDaysFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  deadStockDaysFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                الكل ({deadStockAnalysis.allItems.length})
              </button>
              <button
                onClick={() => setDeadStockDaysFilter('90')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  deadStockDaysFilter === '90'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                راكد شديد (&gt; 90 يوم) 🔴
              </button>
              <button
                onClick={() => setDeadStockDaysFilter('60')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  deadStockDaysFilter === '60'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                بطيء الحركة (30-90 يوم) 🟠
              </button>
              <button
                onClick={() => setDeadStockDaysFilter('never')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  deadStockDaysFilter === 'never'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                }`}
              >
                لم يُبع قط (Zero Sales) 🛑
              </button>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="ابحث بالصنف أو الباركود..."
                value={deadStockSearch}
                onChange={(e) => setDeadStockSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Dead Stock Table & Mobile Cards */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
              {deadStockAnalysis.allItems
                .filter(item => {
                  const q = deadStockSearch.toLowerCase().trim();
                  if (q) {
                    const match = item.product.nameAr.toLowerCase().includes(q) ||
                      item.product.nameEn.toLowerCase().includes(q) ||
                      item.product.barcode.toLowerCase().includes(q);
                    if (!match) return false;
                  }
                  if (deadStockDaysFilter === '90') return item.daysSinceSale >= 90;
                  if (deadStockDaysFilter === '60') return item.daysSinceSale >= 30 && item.daysSinceSale < 90;
                  if (deadStockDaysFilter === 'never') return !item.hasSoldBefore;
                  return true;
                })
                .map((item, idx) => (
                  <div
                    key={item.product.id || idx}
                    className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {item.product.nameAr}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                          {item.product.nameEn} • {item.product.barcode}
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        item.daysSinceSale >= 90 
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {item.daysSinceSale} يوم
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">المخزون الراكد:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.product.stock} {item.product.units[0]?.name || 'وحدة'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">آخر بيع:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                          {item.lastSaleDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">سعر التكلفة:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                          {item.unitCost.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">رأس المال المجمد:</span>
                        <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-xs">
                          {item.tiedUpCapital.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">التوصية:</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        item.status === 'severe'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                      }`}>
                        {item.status === 'severe' ? '⚠️ تسييل فوري / إرجاع' : '📉 تخفيض السعر وعرض'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">الصنف والباركود</th>
                    <th className="px-4 py-3 font-bold">تاريخ آخر بيع</th>
                    <th className="px-4 py-3 font-bold text-center">أيام الركود</th>
                    <th className="px-4 py-3 font-bold text-center">المخزون الراكد</th>
                    <th className="px-4 py-3 font-bold text-center">سعر التكلفة</th>
                    <th className="px-4 py-3 font-bold text-center">سعر الجمهور</th>
                    <th className="px-4 py-3 font-bold text-center">رأس المال المجمد</th>
                    <th className="px-4 py-3 font-bold text-center">الحالة والتوصية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deadStockAnalysis.allItems
                    .filter(item => {
                      const q = deadStockSearch.toLowerCase().trim();
                      if (q) {
                        const match = item.product.nameAr.toLowerCase().includes(q) ||
                          item.product.nameEn.toLowerCase().includes(q) ||
                          item.product.barcode.toLowerCase().includes(q);
                        if (!match) return false;
                      }
                      if (deadStockDaysFilter === '90') return item.daysSinceSale >= 90;
                      if (deadStockDaysFilter === '60') return item.daysSinceSale >= 30 && item.daysSinceSale < 90;
                      if (deadStockDaysFilter === 'never') return !item.hasSoldBefore;
                      return true;
                    })
                    .map((item, idx) => {
                      return (
                        <tr key={item.product.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {item.product.nameAr}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {item.product.nameEn} • {item.product.barcode}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono">
                            {item.lastSaleDate}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                              item.daysSinceSale >= 90 
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {item.daysSinceSale} يوم
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.product.stock} {item.product.units[0]?.name || 'وحدة'}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                            {item.unitCost.toFixed(2)} {settings.currency}
                          </td>
                          <td className="px-4 py-3 text-center text-sky-700 dark:text-sky-400 font-bold font-mono">
                            {item.unitPrice.toFixed(2)} {settings.currency}
                          </td>
                          <td className="px-4 py-3 text-center font-black text-rose-600 dark:text-rose-400 font-mono text-sm">
                            {item.tiedUpCapital.toFixed(2)} {settings.currency}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                              item.status === 'severe'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            }`}>
                              {item.status === 'severe' ? '⚠️ تسييل فوري / إرجاع' : '📉 تخفيض السعر وعرض'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
