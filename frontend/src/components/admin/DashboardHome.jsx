import { motion } from 'framer-motion';

// ─── Skeleton Loading Component ───────────────────────────────────────────
function DashboardSkeleton() {
    return (
        <div className="space-y-6 w-full animate-pulse">
            <div className="space-y-2">
                <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700" />
                ))}
            </div>
            <div className="h-72 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700" />
        </div>
    );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
const COLOR_MAP = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
};

export function StatCard({ title, value, icon, color = 'blue' }) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-200 group"
        >
            <div className={`p-3 rounded-xl shrink-0 transition-transform group-hover:scale-110 ${COLOR_MAP[color] || COLOR_MAP.blue}`}>
                <span className="material-icons-round text-2xl">{icon}</span>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
            </div>
        </motion.div>
    );
}

// ─── Dashboard Home ────────────────────────────────────────────────────────
export default function DashboardHome({ stats }) {
    if (!stats) return <DashboardSkeleton />;

    const { stats: mainStats, daily_searches } = stats;
    const hasChartData = daily_searches?.length > 0;
    const max = hasChartData ? Math.max(...daily_searches.map(d => d.count)) || 1 : 1;

    // Helper for grid lines
    const gridLines = [0.25, 0.5, 0.75, 1];

    return (
        <div className="space-y-4 md:space-y-6 w-full">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Resumen General</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Métricas clave del sistema en tiempo real.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Sistema Online</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                <StatCard title="Total Usuarios" value={mainStats.total_users || 0} icon="group" color="blue" />
                <StatCard title="Búsquedas" value={mainStats.total_searches || 0} icon="search" color="emerald" />
                <StatCard title="Usuarios Premium" value={mainStats.premium_users || 0} icon="workspace_premium" color="purple" />
                <StatCard title="Consultas Hoy" value={mainStats.today_searches || 0} icon="today" color="blue" />
                <StatCard title="Planes Vendidos" value={mainStats.total_purchases || 0} icon="shopping_cart" color="emerald" />
                <StatCard title="Ingresos Totales" value={`S/ ${(mainStats.total_revenue || 0).toFixed(2)}`} icon="payments" color="amber" />
            </div>

            {/* Activity Chart Section */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative">
                <div className="flex flex-row items-center justify-between gap-2 mb-4 md:mb-8 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 md:w-9 md:h-9 bg-slate-100 dark:bg-slate-700/50 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-600/50 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-slate-500 dark:text-slate-400 text-sm md:text-base">trending_up</span>
                        </div>
                        <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white truncate">Actividad Reciente</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-block text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 shrink-0">
                            Últimos 7 días
                        </span>
                        <button className="p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-slate-400 text-lg md:text-xl">refresh</span>
                        </button>
                    </div>
                </div>

                <div className="h-48 md:h-64 relative w-full pt-4">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 pt-4 flex flex-col justify-between pointer-events-none opacity-40">
                        {gridLines.reverse().map(l => (
                            <div key={l} className="w-full border-t border-slate-100 dark:border-slate-700/50 relative">
                                <span className="absolute -top-2.5 right-0 text-[9px] font-bold text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-800 px-1">
                                    {Math.round(max * l)}
                                </span>
                            </div>
                        ))}
                        <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>

                    <div className="h-full flex items-end gap-2 sm:gap-4 justify-between w-full relative z-10">
                        {hasChartData ? (
                            daily_searches.map((day, i) => {
                                const h = Math.max((day.count / max) * 100, 5);
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                                        {/* Premium Tooltip */}
                                        <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-y-2 group-hover:translate-y-0 pointer-events-none z-20">
                                            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap flex flex-col items-center">
                                                <span className="opacity-70 uppercase tracking-tighter mb-0.5">{day.date}</span>
                                                <span className="text-sm">{day.count} BÚSQUEDAS</span>
                                                <div className="absolute top-full border-4 border-transparent border-t-slate-900 dark:border-t-white" />
                                            </div>
                                        </div>

                                        {/* Bar Container */}
                                        <div className="w-full h-full relative flex items-end">
                                            {/* Permanent Label Above Bar */}
                                            <div 
                                                className="absolute w-full flex justify-center text-center transition-all duration-300 pointer-events-none"
                                                style={{ bottom: `${h}%`, paddingBottom: '4px' }}
                                            >
                                                <span className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/40 px-1 rounded">
                                                    {day.count}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-50/50 dark:bg-slate-700/20 rounded-t-lg absolute inset-0 group-hover:bg-slate-100 dark:group-hover:bg-slate-700/40 transition-colors" />
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${h}%` }}
                                                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                                                className="w-full bg-gradient-to-t from-blue-700 via-blue-500 to-blue-400 group-hover:from-blue-600 group-hover:to-blue-300 transition-all duration-300 absolute bottom-0 rounded-t-lg shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                                            />
                                        </div>

                                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors uppercase tracking-tighter">
                                            {new Date(day.date).toLocaleDateString('es-PE', { weekday: 'short', timeZone: 'America/Lima' })}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="w-full h-full flex items-center justify-center flex-col gap-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
                                <span className="material-icons-round text-4xl text-slate-200 dark:text-slate-700">insights</span>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin datos de actividad</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
