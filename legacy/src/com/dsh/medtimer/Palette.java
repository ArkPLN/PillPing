package com.dsh.medtimer;

import android.graphics.Color;

final class Palette {
    static int BG = 0xFFF5F8F7;
    static int CARD = 0xFFFFFFFF;
    static int INK = 0xFF12211E;
    static int INK_SOFT = 0xFF33423E;
    static int MUTED = 0xFF64746F;
    static int MUTED_LIGHT = 0xFF93A19D;
    static int PRIMARY = 0xFF0F766E;
    static int PRIMARY_DARK = 0xFF0B5D56;
    static int PRIMARY_LIGHT = 0xFF14B8A6;
    static int MINT = 0xFFE6F4F1;
    static int MINT_STRONG = 0xFFCCEAE4;
    static int LINE = 0xFFE4ECE9;
    static int FIELD = 0xFFF3F7F5;
    static int AMBER = 0xFFB45309;
    static int AMBER_BG = 0xFFFFF7E6;
    static int AMBER_LINE = 0xFFF6DFAF;
    static int DANGER = 0xFFB3261E;
    static int DANGER_BG = 0xFFFDECEA;
    static int WHITE = 0xFFFFFFFF;
    static int VIOLET = 0xFF7C3AED;
    static int VIOLET_BG = 0xFFF3E8FF;
    static int VIOLET_LINE = 0xFFC4B5FD;
    static int VIOLET_TEXT = 0xFF6D28D9;
    static int NEXT_BG = 0xFFF0FBF8;
    static int OVERDUE_BG = 0xFFFFF8EC;
    static int ON_WHITE = 0xFF0F766E;
    static int ON_BRIGHT = 0xFF062E2A;

    private static boolean dark = false;

    static final int[] MED_COLORS = {
            0xFF0F766E,
            0xFF2563EB,
            0xFFC2410C,
            0xFF7C3AED,
            0xFFBE123C,
            0xFF0369A1,
            0xFF4D7C0F
    };

    private Palette() {
    }

    static boolean isDark() {
        return dark;
    }

    static void apply(boolean darkMode) {
        dark = darkMode;
        if (darkMode) {
            BG = 0xFF0B1210;
            CARD = 0xFF141F1C;
            INK = 0xFFEAF4F1;
            INK_SOFT = 0xFFC6D5D0;
            MUTED = 0xFF93A49F;
            MUTED_LIGHT = 0xFF6D7F79;
            PRIMARY = 0xFF2DD4BF;
            PRIMARY_DARK = 0xFF14B8A6;
            PRIMARY_LIGHT = 0xFF5EEAD4;
            MINT = 0xFF183A33;
            MINT_STRONG = 0xFF1F4A40;
            LINE = 0xFF263A34;
            FIELD = 0xFF1A2925;
            AMBER = 0xFFFBBF24;
            AMBER_BG = 0xFF3A2A12;
            AMBER_LINE = 0xFF6B4E1F;
            DANGER = 0xFFF87171;
            DANGER_BG = 0xFF3B1D1D;
            WHITE = 0xFFFFFFFF;
            VIOLET = 0xFFA78BFA;
            VIOLET_BG = 0xFF2A1E3F;
            VIOLET_LINE = 0xFF4C3A6B;
            VIOLET_TEXT = 0xFFD8B4FE;
            NEXT_BG = 0xFF102C27;
            OVERDUE_BG = 0xFF332711;
        } else {
            BG = 0xFFF5F8F7;
            CARD = 0xFFFFFFFF;
            INK = 0xFF12211E;
            INK_SOFT = 0xFF33423E;
            MUTED = 0xFF64746F;
            MUTED_LIGHT = 0xFF93A19D;
            PRIMARY = 0xFF0F766E;
            PRIMARY_DARK = 0xFF0B5D56;
            PRIMARY_LIGHT = 0xFF14B8A6;
            MINT = 0xFFE6F4F1;
            MINT_STRONG = 0xFFCCEAE4;
            LINE = 0xFFE4ECE9;
            FIELD = 0xFFF3F7F5;
            AMBER = 0xFFB45309;
            AMBER_BG = 0xFFFFF7E6;
            AMBER_LINE = 0xFFF6DFAF;
            DANGER = 0xFFB3261E;
            DANGER_BG = 0xFFFDECEA;
            WHITE = 0xFFFFFFFF;
            VIOLET = 0xFF7C3AED;
            VIOLET_BG = 0xFFF3E8FF;
            VIOLET_LINE = 0xFFC4B5FD;
            VIOLET_TEXT = 0xFF6D28D9;
            NEXT_BG = 0xFFF0FBF8;
            OVERDUE_BG = 0xFFFFF8EC;
        }
    }

    static int medColor(int index) {
        int i = index % MED_COLORS.length;
        if (i < 0) i += MED_COLORS.length;
        return MED_COLORS[i];
    }

    static int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }
}
