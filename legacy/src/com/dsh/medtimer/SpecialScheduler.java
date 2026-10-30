package com.dsh.medtimer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

final class SpecialScheduler {
    static final String ACTION_SPECIAL_ALARM = "com.dsh.medtimer.SPECIAL_ALARM";
    static final String EXTRA_SPECIAL_ID = "special_id";
    private static final String TAG = "MedTimerSpecial";

    private SpecialScheduler() {
    }

    private static PendingIntent alarmIntent(Context c, SpecialMed m) {
        Intent i = new Intent(c, SpecialReceiver.class)
                .setAction(ACTION_SPECIAL_ALARM)
                .putExtra(EXTRA_SPECIAL_ID, m.id)
                .setData(Uri.parse("medtimer://special/" + m.id));
        return PendingIntent.getBroadcast(c, 7000 + m.code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void scheduleAll(Context context, boolean allowImmediate) {
        Store store = Store.load(context);
        cancelAll(context);
        if (!store.isRemindersEnabled()) return;
        long now = System.currentTimeMillis();
        for (SpecialMed m : store.specials) {
            if (!m.enabled) continue;
            long trigger = m.effectiveAt();
            if (trigger <= 0L) continue;
            if (trigger <= now) {
                if (!allowImmediate) continue;
                trigger = now + 2000L;
            }
            setAlarm(context, m, trigger);
        }
    }

    static void scheduleOne(Context context, String id, boolean allowImmediate) {
        Store store = Store.load(context);
        if (!store.isRemindersEnabled()) return;
        SpecialMed m = store.findSpecial(id);
        if (m == null) return;
        cancelOne(context, m);
        if (!m.enabled) return;
        long now = System.currentTimeMillis();
        long trigger = m.effectiveAt();
        if (trigger <= 0L) return;
        if (trigger <= now) {
            if (!allowImmediate) return;
            trigger = now + 2000L;
        }
        setAlarm(context, m, trigger);
    }

    private static void setAlarm(Context context, SpecialMed m, long triggerAtMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(context, m);
        Intent show = new Intent(context, MainActivity.class)
                .putExtra("open_special", m.id)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPi = PendingIntent.getActivity(context, 7500 + m.code, show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showPi), pi);
            }
        } catch (SecurityException e) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } catch (Exception ignored) {
            }
        } catch (Exception e) {
            Log.e(TAG, "Special alarm failed", e);
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } catch (Exception ignored) {
            }
        }
    }

    static void cancelOne(Context context, SpecialMed m) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.cancel(alarmIntent(context, m));
        } catch (Exception ignored) {
        }
    }

    static void cancelAll(Context context) {
        Store store = Store.load(context);
        for (SpecialMed m : store.specials) {
            cancelOne(context, m);
        }
    }
}
