package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class SpecialReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null || !SpecialScheduler.ACTION_SPECIAL_ALARM.equals(intent.getAction())) return;
        String id = intent.getStringExtra(SpecialScheduler.EXTRA_SPECIAL_ID);
        if (id == null) return;

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock lock = null;
        if (pm != null) {
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "medtimer:special");
            try {
                lock.acquire(5_000L);
            } catch (Exception ignored) {
            }
        }
        try {
            Store store = Store.load(context);
            if (!store.isRemindersEnabled()) return;
            SpecialMed m = store.findSpecial(id);
            if (m == null || !m.enabled) return;
            long due = m.effectiveAt();
            if (due > System.currentTimeMillis() + 60_000L) return;
            NotificationHelper.ensureChannel(context);
            NotificationHelper.showSpecial(context, store, m);
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
