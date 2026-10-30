package com.dsh.medtimer;

import android.app.Activity;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import java.util.Calendar;

final class TimeSheet extends Sheet {
    interface Listener {
        /** Return true to close the sheet, false to keep it open (validation failed). */
        boolean onTime(long millis);
    }

    private final TimePicker picker;

    TimeSheet(Activity activity, long initial, Listener listener) {
        this(activity, "第一次服药时间",
                "选择今天第一次服药的时间，之后会按这个时间自动安排提醒。",
                "只能选择今天已经过去的时间；如果记不清，保持默认的当前时间也可以。",
                false, initial, listener);
    }

    TimeSheet(Activity activity, String title, String introText, String hintText,
              boolean allowFuture, long initial, Listener listener) {
        super(activity, title);
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(initial);

        TextView intro = Ui.text(activity, introText, 12.5f, Palette.MUTED);
        intro.setLineSpacing(0, 1.2f);
        add(intro, 12);

        View inflated = LayoutInflater.from(activity).inflate(R.layout.time_picker, null);
        picker = inflated.findViewById(R.id.time_picker);
        picker.setIs24HourView(true);
        picker.setHour(cal.get(Calendar.HOUR_OF_DAY));
        picker.setMinute(cal.get(Calendar.MINUTE));
        stylePickerText(picker);
        add(picker, 8);

        TextView hint = Ui.text(activity, hintText, 11.5f, Palette.MUTED_LIGHT);
        hint.setLineSpacing(0, 1.2f);
        add(hint, 4);

        LinearLayout row = footer();
        View spacer = new View(activity);
        row.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));

        TextView cancel = Ui.medium(activity, "取消", 14, Palette.MUTED);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(Ui.dp(activity, 8), 0, Ui.dp(activity, 14), 0);
        cancel.setOnClickListener(v -> dismiss());
        row.addView(cancel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(activity, 48)));

        TextView save = Ui.primaryButton(activity, "确定", Palette.PRIMARY, Palette.WHITE, 48);
        save.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        save.setOnClickListener(v -> {
            Calendar chosen = Calendar.getInstance();
            chosen.set(Calendar.HOUR_OF_DAY, picker.getHour());
            chosen.set(Calendar.MINUTE, picker.getMinute());
            chosen.set(Calendar.SECOND, 0);
            chosen.set(Calendar.MILLISECOND, 0);
            if (!allowFuture && chosen.getTimeInMillis() > System.currentTimeMillis() + 30_000L) {
                Toast.makeText(activity, "时间不能晚于现在", Toast.LENGTH_SHORT).show();
                return;
            }
            if (listener.onTime(chosen.getTimeInMillis())) {
                dismiss();
            }
        });
        row.addView(save, new LinearLayout.LayoutParams(Ui.dp(activity, 112), Ui.dp(activity, 48)));
        content.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        show();
    }

    private static void stylePickerText(View view) {
        if (view instanceof TextView) {
            ((TextView) view).setTextColor(Palette.INK);
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                stylePickerText(group.getChildAt(i));
            }
        }
    }
}
