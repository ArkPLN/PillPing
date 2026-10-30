package com.dsh.medtimer;

import android.app.Activity;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

final class DoseSheet extends Sheet {
    private final Store store;
    private final int index;
    private final Runnable onChange;
    private final Runnable manageMeds;

    DoseSheet(Activity activity, Store store, int index, Runnable onChange, Runnable manageMeds) {
        super(activity, "第" + (index + 1) + "次服药");
        this.store = store;
        this.index = index;
        this.onChange = onChange;
        this.manageMeds = manageMeds;
        build();
        show();
    }

    private void build() {
        if (store.cycle == null || index < 0 || index >= store.cycle.size()) {
            dismiss();
            return;
        }
        Cycle c = store.cycle;
        long planned = c.planned[index];
        long due = c.effectiveTime(index);
        int status = c.status[index];

        LinearLayout meta = Ui.h(activity);
        meta.setPadding(0, Ui.dp(activity, 10), 0, 0);
        TextView plan = Ui.text(activity, "计划 " + Fmt.dayLabel(planned) + " · " + Fmt.time(planned)
                + (c.snoozeUntil[index] > 0 ? " · 已推迟到 " + Fmt.time(due) : ""), 13, Palette.MUTED);
        meta.addView(plan, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        meta.addView(statusPill(status, due), new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        add(meta);

        if (status == Cycle.PENDING && due <= System.currentTimeMillis()) {
            LinearLayout warn = Ui.v(activity);
            warn.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
            warn.setBackground(Ui.roundStroke(activity, Palette.AMBER_BG, 14, Palette.AMBER_LINE, 1));
            long late = System.currentTimeMillis() - due;
            TextView t = Ui.medium(activity, late < 60_000L
                    ? "已到服药时间，请尽快服用"
                    : "已超过计划时间 " + Fmt.durationShort(late), 12.5f, Palette.AMBER);
            warn.addView(t);
            TextView s = Ui.text(activity, "如果已经服过药，请直接记录；如果还没服，请尽快服用。", 11.5f, Palette.AMBER);
            s.setPadding(0, Ui.dp(activity, 3), 0, 0);
            warn.addView(s);
            add(warn, 14);
        } else if (status == Cycle.PENDING && c.snoozeUntil[index] > 0) {
            TextView t = Ui.medium(activity, "已推迟，将在 " + Fmt.time(due) + " 再次提醒", 12.5f, Palette.PRIMARY);
            t.setBackground(Ui.round(activity, Palette.MINT, 14));
            t.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
            add(t, 14);
        }

        section("本次药物");
        List<Med> meds = store.medsForSlot(index);
        if (meds.isEmpty()) {
            LinearLayout empty = Ui.v(activity);
            empty.setPadding(Ui.dp(activity, 16), Ui.dp(activity, 16), Ui.dp(activity, 16), Ui.dp(activity, 16));
            empty.setBackground(Ui.roundStroke(activity, Palette.FIELD, 16, Palette.LINE, 1));
            empty.addView(Ui.medium(activity, "本次还没有配置药物", 13.5f, Palette.INK));
            TextView hint = Ui.text(activity, "去「药物」页添加药名、用量和服用方式。", 12, Palette.MUTED);
            hint.setPadding(0, Ui.dp(activity, 4), 0, Ui.dp(activity, 8));
            empty.addView(hint);
            TextView go = Ui.medium(activity, "去添加药物 ›", 13, Palette.PRIMARY);
            go.setOnClickListener(v -> {
                dismiss();
                if (manageMeds != null) manageMeds.run();
            });
            empty.addView(go);
            add(empty);
        } else {
            LinearLayout list = Ui.v(activity);
            list.setBackground(Ui.roundStroke(activity, Palette.CARD, 18, Palette.LINE, 1));
            for (int i = 0; i < meds.size(); i++) {
                Med m = meds.get(i);
                LinearLayout row = Ui.h(activity);
                row.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 13), Ui.dp(activity, 14), Ui.dp(activity, 13));
                View dot = new View(activity);
                dot.setBackground(Ui.circle(activity, Palette.medColor(m.color)));
                LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(Ui.dp(activity, 9), Ui.dp(activity, 9));
                dp.rightMargin = Ui.dp(activity, 11);
                row.addView(dot, dp);

                LinearLayout col = Ui.v(activity);
                col.addView(Ui.medium(activity, m.name, 14.5f, Palette.INK));
                TextView detail = Ui.text(activity, m.dose + "  ·  " + m.method, 12, Palette.MUTED);
                detail.setPadding(0, Ui.dp(activity, 3), 0, 0);
                col.addView(detail);
                if (m.note != null && m.note.length() > 0) {
                    TextView note = Ui.text(activity, m.note, 11.5f, Palette.MUTED_LIGHT);
                    note.setPadding(0, Ui.dp(activity, 3), 0, 0);
                    col.addView(note);
                }
                row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
                list.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                if (i < meds.size() - 1) {
                    View line = Ui.line(activity, Palette.LINE);
                    list.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, Ui.dp(activity, 1))));
                }
            }
            add(list);
        }

        if (status == Cycle.PENDING) {
            TextView take = Ui.primaryButton(activity, "我已服用", Palette.PRIMARY, Palette.WHITE, 54);
            take.setTextSize(16);
            take.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
            take.setOnClickListener(v -> markTaken());
            add(take, 22);

            TextView snooze = Ui.outlineButton(activity, "10 分钟后再提醒", Palette.INK_SOFT, Palette.LINE, 48);
            snooze.setOnClickListener(v -> snooze());
            add(snooze, 10);

            TextView backfill = Ui.medium(activity, "忘记登记？补登实际服用时间 ›", 13, Palette.PRIMARY);
            backfill.setGravity(Gravity.CENTER);
            backfill.setPadding(0, Ui.dp(activity, 12), 0, Ui.dp(activity, 2));
            backfill.setOnClickListener(v -> openTimePicker(false));
            add(backfill);

            TextView skip = Ui.medium(activity, "跳过这次", 13, Palette.DANGER);
            skip.setGravity(Gravity.CENTER);
            skip.setPadding(0, Ui.dp(activity, 14), 0, Ui.dp(activity, 4));
            skip.setOnClickListener(v -> confirmSkip());
            add(skip);
        } else {
            String msg;
            if (status == Cycle.TAKEN) {
                long at = c.actedAt[index] > 0 ? c.actedAt[index] : c.planned[index];
                msg = "已于 " + Fmt.time(at) + " 记录服用";
            } else {
                msg = "这次已标记为跳过";
            }
            LinearLayout done = Ui.h(activity);
            done.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 14), Ui.dp(activity, 12));
            done.setBackground(Ui.round(activity, status == Cycle.TAKEN ? Palette.MINT : Palette.FIELD, 14));
            View check = Ui.icon(activity, status == Cycle.TAKEN ? R.drawable.ic_check : R.drawable.ic_close,
                    status == Cycle.TAKEN ? Palette.PRIMARY : Palette.MUTED, 18);
            LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(Ui.dp(activity, 18), Ui.dp(activity, 18));
            ip.rightMargin = Ui.dp(activity, 8);
            done.addView(check, ip);
            done.addView(Ui.medium(activity, msg, 12.5f, status == Cycle.TAKEN ? Palette.PRIMARY : Palette.MUTED),
                    new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            add(done, 22);

            TextView editTime = Ui.medium(activity, "修改服用时间", 13, Palette.PRIMARY);
            editTime.setGravity(Gravity.CENTER);
            editTime.setPadding(0, Ui.dp(activity, 14), 0, Ui.dp(activity, 4));
            editTime.setOnClickListener(v -> openTimePicker(true));
            add(editTime);

            TextView undo = Ui.medium(activity, "撤销记录", 13, Palette.MUTED);
            undo.setGravity(Gravity.CENTER);
            undo.setPadding(0, Ui.dp(activity, 4), 0, Ui.dp(activity, 4));
            undo.setOnClickListener(v -> undo());
            add(undo);
        }
    }

    private TextView statusPill(int status, long due) {
        if (status == Cycle.TAKEN) return Ui.pill(activity, "已服用", Palette.PRIMARY, Palette.MINT);
        if (status == Cycle.SKIPPED) return Ui.pill(activity, "已跳过", Palette.MUTED, Palette.FIELD);
        if (due <= System.currentTimeMillis()) return Ui.pill(activity, "已超时", Palette.DANGER, Palette.DANGER_BG);
        return Ui.pill(activity, "待服用", Palette.PRIMARY, Palette.MINT);
    }

    private void markTaken() {
        long planned = store.cycle == null ? 0L : store.cycle.planned[index];
        if (planned - System.currentTimeMillis() > 30 * 60_000L) {
            Dialogs.confirm(activity, "还没到服药时间",
                    "计划时间是 " + Fmt.time(planned) + "，确定现在就记录为已服用吗？",
                    "现在记录", this::doMarkTaken);
            return;
        }
        doMarkTaken();
    }

    private void doMarkTaken() {
        if (store.cycle == null || store.cycle.status[index] != Cycle.PENDING) return;
        boolean all;
        store.markTaken(index);
        all = store.cycle != null && store.cycle.allResolved();
        NotificationHelper.cancel(activity, index);
        ReminderScheduler.scheduleAll(activity, false);
        onChange.run();
        dismiss();
        Toast.makeText(activity, all ? "今天的药都完成了" : "已记录第" + (index + 1) + "次服药", Toast.LENGTH_SHORT).show();
    }

    private void openTimePicker(boolean editExisting) {
        if (store.cycle == null || index < 0 || index >= store.cycle.size()) return;
        Cycle c = store.cycle;
        boolean alreadyTaken = c.status[index] == Cycle.TAKEN;
        if (!alreadyTaken && c.status[index] != Cycle.PENDING) return;
        long initial = alreadyTaken
                ? (c.actedAt[index] > 0 ? c.actedAt[index] : c.planned[index])
                : Math.min(System.currentTimeMillis(), c.planned[index] > 0 ? c.planned[index] : System.currentTimeMillis());
        String title = (editExisting || alreadyTaken ? "修改第" : "补登第") + (index + 1) + "次服药时间";
        String intro = "选择实际服用的时间，之后的下一次会按这个时间 + 间隔重新排。";
        String hint = "只能选择过去的时间；补登后会同步更新后续提醒和闹钟。";
        new TimeSheet(activity, title, intro, hint, false, initial, at -> {
            long previous = 0L;
            for (int j = index - 1; j >= 0; j--) {
                if (c.status[j] == Cycle.TAKEN) {
                    previous = c.actedAt[j];
                    break;
                }
            }
            if (previous > 0L && at < previous) {
                Toast.makeText(activity, "补登时间不能早于上一次服药时间", Toast.LENGTH_SHORT).show();
                return false;
            }
            store.markTakenAt(index, at);
            NotificationHelper.cancel(activity, index);
            ReminderScheduler.scheduleAll(activity, false);
            onChange.run();
            dismiss();
            Toast.makeText(activity, (editExisting || alreadyTaken ? "已修改为 " : "已补登 ") + Fmt.time(at),
                    Toast.LENGTH_SHORT).show();
            return true;
        });
    }

    private void snooze() {
        store.snooze(index, 10);
        NotificationHelper.cancel(activity, index);
        ReminderScheduler.scheduleDose(activity, index, true);
        onChange.run();
        dismiss();
        Toast.makeText(activity, "将在 10 分钟后提醒", Toast.LENGTH_SHORT).show();
    }

    private void confirmSkip() {
        Dialogs.confirm(activity, "跳过这次服药",
                "确定跳过第" + (index + 1) + "次服药吗？如果只是会晚一点，建议用「10 分钟后再提醒」。",
                "跳过", () -> {
                    store.skip(index);
                    NotificationHelper.cancel(activity, index);
                    ReminderScheduler.scheduleAll(activity, false);
                    onChange.run();
                    dismiss();
                    Toast.makeText(activity, "已跳过第" + (index + 1) + "次", Toast.LENGTH_SHORT).show();
                });
    }

    private void undo() {
        store.undo(index);
        NotificationHelper.cancel(activity, index);
        ReminderScheduler.scheduleAll(activity, false);
        onChange.run();
        dismiss();
        Toast.makeText(activity, "已撤销，改为待服用", Toast.LENGTH_SHORT).show();
    }
}
