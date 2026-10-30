package com.dsh.medtimer;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

final class NotificationHelper {
    private static final String TAG = "MedTimer";
    static final String CHANNEL_ID = "med_reminders_v2";
    private static final String CHANNEL_NAME = "服药提醒";
    private static final int ID_BASE = 210;
    private static final int TEST_ID = 999;
    private static final int PREVIEW_ID = 998;
    private static final int BACKGROUND_TEST_ID = 997;
    static final String ACTION_TEST_ALARM = "com.dsh.medtimer.TEST_ALARM";

    private NotificationHelper() {
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) {
            if (existing.getLockscreenVisibility() != Notification.VISIBILITY_PUBLIC) {
                existing.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                try {
                    nm.createNotificationChannel(existing);
                } catch (Exception ignored) {
                }
            }
            return;
        }

        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("到点提醒你按时服药");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 450, 220, 450});
        ch.enableLights(true);
        ch.setLightColor(Palette.PRIMARY);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(true);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (sound != null) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(sound, attrs);
        }
        nm.createNotificationChannel(ch);
    }

    static void showReminder(Context context, Store store, int dose) {
        showReminder(context, store, dose, ID_BASE + dose, false);
    }

    static void showPreview(Context context, Store store) {
        if (store.cycle == null) return;
        int dose = store.cycle.nextPending();
        if (dose < 0) dose = 0;
        showReminder(context, store, dose, PREVIEW_ID, true);
    }

    private static void showReminder(Context context, Store store, int dose, int notificationId, boolean preview) {
        if (store.cycle == null || dose < 0 || dose >= store.cycle.size()) return;
        ensureChannel(context);
        Cycle c = store.cycle;
        long due = c.effectiveTime(dose);
        String summary = store.summaryForSlot(dose, true, " · ");
        if (summary.length() == 0) summary = "还没有配置本次药物，点开应用添加";

        String title = (preview ? "预览 · 该吃药了 · 第" : "该吃药了 · 第") + (dose + 1) + "次";
        String when = Fmt.dayLabel(due) + " " + Fmt.time(due);
        String big = "第" + (dose + 1) + "次 · " + when + "\n" + store.bigTextForSlot(dose);
        if (preview) big = "这是预览，不会改变服药记录。\n" + big;

        Intent open = new Intent(context, MainActivity.class)
                .putExtra("open_dose", dose)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(context, 3000 + dose, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent markPi = actionPi(context, ActionReceiver.ACTION_MARK, dose, 1000 + dose, "mark");
        PendingIntent snoozePi = actionPi(context, ActionReceiver.ACTION_SNOOZE, dose, 2000 + dose, "snooze");

        Notification.Builder b = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(summary)
                .setStyle(new Notification.BigTextStyle().bigText(big))
                .setSubText("每天 " + store.cycle.size() + " 次 · 间隔 " + store.interval + " 小时")
                .setContentIntent(openPi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(Palette.PRIMARY)
                .setWhen(due)
                .setShowWhen(true)
                .setNumber(dose + 1);
        if (!preview) {
            b.addAction(new Notification.Action.Builder(null, "已服用", markPi).build());
            b.addAction(new Notification.Action.Builder(null, "10 分钟后", snoozePi).build());
        }
        Bitmap large = largeIcon(context);
        if (large != null) b.setLargeIcon(large);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(notificationId, b.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Notification permission missing", e);
        } catch (Exception e) {
            Log.e(TAG, "Unable to show notification; retrying without actions", e);
            try {
                Notification.Builder simple = new Notification.Builder(context, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_notification)
                        .setContentTitle(title)
                        .setContentText(summary)
                        .setStyle(new Notification.BigTextStyle().bigText(big))
                        .setContentIntent(openPi)
                        .setAutoCancel(true)
                        .setCategory(Notification.CATEGORY_REMINDER)
                        .setPriority(Notification.PRIORITY_MAX)
                        .setVisibility(Notification.VISIBILITY_PUBLIC)
                        .setColor(Palette.PRIMARY)
                        .setWhen(due)
                        .setShowWhen(true);
                if (large != null) simple.setLargeIcon(large);
                nm.notify(notificationId, simple.build());
            } catch (Exception e2) {
                Log.e(TAG, "Fallback notification failed", e2);
            }
        }
    }

    private static PendingIntent actionPi(Context c, String action, int dose, int requestCode, String path) {
        Intent i = new Intent(c, ActionReceiver.class)
                .setAction(action)
                .putExtra(ReminderScheduler.EXTRA_DOSE, dose)
                .setData(Uri.parse("medtimer://" + path + "/" + dose));
        return PendingIntent.getBroadcast(c, requestCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void showSpecial(Context context, Store store, SpecialMed m) {
        if (m == null) return;
        ensureChannel(context);
        String summary = m.dose + "（" + m.method + "）";
        String title = "特殊用药 · " + m.name;
        StringBuilder big = new StringBuilder();
        big.append(m.scheduleText()).append("\n").append(summary);
        if (m.note != null && m.note.length() > 0) big.append("\n").append(m.note);

        Intent open = new Intent(context, MainActivity.class)
                .putExtra("open_special", m.id)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(context, 6000 + m.code, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent markPi = specialActionPi(context, SpecialActionReceiver.ACTION_MARK, m, 6100 + m.code, "mark");
        PendingIntent snoozePi = specialActionPi(context, SpecialActionReceiver.ACTION_SNOOZE, m, 6200 + m.code, "snooze");

        Notification.Builder b = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(summary)
                .setStyle(new Notification.BigTextStyle().bigText(big.toString()))
                .setSubText("独立提醒 · " + m.scheduleText())
                .setContentIntent(openPi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(0xFF7C3AED)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        b.addAction(new Notification.Action.Builder(null, "已服用", markPi).build());
        b.addAction(new Notification.Action.Builder(null, "10 分钟后", snoozePi).build());
        Bitmap large = largeIcon(context);
        if (large != null) b.setLargeIcon(large);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(500 + m.code, b.build());
        } catch (Exception e) {
            Log.e(TAG, "Unable to show special notification", e);
            try {
                Notification.Builder simple = new Notification.Builder(context, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_notification)
                        .setContentTitle(title)
                        .setContentText(summary)
                        .setStyle(new Notification.BigTextStyle().bigText(big.toString()))
                        .setContentIntent(openPi)
                        .setAutoCancel(true)
                        .setCategory(Notification.CATEGORY_REMINDER)
                        .setPriority(Notification.PRIORITY_MAX)
                        .setColor(0xFF7C3AED);
                nm.notify(500 + m.code, simple.build());
            } catch (Exception ignored) {
            }
        }
    }

    private static PendingIntent specialActionPi(Context c, String action, SpecialMed m, int requestCode, String path) {
        Intent i = new Intent(c, SpecialActionReceiver.class)
                .setAction(action)
                .putExtra(SpecialScheduler.EXTRA_SPECIAL_ID, m.id)
                .setData(Uri.parse("medtimer://special-action/" + path + "/" + m.id));
        return PendingIntent.getBroadcast(c, requestCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelSpecial(Context context, int code) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(500 + code);
    }

    static boolean scheduleBackgroundTest(Context context) {
        ensureChannel(context);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;

        Intent i = new Intent(context, TestAlarmReceiver.class)
                .setAction(ACTION_TEST_ALARM)
                .setData(Uri.parse("medtimer://background-test/" + System.currentTimeMillis()));
        PendingIntent pi = PendingIntent.getBroadcast(context, 9001, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent show = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPi = PendingIntent.getActivity(context, 9101, show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        long trigger = System.currentTimeMillis() + 10_000L;
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            } else {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(trigger, showPi), pi);
            }
            return true;
        } catch (Exception e) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
                return true;
            } catch (Exception e2) {
                Log.e(TAG, "Unable to schedule background test", e2);
                return false;
            }
        }
    }

    static void showBackgroundTest(Context context) {
        ensureChannel(context);
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 9102, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = "应用在后台也能收到这条提醒。";
        Notification.Builder b = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("后台测试提醒 · 成功")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(
                        "后台测试提醒 · 成功\n" + text + "\n\n如果按 Home 退出后 10 秒仍收到这条通知，说明后台提醒链路正常。"))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(Palette.PRIMARY)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(BACKGROUND_TEST_ID, b.build());
        } catch (Exception e) {
            Log.e(TAG, "Unable to show background test", e);
        }
    }

    static void showFollowup(Context context, Med m) {
        if (m == null) return;
        ensureChannel(context);
        String title = "复诊提醒 · " + m.name;
        String text = "服药期间建议复诊";
        String big = "药物：" + m.name + "\n" + m.courseText()
                + "\n复诊周期：每 " + m.followupDays + " 天";

        Intent open = new Intent(context, MainActivity.class)
                .putExtra("open_med", m.id)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(context, 8850, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent donePi = followupActionPi(context, FollowupActionReceiver.ACTION_DONE, m, 8860);
        PendingIntent tomorrowPi = followupActionPi(context, FollowupActionReceiver.ACTION_TOMORROW, m, 8861);

        Notification.Builder b = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(big))
                .setSubText("复诊提醒")
                .setContentIntent(openPi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(Palette.AMBER)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        b.addAction(new Notification.Action.Builder(null, "已复诊", donePi).build());
        b.addAction(new Notification.Action.Builder(null, "明天再提醒", tomorrowPi).build());
        Bitmap large = largeIcon(context);
        if (large != null) b.setLargeIcon(large);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(850, b.build());
            } catch (Exception e) {
                Log.e(TAG, "Follow-up notification failed", e);
            }
        }
    }

    private static PendingIntent followupActionPi(Context c, String action, Med m, int requestCode) {
        Intent i = new Intent(c, FollowupActionReceiver.class)
                .setAction(action)
                .putExtra(FollowupScheduler.EXTRA_MED_ID, m.id)
                .setData(Uri.parse("medtimer://followup-action/" + action + "/" + m.id));
        return PendingIntent.getBroadcast(c, requestCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelFollowup(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(850);
    }

    static void showTest(Context context) {
        ensureChannel(context);
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 4000, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("测试提醒 · 通知正常")
                .setContentText("真正到点时，会像这样提醒你。")
                .setStyle(new Notification.BigTextStyle().bigText("测试提醒 · 通知正常\n真正到点时，会像这样提醒你。\n如果没听到声音，请检查通知渠道设置和手机静音模式。"))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setPriority(Notification.PRIORITY_MAX)
                .setColor(Palette.PRIMARY);
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(TEST_ID, b.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Notification permission missing", e);
        }
    }

    static void cancel(Context context, int dose) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ID_BASE + dose);
    }

    static void cancelAll(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            for (int i = 0; i < Cycle.MAX_DOSES; i++) nm.cancel(ID_BASE + i);
            nm.cancel(PREVIEW_ID);
            nm.cancel(BACKGROUND_TEST_ID);
            nm.cancel(TEST_ID);
            nm.cancel(850);
            for (int i = 0; i < 128; i++) nm.cancel(500 + i);
        }
    }

    private static Bitmap largeIcon(Context context) {
        try {
            int size = Math.max(96, Ui.dp(context, 64));
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bmp);
            Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
            bg.setColor(Palette.PRIMARY);
            canvas.drawCircle(size / 2f, size / 2f, size / 2f, bg);

            Paint white = new Paint(Paint.ANTI_ALIAS_FLAG);
            white.setColor(0xFFFFFFFF);
            canvas.save();
            canvas.rotate(-38, size / 2f, size / 2f);
            RectF pill = new RectF(size * 0.20f, size * 0.40f, size * 0.80f, size * 0.60f);
            canvas.drawRoundRect(pill, size * 0.10f, size * 0.10f, white);
            canvas.restore();

            Paint teal = new Paint(Paint.ANTI_ALIAS_FLAG);
            teal.setColor(Palette.PRIMARY);
            teal.setStyle(Paint.Style.STROKE);
            teal.setStrokeWidth(size * 0.035f);
            teal.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawCircle(size * 0.72f, size * 0.28f, size * 0.14f, white);
            canvas.drawLine(size * 0.72f, size * 0.28f, size * 0.72f, size * 0.20f, teal);
            canvas.drawLine(size * 0.72f, size * 0.28f, size * 0.79f, size * 0.31f, teal);
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }
}
