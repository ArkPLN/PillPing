package com.dsh.medtimer;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import android.view.ViewGroup;

import java.util.ArrayList;
import java.util.List;

/** A small wrapping row layout used for chips. */
public class FlowLayout extends ViewGroup {
    private int horizontalGap;
    private int verticalGap;

    public FlowLayout(Context context) {
        super(context);
        init(context);
    }

    public FlowLayout(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    public FlowLayout(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    private void init(Context context) {
        horizontalGap = Ui.dp(context, 8);
        verticalGap = Ui.dp(context, 8);
    }

    public void setGaps(int horizontalDp, int verticalDp) {
        horizontalGap = Ui.dp(getContext(), horizontalDp);
        verticalGap = Ui.dp(getContext(), verticalDp);
        requestLayout();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int widthLimit = MeasureSpec.getSize(widthMeasureSpec);
        if (MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.UNSPECIFIED) {
            widthLimit = getResources().getDisplayMetrics().widthPixels;
        }
        int available = Math.max(0, widthLimit - getPaddingLeft() - getPaddingRight());

        int rowWidth = 0;
        int rowHeight = 0;
        int totalHeight = 0;
        int maxRowWidth = 0;
        List<View> row = new ArrayList<>();

        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            if (child.getVisibility() == GONE) continue;
            measureChild(child, widthMeasureSpec, heightMeasureSpec);
            int cw = child.getMeasuredWidth();
            int ch = child.getMeasuredHeight();
            int needed = row.isEmpty() ? cw : rowWidth + horizontalGap + cw;
            if (!row.isEmpty() && needed > available) {
                totalHeight += rowHeight + verticalGap;
                maxRowWidth = Math.max(maxRowWidth, rowWidth);
                row.clear();
                rowWidth = cw;
                rowHeight = ch;
            } else {
                rowWidth = needed;
                rowHeight = Math.max(rowHeight, ch);
            }
            row.add(child);
        }
        if (!row.isEmpty()) {
            totalHeight += rowHeight;
            maxRowWidth = Math.max(maxRowWidth, rowWidth);
        }
        totalHeight += getPaddingTop() + getPaddingBottom();
        maxRowWidth += getPaddingLeft() + getPaddingRight();

        int desiredWidth = Math.min(maxRowWidth, widthLimit);
        setMeasuredDimension(resolveSize(desiredWidth, widthMeasureSpec), resolveSize(totalHeight, heightMeasureSpec));
    }

    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
        int available = Math.max(0, r - l - getPaddingLeft() - getPaddingRight());
        int x = getPaddingLeft();
        int y = getPaddingTop();
        int rowHeight = 0;

        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            if (child.getVisibility() == GONE) continue;
            int cw = child.getMeasuredWidth();
            int ch = child.getMeasuredHeight();
            if (x > getPaddingLeft() && x + cw > getPaddingLeft() + available) {
                x = getPaddingLeft();
                y += rowHeight + verticalGap;
                rowHeight = 0;
            }
            child.layout(x, y, x + cw, y + ch);
            x += cw + horizontalGap;
            rowHeight = Math.max(rowHeight, ch);
        }
    }

    @Override
    protected LayoutParams generateDefaultLayoutParams() {
        return new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
    }

    @Override
    public LayoutParams generateLayoutParams(AttributeSet attrs) {
        return new LayoutParams(getContext(), attrs);
    }

    @Override
    protected LayoutParams generateLayoutParams(LayoutParams p) {
        return new LayoutParams(p);
    }

    @Override
    protected boolean checkLayoutParams(LayoutParams p) {
        return p instanceof LayoutParams;
    }
}
