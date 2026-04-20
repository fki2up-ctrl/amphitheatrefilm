// ---------------------------------------------------------------------------
// useSiteSettings — thin hook that surfaces the global site configuration
// (layout / typography / animations) from the ContentProvider.
//
// Usage:
//   const { config, update, reset, save } = useSiteSettings();
//   update({ layout: { gridCols: 4 } });   // live preview
//   await save();                          // sync to Supabase
// ---------------------------------------------------------------------------

import { useContent } from '../store/content';

export function useSiteSettings() {
  const {
    siteConfig,
    setSiteConfig,
    resetSiteConfig,
    saveSiteConfig,
  } = useContent();

  return {
    config: siteConfig,
    update: setSiteConfig,
    reset:  resetSiteConfig,
    save:   saveSiteConfig,
  };
}
