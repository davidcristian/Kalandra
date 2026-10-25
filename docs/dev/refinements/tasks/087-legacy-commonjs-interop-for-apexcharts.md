# The renderer build needs Vite's legacy CommonJS interop for vue3-apexcharts

**Status:** open
**Area:** renderer
**Origin:** [renderer/vite.config.mts](../../../../renderer/vite.config.mts)
**Verified:** 2026-10-25

`legacy.inconsistentCjsInterop` in `renderer/vite.config.mts` keeps the default import rules that
Vite used before version 8 for every CommonJS dependency. The Vite 8 migration guide calls it a
temporary fallback, so a later Vite major can remove it.

Only vue3-apexcharts 1.1.1 needs it. Its only build is a webpack CommonJS file that sets
`__esModule`. Without the option, `import VueApexcharts from "vue3-apexcharts"` in
`renderer/src/web/price-check/trends/PriceTrend.vue` returns the module object instead of the
component, and the price trend chart does not render. Releases 1.5.3 to 1.10.0 ship an ES module
build and accept the apexcharts 4.7.0 that the renderer has; 1.11 needs apexcharts 5.10.

Done looks like: vue3-apexcharts on a release with an ES module build, the option removed, and
the price trend chart checked in the built page with a price file.

## History

- 2026-10-25: Found when the renderer build moved from Vite 5 to Vite 8: without the option, the
  built page showed the price trend without its chart.
