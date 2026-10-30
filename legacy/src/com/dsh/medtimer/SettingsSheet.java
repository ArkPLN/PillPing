package com.dsh.medtimer;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

final class SettingsSheet extends Sheet {
    private final Store store;
    private final Runnable onChange;
    private int interval;
    private int doses;
    private TextView intervalValue;
    private TextView intervalCaption;
    private TextView doseValue;
    private TextView doseCaption;

    SettingsSheet(Activity activity, Store store, Runnable onChange) {
        super(activity, "设置");
        this.store = store;
        this.onChange = onChange;
        this.interval = store.interval;
        this.doses = store.doseCount;
        build();
        show();
    }

    private void build() {
        section("提醒总开关");
        LinearLayout masterCard = Ui.h(activity);
        masterCard.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 12), Ui.dp(activity, 12));
        masterCard.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        LinearLayout masterCol = Ui.v(activity);
        masterCol.addView(Ui.medium(activity, "所有服药提醒", 14, Palette.INK));
        TextView masterSub = Ui.text(activity, "关闭后暂停普通药、特殊药和复诊提醒；记录保留", 11.5f, Palette.MUTED);
        masterSub.setPadding(0, Ui.dp(activity, 3), 0, 0);
        masterSub.setLineSpacing(0, 1.15f);
        masterCol.addView(masterSub);
        masterCard.addView(masterCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        Switch master = new Switch(activity);
        master.setChecked(store.isRemindersEnabled());
        master.setShowText(false);
        int[][] mstates = {{android.R.attr.state_checked}, {}};
        master.setThumbTintList(new ColorStateList(mstates, new int[]{Palette.PRIMARY, Palette.MUTED_LIGHT}));
        master.setTrackTintList(new ColorStateList(mstates, new int[]{Palette.withAlpha(Palette.PRIMARY, 0x66), Palette.LINE}));
        master.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (store.isRemindersEnabled() == isChecked) return;
            store.setRemindersEnabled(isChecked);
            if (isChecked) {
                ReminderScheduler.scheduleAll(activity, false);
                SpecialScheduler.scheduleAll(activity, false);
                FollowupScheduler.scheduleAll(activity, false);
                Toast.makeText(activity, "已恢复所有提醒", Toast.LENGTH_SHORT).show();
            } else {
                ReminderScheduler.cancelAll(activity);
                SpecialScheduler.cancelAll(activity);
                FollowupScheduler.cancelAll(activity);
                NotificationHelper.cancelAll(activity);
                Toast.makeText(activity, "已暂停所有提醒", Toast.LENGTH_SHORT).show();
            }
            onChange.run();
        });
        masterCard.addView(master, new LinearLayout.LayoutParams(Ui.dp(activity, 46), Ui.dp(activity, 34)));
        add(masterCard, 8);

        section("外观");
        TextView themeTitle = Ui.text(activity, "主题模式", 12.5f, Palette.MUTED);
        content.addView(themeTitle);
        FlowLayout themes = new FlowLayout(activity);
        final int[] modes = {Theme.SYSTEM, Theme.LIGHT, Theme.DARK};
        final String[] names = {"跟随系统", "浅色", "深色"};
        int current = Theme.mode(activity);
        for (int i = 0; i < modes.length; i++) {
            final int m = modes[i];
            TextView chip = Ui.chip(activity, names[i], current == m);
            chip.setOnClickListener(v -> {
                if (Theme.mode(activity) == m) return;
                Theme.setMode(activity, m);
                dismiss();
                activity.recreate();
            });
            themes.addView(chip);
        }
        add(themes, 8);
        TextView themeNote = Ui.text(activity, "跟随系统时，应用会随手机的深色/浅色模式自动切换。", 11, Palette.MUTED_LIGHT);
        themeNote.setPadding(0, Ui.dp(activity, 2), 0, Ui.dp(activity, 10));
        content.addView(themeNote);

        section("服药节奏");

        LinearLayout doseCard = Ui.v(activity);
        doseCard.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 13), Ui.dp(activity, 14), Ui.dp(activity, 13));
        doseCard.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        LinearLayout doseTop = Ui.h(activity);
        LinearLayout doseLabels = Ui.v(activity);
        doseLabels.addView(Ui.medium(activity, "每天服药次数", 14, Palette.INK));
        doseCaption = Ui.text(activity, "当前每天 " + doses + " 次", 11.5f, Palette.MUTED);
        doseCaption.setPadding(0, Ui.dp(activity, 3), 0, 0);
        doseLabels.addView(doseCaption);
        doseTop.addView(doseLabels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout doseStepper = Ui.h(activity);
        View doseMinus = stepButton(R.drawable.ic_minus);
        doseMinus.setOnClickListener(v -> changeDoseCount(-1));
        doseStepper.addView(doseMinus);
        doseValue = Ui.bold(activity, doses + " 次", 15, Palette.PRIMARY);
        doseValue.setGravity(Gravity.CENTER);
        doseStepper.addView(doseValue, new LinearLayout.LayoutParams(Ui.dp(activity, 64), Ui.dp(activity, 36)));
        View dosePlus = stepButton(R.drawable.ic_add);
        dosePlus.setOnClickListener(v -> changeDoseCount(1));
        doseStepper.addView(dosePlus);
        doseTop.addView(doseStepper);
        stackIfCompact(doseTop, doseLabels, doseStepper);
        doseCard.addView(doseTop);
        TextView doseNote = Ui.text(activity, "可设置 1–12 次。修改后今天尚未服用的次数会按新方案重排。", 11.5f, Palette.MUTED);
        doseNote.setPadding(0, Ui.dp(activity, 10), 0, 0);
        doseNote.setLineSpacing(0, 1.15f);
        doseCard.addView(doseNote);
        add(doseCard);

        LinearLayout pace = Ui.v(activity);
        pace.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 13), Ui.dp(activity, 14), Ui.dp(activity, 13));
        pace.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));

        LinearLayout top = Ui.h(activity);
        LinearLayout labels = Ui.v(activity);
        labels.addView(Ui.medium(activity, "服药间隔", 14, Palette.INK));
        intervalCaption = Ui.text(activity, "最近一次实际服药后 " + interval + " 小时", 11.5f, Palette.MUTED);
        intervalCaption.setPadding(0, Ui.dp(activity, 3), 0, 0);
        labels.addView(intervalCaption);
        top.addView(labels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout stepper = Ui.h(activity);
        View minus = stepButton(R.drawable.ic_minus);
        minus.setOnClickListener(v -> changeInterval(-1));
        stepper.addView(minus);

        intervalValue = Ui.bold(activity, interval + " 小时", 15, Palette.PRIMARY);
        intervalValue.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams vp = new LinearLayout.LayoutParams(Ui.dp(activity, 64), Ui.dp(activity, 36));
        stepper.addView(intervalValue, vp);

        View plus = stepButton(R.drawable.ic_add);
        plus.setOnClickListener(v -> changeInterval(1));
        stepper.addView(plus);
        top.addView(stepper);
        stackIfCompact(top, labels, stepper);
        pace.addView(top);

        FlowLayout intervalQuick = new FlowLayout(activity);
        int[] commonIntervals = {3, 4, 5, 6, 8, 10, 12};
        for (int h : commonIntervals) {
            TextView chip = Ui.chip(activity, h + " 小时", h == interval);
            chip.setOnClickListener(v -> applyInterval(h));
            intervalQuick.addView(chip);
        }
        LinearLayout.LayoutParams iqp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        iqp.topMargin = Ui.dp(activity, 9);
        pace.addView(intervalQuick, iqp);

        TextView note = Ui.text(activity, "每次实际服药后，下一次提醒会从实际时间重新计算，而不是固定按第一次推算。", 11.5f, Palette.MUTED);
        note.setPadding(0, Ui.dp(activity, 10), 0, 0);
        note.setLineSpacing(0, 1.15f);
        pace.addView(note);
        add(pace, 8);

        add(actionRow("开始指南", "检查通知、横幅、精确提醒和后台运行", "查看", () -> {
            dismiss();
            new GuideSheet(activity, store, onChange, null);
        }), 8);

        LinearLayout status = Ui.v(activity);
        boolean remindersOn = store.isRemindersEnabled();
        boolean ok = remindersOn && !Perms.hasReminderProblem(activity);
        status.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 14), Ui.dp(activity, 12));
        status.setBackground(Ui.roundStroke(activity,
                !remindersOn ? Palette.FIELD : (ok ? Palette.MINT : Palette.AMBER_BG), 16,
                !remindersOn ? Palette.LINE : (ok ? Palette.MINT_STRONG : Palette.AMBER_LINE), 1));
        status.addView(Ui.medium(activity,
                !remindersOn ? "提醒状态：已暂停" : (ok ? "提醒状态：正常" : "提醒状态：有设置未完成"),
                13, !remindersOn ? Palette.MUTED : (ok ? Palette.PRIMARY : Palette.AMBER)));
        TextView statusText = Ui.text(activity,
                !remindersOn ? "提醒总开关已关闭，所有服药和复诊提醒暂停。"
                        : (ok ? "通知、勿扰、精确提醒和后台运行均正常。"
                        : Perms.problemSummary(activity)),
                11.5f, !remindersOn ? Palette.MUTED : (ok ? Palette.MUTED : Palette.AMBER));
        statusText.setPadding(0, Ui.dp(activity, 4), 0, 0);
        statusText.setLineSpacing(0, 1.2f);
        status.addView(statusText);
        add(status, 10);

        section("提醒权限");
        add(permissionRow("勿扰模式", "勿扰开启时通知可能没有声音/振动",
                !Perms.dndActive(activity), () -> {
                    dismiss();
                    Perms.openDndSettings(activity);
                }), 8);
        add(permissionRow("通知权限", "到点弹出提醒、发出声音",
                Perms.notificationsEnabled(activity), () -> {
                    dismiss();
                    Perms.requestNotifications(activity);
                }), 8);
        add(permissionRow("精确提醒", "按分钟准时触发，避免系统延迟",
                Perms.exactAlarmsEnabled(activity), () -> {
                    dismiss();
                    Perms.openExactAlarmSettings(activity);
                }), 8);
        add(permissionRow("后台运行", "避免系统冻结应用导致漏提醒",
                Perms.batteryExempt(activity), () -> {
                    dismiss();
                    Perms.openBatterySettings(activity);
                }), 8);
        add(actionRow("通知样式", "没弹出横幅或锁屏不显示时，在这里把重要性设为「高」",
                "去设置", () -> {
                    dismiss();
                    Perms.openChannelSettings(activity);
                }), 8);

        TextView vendorNote = Ui.text(activity,
                "如果提醒仍不准时：在系统设置 → 应用 → 按时吃药 中，允许「自启动」「后台高耗电」或「不受限制」。",
                11.5f, Palette.MUTED);
        vendorNote.setLineSpacing(0, 1.2f);
        add(vendorNote, 10);

        TextView appSettings = Ui.medium(activity, "打开应用设置", 13, Palette.PRIMARY);
        appSettings.setGravity(Gravity.CENTER);
        appSettings.setPadding(0, Ui.dp(activity, 12), 0, Ui.dp(activity, 4));
        appSettings.setOnClickListener(v -> {
            dismiss();
            Perms.openAppDetails(activity);
        });
        add(appSettings);

        section("测试");
        LinearLayout test = Ui.h(activity);
        test.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 13), Ui.dp(activity, 14), Ui.dp(activity, 13));
        test.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        test.addView(Ui.icon(activity, R.drawable.ic_bell, Palette.PRIMARY, 20));
        LinearLayout testText = Ui.v(activity);
        testText.setPadding(Ui.dp(activity, 10), 0, 0, 0);
        testText.addView(Ui.medium(activity, "发送测试提醒", 13.5f, Palette.INK));
        testText.addView(Ui.text(activity, "立即发一条通知，检查声音和横幅", 11.5f, Palette.MUTED));
        test.addView(testText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        test.addView(Ui.icon(activity, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 18));
        test.setOnClickListener(v -> {
            if (!Perms.notificationsEnabled(activity)) {
                dismiss();
                Perms.requestNotifications(activity);
                Toast.makeText(activity, "请先允许通知权限", Toast.LENGTH_SHORT).show();
            } else {
                NotificationHelper.showTest(activity);
                Toast.makeText(activity, "已发送，请下拉通知栏查看", Toast.LENGTH_SHORT).show();
            }
        });
        add(test);

        add(actionRow("后台测试提醒", "10 秒后触发；请按 Home 退出，验证后台能否收到", "测试", () -> {
            if (!Perms.notificationsEnabled(activity)) {
                dismiss();
                Perms.requestNotifications(activity);
                Toast.makeText(activity, "请先允许通知权限", Toast.LENGTH_SHORT).show();
                return;
            }
            boolean scheduled = NotificationHelper.scheduleBackgroundTest(activity);
            Toast.makeText(activity, scheduled
                    ? "已安排，请按 Home 退出并等待 10 秒"
                    : "安排失败，请检查精确提醒权限", Toast.LENGTH_LONG).show();
        }), 8);

        add(actionRow("预览下一次提醒", "按当前药物清单生成一条真实通知（不会改变记录）",
                "预览", () -> {
                    if (store.cycle == null) {
                        Toast.makeText(activity, "记录第一次服药后即可预览", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    NotificationHelper.showPreview(activity, store);
                    Toast.makeText(activity, "已发送预览，请下拉通知栏查看", Toast.LENGTH_SHORT).show();
                }), 8);

        section("数据");
        add(dangerRow("清空今日记录", "保留药物清单和历史记录", () -> {
            Dialogs.confirm(activity, "清空今日记录", "今天的服药记录和提醒会被清除，药物清单不受影响。", "清空", () -> {
                store.clearToday();
                NotificationHelper.cancelAll(activity);
                ReminderScheduler.cancelAll(activity);
                onChange.run();
                dismiss();
                Toast.makeText(activity, "今日记录已清空", Toast.LENGTH_SHORT).show();
            });
        }));
        add(dangerRow("清空全部数据", "删除药物、今日记录和所有历史", () -> {
            Dialogs.confirm(activity, "清空全部数据", "药物清单、今天的记录和历史都会删除，且无法恢复。", "全部删除", () -> {
                SpecialScheduler.cancelAll(activity);
                FollowupScheduler.cancelAll(activity);
                store.clearAll();
                NotificationHelper.cancelAll(activity);
                ReminderScheduler.cancelAll(activity);
                onChange.run();
                dismiss();
                Toast.makeText(activity, "全部数据已清空", Toast.LENGTH_SHORT).show();
            });
        }), 8);

        add(actionRow("应用安全", "签名校验通过 · 证书 " + Security.certShort(activity),
                "查看", () -> Dialogs.info(activity, "应用安全",
                        "APK 安装时由 Android 校验 v2/v3 签名；启动时会再次比对固定证书指纹。\n\n"
                                + "证书 SHA-256：\n" + Security.certSha256(activity) + "\n\n"
                                + "如果安装包被重新签名或修改，应用会停止运行。"
                                + "\n\n注意：没有绝对安全，请只从可信来源安装。")), 8);

        divider();
        String versionName = "1.6.2";
        try {
            PackageInfo pi = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            if (pi.versionName != null && pi.versionName.length() > 0) versionName = pi.versionName;
        } catch (Exception ignored) {
        }
        TextView about = Ui.medium(activity, "按时吃药  v" + versionName, 12.5f, Palette.MUTED);
        content.addView(about);
        TextView author = Ui.text(activity, "作者：肚小圆", 11.5f, Palette.MUTED);
        author.setPadding(0, Ui.dp(activity, 4), 0, 0);
        content.addView(author);
        TextView ai = Ui.text(activity, "本应用使用 AI 生成（界面、代码与文案）。", 11, Palette.MUTED_LIGHT);
        ai.setPadding(0, Ui.dp(activity, 2), 0, 0);
        content.addView(ai);
        TextView disclaimer = Ui.text(activity,
                "本应用仅用于服药时间提醒，不提供诊断或用药建议。具体药物、剂量和服用方式请遵医嘱。",
                11.5f, Palette.MUTED_LIGHT);
        disclaimer.setLineSpacing(0, 1.25f);
        disclaimer.setPadding(0, Ui.dp(activity, 6), 0, 0);
        content.addView(disclaimer);

        TextView done = Ui.primaryButton(activity, "完成", Palette.PRIMARY, Palette.WHITE, 50);
        done.setOnClickListener(v -> dismiss());
        add(done, 20);
    }

    private View stepButton(int iconRes) {
        android.widget.ImageView b = Ui.icon(activity, iconRes, Palette.PRIMARY, 18);
        b.setPadding(Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9));
        b.setBackground(Ui.ripple(Ui.round(activity, Palette.FIELD, 18), 0x22000000));
        b.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(activity, 36), Ui.dp(activity, 36)));
        b.setClickable(true);
        b.setFocusable(true);
        return b;
    }

    private void changeDoseCount(int delta) {
        int next = Cycle.clamp(doses + delta);
        if (next == doses) return;
        boolean removesTaken = false;
        if (store.cycle != null) {
            for (int i = next; i < store.cycle.size(); i++) {
                if (store.cycle.status[i] == Cycle.TAKEN) removesTaken = true;
            }
        }
        if (removesTaken) {
            Dialogs.confirm(activity, "减少服药次数",
                    "减少次数会删除今天已记录的后几次服药记录，确定要改为每天 " + next + " 次吗？",
                    "确定修改", () -> applyDoseCount(next));
        } else {
            applyDoseCount(next);
        }
    }

    private void applyDoseCount(int next) {
        doses = next;
        store.setDoseCount(next);
        doseValue.setText(doses + " 次");
        doseCaption.setText("当前每天 " + doses + " 次");
        for (int i = next; i < Cycle.MAX_DOSES; i++) NotificationHelper.cancel(activity, i);
        ReminderScheduler.scheduleAll(activity, false);
        onChange.run();
        Toast.makeText(activity, "已改为每天 " + doses + " 次", Toast.LENGTH_SHORT).show();
    }

    private boolean isCompact() {
        return activity.getResources().getDisplayMetrics().widthPixels < Ui.dp(activity, 360);
    }

    private void stackIfCompact(LinearLayout row, LinearLayout labels, LinearLayout stepper) {
        if (!isCompact()) return;
        row.setOrientation(LinearLayout.VERTICAL);
        row.setGravity(Gravity.START);
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) labels.getLayoutParams();
        lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
        lp.weight = 0f;
        labels.setLayoutParams(lp);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sp.topMargin = Ui.dp(activity, 8);
        stepper.setLayoutParams(sp);
    }

    private void changeInterval(int delta) {
        applyInterval(Math.max(1, Math.min(12, interval + delta)));
    }

    private void applyInterval(int next) {
        next = Math.max(1, Math.min(12, next));
        if (next == interval) return;
        interval = next;
        store.setInterval(interval);
        intervalValue.setText(interval + " 小时");
        intervalCaption.setText("最近一次实际服药后 " + interval + " 小时");
        ReminderScheduler.scheduleAll(activity, false);
        onChange.run();
    }

    private LinearLayout permissionRow(String title, String subtitle, boolean ok, Runnable action) {
        LinearLayout row = Ui.h(activity);
        row.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 10), Ui.dp(activity, 12));
        row.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        View dot = new View(activity);
        dot.setBackground(Ui.circle(activity, ok ? 0xFF16A34A : Palette.AMBER));
        LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(Ui.dp(activity, 8), Ui.dp(activity, 8));
        dp.rightMargin = Ui.dp(activity, 11);
        row.addView(dot, dp);

        LinearLayout col = Ui.v(activity);
        col.addView(Ui.medium(activity, title, 13.5f, Palette.INK));
        TextView sub = Ui.text(activity, ok ? "已开启" : subtitle, 11.5f, ok ? Palette.MUTED : Palette.AMBER);
        sub.setPadding(0, Ui.dp(activity, 3), 0, 0);
        col.addView(sub);
        row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        if (!ok) {
            TextView go = Ui.medium(activity, "去开启", 12.5f, Palette.PRIMARY);
            go.setGravity(Gravity.CENTER);
            go.setPadding(Ui.dp(activity, 12), Ui.dp(activity, 8), Ui.dp(activity, 8), Ui.dp(activity, 8));
            go.setOnClickListener(v -> action.run());
            row.addView(go);
        }
        return row;
    }

    private LinearLayout actionRow(String title, String subtitle, String actionText, Runnable action) {
        LinearLayout row = Ui.h(activity);
        row.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 10), Ui.dp(activity, 12));
        row.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        LinearLayout col = Ui.v(activity);
        col.addView(Ui.medium(activity, title, 13.5f, Palette.INK));
        TextView sub = Ui.text(activity, subtitle, 11.5f, Palette.MUTED);
        sub.setPadding(0, Ui.dp(activity, 3), 0, 0);
        sub.setLineSpacing(0, 1.15f);
        col.addView(sub);
        row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView go = Ui.medium(activity, actionText, 12.5f, Palette.PRIMARY);
        go.setGravity(Gravity.CENTER);
        go.setPadding(Ui.dp(activity, 10), Ui.dp(activity, 8), Ui.dp(activity, 6), Ui.dp(activity, 8));
        go.setOnClickListener(v -> action.run());
        row.addView(go);
        return row;
    }

    private LinearLayout dangerRow(String title, String subtitle, Runnable action) {
        LinearLayout row = Ui.h(activity);
        row.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 14), Ui.dp(activity, 12));
        row.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        LinearLayout col = Ui.v(activity);
        col.addView(Ui.medium(activity, title, 13.5f, Palette.DANGER));
        TextView sub = Ui.text(activity, subtitle, 11.5f, Palette.MUTED);
        sub.setPadding(0, Ui.dp(activity, 3), 0, 0);
        col.addView(sub);
        row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        row.addView(Ui.icon(activity, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 18));
        row.setOnClickListener(v -> action.run());
        row.setClickable(true);
        row.setFocusable(true);
        return row;
    }
}
