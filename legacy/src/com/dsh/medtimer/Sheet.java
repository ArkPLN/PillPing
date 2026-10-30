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

abstract class Sheet {
    final Activity activity;
    final Dialog dialog;
    final LinearLayout content;
    final LinearLayout root;
    private final MaxHeightScrollView scroll;
    private final TextView titleView;

    Sheet(Activity activity, String title) {
        this.activity = activity;
        this.dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCanceledOnTouchOutside(true);
        Window sheetWindow = dialog.getWindow();
        if (sheetWindow != null) {
            sheetWindow.setWindowAnimations(R.style.SheetAnimation);
        }

        root = Ui.v(activity);
        root.setBackground(Ui.corners(activity, Palette.CARD, 26, 0));
        root.setPadding(Ui.dp(activity, 20), Ui.dp(activity, 8), Ui.dp(activity, 20), Ui.dp(activity, 22));

        View handle = new View(activity);
        handle.setBackground(Ui.round(activity, Palette.LINE, 3));
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(Ui.dp(activity, 38), Ui.dp(activity, 4));
        hp.gravity = Gravity.CENTER_HORIZONTAL;
        hp.topMargin = Ui.dp(activity, 2);
        root.addView(handle, hp);

        LinearLayout header = Ui.h(activity);
        header.setPadding(0, Ui.dp(activity, 14), 0, 0);
        titleView = Ui.bold(activity, title, 20, Palette.INK);
        header.addView(titleView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        View close = Ui.icon(activity, R.drawable.ic_close, Palette.MUTED, 22);
        LinearLayout closeWrap = Ui.h(activity);
        closeWrap.setGravity(Gravity.CENTER);
        closeWrap.setBackground(Ui.ripple(Ui.round(activity, Palette.FIELD, 18), 0x22000000));
        closeWrap.addView(close);
        closeWrap.setOnClickListener(v -> dismiss());
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(Ui.dp(activity, 38), Ui.dp(activity, 38));
        header.addView(closeWrap, cp);
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        scroll = new MaxHeightScrollView(activity);
        content = Ui.v(activity);
        content.setPadding(0, Ui.dp(activity, 4), 0, 0);
        scroll.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        dialog.setContentView(root);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int bottom = insets.getSystemWindowInsetBottom();
            if (bottom > 0) {
                root.setPadding(root.getPaddingLeft(), root.getPaddingTop(), root.getPaddingRight(),
                        bottom + Ui.dp(activity, 8));
            }
            return insets;
        });
        root.requestApplyInsets();
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.setDimAmount(0.45f);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            w.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
            int sheetWidth = Math.min(activity.getResources().getDisplayMetrics().widthPixels,
                    Ui.dp(activity, 560));
            w.setLayout(sheetWidth, WindowManager.LayoutParams.WRAP_CONTENT);
            w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }
    }

    void setTitle(String title) {
        titleView.setText(title);
    }

    void show() {
        dialog.show();
    }

    void dismiss() {
        try {
            dialog.dismiss();
        } catch (Exception ignored) {
        }
    }

    void add(View v) {
        content.addView(v, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    void add(View v, int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = Ui.dp(activity, topDp);
        content.addView(v, p);
    }

    TextView section(String text) {
        TextView tv = Ui.medium(activity, text, 12.5f, Palette.PRIMARY);
        tv.setLetterSpacing(0.02f);
        content.addView(tv, sectionParams(20));
        return tv;
    }

    LinearLayout.LayoutParams sectionParams(int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = Ui.dp(activity, topDp);
        p.bottomMargin = Ui.dp(activity, 8);
        return p;
    }

    TextView label(String text) {
        TextView tv = Ui.medium(activity, text, 12.5f, Palette.MUTED);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = Ui.dp(activity, 14);
        p.bottomMargin = Ui.dp(activity, 6);
        content.addView(tv, p);
        return tv;
    }

    TextView labelWithIcon(int iconRes, String text) {
        LinearLayout row = Ui.h(activity);
        row.addView(Ui.icon(activity, iconRes, Palette.MUTED, 17));
        TextView tv = Ui.medium(activity, text, 12.5f, Palette.MUTED);
        tv.setPadding(Ui.dp(activity, 6), 0, 0, 0);
        row.addView(tv);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = Ui.dp(activity, 14);
        p.bottomMargin = Ui.dp(activity, 6);
        content.addView(row, p);
        return tv;
    }

    EditText input(String hint, int inputType) {
        EditText et = new EditText(activity);
        et.setHint(hint);
        et.setHintTextColor(Palette.MUTED_LIGHT);
        et.setTextColor(Palette.INK);
        et.setTextSize(15);
        et.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        et.setInputType(inputType);
        et.setSingleLine(true);
        et.setPadding(Ui.dp(activity, 14), Ui.dp(activity, 12), Ui.dp(activity, 14), Ui.dp(activity, 12));
        et.setBackground(Ui.roundStroke(activity, Palette.FIELD, 14, Palette.LINE, 1));
        return et;
    }

    EditText multiline(String hint) {
        EditText et = input(hint, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        et.setSingleLine(false);
        et.setMinLines(2);
        et.setGravity(Gravity.TOP | Gravity.START);
        et.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        return et;
    }

    void divider() {
        View line = Ui.line(activity, Palette.LINE);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, Ui.dp(activity, 1)));
        p.topMargin = Ui.dp(activity, 18);
        p.bottomMargin = Ui.dp(activity, 18);
        content.addView(line, p);
    }

    TextView primaryButton(String text) {
        TextView b = Ui.primaryButton(activity, text, Palette.PRIMARY, Palette.WHITE, 52);
        add(b, 20);
        return b;
    }

    TextView secondaryButton(String text) {
        TextView b = Ui.outlineButton(activity, text, Palette.INK_SOFT, Palette.LINE, 48);
        add(b, 10);
        return b;
    }

    LinearLayout footer() {
        LinearLayout row = Ui.h(activity);
        row.setPadding(0, Ui.dp(activity, 20), 0, 0);
        return row;
    }
}
