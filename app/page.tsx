import TDEECalculator from "@/app/components/tdee/TDEECalculator";
import MacroResultPanel from "@/app/components/tdee/MacroResultPanel";
import ImageUploader from "@/app/components/food/ImageUploader";
import IngredientList from "@/app/components/food/IngredientList";
import DailyTracker from "@/app/components/tracker/DailyTracker";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}
      <header className="border-b border-white/[0.06] bg-surface-1/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center">
                <span className="text-lg">🔬</span>
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-brand-text tracking-tight">
                  NutriVision
                </h1>
                <p className="text-[11px] text-white/35 -mt-0.5">
                  Clinical-Grade Nutrition Tracker
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/20 font-mono">
                Mifflin-St Jeor · Atwater System
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Main Content                                                     */}
      {/* ================================================================ */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* ------------------------------------------------------------ */}
        {/* Section 1: TDEE Calculator + Macro Results                    */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-8 animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TDEECalculator />
            <MacroResultPanel />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Section 2: AI Food Scanner + Ingredient List                  */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-8" style={{ animationDelay: "0.1s" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ImageUploader />
            <IngredientList />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Section 3: Daily Progress Tracker                             */}
        {/* ------------------------------------------------------------ */}
        <section className="mb-8" style={{ animationDelay: "0.2s" }}>
          <DailyTracker />
        </section>
      </main>

      {/* ================================================================ */}
      {/* Footer                                                           */}
      {/* ================================================================ */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-white/20">
            <p>
              NutriVision — Powered by OpenAI Vision + Edamam
            </p>
            <p>
              ⚠️ Not a substitute for professional medical advice
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
