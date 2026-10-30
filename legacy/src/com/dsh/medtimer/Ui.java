package com.dsh.medtimer;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Ui {
    private Ui() {
    }

    static int dp(Context c, float value) {
        return Math.round(value * c.getResources().getDisplayMetrics().density);
    }

    static TextView text(Context c, CharSequence value, float sp, int color) {
        return text(c, value, sp, color, Typeface.NORMAL);
    }

    static TextView text(Context c, CharSequence value, float sp, int color, int style) {
        TextView tv = new TextView(c);
        tv.setText(value);
        tv.setTextSize(sp);
        tv.setTextColor(color);
        tv.setTypeface(Typeface.create("sans-serif", style));
        tv.setIncludeFontPadding(false);
        return tv;
    }

    static TextView medium(Context c, CharSequence value, float sp, int color) {
        TextView tv = text(c, value, sp, color);
        tv.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return tv;
    }

    static TextView bold(Context c, CharSequence value, float sp, int color) {
        TextView tv = text(c, value, sp, color, Typeface.BOLD);
        return tv;
    }

    static LinearLayout v(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    static LinearLayout h(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    static LinearLayout.LayoutParams lp(Context c, int wDp, int hDp) {
        return new LinearLayout.LayoutParams(
                wDp < 0 ? wDp : dp(c, wDp),
                hDp < 0 ? hDp : dp(c, hDp));
    }

    static LinearLayout.LayoutParams lp(Context c, int wDp, int hDp, float weight) {
        LinearLayout.LayoutParams p = lp(c, wDp, hDp);
        p.weight = weight;
        return p;
    }

    static void margins(View v, int l, int t, int r, int b) {
        ViewGroup.LayoutParams raw = v.getLayoutParams();
        if (!(raw instanceof ViewGroup.MarginLayoutParams)) return;
        ViewGroup.MarginLayoutParams p = (ViewGroup.MarginLayoutParams) raw;
        Context c = v.getContext();
        p.setMargins(dp(c, l), dp(c, t), dp(c, r), dp(c, b));
        v.setLayoutParams(p);
    }

    static View spacer(Context c, int hDp) {
        View v = new View(c);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(c, hDp)));
        return v;
    }

    static View line(Context c, int color) {
        View v = new View(c);
        v.setBackgroundColor(color);
        v.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, dp(c, 1))));
        return v;
    }

    static GradientDrawable round(Context c, int color, float radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(c, radiusDp));
        return d;
    }

    static GradientDrawable roundStroke(Context c, int color, float radiusDp, int strokeColor, float strokeDp) {
        GradientDrawable d = round(c, color, radiusDp);
        d.setStroke(Math.max(1, dp(c, strokeDp)), strokeColor);
        return d;
    }

    static GradientDrawable roundDashed(Context c, int color, float radiusDp, int strokeColor, float strokeDp) {
        GradientDrawable d = round(c, color, radiusDp);
        d.setStroke(Math.max(1, dp(c, strokeDp)), strokeColor, dp(c, 6), dp(c, 5));
        return d;
    }

    static GradientDrawable circle(Context c, int color) {
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(color);
        return d;
    }

    static GradientDrawable gradient(Context c, int start, int end, float radiusDp) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{start, end});
        d.setCornerRadius(dp(c, radiusDp));
        return d;
    }

    static GradientDrawable corners(Context c, int color, float topDp, float bottomDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        float t = dp(c, topDp);
        float b = dp(c, bottomDp);
        d.setCornerRadii(new float[]{t, t, t, t, b, b, b, b});
        return d;
    }

    static Drawable ripple(Drawable content, int color) {
        return new RippleDrawable(ColorStateList.valueOf(color), content, null);
    }

    static ImageView icon(Context c, int res, int color, int sizeDp) {
        ImageView iv = new ImageView(c);
        iv.setImageResource(res);
        iv.setColorFilter(color);
        iv.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(c, sizeDp), dp(c, sizeDp)));
        return iv;
    }

    static TextView pill(Context c, CharSequence text, int textColor, int bgColor) {
        TextView tv = medium(c, text, 11, textColor);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(dp(c, 9), dp(c, 4), dp(c, 9), dp(c, 4));
        tv.setBackground(round(c, bgColor, 20));
        return tv;
    }

    static TextView chip(Context c, CharSequence text, boolean selected) {
        TextView tv = medium(c, text, 12.5f, selected ? Palette.PRIMARY : Palette.INK_SOFT);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(dp(c, 12), dp(c, 7), dp(c, 12), dp(c, 7));
        if (selected) {
            tv.setBackground(roundStroke(c, Palette.MINT, 20, Palette.withAlpha(Palette.PRIMARY, 90), 1));
        } else {
            tv.setBackground(roundStroke(c, Palette.FIELD, 20, Palette.LINE, 1));
        }
        return tv;
    }

    static LinearLayout card(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(c, 16), dp(c, 16), dp(c, 16), dp(c, 16));
        l.setBackground(roundStroke(c, Palette.CARD, 20, Palette.LINE, 1));
        l.setElevation(dp(c, 1));
        return l;
    }

    static ScrollView scroll(Context c, View child) {
        ScrollView sv = new ScrollView(c);
        sv.setFillViewport(true);
        sv.setClipToPadding(false);
        sv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        sv.addView(child, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return sv;
    }

    static TextView primaryButton(Context c, CharSequence text, int bgColor, int textColor, float heightDp) {
        int fg = textColor;
        if (Palette.isDark()) {
            if (bgColor == Palette.WHITE && textColor == Palette.PRIMARY) {
                fg = Palette.ON_WHITE;
            } else if (textColor == Palette.WHITE
                    && (bgColor == Palette.PRIMARY || bgColor == Palette.VIOLET || bgColor == Palette.AMBER)) {
                fg = Palette.ON_BRIGHT;
            }
        }
        TextView tv = bold(c, text, 15, fg);
        tv.setGravity(Gravity.CENTER);
        tv.setMinHeight(dp(c, (int) heightDp));
        tv.setPadding(dp(c, 16), dp(c, 12), dp(c, 16), dp(c, 12));
        tv.setBackground(ripple(round(c, bgColor, 16), 0x22000000));
        tv.setClickable(true);
        tv.setFocusable(true);
        return tv;
    }

    static TextView outlineButton(Context c, CharSequence text, int textColor, int strokeColor, float heightDp) {
        TextView tv = medium(c, text, 14, textColor);
        tv.setGravity(Gravity.CENTER);
        tv.setMinHeight(dp(c, (int) heightDp));
        tv.setPadding(dp(c, 14), dp(c, 10), dp(c, 14), dp(c, 10));
        tv.setBackground(ripple(roundStroke(c, 0x00000000, 16, strokeColor, 1.2f), 0x14FFFFFF));
        tv.setClickable(true);
        tv.setFocusable(true);
        return tv;
    }

    static void setSelectable(View v) {
        v.setClickable(true);
        v.setFocusable(true);
    }
}
