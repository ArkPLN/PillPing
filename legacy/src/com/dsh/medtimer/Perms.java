package com.dsh.medtimer;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Toast;

final class Perms {
    static final int REQ_NOTIFICATIONS = 9001;

    private Perms() {
    }

    static boolean notificationsEnabled(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        android.app.NotificationManager nm =
                (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    static boolean channelHigh(Context c) {
        if (Build.VERSION.SDK_INT < 26) return true;
        android.app.NotificationManager nm =
                (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        android.app.NotificationChannel ch = nm.getNotificationChannel(NotificationHelper.CHANNEL_ID);
        return ch != null && ch.getImportance() >= android.app.NotificationManager.IMPORTANCE_HIGH;
    }

    static boolean exactAlarmsEnabled(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    static boolean dndActive(Context c) {
        if (Build.VERSION.SDK_INT < 23) return false;
        android.app.NotificationManager nm =
                (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        int filter = nm.getCurrentInterruptionFilter();
        return filter != android.app.NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    static String dndSummary(Context c) {
        if (!dndActive(c)) return "";
        android.app.NotificationManager nm =
                (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return "勿扰模式已开启";
        int filter = nm.getCurrentInterruptionFilter();
        if (filter == android.app.NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
            return "勿扰模式（仅重要提醒）已开启，普通通知可能没有声音或振动";
        }
        if (filter == android.app.NotificationManager.INTERRUPTION_FILTER_ALARMS) {
            return "勿扰模式（仅闹钟）已开启，通知可能被静音";
        }
        if (filter == android.app.NotificationManager.INTERRUPTION_FILTER_NONE) {
            return "勿扰模式（完全静音）已开启，通知不会响铃或振动";
        }
        return "勿扰模式已开启，通知可能没有声音或振动";
    }

    static void openDndSettings(Context c) {
        try {
            Intent i = new Intent("android.settings.ZEN_MODE_SETTINGS")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (i.resolveActivity(c.getPackageManager()) == null) {
                i = new Intent(Settings.ACTION_SOUND_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }
            c.startActivity(i);
        } catch (Exception e) {
            try {
                c.startActivity(new Intent(Settings.ACTION_SOUND_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
        }
    }

    static boolean batteryExempt(Context c) {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
    }

    static boolean hasReminderProblem(Context c) {
        return !notificationsEnabled(c) || !exactAlarmsEnabled(c) || dndActive(c);
    }

    static void requestNotifications(Activity activity) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED) {
                return;
            }
            SharedPreferences p = activity.getSharedPreferences("medtimer_data", Context.MODE_PRIVATE);
            boolean asked = p.getBoolean("notif_asked", false);
            if (asked && !activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                openNotificationSettings(activity);
                return;
            }
            p.edit().putBoolean("notif_asked", true).apply();
            activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
        } else {
            openNotificationSettings(activity);
        }
    }

    static void openChannelSettings(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                    .putExtra(Settings.EXTRA_CHANNEL_ID, NotificationHelper.CHANNEL_ID)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            openNotificationSettings(c);
        }
    }

    static void openNotificationSettings(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            openAppDetails(c);
        }
    }

    static void openExactAlarmSettings(Context c) {
        if (Build.VERSION.SDK_INT < 31) {
            Toast.makeText(c, "当前系统不需要单独开启精确提醒", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:" + c.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (i.resolveActivity(c.getPackageManager()) == null) {
                openAppDetails(c);
            } else {
                c.startActivity(i);
            }
        } catch (Exception e) {
            openAppDetails(c);
        }
    }

    static void openBatterySettings(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:" + c.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (i.resolveActivity(c.getPackageManager()) == null) {
                openAppDetails(c);
            } else {
                c.startActivity(i);
            }
        } catch (Exception e) {
            openAppDetails(c);
        }
    }

    static void openAppDetails(Context c) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + c.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception ignored) {
        }
    }

    static void openFirstProblem(Activity a) {
        if (!notificationsEnabled(a)) {
            requestNotifications(a);
        } else if (!exactAlarmsEnabled(a)) {
            openExactAlarmSettings(a);
        } else if (dndActive(a)) {
            openDndSettings(a);
        }
    }

    static String problemSummary(Context c) {
        boolean n = notificationsEnabled(c);
        boolean e = exactAlarmsEnabled(c);
        if (!n && !e) return "通知和精确提醒均未开启，可能收不到或延迟收到提醒";
        if (!n) return "通知权限未开启，到点将无法提醒你";
        if (!e) return "精确提醒未开启，提醒可能会延迟几分钟";
        if (dndActive(c)) return dndSummary(c);
        return "";
    }
}
