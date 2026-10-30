package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class FollowupActionReceiver extends BroadcastReceiver {
    static final String ACTION_DONE = "com.dsh.medtimer.FOLLOWUP_DONE";
    static final String ACTION_TOMORROW = "com.dsh.medtimer.FOLLOWUP_TOMORROW";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null) return;
        String id = intent.getStringExtra(FollowupScheduler.EXTRA_MED_ID);
        Store store = Store.load(context);
        Med med = id == null ? null : store.findMed(id);
        if (med == null) return;
        long now = System.currentTimeMillis();
        if (ACTION_DONE.equals(intent.getAction())) {
            med.nextFollowupAt = now + Math.max(1, med.followupDays) * 86_400_000L;
            Toast.makeText(context, "已记录复诊，下次 " + Fmt.monthDay(med.nextFollowupAt), Toast.LENGTH_SHORT).show();
        } else if (ACTION_TOMORROW.equals(intent.getAction())) {
            med.nextFollowupAt = now + 86_400_000L;
            Toast.makeText(context, "明天再提醒复诊", Toast.LENGTH_SHORT).show();
        } else {
            return;
        }
        store.saveMeds();
        NotificationHelper.cancelFollowup(context);
        FollowupScheduler.scheduleAll(context, true);
        Intent changed = new Intent(ActionReceiver.ACTION_STATE_CHANGED).setPackage(context.getPackageName());
        context.sendBroadcast(changed);
    }
}
