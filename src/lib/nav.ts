import { router } from 'expo-router';

/**
 * 安全返回。
 *
 * 直接通过 URL / 深链进入某个页面时没有历史栈，
 * 此时调用 router.back() 会抛 "The action 'GO_BACK' was not handled by any navigator"。
 * 统一走这里：能回退就回退，否则回落到首页。
 */
export function goBack(fallback: '/' | '/meds' | '/special' = '/') {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // canGoBack 在极早期调用时可能抛错，直接走兜底
  }
  router.replace(fallback);
}
