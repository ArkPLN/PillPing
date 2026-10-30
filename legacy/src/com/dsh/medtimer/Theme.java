package com.dsh.medtimer;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.View;
import android.view.Window;

final class Theme {
    static final int SYSTEM = 0;
    static final int LIGHT = 1;
    static final int DARK = 2;
    private static final String PREFS = "medtimer_data";
    private static final String KEY = "theme_mode";

    private Theme() {
    }

    static int mode(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int m = p.getInt(KEY, SYSTEM);
        return m == LIGHT || m == DARK ? m : SYSTEM;
    }

    static void setMode(Context c, int mode) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY, mode).commit();
    }

    static boolean isDark(Context c) {
        int m = mode(c);
        if (m == LIGHT) return false;
        if (m == DARK) return true;
        int ui = c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return ui == Configuration.UI_MODE_NIGHT_YES;
    }

    static void apply(Context c) {
        Palette.apply(isDark(c));
    }

    static void applyWindow(Activity a) {
        Window w = a.getWindow();
        if (w == null) return;
        w.setBackgroundDrawable(new ColorDrawable(Palette.BG));
        w.setStatusBarColor(Palette.BG);
        w.setNavigationBarColor(Palette.CARD);
        if (Build.VERSION.SDK_INT >= 29) {
            w.setStatusBarContrastEnforced(false);
            w.setNavigationBarContrastEnforced(false);
        }
        View decor = w.getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (Palette.isDark()) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        } else {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decor.setSystemUiVisibility(flags);
    }
}
