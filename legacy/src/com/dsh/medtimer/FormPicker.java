package com.dsh.medtimer;

import android.app.Activity;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Form chips + animated icon preview used by add/edit medication sheets. */
final class FormPicker {
    interface Listener {
        void onForm(String form);
    }

    private final Activity activity;
    private final LinearLayout view;
    private final FrameLayout iconBox;
    private final ImageView iconA;
    private final ImageView iconB;
    private final TextView title;
    private final TextView subtitle;
    private final Listener listener;
    private ImageView activeIcon;
    private String form;
    private FlowLayout chips;

    FormPicker(Activity activity, String initial, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.form = Forms.NAMES[Forms.indexOf(initial)];
        this.view = Ui.v(activity);
        this.view.setPadding(Ui.dp(activity, 13), Ui.dp(activity, 12), Ui.dp(activity, 13), Ui.dp(activity, 11));
        this.view.setBackground(Ui.roundStroke(activity, Palette.FIELD, 16, Palette.LINE, 1));

        LinearLayout top = Ui.h(activity);
        iconBox = new FrameLayout(activity);
        iconBox.setBackground(Ui.circle(activity, Palette.MINT));
        iconA = formIcon(Forms.iconRes(form));
        iconB = formIcon(Forms.iconRes(form));
        iconB.setAlpha(0f);
        activeIcon = iconA;
        FrameLayout.LayoutParams ip = new FrameLayout.LayoutParams(Ui.dp(activity, 28), Ui.dp(activity, 28), Gravity.CENTER);
        iconBox.addView(iconA, ip);
        iconBox.addView(iconB, new FrameLayout.LayoutParams(Ui.dp(activity, 28), Ui.dp(activity, 28), Gravity.CENTER));
        top.addView(iconBox, new LinearLayout.LayoutParams(Ui.dp(activity, 46), Ui.dp(activity, 46)));

        LinearLayout labels = Ui.v(activity);
        labels.setPadding(Ui.dp(activity, 10), 0, 0, 0);
        title = Ui.medium(activity, "剂型 · " + form, 13.5f, Palette.INK);
        labels.addView(title);
        subtitle = Ui.text(activity, formHint(form), 11, Palette.MUTED);
        subtitle.setPadding(0, Ui.dp(activity, 3), 0, 0);
        subtitle.setLineSpacing(0, 1.1f);
        labels.addView(subtitle);
        top.addView(labels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        view.addView(top);

        chips = new FlowLayout(activity);
        for (int i = 0; i < Forms.NAMES.length; i++) {
            final String f = Forms.NAMES[i];
            TextView chip = Ui.chip(activity, f, f.equals(form));
            chip.setOnClickListener(v -> select(f));
            chips.addView(chip);
        }
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        cp.topMargin = Ui.dp(activity, 9);
        view.addView(chips, cp);
    }

    private ImageView formIcon(int res) {
        ImageView iv = new ImageView(activity);
        iv.setImageResource(res);
        iv.setColorFilter(Palette.PRIMARY);
        iv.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        return iv;
    }

    private static String formHint(String form) {
        if (Forms.CAPSULE.equals(form)) return "胶囊剂，通常按粒服用";
        if (Forms.LIQUID.equals(form)) return "口服液 / 糖浆，按毫升服用";
        if (Forms.INJECTION.equals(form)) return "注射剂，按支或毫升记录";
        if (Forms.TOPICAL.equals(form)) return "外用 / 喷雾 / 贴剂";
        if (Forms.OTHER.equals(form)) return "其他剂型，可在备注里说明";
        return "片剂，通常按片服用";
    }

    View view() {
        return view;
    }

    String getForm() {
        return form;
    }

    private void select(String next) {
        if (next == null || next.equals(form)) return;
        form = next;

        ImageView incoming = activeIcon == iconA ? iconB : iconA;
        incoming.setImageResource(Forms.iconRes(form));
        incoming.setAlpha(0f);
        incoming.setScaleX(0.82f);
        incoming.setScaleY(0.82f);
        activeIcon.animate().alpha(0f).scaleX(0.9f).scaleY(0.9f).setDuration(110).start();
        incoming.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(190).start();
        activeIcon = incoming;

        title.animate().alpha(0f).setDuration(80).withEndAction(() -> {
            title.setText("剂型 · " + form);
            subtitle.setText(formHint(form));
            title.animate().alpha(1f).setDuration(160).start();
            subtitle.setAlpha(0f);
            subtitle.animate().alpha(1f).setDuration(180).start();
        }).start();

        for (int i = 0; i < chips.getChildCount(); i++) {
            TextView chip = (TextView) chips.getChildAt(i);
            boolean selected = Forms.NAMES[i].equals(form);
            chip.setTextColor(selected ? Palette.PRIMARY : Palette.INK_SOFT);
            chip.setBackground(selected
                    ? Ui.roundStroke(activity, Palette.MINT, 20, Palette.withAlpha(Palette.PRIMARY, 90), 1)
                    : Ui.roundStroke(activity, Palette.FIELD, 20, Palette.LINE, 1));
        }
        if (listener != null) listener.onForm(form);
    }
}
