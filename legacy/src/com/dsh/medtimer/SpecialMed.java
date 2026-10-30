package com.dsh.medtimer;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.UUID;

/**
 * A medication that is NOT part of the normal 3/N-times daily chain.
 * It has its own independent reminder schedule.
 */
final class SpecialMed {
    static final int MODE_INTERVAL = 0;
    static final int MODE_DAILY = 1;

    String id = UUID.randomUUID().toString();
    int code = 0;
    String name = "";
    String dose = "";
    String method = "口服";
    String form = Forms.TABLET;
    String note = "";
    boolean enabled = true;
    int mode = MODE_INTERVAL;
    int intervalHours = 8;
    int hour = 21;
    int minute = 0;
    long nextAt = 0L;
    long lastAt = 0L;
    long snoozeUntil = 0L;

    long effectiveAt() {
        return snoozeUntil > 0L ? snoozeUntil : nextAt;
    }

    long computeNext(long fromMillis) {
        long from = fromMillis > 0L ? fromMillis : System.currentTimeMillis();
        if (mode == MODE_INTERVAL) {
            return from + Math.max(1, intervalHours) * 3600_000L;
        }
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(from);
        c.set(Calendar.HOUR_OF_DAY, Math.max(0, Math.min(23, hour)));
        c.set(Calendar.MINUTE, Math.max(0, Math.min(59, minute)));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= from) {
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return c.getTimeInMillis();
    }

    /** Next reminder after a dose was actually taken. Daily mode always moves to the next day. */
    long computeNextAfterTaken(long atMillis) {
        long at = atMillis > 0L ? atMillis : System.currentTimeMillis();
        if (mode == MODE_INTERVAL) {
            return at + Math.max(1, intervalHours) * 3600_000L;
        }
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, Math.max(0, Math.min(23, hour)));
        c.set(Calendar.MINUTE, Math.max(0, Math.min(59, minute)));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    String scheduleText() {
        if (mode == MODE_INTERVAL) {
            return "每 " + intervalHours + " 小时";
        }
        return "每天 " + String.format(java.util.Locale.CHINA, "%02d:%02d", hour, minute);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("id", id);
            o.put("code", code);
            o.put("name", name);
            o.put("dose", dose);
            o.put("method", method);
            o.put("form", form);
            o.put("note", note);
            o.put("enabled", enabled);
            o.put("mode", mode);
            o.put("intervalHours", intervalHours);
            o.put("hour", hour);
            o.put("minute", minute);
            o.put("nextAt", nextAt);
            o.put("lastAt", lastAt);
            o.put("snoozeUntil", snoozeUntil);
        } catch (JSONException ignored) {
        }
        return o;
    }

    static SpecialMed fromJson(JSONObject o) {
        SpecialMed m = new SpecialMed();
        m.id = o.optString("id", UUID.randomUUID().toString());
        m.code = o.optInt("code", 0);
        m.name = o.optString("name", "");
        m.dose = o.optString("dose", "");
        m.method = o.optString("method", "口服");
        m.form = o.optString("form", Forms.infer(m.name, m.dose, m.method));
        m.note = o.optString("note", "");
        m.enabled = o.optBoolean("enabled", true);
        m.mode = o.optInt("mode", MODE_INTERVAL);
        m.intervalHours = Math.max(1, Math.min(72, o.optInt("intervalHours", 8)));
        m.hour = Math.max(0, Math.min(23, o.optInt("hour", 21)));
        m.minute = Math.max(0, Math.min(59, o.optInt("minute", 0)));
        m.nextAt = o.optLong("nextAt", 0L);
        m.lastAt = o.optLong("lastAt", 0L);
        m.snoozeUntil = o.optLong("snoozeUntil", 0L);
        return m;
    }
}
