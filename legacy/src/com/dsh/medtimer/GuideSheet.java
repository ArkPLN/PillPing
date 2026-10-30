package com.dsh.medtimer;

import android.app.Activity;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

final class GuideSheet extends Sheet {
    private final Store store;
    private final Runnable onChange;
    private final Runnable openMeds;

    GuideSheet(Activity activity, Store store, Runnable onChange, Runnable openMeds) {
        super(activity, "开始指南");
        this.store = store;
        this.onChange = onChange;
        this.openMeds = openMeds;
        dialog.setOnDismissListener(d -> {
            store.setOnboarded(true);
            if (onChange != null) onChange.run();
        });
        build();
        show();
    }

    private void build() {
        LinearLayout top = Ui.h(activity);
        FrameLayout iconWrap = new FrameLayout(activity);
        iconWrap.setBackground(Ui.circle(activity, Palette.MINT));
        iconWrap.addView(Ui.icon(activity, R.drawable.ic_pill, Palette.PRIMARY, 30),
                new FrameLayout.LayoutParams(Ui.dp(activity, 30), Ui.dp(activity, 30), Gravity.CENTER));
        top.addView(iconWrap, new LinearLayout.LayoutParams(Ui.dp(activity, 62), Ui.dp(activity, 62)));

        LinearLayout titleCol = Ui.v(activity);
        titleCol.setPadding(Ui.dp(activity, 12), 0, 0, 0);
        titleCol.addView(Ui.bold(activity, "先检查这几项", 20, Palette.INK));
        TextView sub = Ui.text(activity, "设置好之后，退出应用也能按时收到提醒。", 12, Palette.MUTED);
        sub.setPadding(0, Ui.dp(activity, 4), 0, 0);
        sub.setLineSpacing(0, 1.15f);
        titleCol.addView(sub);
        top.addView(titleCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        add(top, 6);

        TextView refresh = Ui.medium(activity, "重新检查状态", 12, Palette.PRIMARY);
        refresh.setGravity(Gravity.END);
        refresh.setPadding(0, Ui.dp(activity, 8), 0, Ui.dp(activity, 2));
        refresh.setOnClickListener(v -> {
            dismiss();
            new GuideSheet(activity, store, onChange, openMeds);
        });
        add(refresh);

        sec("1  添加药物", store.meds.size() > 0,
                store.meds.size() > 0 ? "已添加 " + store.meds.size() + " 种药物" : "还没有添加药物",
                store.meds.size() > 0 ? null : "去添加",
                () -> {
                    dismiss();
                    if (openMeds != null) openMeds.run();
                });

        sec("2  通知权限", Perms.notificationsEnabled(activity),
                Perms.notificationsEnabled(activity) ? "已开启，可以收到通知" : "未开启，到点不会提醒",
                Perms.notificationsEnabled(activity) ? null : "去开启",
                () -> Perms.requestNotifications(activity));

        sec("3  通知横幅 / 锁屏", Perms.channelHigh(activity) ? 2 : 0,
                "没有弹出横幅或锁屏不显示时，在这里设置",
                "去设置",
                () -> Perms.openNotificationSettings(activity));

        sec("4  勿扰模式 / 静音", !Perms.dndActive(activity),
                Perms.dndActive(activity) ? Perms.dndSummary(activity) : "未开启，通知可以响铃和振动",
                Perms.dndActive(activity) ? "去关闭" : null,
                () -> Perms.openDndSettings(activity));

        sec("5  精确提醒", Perms.exactAlarmsEnabled(activity),
                Perms.exactAlarmsEnabled(activity) ? "已开启，按分钟触发" : "未开启，提醒可能延迟",
                Perms.exactAlarmsEnabled(activity) ? null : "去开启",
                () -> Perms.openExactAlarmSettings(activity));

        sec("6  后台运行", Perms.batteryExempt(activity),
                Perms.batteryExempt(activity) ? "已允许后台运行" : "未允许，系统可能冻结应用",
                Perms.batteryExempt(activity) ? null : "去设置",
                () -> Perms.openBatterySettings(activity));

        sec("7  自启动 / 后台高耗电", 2,
                "vivo / OPPO / 小米等手机需要手动允许",
                "打开应用设置",
                () -> Perms.openAppDetails(activity));

        TextView vendor = Ui.text(activity,
                "找不到「自启动」时：系统设置 → 应用 → 按时吃药 → 允许自启动、后台高耗电、锁屏显示。\n"
                        + "如果按 Home 后测试提醒没到，请先检查第 2–7 项。",
                11.5f, Palette.MUTED);
        vendor.setLineSpacing(0, 1.25f);
        add(vendor, 14);

        LinearLayout test = Ui.v(activity);
        test.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 14), Ui.dp(activity, 12));
        test.setBackground(Ui.roundStroke(activity, Palette.AMBER_BG, 16, Palette.AMBER_LINE, 1));
        test.addView(Ui.medium(activity, "后台测试提醒", 13.5f, Palette.AMBER));
        TextView desc = Ui.text(activity, "点下面的按钮，然后按 Home 退出应用，等 10 秒看是否收到通知。",
                11.5f, Palette.AMBER);
        desc.setPadding(0, Ui.dp(activity, 4), 0, Ui.dp(activity, 8));
        desc.setLineSpacing(0, 1.15f);
        test.addView(desc);
        TextView testBtn = Ui.primaryButton(activity, "10 秒后测试", Palette.AMBER, Palette.WHITE, 44);
        testBtn.setOnClickListener(v -> {
            if (!Perms.notificationsEnabled(activity)) {
                Perms.requestNotifications(activity);
                Toast.makeText(activity, "请先允许通知权限", Toast.LENGTH_SHORT).show();
                return;
            }
            boolean ok = NotificationHelper.scheduleBackgroundTest(activity);
            Toast.makeText(activity, ok
                    ? "已安排，请按 Home 退出并等待 10 秒"
                    : "安排失败，请检查精确提醒权限", Toast.LENGTH_LONG).show();
        });
        test.addView(testBtn);
        add(test, 16);

        LinearLayout footer = Ui.h(activity);
        footer.setPadding(0, Ui.dp(activity, 18), 0, 0);
        TextView later = Ui.medium(activity, "稍后设置", 13, Palette.MUTED);
        later.setGravity(Gravity.CENTER);
        later.setPadding(Ui.dp(activity, 6), 0, Ui.dp(activity, 12), 0);
        later.setOnClickListener(v -> dismiss());
        footer.addView(later, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(activity, 48)));
        View spacer = new View(activity);
        footer.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        TextView done = Ui.primaryButton(activity, "完成", Palette.PRIMARY, Palette.WHITE, 48);
        done.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        done.setOnClickListener(v -> {
            store.setOnboarded(true);
            dismiss();
            if (!Perms.notificationsEnabled(activity)) {
                Perms.requestNotifications(activity);
            }
        });
        footer.addView(done, new LinearLayout.LayoutParams(Ui.dp(activity, 120), Ui.dp(activity, 48)));
        content.addView(footer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private void sec(String title, boolean ok, String desc, String action, Runnable onClick) {
        sec(title, ok ? 1 : 0, desc, action, onClick);
    }

    private void sec(String title, int status, String desc, String action, Runnable onClick) {
        LinearLayout card = Ui.h(activity);
        card.setPadding(Ui.dp(activity, 12), Ui.dp(activity, 10), Ui.dp(activity, 10), Ui.dp(activity, 10));
        card.setBackground(Ui.roundStroke(activity, Palette.CARD, 15, Palette.LINE, 1));

        View dot = new View(activity);
        int color = status == 1 ? 0xFF16A34A : (status == 2 ? Palette.MUTED_LIGHT : Palette.AMBER);
        dot.setBackground(Ui.circle(activity, color));
        LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(Ui.dp(activity, 8), Ui.dp(activity, 8));
        dp.rightMargin = Ui.dp(activity, 9);
        card.addView(dot, dp);

        LinearLayout col = Ui.v(activity);
        col.addView(Ui.medium(activity, title, 13, Palette.INK));
        TextView d = Ui.text(activity, desc, 11, status == 0 ? Palette.AMBER : Palette.MUTED);
        d.setPadding(0, Ui.dp(activity, 3), 0, 0);
        d.setLineSpacing(0, 1.12f);
        col.addView(d);
        card.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        if (action != null && onClick != null) {
            TextView go = Ui.medium(activity, action, 12, status == 0 ? Palette.AMBER : Palette.PRIMARY);
            go.setGravity(Gravity.CENTER);
            go.setPadding(Ui.dp(activity, 8), Ui.dp(activity, 7), Ui.dp(activity, 4), Ui.dp(activity, 7));
            go.setOnClickListener(v -> onClick.run());
            card.addView(go);
        } else if (status == 1) {
            card.addView(Ui.icon(activity, R.drawable.ic_check, 0xFF16A34A, 16));
        }
        add(card, 7);
    }
}
