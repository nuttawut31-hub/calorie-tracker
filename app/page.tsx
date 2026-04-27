import TDEECalculator from "@/app/components/tdee/TDEECalculator";
import MacroResultPanel from "@/app/components/tdee/MacroResultPanel";
import ImageUploader from "@/app/components/food/ImageUploader";
import IngredientList from "@/app/components/food/IngredientList";
import DailyTracker from "@/app/components/tracker/DailyTracker";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}
      <header className="border-b border-white/[0.06] bg-surface-1/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl gradient-brand flex items-center justify-center shrink-0">
                <span className="text-base sm:text-lg">🔬</span>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold gradient-brand-text tracking-tight leading-none">
                  NutriVision
                </h1>
                <p className="text-[10px] text-white/35 mt-0.5 hidden sm:block">
                  Clinical-Grade Nutrition Tracker
                </p>
              </div>
            </div>

            {/* Badge */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-[10px] text-white/20 font-mono">
                Mifflin-St Jeor · Atwater System
              </span>
              <span className="sm:hidden text-[9px] text-white/20 font-mono">
                AI-Powered
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Main Content                                                     */}
      {/* ================================================================ */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 w-full">

        {/* ------------------------------------------------------------ */}
        {/* Section 1: AI Food Scanner + Ingredient List                  */}
        {/* Placed FIRST on mobile — most important feature               */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-4 sm:mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
              Step 1
            </span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          {/* Stack on mobile, side-by-side on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <ImageUploader />
            <IngredientList />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Section 2: TDEE Calculator + Macro Results                    */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
              Step 2 — Calorie Target
            </span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          {/* md breakpoint: 2 col already on tablet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <TDEECalculator />
            <MacroResultPanel />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Section 3: Daily Progress Tracker                             */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
              Step 3 — Daily Log
            </span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          <DailyTracker />
        </section>
      </main>

      {/* ================================================================ */}
      {/* Footer                                                           */}
      {/* ================================================================ */}
      <footer className="border-t border-white/[0.06] py-4 sm:py-6 mt-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20">
            <p>NutriVision — Gemini Vision · Open Food Facts · USDA</p>
            <p className="text-center sm:text-right">
              ⚠️ Not a substitute for professional medical advice
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
