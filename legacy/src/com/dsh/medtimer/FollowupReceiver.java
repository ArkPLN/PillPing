package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class FollowupReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null || !FollowupScheduler.ACTION_FOLLOWUP_ALARM.equals(intent.getAction())) return;
        String id = intent.getStringExtra(FollowupScheduler.EXTRA_MED_ID);

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock lock = null;
        if (pm != null) {
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "medtimer:followup");
            try {
                lock.acquire(5_000L);
            } catch (Exception ignored) {
            }
        }
        try {
            Store store = Store.load(context);
            if (!store.isRemindersEnabled()) return;
            Med med = null;
            if (id != null) med = store.findMed(id);
            if (med == null || !med.enabled || !med.isCourseActive() || med.followupDays <= 0) return;
            long due = med.nextFollowupAt;
            if (due > System.currentTimeMillis() + 60_000L) return;
            NotificationHelper.ensureChannel(context);
            NotificationHelper.showFollowup(context, med);
            med.nextFollowupAt = System.currentTimeMillis() + med.followupDays * 86_400_000L;
            store.saveMeds();
            FollowupScheduler.scheduleAll(context, true);
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
