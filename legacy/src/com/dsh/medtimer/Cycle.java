package com.dsh.medtimer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;

final class Cycle {
    static final int PENDING = 0;
    static final int TAKEN = 1;
    static final int SKIPPED = 2;
    static final int MAX_DOSES = 12;

    String startDate = "";
    long firstAt = 0L;
    int count = 3;
    long[] planned = new long[3];
    int[] status = new int[]{PENDING, PENDING, PENDING};
    long[] actedAt = new long[3];
    long[] snoozeUntil = new long[3];

    Cycle() {
        this(3);
    }

    Cycle(int n) {
        count = clamp(n);
        planned = new long[count];
        status = new int[count];
        actedAt = new long[count];
        snoozeUntil = new long[count];
    }

    static int clamp(int n) {
        return Math.max(1, Math.min(MAX_DOSES, n));
    }

    int size() {
        return count;
    }

    void resize(int newCount) {
        int n = clamp(newCount);
        if (n == count) return;
        int old = count;
        planned = Arrays.copyOf(planned, n);
        status = Arrays.copyOf(status, n);
        actedAt = Arrays.copyOf(actedAt, n);
        snoozeUntil = Arrays.copyOf(snoozeUntil, n);
        for (int i = old; i < n; i++) {
            planned[i] = 0L;
            status[i] = PENDING;
            actedAt[i] = 0L;
            snoozeUntil[i] = 0L;
        }
        count = n;
    }

    boolean isStarted() {
        return firstAt > 0L;
    }

    int nextPending() {
        for (int i = 0; i < count; i++) {
            if (status[i] == PENDING) return i;
        }
        return -1;
    }

    boolean allResolved() {
        return isStarted() && nextPending() < 0;
    }

    int takenCount() {
        int n = 0;
        for (int i = 0; i < count; i++) if (status[i] == TAKEN) n++;
        return n;
    }

    int skippedCount() {
        int n = 0;
        for (int i = 0; i < count; i++) if (status[i] == SKIPPED) n++;
        return n;
    }

    int lastTakenIndex() {
        for (int i = count - 1; i >= 0; i--) {
            if (status[i] == TAKEN) return i;
        }
        return -1;
    }

    long effectiveTime(int i) {
        if (i < 0 || i >= count) return 0L;
        if (snoozeUntil[i] > 0L) return snoozeUntil[i];
        return planned[i];
    }

    /**
     * Re-project every still-pending dose from the most recent actually-taken dose.
     * This is the core of "next dose = actual intake + interval", not "first dose + N*interval".
     */
    void projectPendingFromLastTaken(int intervalHours) {
        int anchor = lastTakenIndex();
        long base;
        if (anchor >= 0) {
            base = actedAt[anchor] > 0L ? actedAt[anchor] : planned[anchor];
        } else {
            anchor = 0;
            base = firstAt;
        }
        long step = Math.max(1, intervalHours) * 3600_000L;
        for (int j = anchor + 1; j < count; j++) {
            if (status[j] != PENDING) continue;
            planned[j] = base + (long) (j - anchor) * step;
            snoozeUntil[j] = 0L;
        }
    }

    /** After taking dose i, shift every later pending dose to actual time + interval. */
    void rescheduleAfterTaken(int index, int intervalHours) {
        if (index < 0 || index >= count) return;
        long base = actedAt[index] > 0L ? actedAt[index] : System.currentTimeMillis();
        long step = Math.max(1, intervalHours) * 3600_000L;
        for (int j = index + 1; j < count; j++) {
            if (status[j] != PENDING) continue;
            planned[j] = base + (long) (j - index) * step;
            snoozeUntil[j] = 0L;
        }
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("startDate", startDate);
            o.put("firstAt", firstAt);
            o.put("count", count);
            o.put("planned", longArray(planned));
            o.put("status", intArray(status));
            o.put("actedAt", longArray(actedAt));
            o.put("snoozeUntil", longArray(snoozeUntil));
        } catch (JSONException ignored) {
        }
        return o;
    }

    static Cycle fromJson(JSONObject o) {
        int n = o.optInt("count", 0);
        if (n <= 0) {
            JSONArray a = o.optJSONArray("status");
            if (a != null) n = a.length();
            if (n <= 0) {
                JSONArray p = o.optJSONArray("planned");
                n = p == null ? 3 : p.length();
            }
        }
        n = clamp(n);
        Cycle c = new Cycle(n);
        c.startDate = o.optString("startDate", "");
        c.firstAt = o.optLong("firstAt", 0L);
        c.planned = readLongs(o.optJSONArray("planned"), c.planned);
        c.status = readInts(o.optJSONArray("status"), c.status);
        c.actedAt = readLongs(o.optJSONArray("actedAt"), c.actedAt);
        c.snoozeUntil = readLongs(o.optJSONArray("snoozeUntil"), c.snoozeUntil);
        return c;
    }

    private static JSONArray longArray(long[] values) {
        JSONArray a = new JSONArray();
        for (long v : values) a.put(v);
        return a;
    }

    private static JSONArray intArray(int[] values) {
        JSONArray a = new JSONArray();
        for (int v : values) a.put(v);
        return a;
    }

    private static long[] readLongs(JSONArray a, long[] fallback) {
        int n = fallback.length;
        long[] out = new long[n];
        for (int i = 0; i < n; i++) {
            out[i] = a == null ? fallback[i] : a.optLong(i, fallback[i]);
        }
        return out;
    }

    private static int[] readInts(JSONArray a, int[] fallback) {
        int n = fallback.length;
        int[] out = new int[n];
        for (int i = 0; i < n; i++) {
            out[i] = a == null ? fallback[i] : a.optInt(i, fallback[i]);
        }
        return out;
    }
}
