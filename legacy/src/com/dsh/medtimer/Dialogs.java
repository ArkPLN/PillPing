package com.dsh.medtimer;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

final class Dialogs {
    private Dialogs() {
    }

    static void confirm(Activity activity, String title, String message, String positive, Runnable onConfirm) {
        show(activity, title, message, "取消", positive, onConfirm);
    }

    static void info(Activity activity, String title, String message) {
        show(activity, title, message, null, "知道了", null);
    }

    interface NumberListener {
        void onNumber(int value);
    }

    static void number(Activity activity, String title, String hint, int initial, int min, int max, NumberListener listener) {
        Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCanceledOnTouchOutside(true);

        LinearLayout card = Ui.v(activity);
        card.setPadding(Ui.dp(activity, 22), Ui.dp(activity, 22), Ui.dp(activity, 22), Ui.dp(activity, 15));
        card.setBackground(Ui.round(activity, Palette.CARD, 24));
        TextView titleView = Ui.bold(activity, title, 18, Palette.INK);
        card.addView(titleView);
        TextView hintView = Ui.text(activity, hint, 12.5f, Palette.MUTED);
        hintView.setPadding(0, Ui.dp(activity, 8), 0, Ui.dp(activity, 8));
        hintView.setLineSpacing(0, 1.2f);
        card.addView(hintView);

        EditText input = new EditText(activity);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setText(String.valueOf(initial));
        input.setSelectAllOnFocus(true);
        input.setTextSize(22);
        input.setGravity(Gravity.CENTER);
        input.setTextColor(Palette.INK);
        input.setHintTextColor(Palette.MUTED_LIGHT);
        input.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
        input.setBackground(Ui.roundStroke(activity, Palette.FIELD, 14, Palette.LINE, 1));
        card.addView(input);

        LinearLayout buttons = Ui.h(activity);
        buttons.setGravity(Gravity.END);
        buttons.setPadding(0, Ui.dp(activity, 10), 0, 0);
        TextView cancel = Ui.medium(activity, "取消", 14, Palette.MUTED);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
        cancel.setOnClickListener(v -> dialog.dismiss());
        buttons.addView(cancel);
        TextView ok = Ui.medium(activity, "确定", 14, Palette.PRIMARY);
        ok.setGravity(Gravity.CENTER);
        ok.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 10), Ui.dp(activity, 10));
        ok.setOnClickListener(v -> {
            int value;
            try {
                value = Integer.parseInt(input.getText().toString().trim());
            } catch (Exception e) {
                Toast.makeText(activity, "请输入 " + min + "–" + max + " 的数字", Toast.LENGTH_SHORT).show();
                return;
            }
            if (value < min || value > max) {
                Toast.makeText(activity, "请输入 " + min + "–" + max + " 的数字", Toast.LENGTH_SHORT).show();
                return;
            }
            dialog.dismiss();
            if (listener != null) listener.onNumber(value);
        });
        buttons.addView(ok);
        card.addView(buttons);

        dialog.setContentView(card);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.setDimAmount(0.45f);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            w.setGravity(Gravity.CENTER);
            int width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - Ui.dp(activity, 48),
                    Ui.dp(activity, 360));
            w.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        dialog.show();
        input.requestFocus();
    }

    private static void show(Activity activity, String title, String message,
                             String negative, String positive, Runnable onConfirm) {
        Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCanceledOnTouchOutside(true);

        LinearLayout card = Ui.v(activity);
        card.setPadding(Ui.dp(activity, 22), Ui.dp(activity, 22), Ui.dp(activity, 22), Ui.dp(activity, 14));
        card.setBackground(Ui.round(activity, Palette.CARD, 24));

        TextView titleView = Ui.bold(activity, title, 18, Palette.INK);
        titleView.setLineSpacing(0, 1.15f);
        card.addView(titleView);

        TextView messageView = Ui.text(activity, message, 13, Palette.MUTED);
        messageView.setLineSpacing(Ui.dp(activity, 3), 1.28f);
        messageView.setPadding(0, Ui.dp(activity, 10), 0, Ui.dp(activity, 8));
        card.addView(messageView);

        LinearLayout buttons = Ui.h(activity);
        buttons.setGravity(Gravity.END);
        buttons.setPadding(0, Ui.dp(activity, 8), 0, 0);
        if (negative != null) {
            TextView cancel = Ui.medium(activity, negative, 14, Palette.MUTED);
            cancel.setGravity(Gravity.CENTER);
            cancel.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 14), Ui.dp(activity, 10));
            cancel.setOnClickListener(v -> dialog.dismiss());
            buttons.addView(cancel);
        }
        TextView ok = Ui.medium(activity, positive, 14,
                isDangerous(positive) ? Palette.DANGER : Palette.PRIMARY);
        ok.setGravity(Gravity.CENTER);
        ok.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 10), Ui.dp(activity, 10), Ui.dp(activity, 10));
        ok.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        ok.setOnClickListener(v -> {
            dialog.dismiss();
            if (onConfirm != null) onConfirm.run();
        });
        buttons.addView(ok);
        card.addView(buttons);

        dialog.setContentView(card);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.setDimAmount(0.45f);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            w.setGravity(Gravity.CENTER);
            int width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - Ui.dp(activity, 48),
                    Ui.dp(activity, 360));
            w.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        dialog.show();
    }

    private static boolean isDangerous(String text) {
        return text.contains("删") || text.contains("清空") || text.contains("跳过");
    }
}
