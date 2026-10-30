package com.dsh.medtimer;

import java.util.Locale;

/** Preset dosage forms and their icons. */
final class Forms {
    static final String TABLET = "药片";
    static final String CAPSULE = "胶囊";
    static final String LIQUID = "口服液";
    static final String INJECTION = "注射剂";
    static final String TOPICAL = "外用";
    static final String OTHER = "其他";

    static final String[] NAMES = {TABLET, CAPSULE, LIQUID, INJECTION, TOPICAL, OTHER};

    private Forms() {
    }

    static int indexOf(String form) {
        for (int i = 0; i < NAMES.length; i++) {
            if (NAMES[i].equals(form)) return i;
        }
        return 0;
    }

    static int iconRes(String form) {
        int i = indexOf(form);
        switch (i) {
            case 1: return R.drawable.ic_form_capsule;
            case 2: return R.drawable.ic_form_liquid;
            case 3: return R.drawable.ic_form_injection;
            case 4: return R.drawable.ic_form_topical;
            case 5: return R.drawable.ic_form_other;
            default: return R.drawable.ic_form_tablet;
        }
    }

    static String infer(String name, String dose, String method) {
        String n = name == null ? "" : name;
        String d = dose == null ? "" : dose;
        String m = method == null ? "" : method;
        String all = (n + " " + d + " " + m).toLowerCase(Locale.CHINA);
        if (m.contains("注射") || all.contains("注射") || all.contains("针剂") || all.contains("安瓿")) {
            return INJECTION;
        }
        if (m.contains("外用") || m.contains("吸入") || all.contains("软膏") || all.contains("乳膏")
                || all.contains("喷雾") || all.contains("贴")) {
            return TOPICAL;
        }
        if (all.contains("胶囊") || all.contains("胶丸")) return CAPSULE;
        if (d.contains("ml") || d.contains("毫升") || all.contains("口服液") || all.contains("糖浆")
                || all.contains("滴剂") || all.contains("溶液")) {
            return LIQUID;
        }
        if (all.contains("片") || all.contains("粒") || all.contains("丸")) return TABLET;
        return TABLET;
    }
}
