package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class SpecialActionReceiver extends BroadcastReceiver {
    static final String ACTION_MARK = "com.dsh.medtimer.SPECIAL_MARK";
    static final String ACTION_SNOOZE = "com.dsh.medtimer.SPECIAL_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null) return;
        String action = intent.getAction();
        String id = intent.getStringExtra(SpecialScheduler.EXTRA_SPECIAL_ID);
        if (id == null) return;

        Store store = Store.load(context);
        SpecialMed m = store.findSpecial(id);
        if (m == null || !m.enabled) return;

        if (ACTION_MARK.equals(action)) {
            store.markSpecialTaken(id, System.currentTimeMillis());
            NotificationHelper.cancelSpecial(context, m.code);
            SpecialScheduler.scheduleOne(context, id, false);
            Toast.makeText(context, "已记录 " + m.name, Toast.LENGTH_SHORT).show();
        } else if (ACTION_SNOOZE.equals(action)) {
            store.snoozeSpecial(id, 10);
            NotificationHelper.cancelSpecial(context, m.code);
            SpecialScheduler.scheduleOne(context, id, true);
            Toast.makeText(context, "将在 10 分钟后提醒", Toast.LENGTH_SHORT).show();
        } else {
            return;
        }

        Intent changed = new Intent(ActionReceiver.ACTION_STATE_CHANGED).setPackage(context.getPackageName());
        context.sendBroadcast(changed);
    }
}
