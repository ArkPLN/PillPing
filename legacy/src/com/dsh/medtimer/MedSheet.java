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

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

final class MedSheet extends Sheet {
    private final Store store;
    private final Med editing;
    private final Runnable onChange;
    private final int doseCount;
    private boolean allDoses = true;
    private int slotMask = 0;
    private int methodIndex;
    private EditText nameInput;
    private EditText doseInput;
    private EditText noteInput;
    private FormPicker formPicker;
    private int courseDays;
    private long courseStart;
    private int followupDays;
    private long nextFollowup;
    private TextView courseValue;
    private TextView courseEndText;
    private TextView followupValue;
    private TextView followupNextText;
    private final List<TextView> methodChips = new ArrayList<>();
    private final List<TextView> slotChips = new ArrayList<>();
    private TextView everyChip;

    MedSheet(Activity activity, Store store, Med editing, Runnable onChange) {
        super(activity, editing == null ? "添加药物" : "编辑药物");
        this.store = store;
        this.editing = editing;
        this.onChange = onChange;
        this.doseCount = store.doseCount;
        if (editing != null) {
            allDoses = editing.allDoses;
            slotMask = editing.slotMask;
            methodIndex = methodIndexOf(editing.method);
            courseDays = editing.courseDays;
            courseStart = editing.courseStart;
            followupDays = editing.followupDays;
            nextFollowup = editing.nextFollowupAt;
            if (!allDoses && slotMask == 0) allDoses = true;
        }
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
                editing == null ? "添加你每天要吃的药，提醒时会自动带上这些信息。" : "修改后，之后的提醒内容会同步更新。",
                12.5f, Palette.MUTED);
        intro.setLineSpacing(0, 1.2f);
        add(intro, 12);

        label("药名");
        nameInput = input("例如：维生素D", InputType.TYPE_CLASS_TEXT);
        if (editing != null) nameInput.setText(editing.name);
        add(nameInput);
        nameInput.setSelection(nameInput.getText().length());

        label("每次用量");
        doseInput = input("例如：1片 / 半粒 / 5ml", InputType.TYPE_CLASS_TEXT);
        if (editing != null) doseInput.setText(editing.dose);
        add(doseInput);

        FlowLayout doseQuick = new FlowLayout(activity);
        String[] quick = {"半片", "1片", "2片", "1粒", "2粒", "5ml", "10ml"};
        for (String q : quick) {
            TextView chip = Ui.chip(activity, q, false);
            chip.setOnClickListener(v -> {
                doseInput.setText(q);
                doseInput.setSelection(doseInput.getText().length());
            });
            doseQuick.addView(chip);
        }
        add(doseQuick, 8);

        label("剂型");
        String initialForm = editing != null
                ? editing.form
                : Forms.infer(nameInput.getText().toString(), doseInput.getText().toString(), Med.METHODS[methodIndex]);
        formPicker = new FormPicker(activity, initialForm, null);
        add(formPicker.view(), 6);

        label("服用方式");
        FlowLayout methods = new FlowLayout(activity);
        for (int i = 0; i < Med.METHODS.length; i++) {
            final int index = i;
            TextView chip = Ui.chip(activity, Med.METHODS[i], i == methodIndex);
            chip.setOnClickListener(v -> {
                methodIndex = index;
                restyleMethods();
            });
            methodChips.add(chip);
            methods.addView(chip);
        }
        add(methods);

        label("服用时机");
        FlowLayout slotRow = new FlowLayout(activity);
        everyChip = Ui.chip(activity, "每次", allDoses);
        everyChip.setOnClickListener(v -> {
            allDoses = true;
            restyleSlots();
        });
        slotRow.addView(everyChip);
        for (int i = 0; i < doseCount; i++) {
            final int index = i;
            TextView chip = Ui.chip(activity, "第" + (i + 1) + "次", !allDoses && isSlot(i));
            chip.setOnClickListener(v -> {
                if (allDoses) {
                    allDoses = false;
                    slotMask = 0;
                }
                slotMask ^= (1 << index);
                restyleSlots();
            });
            slotChips.add(chip);
            slotRow.addView(chip);
        }
        add(slotRow);
        TextView slotHint = Ui.text(activity,
                "选「每次」会自动包含以后新增的次数；也可以只选某几次。至少选择一次。",
                11.5f, Palette.MUTED_LIGHT);
        add(slotHint, 7);

        labelWithIcon(R.drawable.ic_ms_calendar, "服药周期");
        LinearLayout courseCard = Ui.v(activity);
        courseCard.setPadding(Ui.dp(activity, 13), Ui.dp(activity, 11), Ui.dp(activity, 13), Ui.dp(activity, 11));
        courseCard.setBackground(Ui.roundStroke(activity, Palette.FIELD, 16, Palette.LINE, 1));
        LinearLayout courseTop = Ui.h(activity);
        LinearLayout courseLabels = Ui.v(activity);
        courseLabels.addView(Ui.medium(activity, "连续服用天数", 13.5f, Palette.INK));
        courseLabels.addView(Ui.text(activity, "0 = 不限制；到期后自动停止该药提醒", 11, Palette.MUTED));
        courseTop.addView(courseLabels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout courseStep = Ui.h(activity);
        View courseMinus = stepButton(R.drawable.ic_minus);
        courseMinus.setOnClickListener(v -> {
            courseDays = Math.max(0, courseDays - 1);
            if (courseDays > 0 && courseStart <= 0L) courseStart = startOfToday();
            updateCourse();
        });
        courseStep.addView(courseMinus);
        courseValue = Ui.bold(activity, "不限制", 14, Palette.PRIMARY);
        courseValue.setGravity(Gravity.CENTER);
        courseValue.setMinWidth(Ui.dp(activity, 76));
        courseStep.addView(courseValue);
        View coursePlus = stepButton(R.drawable.ic_add);
        coursePlus.setOnClickListener(v -> {
            courseDays = Math.min(365, courseDays + 1);
            if (courseStart <= 0L) courseStart = startOfToday();
            updateCourse();
        });
        courseStep.addView(coursePlus);
        TextView courseInput = Ui.medium(activity, "输入", 12, Palette.PRIMARY);
        courseInput.setGravity(Gravity.CENTER);
        courseInput.setPadding(Ui.dp(activity, 6), Ui.dp(activity, 8), Ui.dp(activity, 2), Ui.dp(activity, 8));
        courseInput.setOnClickListener(v -> Dialogs.number(activity, "设置服药天数",
                "0 = 长期服用；也可以直接输入 1–365 天。", courseDays, 0, 365, value -> {
                    courseDays = value;
                    if (courseDays > 0 && courseStart <= 0L) courseStart = startOfToday();
                    updateCourse();
                }));
        courseStep.addView(courseInput);
        courseTop.addView(courseStep);
        stackIfCompact(courseTop, courseLabels, courseStep);
        courseCard.addView(courseTop);

        FlowLayout courseQuick = new FlowLayout(activity);
        String[] coursePresets = {"长期", "7 天", "14 天", "30 天", "90 天"};
        for (String preset : coursePresets) {
            TextView chip = Ui.chip(activity, preset, false);
            chip.setOnClickListener(v -> {
                if ("长期".equals(preset)) {
                    courseDays = 0;
                    courseStart = 0L;
                } else {
                    courseDays = Integer.parseInt(preset.replace(" 天", ""));
                    if (courseStart <= 0L) courseStart = startOfToday();
                }
                updateCourse();
            });
            courseQuick.addView(chip);
        }
        LinearLayout.LayoutParams cqp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        cqp.topMargin = Ui.dp(activity, 8);
        courseCard.addView(courseQuick, cqp);
        courseEndText = Ui.text(activity, "", 11, Palette.MUTED);
        courseEndText.setPadding(0, Ui.dp(activity, 7), 0, 0);
        courseCard.addView(courseEndText);
        TextView courseTip = Ui.text(activity, "也可直接点上方「输入」填写天数。", 10.5f, Palette.MUTED_LIGHT);
        courseTip.setPadding(0, Ui.dp(activity, 2), 0, 0);
        courseCard.addView(courseTip);
        add(courseCard, 6);

        labelWithIcon(R.drawable.ic_ms_heart, "复诊提醒");
        LinearLayout followupCard = Ui.v(activity);
        followupCard.setPadding(Ui.dp(activity, 13), Ui.dp(activity, 11), Ui.dp(activity, 13), Ui.dp(activity, 11));
        followupCard.setBackground(Ui.roundStroke(activity, Palette.FIELD, 16, Palette.LINE, 1));
        LinearLayout followupTop = Ui.h(activity);
        LinearLayout followupLabels = Ui.v(activity);
        followupLabels.addView(Ui.medium(activity, "复诊间隔", 13.5f, Palette.INK));
        followupLabels.addView(Ui.text(activity, "0 = 不提醒；服药期间定期复诊", 11, Palette.MUTED));
        followupTop.addView(followupLabels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout followupStep = Ui.h(activity);
        View followupMinus = stepButton(R.drawable.ic_minus);
        followupMinus.setOnClickListener(v -> {
            followupDays = Math.max(0, followupDays - 1);
            nextFollowup = 0L;
            updateFollowup();
        });
        followupStep.addView(followupMinus);
        followupValue = Ui.bold(activity, "不提醒", 14, Palette.VIOLET_TEXT);
        followupValue.setGravity(Gravity.CENTER);
        followupValue.setMinWidth(Ui.dp(activity, 76));
        followupStep.addView(followupValue);
        View followupPlus = stepButton(R.drawable.ic_add);
        followupPlus.setOnClickListener(v -> {
            followupDays = Math.min(365, followupDays + 1);
            nextFollowup = 0L;
            updateFollowup();
        });
        followupStep.addView(followupPlus);
        TextView followupInput = Ui.medium(activity, "输入", 12, Palette.PRIMARY);
        followupInput.setGravity(Gravity.CENTER);
        followupInput.setPadding(Ui.dp(activity, 6), Ui.dp(activity, 8), Ui.dp(activity, 2), Ui.dp(activity, 8));
        followupInput.setOnClickListener(v -> Dialogs.number(activity, "设置复诊间隔",
                "0 = 不提醒；可以直接输入 1–365 天。", followupDays, 0, 365, value -> {
                    followupDays = value;
                    nextFollowup = 0L;
                    updateFollowup();
                }));
        followupStep.addView(followupInput);
        followupTop.addView(followupStep);
        stackIfCompact(followupTop, followupLabels, followupStep);
        followupCard.addView(followupTop);
        FlowLayout followupQuick = new FlowLayout(activity);
        String[] followPresets = {"14 天", "30 天", "90 天"};
        for (String preset : followPresets) {
            TextView chip = Ui.chip(activity, preset, false);
            chip.setOnClickListener(v -> {
                followupDays = Integer.parseInt(preset.replace(" 天", ""));
                nextFollowup = 0L;
                updateFollowup();
            });
            followupQuick.addView(chip);
        }
        LinearLayout.LayoutParams fqp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        fqp.topMargin = Ui.dp(activity, 8);
        followupCard.addView(followupQuick, fqp);
        followupNextText = Ui.text(activity, "", 11, Palette.MUTED);
        followupNextText.setPadding(0, Ui.dp(activity, 7), 0, 0);
        followupCard.addView(followupNextText);
        TextView followupTip = Ui.text(activity, "也可直接点上方「输入」填写间隔天数。", 10.5f, Palette.MUTED_LIGHT);
        followupTip.setPadding(0, Ui.dp(activity, 2), 0, 0);
        followupCard.addView(followupTip);
        add(followupCard, 6);

        TextView cycleHint = Ui.text(activity,
                "疗程结束后该药不再出现在提醒里；复诊提醒只在该药疗程内生效，可单独关闭。",
                11, Palette.MUTED_LIGHT);
        cycleHint.setLineSpacing(0, 1.2f);
        add(cycleHint, 4);

        updateCourse();
        updateFollowup();

        label("备注（可选）");
        noteInput = multiline("例如：饭后服用 / 不要和牛奶同服");
        if (editing != null) noteInput.setText(editing.note);
        add(noteInput);

        TextView hint = Ui.text(activity, "提醒通知会显示：药名、用量、剂型和服用方式。", 11.5f, Palette.MUTED_LIGHT);
        add(hint, 14);

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

        TextView save = Ui.primaryButton(activity, "保存", Palette.PRIMARY, Palette.WHITE, 48);
        save.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        save.setOnClickListener(v -> save());
        row.addView(save, new LinearLayout.LayoutParams(Ui.dp(activity, 112), Ui.dp(activity, 48)));
        content.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private boolean isSlot(int slot) {
        return ((slotMask >>> slot) & 1) == 1;
    }

    private void restyleMethods() {
        for (int i = 0; i < methodChips.size(); i++) {
            styleChip(methodChips.get(i), i == methodIndex);
        }
    }

    private void restyleSlots() {
        styleChip(everyChip, allDoses);
        everyChip.setAlpha(1f);
        for (int i = 0; i < slotChips.size(); i++) {
            TextView chip = slotChips.get(i);
            boolean selected = !allDoses && isSlot(i);
            styleChip(chip, selected);
            chip.setAlpha(allDoses ? 0.55f : 1f);
        }
    }

    private void styleChip(TextView chip, boolean selected) {
        chip.setTextColor(selected ? Palette.PRIMARY : Palette.INK_SOFT);
        if (selected) {
            chip.setBackground(Ui.roundStroke(activity, Palette.MINT, 20,
                    Palette.withAlpha(Palette.PRIMARY, 90), 1));
        } else {
            chip.setBackground(Ui.roundStroke(activity, Palette.FIELD, 20, Palette.LINE, 1));
        }
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

    private long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private void updateCourse() {
        if (courseValue == null) return;
        courseValue.setText(courseDays <= 0 ? "不限制" : courseDays + " 天");
        if (courseDays <= 0) {
            courseEndText.setText("长期服用，不会自动停止");
            return;
        }
        if (courseStart <= 0L) {
            courseEndText.setText("保存后从今天开始计算");
            return;
        }
        long end = courseStart + courseDays * 86_400_000L;
        if (System.currentTimeMillis() >= end) {
            courseEndText.setText("疗程已结束（至 " + Fmt.monthDay(end - 1L) + "）");
        } else {
            courseEndText.setText("预计服用至 " + Fmt.monthDay(end - 1L) + "，到期后自动停止该药提醒");
        }
        if (followupValue != null) updateFollowup();
    }

    private void updateFollowup() {
        if (followupValue == null) return;
        followupValue.setText(followupDays <= 0 ? "不提醒" : "每 " + followupDays + " 天");
        if (followupDays <= 0) {
            followupNextText.setText("不发送复诊提醒");
            return;
        }
        if (courseDays > 0 && courseStart > 0L
                && System.currentTimeMillis() >= courseStart + courseDays * 86_400_000L) {
            followupNextText.setText("该药疗程已结束，复诊提醒不会生效");
        } else if (nextFollowup > 0L) {
            followupNextText.setText("下次复诊：" + Fmt.monthDay(nextFollowup));
        } else {
            followupNextText.setText("保存后从今天开始计算");
        }
    }

    private View stepButton(int iconRes) {
        android.widget.ImageView b = Ui.icon(activity, iconRes, Palette.PRIMARY, 18);
        b.setPadding(Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9), Ui.dp(activity, 9));
        b.setBackground(Ui.ripple(Ui.round(activity, Palette.MINT, 18), 0x22000000));
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
            nameInput.requestFocus();
            return;
        }
        if (dose.length() == 0) {
            Toast.makeText(activity, "请填写每次用量", Toast.LENGTH_SHORT).show();
            doseInput.requestFocus();
            return;
        }
        if (!allDoses && slotMask == 0) {
            Toast.makeText(activity, "请至少选择一次服药", Toast.LENGTH_SHORT).show();
            return;
        }

        Med target = editing;
        if (target == null) {
            target = new Med();
            target.color = store.meds.size() % Palette.MED_COLORS.length;
            store.meds.add(target);
        }
        target.name = name;
        target.dose = dose;
        target.method = Med.METHODS[methodIndex];
        target.form = formPicker != null ? formPicker.getForm() : Forms.infer(name, dose, target.method);
        target.note = noteInput.getText().toString().trim();
        target.allDoses = allDoses;
        target.slotMask = slotMask;
        target.courseDays = courseDays;
        if (courseDays <= 0) {
            target.courseStart = 0L;
        } else if (target.courseStart <= 0L || (editing != null && editing.courseDays <= 0)) {
            target.courseStart = startOfToday();
        }
        target.followupDays = followupDays;
        if (followupDays <= 0) {
            target.nextFollowupAt = 0L;
        } else if (nextFollowup <= 0L || (editing != null && editing.followupDays != followupDays)) {
            target.nextFollowupAt = System.currentTimeMillis() + followupDays * 86_400_000L;
        } else {
            target.nextFollowupAt = nextFollowup;
        }
        store.saveMeds();
        FollowupScheduler.scheduleAll(activity, false);
        onChange.run();
        dismiss();
        Toast.makeText(activity, editing == null ? "已添加 " + name : "已保存", Toast.LENGTH_SHORT).show();
    }

    private void confirmDelete() {
        if (editing == null) return;
        Dialogs.confirm(activity, "删除药物",
                "确定删除「" + editing.name + "」吗？之后不会再出现在提醒里。",
                "删除", () -> {
                    store.meds.remove(editing);
                    store.saveMeds();
                    FollowupScheduler.scheduleAll(activity, false);
                    onChange.run();
                    dismiss();
                    Toast.makeText(activity, "已删除", Toast.LENGTH_SHORT).show();
                });
    }
}
