package com.dsh.medtimer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

/** Schedules only the earliest follow-up reminder across all medications. */
final class FollowupScheduler {
    static final String ACTION_FOLLOWUP_ALARM = "com.dsh.medtimer.FOLLOWUP_ALARM";
    static final String EXTRA_MED_ID = "followup_med_id";
    private static final String TAG = "MedTimerFollowup";

    private FollowupScheduler() {
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, FollowupReceiver.class)
                .setAction(ACTION_FOLLOWUP_ALARM)
                .setData(Uri.parse("medtimer://followup/next"));
        return PendingIntent.getBroadcast(c, 8600, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void scheduleAll(Context context, boolean allowImmediate) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.cancel(alarmIntent(context));
        } catch (Exception ignored) {
        }
        Store store = Store.load(context);
        if (!store.isRemindersEnabled()) return;
        long now = System.currentTimeMillis();
        Med earliest = null;
        for (Med m : store.meds) {
            if (!m.enabled || !m.isCourseActive()) continue;
            if (m.followupDays <= 0 || m.nextFollowupAt <= 0L) continue;
            if (earliest == null || m.nextFollowupAt < earliest.nextFollowupAt) earliest = m;
        }
        if (earliest == null) return;
        long trigger = earliest.nextFollowupAt;
        if (trigger <= now) {
            if (!allowImmediate) return;
            trigger = now + 2000L;
        }
        setAlarm(context, earliest, trigger);
    }

    static void scheduleFor(Context context, Med m, boolean allowImmediate) {
        if (m == null || m.followupDays <= 0 || m.nextFollowupAt <= 0L) return;
        Store store = Store.load(context);
        if (!store.isRemindersEnabled() || !m.enabled || !m.isCourseActive()) return;
        long now = System.currentTimeMillis();
        long trigger = m.nextFollowupAt;
        if (trigger <= now) {
            if (!allowImmediate) return;
            trigger = now + 2000L;
        }
        setAlarm(context, m, trigger);
    }

    private static void setAlarm(Context context, Med m, long triggerAtMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(context, FollowupReceiver.class)
                .setAction(ACTION_FOLLOWUP_ALARM)
                .putExtra(EXTRA_MED_ID, m.id)
                .setData(Uri.parse("medtimer://followup/next"));
        PendingIntent pi = PendingIntent.getBroadcast(context, 8600, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent show = new Intent(context, MainActivity.class)
                .putExtra("open_med", m.id)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPi = PendingIntent.getActivity(context, 8700, show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showPi), pi);
            }
        } catch (Exception e) {
            Log.e(TAG, "Follow-up alarm failed", e);
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } catch (Exception ignored) {
            }
        }
    }

    static void cancelAll(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.cancel(alarmIntent(context));
        } catch (Exception ignored) {
        }
    }
}
