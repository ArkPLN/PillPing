package com.dsh.medtimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class TestAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Security.isTrusted(context)) return;
        if (intent == null) return;
        NotificationHelper.ensureChannel(context);
        NotificationHelper.showBackgroundTest(context);
    }
}
