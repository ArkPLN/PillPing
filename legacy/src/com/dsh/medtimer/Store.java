package com.dsh.medtimer;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class Store {
    private static final String PREFS = "medtimer_data";
    private static final String KEY_MEDS = "meds_v1";
    private static final String KEY_CYCLE = "cycle_v1";
    private static final String KEY_HISTORY = "history_v1";
    private static final String KEY_SPECIALS = "specials_v1";
    private static final String KEY_INTERVAL = "interval_hours";
    private static final String KEY_DOSE_COUNT = "dose_count";
    private static final String KEY_ONBOARDED = "onboarded";
    private static final String KEY_REMINDERS = "reminders_enabled";
    private static final Object LOCK = new Object();

    final Context context;
    private final SharedPreferences prefs;
    List<Med> meds = new ArrayList<>();
    Cycle cycle;
    List<HistoryItem> history = new ArrayList<>();
    List<SpecialMed> specials = new ArrayList<>();
    int interval = 5;
    int doseCount = 3;
    boolean remindersEnabled = true;

    private Store(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static Store load(Context context) {
        Store s = new Store(context);
        synchronized (LOCK) {
            s.interval = Math.max(1, Math.min(12, s.prefs.getInt(KEY_INTERVAL, 5)));
            s.doseCount = Cycle.clamp(s.prefs.getInt(KEY_DOSE_COUNT, 3));
            s.meds = readMeds(s.prefs.getString(KEY_MEDS, "[]"));
            s.remindersEnabled = s.prefs.getBoolean(KEY_REMINDERS, true);
            long today = System.currentTimeMillis() / 86_400_000L * 86_400_000L;
            for (Med m : s.meds) {
                if (m.courseDays > 0 && m.courseStart <= 0L) m.courseStart = today;
            }
            s.history = readHistory(s.prefs.getString(KEY_HISTORY, "[]"));
            s.specials = readSpecials(s.prefs.getString(KEY_SPECIALS, "[]"));
            for (SpecialMed m : s.specials) {
                if (m.nextAt <= 0L) m.nextAt = m.computeNext(System.currentTimeMillis());
            }
            String cycleRaw = s.prefs.getString(KEY_CYCLE, null);
            if (cycleRaw != null) {
                try {
                    s.cycle = Cycle.fromJson(new JSONObject(cycleRaw));
                    if (s.cycle != null && s.cycle.size() > 0) {
                        s.doseCount = s.cycle.size();
                        boolean hasSnooze = false;
                        for (int i = 0; i < s.cycle.size(); i++) {
                            if (s.cycle.status[i] == Cycle.PENDING && s.cycle.snoozeUntil[i] > 0L) {
                                hasSnooze = true;
                            }
                        }
                        // Repair old/corrupt schedules that were projected from the first dose
                        // instead of from the latest actual intake.
                        if (!hasSnooze) s.cycle.projectPendingFromLastTaken(s.interval);
                    }
                } catch (Exception e) {
                    s.cycle = null;
                }
            }
        }
        return s;
    }

    private static List<Med> readMeds(String raw) {
        List<Med> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(raw);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null) out.add(Med.fromJson(o));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static List<SpecialMed> readSpecials(String raw) {
        List<SpecialMed> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(raw);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null) out.add(SpecialMed.fromJson(o));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static List<HistoryItem> readHistory(String raw) {
        List<HistoryItem> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(raw);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null) out.add(HistoryItem.fromJson(o));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    void saveMeds() {
        synchronized (LOCK) {
            JSONArray a = new JSONArray();
            for (Med m : meds) a.put(m.toJson());
            prefs.edit().putString(KEY_MEDS, a.toString()).commit();
        }
    }

    void saveCycle() {
        synchronized (LOCK) {
            if (cycle == null || !cycle.isStarted()) {
                prefs.edit().remove(KEY_CYCLE).commit();
            } else {
                prefs.edit().putString(KEY_CYCLE, cycle.toJson().toString()).commit();
            }
        }
    }

    void saveSpecials() {
        synchronized (LOCK) {
            JSONArray a = new JSONArray();
            for (SpecialMed m : specials) a.put(m.toJson());
            prefs.edit().putString(KEY_SPECIALS, a.toString()).commit();
        }
    }

    int nextSpecialCode() {
        int max = -1;
        for (SpecialMed m : specials) max = Math.max(max, m.code);
        return Math.min(127, max + 1);
    }

    void addSpecial(SpecialMed m) {
        m.code = nextSpecialCode();
        if (findSpecialByCode(m.code) != null) {
            for (int i = 0; i < 128; i++) {
                if (findSpecialByCode(i) == null) {
                    m.code = i;
                    break;
                }
            }
        }
        specials.add(m);
        saveSpecials();
    }

    void removeSpecial(SpecialMed m) {
        specials.remove(m);
        saveSpecials();
    }

    SpecialMed findSpecial(String id) {
        for (SpecialMed m : specials) {
            if (m.id.equals(id)) return m;
        }
        return null;
    }

    SpecialMed findSpecialByCode(int code) {
        for (SpecialMed m : specials) {
            if (m.code == code) return m;
        }
        return null;
    }

    void markSpecialTaken(String id, long atMillis) {
        SpecialMed m = findSpecial(id);
        if (m == null) return;
        long now = System.currentTimeMillis();
        long at = atMillis > 0L ? Math.min(atMillis, now) : now;
        m.lastAt = at;
        m.snoozeUntil = 0L;
        m.nextAt = m.computeNextAfterTaken(at);
        saveSpecials();
    }

    void snoozeSpecial(String id, int minutes) {
        SpecialMed m = findSpecial(id);
        if (m == null || !m.enabled) return;
        long base = Math.max(System.currentTimeMillis(), m.effectiveAt());
        m.snoozeUntil = base + Math.max(1, minutes) * 60_000L;
        saveSpecials();
    }

    void saveHistory() {
        synchronized (LOCK) {
            JSONArray a = new JSONArray();
            for (HistoryItem h : history) a.put(h.toJson());
            prefs.edit().putString(KEY_HISTORY, a.toString()).commit();
        }
    }

    void setInterval(int newInterval) {
        int v = Math.max(1, Math.min(12, newInterval));
        if (v == interval) return;
        interval = v;
        synchronized (LOCK) {
            prefs.edit().putInt(KEY_INTERVAL, v).commit();
        }
        if (cycle != null && cycle.isStarted()) {
            cycle.projectPendingFromLastTaken(interval);
            saveCycle();
        }
    }

    /** Change the total number of doses per cycle. Existing taken/skipped rows are preserved. */
    void setDoseCount(int newCount) {
        int v = Cycle.clamp(newCount);
        if (v == doseCount) return;
        doseCount = v;
        synchronized (LOCK) {
            prefs.edit().putInt(KEY_DOSE_COUNT, v).commit();
        }
        if (cycle != null && cycle.isStarted()) {
            int oldSize = cycle.size();
            cycle.resize(v);
            if (v > oldSize) {
                cycle.projectPendingFromLastTaken(interval);
            }
            saveCycle();
        }
    }

    void archiveCurrent() {
        if (cycle == null || !cycle.isStarted()) return;
        HistoryItem h = new HistoryItem();
        h.date = cycle.startDate;
        h.startAt = cycle.firstAt;
        h.taken = cycle.takenCount();
        h.total = cycle.size();
        h.summary = allMedSummary();
        history.add(0, h);
        while (history.size() > 40) history.remove(history.size() - 1);
        saveHistory();
    }

    void startCycle(long firstAt, int intervalHours, int count) {
        interval = Math.max(1, Math.min(12, intervalHours));
        doseCount = Cycle.clamp(count);
        long first = firstAt > 0L ? firstAt : System.currentTimeMillis();
        long now = System.currentTimeMillis();
        if (first > now) first = now;
        archiveCurrent();
        Cycle c = new Cycle(doseCount);
        c.firstAt = first;
        c.startDate = Fmt.dateKey(first);
        for (int i = 0; i < doseCount; i++) {
            c.planned[i] = first + (long) i * interval * 3600_000L;
            c.status[i] = Cycle.PENDING;
            c.snoozeUntil[i] = 0L;
        }
        c.status[0] = Cycle.TAKEN;
        c.actedAt[0] = first;
        cycle = c;
        saveCycle();
        synchronized (LOCK) {
            prefs.edit().putInt(KEY_INTERVAL, interval)
                    .putInt(KEY_DOSE_COUNT, doseCount).commit();
        }
    }

    void markTaken(int index) {
        markTakenAt(index, System.currentTimeMillis());
    }

    /** Record a dose at a chosen actual time (used by "补登"). */
    void markTakenAt(int index, long atMillis) {
        if (cycle == null || index < 0 || index >= cycle.size()) return;
        long now = System.currentTimeMillis();
        long at = atMillis > 0L ? Math.min(atMillis, now) : now;
        cycle.status[index] = Cycle.TAKEN;
        cycle.actedAt[index] = at;
        cycle.snoozeUntil[index] = 0L;
        // Key behavior: every later pending dose is based on THIS actual intake time.
        cycle.rescheduleAfterTaken(index, interval);
        saveCycle();
    }

    void skip(int index) {
        if (cycle == null || index < 0 || index >= cycle.size()) return;
        cycle.status[index] = Cycle.SKIPPED;
        cycle.actedAt[index] = System.currentTimeMillis();
        cycle.snoozeUntil[index] = 0L;
        // Do not shift future doses from a skipped dose; keep the existing projected schedule.
        saveCycle();
    }

    void undo(int index) {
        if (cycle == null || index < 0 || index >= cycle.size()) return;
        cycle.status[index] = Cycle.PENDING;
        cycle.actedAt[index] = 0L;
        cycle.snoozeUntil[index] = 0L;
        cycle.projectPendingFromLastTaken(interval);
        saveCycle();
    }

    void snooze(int index, int minutes) {
        if (cycle == null || index < 0 || index >= cycle.size()) return;
        if (cycle.status[index] != Cycle.PENDING) return;
        long base = Math.max(System.currentTimeMillis(), cycle.effectiveTime(index));
        cycle.snoozeUntil[index] = base + Math.max(1, minutes) * 60_000L;
        saveCycle();
    }

    void clearToday() {
        cycle = null;
        saveCycle();
    }

    void clearAll() {
        synchronized (LOCK) {
            prefs.edit()
                    .remove(KEY_MEDS)
                    .remove(KEY_CYCLE)
                    .remove(KEY_HISTORY)
                    .remove(KEY_SPECIALS)
                    .remove(KEY_INTERVAL)
                    .remove(KEY_DOSE_COUNT)
                    .remove(KEY_REMINDERS)
                    .remove("last_use_day")
                    .remove("use_streak")
                    .commit();
        }
        meds = new ArrayList<>();
        history = new ArrayList<>();
        specials = new ArrayList<>();
        cycle = null;
        interval = 5;
        doseCount = 3;
        remindersEnabled = true;
    }

    int touchDailyUse() {
        String today = Fmt.todayKey();
        String last = prefs.getString("last_use_day", null);
        int streak = prefs.getInt("use_streak", 0);
        if (today.equals(last)) return Math.max(1, streak);
        boolean consecutive = false;
        if (last != null) {
            try {
                consecutive = java.time.LocalDate.parse(last).plusDays(1).toString().equals(today);
            } catch (Exception ignored) {
            }
        }
        streak = consecutive ? streak + 1 : 1;
        prefs.edit().putString("last_use_day", today).putInt("use_streak", streak).apply();
        return streak;
    }

    int streakDays() {
        return Math.max(1, prefs.getInt("use_streak", 1));
    }

    boolean isRemindersEnabled() {
        return remindersEnabled;
    }

    void setRemindersEnabled(boolean value) {
        remindersEnabled = value;
        prefs.edit().putBoolean(KEY_REMINDERS, value).apply();
    }

    boolean isOnboarded() {
        return prefs.getBoolean(KEY_ONBOARDED, false);
    }

    void setOnboarded(boolean value) {
        prefs.edit().putBoolean(KEY_ONBOARDED, value).apply();
    }

    List<Med> medsForSlot(int slot) {
        List<Med> out = new ArrayList<>();
        for (Med m : meds) {
            if (m.enabled && m.isCourseActive() && m.forSlot(slot)) out.add(m);
        }
        return out;
    }

    boolean hasActiveMeds() {
        for (Med m : meds) {
            if (m.enabled && m.isCourseActive()) return true;
        }
        return false;
    }

    int activeMedCount() {
        int n = 0;
        for (Med m : meds) if (m.enabled && m.isCourseActive()) n++;
        return n;
    }

    int totalMedCountForSlot(int slot) {
        return medsForSlot(slot).size();
    }

    String summaryForSlot(int slot, boolean withMethods, String separator) {
        List<Med> list = medsForSlot(slot);
        if (list.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            Med m = list.get(i);
            if (i > 0) sb.append(separator);
            sb.append(m.name).append(" ").append(m.dose);
            if (withMethods) sb.append("（").append(m.method).append("）");
        }
        return sb.toString();
    }

    String bigTextForSlot(int slot) {
        List<Med> list = medsForSlot(slot);
        if (list.isEmpty()) return "还没有添加药物，点开应用添加后再按时服用。";
        StringBuilder sb = new StringBuilder();
        for (Med m : list) {
            sb.append("• ").append(m.name).append("  ").append(m.dose).append("  ").append(m.method);
            if (m.note != null && m.note.length() > 0) sb.append("  · ").append(m.note);
            sb.append('\n');
        }
        return sb.toString().trim();
    }

    String allMedSummary() {
        StringBuilder sb = new StringBuilder();
        for (Med m : meds) {
            if (!m.enabled) continue;
            if (sb.length() > 0) sb.append("、");
            sb.append(m.name);
        }
        return sb.length() == 0 ? "未配置药物" : sb.toString();
    }

    Med findMed(String id) {
        for (Med m : meds) {
            if (m.id.equals(id)) return m;
        }
        return null;
    }
}
