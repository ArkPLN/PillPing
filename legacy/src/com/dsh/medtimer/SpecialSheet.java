package com.dsh.medtimer;

import android.app.Activity;
import android.graphics.Typeface;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Calendar;

final class SpecialSheet extends Sheet {
    private final Store store;
    private final SpecialMed editing;
    private final Runnable onChange;
    private int mode;
    private int intervalHours;
    private int hour;
    private int minute;
    private boolean scheduleChanged;
    private EditText nameInput;
    private EditText doseInput;
    private EditText noteInput;
    private TextView intervalValue;
    private TextView timeValue;
    private LinearLayout intervalCard;
    private LinearLayout dailyCard;
    private TextView preview;
    private TextView modeIntervalChip;
    private TextView modeDailyChip;
    private FormPicker formPicker;
    private int methodIndex;

    SpecialSheet(Activity activity, Store store, SpecialMed editing, Runnable onChange) {
        super(activity, editing == null ? "添加特殊用药" : "编辑特殊用药");
        this.store = store;
        this.editing = editing;
        this.onChange = onChange;
        this.mode = editing == null ? SpecialMed.MODE_INTERVAL : editing.mode;
        this.intervalHours = editing == null ? 8 : editing.intervalHours;
        this.hour = editing == null ? 21 : editing.hour;
        this.minute = editing == null ? 0 : editing.minute;
        this.methodIndex = methodIndexOf(editing == null ? "口服" : editing.method);
        build();
        show();
    }

    private static int methodIndexOf(String method) {
        for (int i = 0; i < Med.METHODS.length; i++) {
            if (Med.METHODS[i].equals(method)) return i;
        }
        return 0;
    }

    private void build() {
        TextView intro = Ui.text(activity,
                "特殊用药有独立的提醒节奏，不计入普通药物的今日次数。",
                12.5f, Palette.MUTED);
        intro.setLineSpacing(0, 1.2f);
        add(intro, 12);

        label("药名");
        nameInput = input("例如：某特殊药", InputType.TYPE_CLASS_TEXT);
        if (editing != null) nameInput.setText(editing.name);
        add(nameInput);

        label("每次用量");
        doseInput = input("例如：1片 / 5ml", InputType.TYPE_CLASS_TEXT);
        if (editing != null) doseInput.setText(editing.dose);
        add(doseInput);

        label("剂型");
        String initialForm = editing != null
                ? editing.form
                : Forms.infer(nameInput.getText().toString(), doseInput.getText().toString(), Med.METHODS[methodIndex]);
        formPicker = new FormPicker(activity, initialForm, null);
        add(formPicker.view(), 6);

        label("服用方式");
        FlowLayout methods = new FlowLayout(activity);
        for (int i = 0; i < Med.METHODS.length; i++) {
            final int idx = i;
            TextView chip = Ui.chip(activity, Med.METHODS[i], i == methodIndex);
            chip.setOnClickListener(v -> {
                methodIndex = idx;
                for (int j = 0; j < methods.getChildCount(); j++) {
                    styleChip((TextView) methods.getChildAt(j), j == methodIndex);
                }
            });
            methods.addView(chip);
        }
        add(methods);

        label("服用节奏");
        FlowLayout modeRow = new FlowLayout(activity);
        modeIntervalChip = Ui.chip(activity, "按间隔", mode == SpecialMed.MODE_INTERVAL);
        modeDailyChip = Ui.chip(activity, "每天固定时间", mode == SpecialMed.MODE_DAILY);
        modeIntervalChip.setOnClickListener(v -> {
            if (mode != SpecialMed.MODE_INTERVAL) {
                mode = SpecialMed.MODE_INTERVAL;
                scheduleChanged = true;
            }
            updateMode();
        });
        modeDailyChip.setOnClickListener(v -> {
            if (mode != SpecialMed.MODE_DAILY) {
                mode = SpecialMed.MODE_DAILY;
                scheduleChanged = true;
            }
            updateMode();
        });
        modeRow.addView(modeIntervalChip);
        modeRow.addView(modeDailyChip);
        add(modeRow, 6);

        intervalCard = Ui.v(activity);
        intervalCard.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 11), Ui.dp(activity, 14), Ui.dp(activity, 11));
        intervalCard.setBackground(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1));
        LinearLayout intervalTop = Ui.h(activity);
        LinearLayout intervalLabels = Ui.v(activity);
        intervalLabels.addView(Ui.medium(activity, "每隔多久提醒", 13.5f, Palette.INK));
        intervalLabels.addView(Ui.text(activity, "从上一次实际服用时间开始计算", 11, Palette.MUTED));
        intervalTop.addView(intervalLabels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout stepper = Ui.h(activity);
        View minus = stepButton(R.drawable.ic_minus);
        minus.setOnClickListener(v -> {
            intervalHours = Math.max(1, intervalHours - 1);
            intervalValue.setText(intervalHours + " 小时");
            scheduleChanged = true;
            updatePreview();
        });
        stepper.addView(minus);
        intervalValue = Ui.bold(activity, intervalHours + " 小时", 14, Palette.VIOLET);
        intervalValue.setGravity(Gravity.CENTER);
        stepper.addView(intervalValue, new LinearLayout.LayoutParams(Ui.dp(activity, 60), Ui.dp(activity, 34)));
        View plus = stepButton(R.drawable.ic_add);
        plus.setOnClickListener(v -> {
            intervalHours = Math.min(72, intervalHours + 1);
            intervalValue.setText(intervalHours + " 小时");
            scheduleChanged = true;
            updatePreview();
        });
        stepper.addView(plus);
        intervalTop.addView(stepper);
        intervalCard.addView(intervalTop);
        add(intervalCard, 8);

        dailyCard = Ui.h(activity);
        dailyCard.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 11), Ui.dp(activity, 12), Ui.dp(activity, 11));
        dailyCard.setBackground(Ui.ripple(Ui.roundStroke(activity, Palette.CARD, 16, Palette.LINE, 1), 0x0F000000));
        LinearLayout dailyLabels = Ui.v(activity);
        dailyLabels.addView(Ui.medium(activity, "每天提醒时间", 13.5f, Palette.INK));
        dailyLabels.addView(Ui.text(activity, "每天这个时间提醒一次", 11, Palette.MUTED));
        dailyCard.addView(dailyLabels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        timeValue = Ui.bold(activity, String.format(java.util.Locale.CHINA, "%02d:%02d", hour, minute), 15, Palette.VIOLET);
        dailyCard.addView(timeValue);
        TextView edit = Ui.medium(activity, " 修改", 12, Palette.PRIMARY);
        dailyCard.addView(edit);
        dailyCard.setOnClickListener(v -> pickDailyTime());
        add(dailyCard, 8);

        LinearLayout previewCard = Ui.v(activity);
        previewCard.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
        previewCard.setBackground(Ui.round(activity, Palette.VIOLET_BG, 14));
        preview = Ui.medium(activity, "", 12, Palette.VIOLET_TEXT);
        previewCard.addView(preview);
        add(previewCard, 10);

        label("备注（可选）");
        noteInput = multiline("例如：睡前服用 / 不要和某药同服");
        if (editing != null) noteInput.setText(editing.note);
        add(noteInput);

        LinearLayout row = footer();
        if (editing != null) {
            TextView delete = Ui.medium(activity, "删除", 14, Palette.DANGER);
            delete.setGravity(Gravity.CENTER);
            delete.setPadding(Ui.dp(activity, 6), 0, Ui.dp(activity, 12), 0);
            delete.setOnClickListener(v -> confirmDelete());
            row.addView(delete, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(activity, 48)));
        }
        View spacer = new View(activity);
        row.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        TextView cancel = Ui.medium(activity, "取消", 14, Palette.MUTED);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(Ui.dp(activity, 8), 0, Ui.dp(activity, 14), 0);
        cancel.setOnClickListener(v -> dismiss());
        row.addView(cancel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(activity, 48)));
        TextView save = Ui.primaryButton(activity, "保存", Palette.VIOLET, Palette.WHITE, 48);
        save.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        save.setOnClickListener(v -> save());
        row.addView(save, new LinearLayout.LayoutParams(Ui.dp(activity, 112), Ui.dp(activity, 48)));
        content.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        updateMode();
    }

    private void updateMode() {
        boolean interval = mode == SpecialMed.MODE_INTERVAL;
        intervalCard.setVisibility(interval ? View.VISIBLE : View.GONE);
        dailyCard.setVisibility(interval ? View.GONE : View.VISIBLE);
        styleChip(modeIntervalChip, interval);
        styleChip(modeDailyChip, !interval);
        updatePreview();
    }

    private void updatePreview() {
        if (preview == null) return;
        SpecialMed temp = new SpecialMed();
        temp.mode = mode;
        temp.intervalHours = intervalHours;
        temp.hour = hour;
        temp.minute = minute;
        long next = temp.computeNext(System.currentTimeMillis());
        preview.setText("按此节奏，下一次提醒约在 " + Fmt.dayLabel(next) + " " + Fmt.time(next));
    }

    private void pickDailyTime() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        new TimeSheet(activity, "每天提醒时间",
                "选择每天固定提醒的时间，适合每天一次的特殊药。",
                "这是每天重复的提醒时间。", true, c.getTimeInMillis(), millis -> {
                    Calendar chosen = Calendar.getInstance();
                    chosen.setTimeInMillis(millis);
                    hour = chosen.get(Calendar.HOUR_OF_DAY);
                    minute = chosen.get(Calendar.MINUTE);
                    timeValue.setText(String.format(java.util.Locale.CHINA, "%02d:%02d", hour, minute));
                    scheduleChanged = true;
                    updatePreview();
                    return true;
                });
    }

    private void styleChip(TextView chip, boolean selected) {
        chip.setTextColor(selected ? Palette.VIOLET_TEXT : Palette.INK_SOFT);
        if (selected) {
            chip.setBackground(Ui.roundStroke(activity, Palette.VIOLET_BG, 20, Palette.VIOLET_LINE, 1));
        } else {
            chip.setBackground(Ui.roundStroke(activity, Palette.FIELD, 20, Palette.LINE, 1));
        }
    }

    private View stepButton(int iconRes) {
        android.widget.ImageView b = Ui.icon(activity, iconRes, Palette.VIOLET, 18);
        b.setPadding(Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9));
        b.setBackground(Ui.ripple(Ui.round(activity, Palette.VIOLET_BG, 18), 0x22000000));
        b.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(activity, 36), Ui.dp(activity, 36)));
        b.setClickable(true);
        b.setFocusable(true);
        return b;
    }

    private void save() {
        String name = nameInput.getText().toString().trim();
        String dose = doseInput.getText().toString().trim();
        if (name.length() == 0) {
            Toast.makeText(activity, "请填写药名", Toast.LENGTH_SHORT).show();
            return;
        }
        if (dose.length() == 0) {
            Toast.makeText(activity, "请填写每次用量", Toast.LENGTH_SHORT).show();
            return;
        }
        SpecialMed target = editing;
        boolean isNew = target == null;
        if (isNew) {
            target = new SpecialMed();
        }
        boolean changed = isNew || scheduleChanged
                || target.mode != mode || target.intervalHours != intervalHours
                || target.hour != hour || target.minute != minute;
        target.name = name;
        target.dose = dose;
        target.method = Med.METHODS[methodIndex];
        target.form = formPicker != null ? formPicker.getForm() : Forms.infer(name, dose, target.method);
        target.note = noteInput.getText().toString().trim();
        target.mode = mode;
        target.intervalHours = intervalHours;
        target.hour = hour;
        target.minute = minute;
        if (changed) {
            long from = isNew ? System.currentTimeMillis()
                    : (mode == SpecialMed.MODE_INTERVAL && target.lastAt > 0L
                    ? target.lastAt : System.currentTimeMillis());
            target.nextAt = target.computeNext(from);
            target.snoozeUntil = 0L;
        }
        if (isNew) store.addSpecial(target);
        else store.saveSpecials();
        SpecialScheduler.scheduleAll(activity, false);
        onChange.run();
        dismiss();
        Toast.makeText(activity, isNew ? "已添加 " + name : "已保存", Toast.LENGTH_SHORT).show();
    }

    private void confirmDelete() {
        if (editing == null) return;
        Dialogs.confirm(activity, "删除特殊用药",
                "确定删除「" + editing.name + "」吗？它的独立提醒也会取消。",
                "删除", () -> {
                    SpecialScheduler.cancelOne(activity, editing);
                    NotificationHelper.cancelSpecial(activity, editing.code);
                    store.removeSpecial(editing);
                    onChange.run();
                    dismiss();
                    Toast.makeText(activity, "已删除", Toast.LENGTH_SHORT).show();
                });
    }
}
