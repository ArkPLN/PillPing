package com.dsh.medtimer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

final class ReminderScheduler {
    static final String ACTION_ALARM = "com.dsh.medtimer.ACTION_ALARM";
    static final String EXTRA_DOSE = "dose";
    private static final String TAG = "MedTimer";

    private ReminderScheduler() {
    }

    static PendingIntent alarmIntent(Context c, int dose) {
        Intent i = new Intent(c, ReminderReceiver.class)
                .setAction(ACTION_ALARM)
                .putExtra(EXTRA_DOSE, dose)
                .setData(Uri.parse("medtimer://alarm/" + dose));
        return PendingIntent.getBroadcast(c, 100 + dose, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Only the next pending dose is registered with AlarmManager.
     * After it fires, ReminderReceiver schedules the following one. This keeps
     * at most one medication alarm pending instead of one per dose (up to 12).
     */
    static void scheduleAll(Context context, boolean allowImmediate) {
        Store store = Store.load(context);
        cancelAll(context);
        if (!store.isRemindersEnabled() || !store.hasActiveMeds()) return;
        if (store.cycle == null || !store.cycle.isStarted()) return;
        int next = store.cycle.nextPending();
        if (next < 0) return;
        long now = System.currentTimeMillis();
        long trigger = store.cycle.effectiveTime(next);
        if (trigger <= now) {
            if (!allowImmediate) return;
            trigger = now + 2000L;
        }
        setAlarm(context, next, trigger);
    }

    /**
     * Called after a reminder has fired. It queues the next pending dose so a
     * user who ignores the notification still gets later reminders, while only
     * one alarm is ever outstanding.
     */
    static void scheduleAfterFired(Context context, int firedDose) {
        Store store = Store.load(context);
        if (!store.isRemindersEnabled() || !store.hasActiveMeds()) return;
        if (store.cycle == null || !store.cycle.isStarted()) return;
        int next = -1;
        for (int i = firedDose + 1; i < store.cycle.size(); i++) {
            if (store.cycle.status[i] == Cycle.PENDING) {
                next = i;
                break;
            }
        }
        if (next < 0) return;
        cancelAll(context);
        long now = System.currentTimeMillis();
        long trigger = store.cycle.effectiveTime(next);
        if (trigger <= now) trigger = now + 2000L;
        setAlarm(context, next, trigger);
    }

    static void scheduleDose(Context context, int dose, boolean allowImmediate) {
        Store store = Store.load(context);
        if (!store.isRemindersEnabled()) return;
        if (store.cycle == null || dose < 0 || dose >= store.cycle.size()) return;
        if (store.cycle.status[dose] != Cycle.PENDING) {
            cancelDose(context, dose);
            return;
        }
        long now = System.currentTimeMillis();
        long trigger = store.cycle.effectiveTime(dose);
        if (trigger <= now) {
            if (!allowImmediate) {
                cancelDose(context, dose);
                return;
            }
            trigger = now + 2000L;
        }
        setAlarm(context, dose, trigger);
    }

    private static void setAlarm(Context context, int dose, long triggerAtMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(context, dose);
        Intent show = new Intent(context, MainActivity.class)
                .putExtra("open_dose", dose)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPi = PendingIntent.getActivity(context, 5000 + dose, show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                Log.w(TAG, "Exact alarm permission missing; scheduled inexact dose " + dose);
            } else {
                // An alarm-clock alarm is treated as a user-visible alarm by the system.
                // On aggressive Chinese ROMs this is less likely to be dropped while idle.
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAtMillis, showPi), pi);
            }
        } catch (SecurityException e) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } catch (Exception ignored) {
            }
        } catch (Exception e) {
            Log.e(TAG, "Alarm clock scheduling failed; falling back", e);
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } catch (Exception e2) {
                try {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                } catch (Exception e3) {
                    Log.e(TAG, "Unable to schedule alarm", e3);
                }
            }
        }
    }

    static void cancelDose(Context context, int dose) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.cancel(alarmIntent(context, dose));
        } catch (Exception ignored) {
        }
    }

    static void cancelAll(Context context) {
        for (int i = 0; i < Cycle.MAX_DOSES; i++) cancelDose(context, i);
    }
}
