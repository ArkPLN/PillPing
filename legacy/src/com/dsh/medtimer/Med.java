package com.dsh.medtimer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

final class Med {
    static final String[] METHODS = {"口服", "含服", "舌下", "嚼服", "外用", "吸入", "注射", "其他"};

    String id = UUID.randomUUID().toString();
    String name = "";
    String dose = "";
    String method = "口服";
    String form = Forms.TABLET;
    String note = "";
    boolean enabled = true;
    /** true = appears in every dose, including doses added later. */
    boolean allDoses = true;
    /** Used when allDoses == false. Bit i = dose index i. */
    int slotMask = 0;
    int color = 0;
    /** 0 = no limit; otherwise number of days from courseStart. */
    int courseDays = 0;
    long courseStart = 0L;
    /** 0 = no follow-up reminder; otherwise interval in days. */
    int followupDays = 0;
    long nextFollowupAt = 0L;

    boolean forSlot(int slot) {
        if (!enabled || slot < 0 || slot >= Cycle.MAX_DOSES) return false;
        return allDoses || ((slotMask >>> slot) & 1) == 1;
    }

    boolean isCourseActive() {
        if (courseDays <= 0) return true;
        if (courseStart <= 0L) return true;
        return System.currentTimeMillis() < courseEnd();
    }

    long courseEnd() {
        if (courseDays <= 0) return 0L;
        long start = courseStart > 0L ? courseStart : System.currentTimeMillis();
        return start + courseDays * 86_400_000L;
    }

    String courseText() {
        if (courseDays <= 0) return "长期服用";
        long end = courseEnd();
        if (end <= 0L) return courseDays + " 天";
        if (System.currentTimeMillis() >= end) return "疗程已结束";
        return "疗程至 " + Fmt.monthDay(end - 1L);
    }

    String followupText() {
        if (followupDays <= 0) return "";
        if (nextFollowupAt <= 0L) return "每 " + followupDays + " 天复诊";
        return "复诊 " + Fmt.monthDay(nextFollowupAt);
    }

    boolean isSlot(int slot) {
        return ((slotMask >>> slot) & 1) == 1;
    }

    void toggleSlot(int slot) {
        if (slot < 0 || slot >= Cycle.MAX_DOSES) return;
        slotMask ^= (1 << slot);
    }

    void setSlot(int slot, boolean selected) {
        if (slot < 0 || slot >= Cycle.MAX_DOSES) return;
        if (selected) slotMask |= (1 << slot);
        else slotMask &= ~(1 << slot);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("id", id);
            o.put("name", name);
            o.put("dose", dose);
            o.put("method", method);
            o.put("form", form);
            o.put("note", note);
            o.put("enabled", enabled);
            o.put("color", color);
            o.put("allDoses", allDoses);
            o.put("slotMask", slotMask);
            o.put("courseDays", courseDays);
            o.put("courseStart", courseStart);
            o.put("followupDays", followupDays);
            o.put("nextFollowupAt", nextFollowupAt);
        } catch (JSONException ignored) {
        }
        return o;
    }

    static Med fromJson(JSONObject o) {
        Med m = new Med();
        m.id = o.optString("id", UUID.randomUUID().toString());
        m.name = o.optString("name", "");
        m.dose = o.optString("dose", "");
        m.method = o.optString("method", "口服");
        m.form = o.optString("form", Forms.infer(m.name, m.dose, m.method));
        m.note = o.optString("note", "");
        m.enabled = o.optBoolean("enabled", true);
        m.color = o.optInt("color", 0);
        m.courseDays = Math.max(0, Math.min(365, o.optInt("courseDays", 0)));
        m.courseStart = o.optLong("courseStart", 0L);
        m.followupDays = Math.max(0, Math.min(365, o.optInt("followupDays", 0)));
        m.nextFollowupAt = o.optLong("nextFollowupAt", 0L);
        if (o.has("allDoses")) {
            m.allDoses = o.optBoolean("allDoses", true);
            m.slotMask = o.optInt("slotMask", 0);
        } else {
            // Migration from the old three-slot array.
            JSONArray a = o.optJSONArray("slots");
            if (a == null) {
                m.allDoses = true;
            } else {
                boolean all = a.length() > 0;
                for (int i = 0; i < a.length(); i++) {
                    if (a.optInt(i, 0) != 1) all = false;
                }
                m.allDoses = all;
                if (!all) {
                    m.slotMask = 0;
                    for (int i = 0; i < a.length() && i < Cycle.MAX_DOSES; i++) {
                        if (a.optInt(i, 0) == 1) m.slotMask |= (1 << i);
                    }
                }
            }
        }
        return m;
    }
}
