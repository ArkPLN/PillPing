package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class ActionReceiver extends BroadcastReceiver {
    static final String ACTION_MARK = "com.dsh.medtimer.ACTION_MARK";
    static final String ACTION_SNOOZE = "com.dsh.medtimer.ACTION_SNOOZE";
    static final String ACTION_STATE_CHANGED = "com.dsh.medtimer.STATE_CHANGED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null) return;
        String action = intent.getAction();
        int dose = intent.getIntExtra(ReminderScheduler.EXTRA_DOSE, -1);
        if (dose < 0 || dose >= Cycle.MAX_DOSES) return;

        Store store = Store.load(context);
        if (store.cycle == null || dose >= store.cycle.size()) return;

        if (ACTION_MARK.equals(action)) {
            if (store.cycle.status[dose] != Cycle.PENDING) return;
            store.markTaken(dose);
            NotificationHelper.cancel(context, dose);
            ReminderScheduler.scheduleAll(context, false);
            Toast.makeText(context, "已记录第" + (dose + 1) + "次服药", Toast.LENGTH_SHORT).show();
        } else if (ACTION_SNOOZE.equals(action)) {
            if (store.cycle.status[dose] != Cycle.PENDING) return;
            store.snooze(dose, 10);
            NotificationHelper.cancel(context, dose);
            ReminderScheduler.scheduleDose(context, dose, true);
            Toast.makeText(context, "将在 10 分钟后提醒", Toast.LENGTH_SHORT).show();
        } else {
            return;
        }

        Intent changed = new Intent(ACTION_STATE_CHANGED).setPackage(context.getPackageName());
        context.sendBroadcast(changed);
    }
}
