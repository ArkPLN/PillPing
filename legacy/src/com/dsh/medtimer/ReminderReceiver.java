package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null || !ReminderScheduler.ACTION_ALARM.equals(intent.getAction())) return;
        int dose = intent.getIntExtra(ReminderScheduler.EXTRA_DOSE, -1);
        if (dose < 0 || dose >= Cycle.MAX_DOSES) return;

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock lock = null;
        if (pm != null) {
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "medtimer:alarm");
            try {
                lock.acquire(5_000L);
            } catch (Exception ignored) {
            }
        }
        try {
            Store store = Store.load(context);
            if (!store.isRemindersEnabled() || !store.hasActiveMeds()) return;
            if (store.cycle == null || dose >= store.cycle.size()) return;
            if (store.cycle.status[dose] != Cycle.PENDING) return;
            long due = store.cycle.effectiveTime(dose);
            if (due > System.currentTimeMillis() + 60_000L) return;
            NotificationHelper.ensureChannel(context);
            ReminderScheduler.scheduleAfterFired(context, dose);
            NotificationHelper.showReminder(context, store, dose);
        } finally {
            if (lock != null && lock.isHeld()) {
                try {
                    lock.release();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
