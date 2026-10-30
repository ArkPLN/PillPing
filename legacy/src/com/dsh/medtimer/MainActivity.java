package com.dsh.medtimer;

import android.app.Activity;
import android.app.Dialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

public class MainActivity extends Activity {
    private static final int TAB_HOME = 0;
    private static final int TAB_MEDS = 1;
    private static final int TAB_SPECIAL = 2;

    private Store store;
    private FrameLayout host;
    private LinearLayout navHome;
    private LinearLayout navMeds;
    private LinearLayout navSpecial;
    private ImageView navHomeIcon;
    private ImageView navMedsIcon;
    private ImageView navSpecialIcon;
    private TextView navHomeText;
    private TextView navMedsText;
    private TextView navSpecialText;
    private int tab = TAB_HOME;
    private long firstAtChoice = 0L;
    private int useStreak = 1;
    private int lastGreetingHour = -1;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable ticker;
    private TextView countdownView;
    private int lastNext = -2;
    private boolean lastOverdue = false;

    private BroadcastReceiver stateReceiver;
    private boolean receiverRegistered = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Theme.apply(this);
        Theme.applyWindow(this);
        if (!Security.enforce(this)) return;

        store = Store.load(this);
        useStreak = store.touchDailyUse();
        NotificationHelper.ensureChannel(this);
        if (savedInstanceState != null) {
            tab = savedInstanceState.getInt("tab", TAB_HOME);
        }
        buildShell();
        refreshCurrent(true);
        ReminderScheduler.scheduleAll(this, false);
        SpecialScheduler.scheduleAll(this, false);
        FollowupScheduler.scheduleAll(this, false);

        if (!store.isOnboarded()) {
            handler.postDelayed(this::showOnboarding, 300);
        }
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
        refreshCurrent(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        store = Store.load(this);
        useStreak = store.touchDailyUse();
        refreshCurrent(false);
        startTicker();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopTicker();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (!receiverRegistered) {
            stateReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    store = Store.load(MainActivity.this);
                    refreshCurrent(false);
                }
            };
            IntentFilter filter = new IntentFilter(ActionReceiver.ACTION_STATE_CHANGED);
            if (Build.VERSION.SDK_INT >= 33) {
                registerReceiver(stateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(stateReceiver, filter);
            }
            receiverRegistered = true;
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (receiverRegistered && stateReceiver != null) {
            try {
                unregisterReceiver(stateReceiver);
            } catch (Exception ignored) {
            }
            receiverRegistered = false;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt("tab", tab);
    }

    @Override
    public void onBackPressed() {
        if (tab != TAB_HOME) {
            showTab(TAB_HOME);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == Perms.REQ_NOTIFICATIONS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
            Toast.makeText(this, granted ? "通知权限已开启" : "未开启通知权限，到点将无法提醒", Toast.LENGTH_SHORT).show();
            refreshCurrent(false);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String specialId = intent.getStringExtra("open_special");
        if (specialId != null) {
            intent.removeExtra("open_special");
            handler.postDelayed(() -> showTab(TAB_SPECIAL), 260);
        }
        String medId = intent.getStringExtra("open_med");
        if (medId != null) {
            intent.removeExtra("open_med");
            handler.postDelayed(() -> {
                Store s = Store.load(this);
                Med m = s.findMed(medId);
                if (m != null) {
                    new MedSheet(this, s, m, this::refreshAll);
                } else {
                    showTab(TAB_MEDS);
                }
            }, 260);
        }
        int dose = intent.getIntExtra("open_dose", -1);
        if (dose >= 0 && dose <= 2) {
            intent.removeExtra("open_dose");
            final int index = dose;
            handler.postDelayed(() -> {
                if (store.cycle == null || isFinishing()) return;
                new DoseSheet(MainActivity.this, store, index,
                        () -> refreshAll(), () -> showTab(TAB_MEDS));
            }, 280);
        }
    }

    private void buildShell() {
        LinearLayout root = Ui.v(this);
        root.setBackgroundColor(Palette.BG);
        host = new FrameLayout(this);
        root.addView(host, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout navWrap = Ui.v(this);
        navWrap.setBackgroundColor(Palette.CARD);
        navWrap.setElevation(Ui.dp(this, 12));
        navWrap.setPadding(0, 0, 0, Ui.dp(this, 16));
        navWrap.addView(Ui.line(this, Palette.LINE), new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
        LinearLayout nav = Ui.h(this);
        nav.setPadding(0, Ui.dp(this, 7), 0, Ui.dp(this, 7));
        navHome = tabItem(R.drawable.ic_today, "今日");
        navMeds = tabItem(R.drawable.ic_pill, "药物");
        navSpecial = tabItem(R.drawable.ic_clock, "特殊");
        navHomeIcon = (ImageView) navHome.getTag();
        navMedsIcon = (ImageView) navMeds.getTag();
        navSpecialIcon = (ImageView) navSpecial.getTag();
        navHomeText = (TextView) navHome.getTag(R.id.nav_label);
        navMedsText = (TextView) navMeds.getTag(R.id.nav_label);
        navSpecialText = (TextView) navSpecial.getTag(R.id.nav_label);
        nav.addView(navHome, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        nav.addView(navMeds, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        nav.addView(navSpecial, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        navWrap.addView(nav, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(navWrap, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(root);

        final LinearLayout navBar = navWrap;
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = insets.getSystemWindowInsetTop();
            int bottom = insets.getSystemWindowInsetBottom();
            if (top > 0) host.setPadding(0, top, 0, 0);
            if (bottom > 0) navBar.setPadding(0, 0, 0, bottom + Ui.dp(this, 4));
            return insets;
        });
        root.requestApplyInsets();
        updateNav();
    }

    private LinearLayout tabItem(int iconRes, String label) {
        LinearLayout item = Ui.v(this);
        item.setGravity(Gravity.CENTER);
        item.setPadding(0, Ui.dp(this, 4), 0, Ui.dp(this, 4));
        item.setBackground(Ui.ripple(Ui.round(this, 0x00000000, 16), 0x14000000));
        ImageView icon = Ui.icon(this, iconRes, Palette.MUTED, 22);
        item.addView(icon, new LinearLayout.LayoutParams(Ui.dp(this, 22), Ui.dp(this, 22)));
        TextView text = Ui.medium(this, label, 10.5f, Palette.MUTED);
        text.setGravity(Gravity.CENTER);
        text.setPadding(0, Ui.dp(this, 3), 0, 0);
        item.addView(text);
        item.setTag(icon);
        item.setTag(R.id.nav_label, text);
        item.setOnClickListener(v -> showTab(item == navHome ? TAB_HOME : (item == navMeds ? TAB_MEDS : TAB_SPECIAL)));
        return item;
    }

    private void updateNav() {
        if (navHomeIcon == null) return;
        int active = Palette.PRIMARY;
        int idle = Palette.MUTED;
        navHomeIcon.setColorFilter(tab == TAB_HOME ? active : idle);
        navMedsIcon.setColorFilter(tab == TAB_MEDS ? active : idle);
        navSpecialIcon.setColorFilter(tab == TAB_SPECIAL ? active : idle);
        navHomeText.setTextColor(tab == TAB_HOME ? active : idle);
        navMedsText.setTextColor(tab == TAB_MEDS ? active : idle);
        navSpecialText.setTextColor(tab == TAB_SPECIAL ? active : idle);
        navHomeText.setTypeface(Typeface.create(tab == TAB_HOME ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
        navMedsText.setTypeface(Typeface.create(tab == TAB_MEDS ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
        navSpecialText.setTypeface(Typeface.create(tab == TAB_SPECIAL ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
    }

    private void showTab(int which) {
        tab = which;
        updateNav();
        refreshCurrent(true);
    }

    private void refreshAll() {
        store = Store.load(this);
        refreshCurrent(false);
        startTicker();
    }

    private void refreshCurrent(boolean resetScroll) {
        int scrollY = 0;
        if (!resetScroll && host.getChildCount() > 0 && host.getChildAt(0) instanceof ScrollView) {
            scrollY = ((ScrollView) host.getChildAt(0)).getScrollY();
        }
        updateNav();
        ScrollView sv;
        if (tab == TAB_HOME) sv = buildHome();
        else if (tab == TAB_MEDS) sv = buildMeds();
        else sv = buildSpecial();
        host.removeAllViews();
        int contentWidth = Math.min(getResources().getDisplayMetrics().widthPixels, Ui.dp(this, 640));
        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(contentWidth,
                ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER_HORIZONTAL);
        host.addView(sv, contentParams);
        if (resetScroll) {
            sv.setAlpha(0f);
            sv.setTranslationY(Ui.dp(this, 10));
            sv.animate().alpha(1f).translationY(0f).setDuration(190).start();
        }
        if (scrollY > 0) {
            final int y = scrollY;
            sv.post(() -> sv.scrollTo(0, y));
        }
    }

    private ScrollView buildHome() {
        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 20), Ui.dp(this, 6), Ui.dp(this, 20), Ui.dp(this, 28));

        col.addView(buildHeader());

        col.addView(buildHero(), topParams(14));

        boolean start = shouldStartNewDay();
        if (!start && store.cycle != null && store.cycle.allResolved()) {
            lastNext = -1;
            lastOverdue = false;
            countdownView = null;
        }
        // buildHero already sets ticker targets

        int planCount = start ? store.doseCount
                : (store.cycle != null && store.cycle.isStarted() ? store.cycle.size() : store.doseCount);
        col.addView(sectionHeader("今天的服药计划",
                planCount + " 次 · " + store.interval + " 小时"),
                topParams(24));
        if (start) {
            col.addView(buildPlanPlaceholder(), topParams(0));
        } else {
            for (int i = 0; i < planCount; i++) {
                col.addView(buildDoseCard(i), topParams(i == 0 ? 0 : 10));
            }
        }

        col.addView(buildMedsShortcut(), topParams(16));

        if (!store.history.isEmpty()) {
            col.addView(sectionHeader("最近记录", null), topParams(26));
            col.addView(buildHistory(), topParams(0));
        }

        TextView footer = Ui.text(this,
                "本应用仅用于服药时间提醒，不提供医疗建议。\n具体用药请遵医嘱。",
                11, Palette.MUTED_LIGHT);
        footer.setGravity(Gravity.CENTER);
        footer.setLineSpacing(0, 1.35f);
        col.addView(footer, topParams(26));

        return Ui.scroll(this, col);
    }

    private View buildHeader() {
        LinearLayout row = Ui.h(this);
        row.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
        LinearLayout titleCol = Ui.v(this);
        int hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        lastGreetingHour = hour;
        String headerTitle = useStreak >= 3 ? greeting(hour) : "服药提醒";
        TextView title = Ui.bold(this, headerTitle, 25, Palette.INK);
        if (useStreak >= 3) {
            LinearLayout titleRow = Ui.h(this);
            titleRow.addView(Ui.icon(this, R.drawable.ic_ms_wave, Palette.PRIMARY, 20));
            LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            tp.leftMargin = Ui.dp(this, 6);
            titleRow.addView(title, tp);
            titleCol.addView(titleRow);
        } else {
            titleCol.addView(title);
        }
        String date = Fmt.monthDay(System.currentTimeMillis()) + "  " + Fmt.weekday(System.currentTimeMillis());
        String subText = date + " · 今天";
        if (useStreak >= 7) subText = date + " · 已坚持 " + useStreak + " 天";
        else if (useStreak >= 3) subText = date + " · 第 " + useStreak + " 天";
        TextView sub = Ui.text(this, subText, 12.5f, Palette.MUTED);
        sub.setPadding(0, Ui.dp(this, 4), 0, 0);
        titleCol.addView(sub);
        if (!store.isRemindersEnabled()) {
            TextView paused = Ui.pill(this, "提醒已暂停", Palette.MUTED, Palette.FIELD);
            paused.setPadding(Ui.dp(this, 9), Ui.dp(this, 4), Ui.dp(this, 9), Ui.dp(this, 4));
            LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            pp.topMargin = Ui.dp(this, 7);
            titleCol.addView(paused, pp);
        }
        row.addView(titleCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        FrameLayout settings = new FrameLayout(this);
        settings.setBackground(Ui.ripple(Ui.round(this, Palette.MINT, 21), 0x22000000));
        ImageView gear = Ui.icon(this, R.drawable.ic_settings, Palette.PRIMARY, 20);
        FrameLayout.LayoutParams gp = new FrameLayout.LayoutParams(Ui.dp(this, 20), Ui.dp(this, 20), Gravity.CENTER);
        settings.addView(gear, gp);
        settings.setClickable(true);
        settings.setFocusable(true);
        settings.setContentDescription("设置");
        settings.setOnClickListener(v -> new SettingsSheet(this, store, this::refreshAll));
        row.addView(settings, new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));
        return row;
    }

    private View buildPermissionBanner() {
        LinearLayout card = Ui.h(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        card.setBackground(Ui.roundStroke(this, Palette.AMBER_BG, 16, Palette.AMBER_LINE, 1));
        card.addView(Ui.icon(this, R.drawable.ic_bell, Palette.AMBER, 20));
        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 10), 0, Ui.dp(this, 8), 0);
        col.addView(Ui.medium(this, Perms.dndActive(this) ? "勿扰模式可能静音提醒" : "提醒权限未完全开启", 13, Palette.AMBER));
        TextView detail = Ui.text(this, Perms.problemSummary(this), 11.5f, Palette.AMBER);
        detail.setLineSpacing(0, 1.15f);
        detail.setPadding(0, Ui.dp(this, 3), 0, 0);
        col.addView(detail);
        card.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView go = Ui.medium(this, "去开启", 12, Palette.WHITE);
        go.setGravity(Gravity.CENTER);
        go.setPadding(Ui.dp(this, 11), Ui.dp(this, 6), Ui.dp(this, 11), Ui.dp(this, 6));
        go.setBackground(Ui.ripple(Ui.round(this, Palette.AMBER, 14), 0x33FFFFFF));
        go.setOnClickListener(v -> Perms.openFirstProblem(this));
        card.addView(go);
        return card;
    }

    private View buildHero() {
        FrameLayout hero = new FrameLayout(this);
        GradientDrawable bg = Ui.gradient(this, 0xFF0F766E, 0xFF0D9488, 28);
        hero.setBackground(bg);
        hero.setClipToOutline(true);

        addDecor(hero, 190, -55, -70, Gravity.TOP | Gravity.RIGHT, 0x16FFFFFF);
        addDecor(hero, 130, 40, -50, Gravity.BOTTOM | Gravity.LEFT, 0x0CFFFFFF);

        LinearLayout content = Ui.v(this);
        content.setPadding(Ui.dp(this, 22), Ui.dp(this, 22), Ui.dp(this, 22), Ui.dp(this, 22));
        hero.addView(content, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        boolean start = shouldStartNewDay();
        if (start) {
            buildStartHero(content);
        } else if (store.cycle != null && store.cycle.allResolved()) {
            buildDoneHero(content);
        } else {
            buildActiveHero(content);
        }
        return hero;
    }

    private void addDecor(FrameLayout parent, int sizeDp, int leftDp, int topDp, int gravity, int color) {
        View v = new View(this);
        v.setBackground(Ui.circle(this, color));
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(Ui.dp(this, sizeDp), Ui.dp(this, sizeDp), gravity);
        p.leftMargin = Ui.dp(this, leftDp);
        p.topMargin = Ui.dp(this, topDp);
        parent.addView(v, p);
    }

    private void buildStartHero(LinearLayout content) {
        ensureFirstAtChoice();
        Cycle old = store.cycle;
        TextView label = Ui.medium(this, "今天 · 第 1 次", 12, 0xCCFFFFFF);
        label.setLetterSpacing(0.03f);
        content.addView(label);

        TextView title = Ui.bold(this, "起床吃药后，\n点一下开始计时", 25, Palette.WHITE);
        title.setLineSpacing(0, 1.12f);
        content.addView(title, topParams(8));

        TextView sub = Ui.text(this, "之后每 " + store.interval + " 小时提醒一次，共 " + store.doseCount + " 次", 13, 0xD9FFFFFF);
        sub.setPadding(0, Ui.dp(this, 8), 0, 0);
        content.addView(sub);

        if (old != null && old.isStarted()) {
            String oldText;
            if (old.allResolved()) {
                oldText = "上次已完成 " + old.takenCount() + "/" + old.size();
            } else {
                oldText = "上次还有 " + (old.size() - old.takenCount() - old.skippedCount()) + " 次未记录";
            }
            TextView oldInfo = Ui.text(this, oldText + " · 开始后会归档", 11.5f, 0x99FFFFFF);
            oldInfo.setPadding(0, Ui.dp(this, 5), 0, 0);
            content.addView(oldInfo);
        }

        LinearLayout timeRow = Ui.h(this);
        timeRow.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 12), Ui.dp(this, 10));
        timeRow.setBackground(Ui.ripple(Ui.round(this, 0x1FFFFFFF, 16), 0x22FFFFFF));
        LinearLayout timeCol = Ui.v(this);
        timeCol.addView(Ui.text(this, "第一次服药时间", 10.5f, 0xB3FFFFFF));
        TextView time = Ui.bold(this, "今天 " + Fmt.time(firstAtChoice), 15, Palette.WHITE);
        time.setPadding(0, Ui.dp(this, 2), 0, 0);
        timeCol.addView(time);
        timeRow.addView(timeCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView edit = Ui.medium(this, "修改", 12, Palette.WHITE);
        edit.setGravity(Gravity.CENTER);
        edit.setPadding(Ui.dp(this, 12), Ui.dp(this, 6), Ui.dp(this, 12), Ui.dp(this, 6));
        edit.setBackground(Ui.round(this, 0x2BFFFFFF, 14));
        timeRow.addView(edit);
        timeRow.setOnClickListener(v -> pickFirstTime());
        content.addView(timeRow, topParams(18));

        TextView startButton = Ui.primaryButton(this, "记录第一次服药", Palette.WHITE, Palette.PRIMARY, 54);
        startButton.setTextSize(16);
        startButton.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        startButton.setOnClickListener(v -> startCycle());
        content.addView(startButton, topParams(14));

        if (store.meds.isEmpty()) {
            TextView warn = Ui.text(this, "还没有添加药物，提醒里不会显示药品 ›", 11.5f, 0xD9FFFFFF);
            warn.setPadding(0, Ui.dp(this, 12), 0, 0);
            warn.setOnClickListener(v -> showTab(TAB_MEDS));
            content.addView(warn);
        }
    }

    private void buildActiveHero(LinearLayout content) {
        Cycle c = store.cycle;
        int next = c.nextPending();
        if (next < 0) {
            buildDoneHero(content);
            return;
        }
        long due = c.effectiveTime(next);
        long now = System.currentTimeMillis();
        boolean overdue = due <= now;
        lastNext = next;
        lastOverdue = overdue;

        LinearLayout labelRow = Ui.h(this);
        TextView label = Ui.medium(this, overdue ? "该吃药了 · 请尽快服用" : "下一次服药", 12, 0xCCFFFFFF);
        label.setLetterSpacing(0.03f);
        labelRow.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView count = Ui.pill(this, "第" + (next + 1) + "次", Palette.WHITE, 0x26FFFFFF);
        labelRow.addView(count);
        content.addView(labelRow);

        LinearLayout timeRow = Ui.h(this);
        timeRow.setPadding(0, Ui.dp(this, 2), 0, 0);
        TextView bigTime = Ui.bold(this, Fmt.time(due), 44, Palette.WHITE);
        timeRow.addView(bigTime);
        String heroDay = Fmt.dayLabel(due);
        if (!"今天".equals(heroDay)) {
            TextView dayTag = Ui.medium(this, "  " + heroDay, 13, 0xCCFFFFFF);
            timeRow.addView(dayTag);
        }
        if (c.snoozeUntil[next] > 0) {
            TextView snoozed = Ui.text(this, "  已推迟", 12, 0xCCFFFFFF);
            timeRow.addView(snoozed);
        }
        content.addView(timeRow);

        countdownView = Ui.text(this, countdownText(due - now, overdue), 14, overdue ? 0xFFFDE68A : 0xD9FFFFFF);
        countdownView.setPadding(0, Ui.dp(this, 2), 0, 0);
        content.addView(countdownView);

        content.addView(progressRow(), topParams(16));

        List<Med> meds = store.medsForSlot(next);
        if (meds.isEmpty()) {
            TextView warn = Ui.text(this, "本次还没有配置药物，点「药物」页添加", 11.5f, 0xD9FFFFFF);
            warn.setPadding(0, Ui.dp(this, 12), 0, 0);
            warn.setOnClickListener(v -> showTab(TAB_MEDS));
            content.addView(warn);
        } else {
            TextView medsLine = Ui.text(this, compactMeds(meds), 12, 0xCCFFFFFF);
            medsLine.setPadding(0, Ui.dp(this, 12), 0, 0);
            content.addView(medsLine);
        }

        LinearLayout actions = Ui.h(this);
        actions.setPadding(0, Ui.dp(this, 16), 0, 0);
        TextView take = Ui.primaryButton(this, "我已服用", Palette.WHITE, Palette.PRIMARY, 50);
        take.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        take.setOnClickListener(v -> markNextTaken());
        actions.addView(take, new LinearLayout.LayoutParams(0, Ui.dp(this, 50), 1));
        TextView snooze = Ui.outlineButton(this, "推迟 10 分钟", Palette.WHITE, 0x66FFFFFF, 50);
        snooze.setOnClickListener(v -> snoozeNext());
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(0, Ui.dp(this, 50), 1);
        sp.leftMargin = Ui.dp(this, 10);
        actions.addView(snooze, sp);
        content.addView(actions);

        TextView backfill = Ui.medium(this, "忘记登记？补登第" + (next + 1) + "次实际时间 ›", 11.5f, 0xD9FFFFFF);
        backfill.setGravity(Gravity.CENTER);
        backfill.setPadding(0, Ui.dp(this, 10), 0, 0);
        backfill.setOnClickListener(v -> showBackfill(next));
        content.addView(backfill);
    }

    private void showBackfill(int index) {
        if (store.cycle == null || index < 0 || index >= store.cycle.size()) return;
        Cycle c = store.cycle;
        long now = System.currentTimeMillis();
        long planned = c.planned[index];
        long initial = Math.min(now, planned > 0 ? planned : now);
        new TimeSheet(this, "补登第" + (index + 1) + "次服药",
                "如果已经服过药但忘记登记，在这里选择实际服用的时间。",
                "只能选择过去的时间；补登后下一次会从实际时间 + 间隔重排。",
                false, initial, at -> {
                    long previous = 0L;
                    for (int j = index - 1; j >= 0; j--) {
                        if (c.status[j] == Cycle.TAKEN) {
                            previous = c.actedAt[j];
                            break;
                        }
                    }
                    if (previous > 0L && at < previous) {
                        Toast.makeText(this, "补登时间不能早于上一次服药时间", Toast.LENGTH_SHORT).show();
                        return false;
                    }
                    store.markTakenAt(index, at);
                    NotificationHelper.cancel(this, index);
                    ReminderScheduler.scheduleAll(this, false);
                    store = Store.load(this);
                    refreshCurrent(false);
                    Toast.makeText(this, "已补登第" + (index + 1) + "次 " + Fmt.time(at), Toast.LENGTH_SHORT).show();
                    return true;
                });
    }

    private void buildDoneHero(LinearLayout content) {
        Cycle c = store.cycle;
        lastNext = -1;
        lastOverdue = false;
        countdownView = null;
        TextView label = Ui.medium(this, "今日完成", 12, 0xCCFFFFFF);
        label.setLetterSpacing(0.03f);
        content.addView(label);
        TextView big = Ui.bold(this, c.takenCount() + " / " + c.size(), 42, Palette.WHITE);
        big.setPadding(0, Ui.dp(this, 4), 0, 0);
        content.addView(big);
        String sub = c.skippedCount() > 0
                ? "有 " + c.skippedCount() + " 次标记为跳过，其余已记录"
                : c.size() + " 次服药都已记录，辛苦啦";
        TextView subView = Ui.text(this, sub, 13, 0xD9FFFFFF);
        subView.setPadding(0, Ui.dp(this, 4), 0, 0);
        content.addView(subView);
        content.addView(progressRow(), topParams(16));
        TextView note = Ui.text(this, "明天起床吃完第一次药后，再来记录。", 11.5f, 0x99FFFFFF);
        note.setPadding(0, Ui.dp(this, 16), 0, 0);
        content.addView(note);
    }

    private View progressRow() {
        LinearLayout wrap = Ui.v(this);
        Cycle c = store.cycle;
        int n = c == null ? store.doseCount : c.size();
        int next = c == null ? -1 : c.nextPending();

        LinearLayout segments = Ui.h(this);
        for (int i = 0; i < n; i++) {
            int status = c == null ? Cycle.PENDING : c.status[i];
            int color;
            if (status == Cycle.TAKEN) color = Palette.WHITE;
            else if (status == Cycle.SKIPPED) color = 0x55FFFFFF;
            else if (i == next) color = 0xFFFDE68A;
            else color = 0x33FFFFFF;
            View seg = new View(this);
            seg.setBackground(Ui.round(this, color, 4));
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, Ui.dp(this, 6), 1);
            if (i > 0) p.leftMargin = Ui.dp(this, 4);
            segments.addView(seg, p);
        }
        wrap.addView(segments);

        LinearLayout caption = Ui.h(this);
        caption.setPadding(0, Ui.dp(this, 7), 0, 0);
        int taken = c == null ? 0 : c.takenCount();
        TextView left = Ui.text(this, "已服 " + taken + " / " + n + " 次", 10.5f, 0xCCFFFFFF);
        caption.addView(left, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        String rightText;
        if (next < 0) rightText = "全部完成";
        else rightText = "第" + (next + 1) + "次 · 下次";
        TextView right = Ui.medium(this, rightText, 10.5f, next < 0 ? 0xCCFFFFFF : 0xFFFDE68A);
        caption.addView(right);
        wrap.addView(caption);
        return wrap;
    }

    private String countdownText(long remaining, boolean overdue) {
        if (overdue) {
            if (remaining > -60_000L) return "已到服药时间，请尽快服用";
            return "已超时 " + Fmt.durationShort(-remaining) + "，请尽快服用";
        }
        return "还有 " + Fmt.duration(remaining);
    }

    private String compactMeds(List<Med> meds) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < meds.size(); i++) {
            if (i > 0) sb.append("  ·  ");
            sb.append(meds.get(i).name).append(" ").append(meds.get(i).dose);
        }
        return sb.toString();
    }

    private View buildPlanPlaceholder() {
        LinearLayout card = Ui.card(this);
        card.setPadding(Ui.dp(this, 16), Ui.dp(this, 8), Ui.dp(this, 16), Ui.dp(this, 10));
        int n = store.doseCount;
        for (int i = 0; i < n; i++) {
            LinearLayout row = Ui.h(this);
            row.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 8));
            TextView num = Ui.medium(this, String.valueOf(i + 1), 12, Palette.PRIMARY);
            num.setGravity(Gravity.CENTER);
            num.setBackground(Ui.circle(this, Palette.MINT));
            row.addView(num, new LinearLayout.LayoutParams(Ui.dp(this, 26), Ui.dp(this, 26)));
            LinearLayout col = Ui.v(this);
            col.setPadding(Ui.dp(this, 10), 0, 0, 0);
            col.addView(Ui.medium(this, "第" + (i + 1) + "次", 13.5f, Palette.INK));
            String desc;
            if (i == 0) {
                desc = "起床服药后，点上面的按钮记录时间";
            } else {
                desc = "上次实际服药后 " + store.interval + " 小时，自动提醒";
            }
            TextView descView = Ui.text(this, desc, 11.5f, Palette.MUTED);
            descView.setPadding(0, Ui.dp(this, 2), 0, 0);
            col.addView(descView);
            row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            card.addView(row);
            if (i < n - 1) card.addView(Ui.line(this, Palette.LINE));
        }
        TextView note = Ui.text(this, n <= 1
                ? "每天 1 次，记录第一次后即完成。可在设置里修改次数和间隔。"
                : "每次实际服药后，下一次会从实际时间重新计算。可在设置里修改次数和间隔。",
                11.5f, Palette.MUTED_LIGHT);
        note.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
        note.setLineSpacing(0, 1.2f);
        card.addView(note);
        return card;
    }

    private View buildDoseCard(int index) {
        Cycle c = store.cycle;
        if (c == null) return new View(this);
        boolean isNext = c.nextPending() == index;
        boolean overdue = isNext && c.effectiveTime(index) <= System.currentTimeMillis();
        int status = c.status[index];

        int bgColor = Palette.CARD;
        int strokeColor = Palette.LINE;
        if (isNext) {
            bgColor = overdue ? Palette.OVERDUE_BG : Palette.NEXT_BG;
            strokeColor = overdue ? Palette.AMBER_LINE : Palette.PRIMARY;
        }
        LinearLayout card = Ui.v(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 13), Ui.dp(this, 12), Ui.dp(this, 13));
        card.setBackground(Ui.ripple(Ui.roundStroke(this, bgColor, 18, strokeColor, isNext ? 1.4f : 1), 0x0F000000));
        card.setElevation(Ui.dp(this, 1));
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> new DoseSheet(this, store, index,
                () -> refreshAll(), () -> showTab(TAB_MEDS)));

        LinearLayout row = Ui.h(this);
        LinearLayout left = Ui.v(this);
        String cardDay = Fmt.dayLabel(c.effectiveTime(index));
        if (!"今天".equals(cardDay)) {
            TextView dayTag = Ui.text(this, cardDay, 9.5f, Palette.MUTED_LIGHT);
            left.addView(dayTag);
        }
        TextView time = Ui.bold(this, Fmt.time(c.effectiveTime(index)), 15, isNext ? (overdue ? Palette.AMBER : Palette.PRIMARY) : Palette.INK);
        left.addView(time);
        TextView ordinal = Ui.text(this, "第" + (index + 1) + "次", 10.5f, Palette.MUTED);
        ordinal.setPadding(0, Ui.dp(this, 3), 0, 0);
        left.addView(ordinal);
        row.addView(left, new LinearLayout.LayoutParams(Ui.dp(this, 52), ViewGroup.LayoutParams.WRAP_CONTENT));

        View divider = new View(this);
        divider.setBackgroundColor(Palette.LINE);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(1, ViewGroup.LayoutParams.MATCH_PARENT);
        dividerParams.rightMargin = Ui.dp(this, 12);
        row.addView(divider, dividerParams);

        LinearLayout middle = Ui.v(this);
        List<Med> meds = store.medsForSlot(index);
        if (meds.isEmpty()) {
            middle.addView(Ui.text(this, "未配置药物", 13, Palette.MUTED));
        } else {
            for (int i = 0; i < meds.size(); i++) {
                Med m = meds.get(i);
                SpannableStringBuilder sb = new SpannableStringBuilder();
                sb.append(m.name);
                int nameEnd = sb.length();
                sb.setSpan(new StyleSpan(Typeface.BOLD), 0, nameEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                sb.append("  ").append(m.dose);
                int methodStart = sb.length();
                sb.append("  ·  ").append(m.method);
                sb.setSpan(new ForegroundColorSpan(Palette.MUTED), methodStart, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                TextView line = Ui.text(this, sb, 13, Palette.INK);
                if (i > 0) line.setPadding(0, Ui.dp(this, 4), 0, 0);
                middle.addView(line);
            }
        }

        long due = c.effectiveTime(index);
        String detail;
        int detailColor = Palette.MUTED_LIGHT;
        if (status == Cycle.TAKEN) {
            detail = "已服用 " + Fmt.time(c.actedAt[index] > 0 ? c.actedAt[index] : due);
            detailColor = Palette.PRIMARY;
        } else if (status == Cycle.SKIPPED) {
            detail = "已跳过这次";
        } else if (c.snoozeUntil[index] > 0) {
            detail = "已推迟到 " + Fmt.time(due);
            detailColor = Palette.AMBER;
        } else if (due <= System.currentTimeMillis()) {
            long late = System.currentTimeMillis() - due;
            detail = late < 60_000L ? "已到服药时间" : "已超时 " + Fmt.durationShort(late);
            detailColor = Palette.DANGER;
        } else {
            detail = "计划 " + Fmt.time(due);
        }
        TextView detailView = Ui.text(this, detail, 11, detailColor);
        detailView.setPadding(0, Ui.dp(this, 5), 0, 0);
        middle.addView(detailView);
        row.addView(middle, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout right = Ui.v(this);
        right.setGravity(Gravity.END);
        right.addView(statusPill(index, status, isNext, overdue));
        ImageView chevron = Ui.icon(this, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 16);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(Ui.dp(this, 16), Ui.dp(this, 16));
        cp.topMargin = Ui.dp(this, 6);
        cp.gravity = Gravity.END;
        right.addView(chevron, cp);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(Ui.dp(this, 64), ViewGroup.LayoutParams.WRAP_CONTENT);
        row.addView(right, rp);
        card.addView(row);
        return card;
    }

    private View statusPill(int index, int status, boolean isNext, boolean overdue) {
        if (status == Cycle.TAKEN) return Ui.pill(this, "已服用", Palette.PRIMARY, Palette.MINT);
        if (status == Cycle.SKIPPED) return Ui.pill(this, "已跳过", Palette.MUTED, Palette.FIELD);
        if (isNext) {
            if (overdue) return Ui.pill(this, "该吃了", Palette.DANGER, Palette.DANGER_BG);
            return Ui.pill(this, "下次", Palette.PRIMARY, Palette.MINT);
        }
        return Ui.pill(this, "待服用", Palette.MUTED, Palette.FIELD);
    }

    private View buildMedsShortcut() {
        LinearLayout card = Ui.h(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        card.setBackground(Ui.ripple(Ui.roundStroke(this, Palette.CARD, 18, Palette.LINE, 1), 0x0F000000));
        FrameLayout avatar = new FrameLayout(this);
        avatar.setBackground(Ui.round(this, Palette.MINT, 13));
        ImageView icon = Ui.icon(this, R.drawable.ic_pill, Palette.PRIMARY, 21);
        avatar.addView(icon, new FrameLayout.LayoutParams(Ui.dp(this, 21), Ui.dp(this, 21), Gravity.CENTER));
        card.addView(avatar, new LinearLayout.LayoutParams(Ui.dp(this, 40), Ui.dp(this, 40)));
        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 11), 0, 0, 0);
        col.addView(Ui.medium(this, "我的药物", 14, Palette.INK));
        String sub = store.meds.isEmpty()
                ? "还没有添加药物"
                : "共 " + store.meds.size() + " 种 · 已启用 " + store.activeMedCount() + " 种";
        TextView subView = Ui.text(this, sub, 11.5f, Palette.MUTED);
        subView.setPadding(0, Ui.dp(this, 2), 0, 0);
        col.addView(subView);
        card.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView manage = Ui.medium(this, store.meds.isEmpty() ? "去添加" : "管理", 12.5f, Palette.PRIMARY);
        manage.setGravity(Gravity.CENTER);
        manage.setPadding(Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8), Ui.dp(this, 8));
        card.addView(manage);
        card.addView(Ui.icon(this, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 16));
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> showTab(TAB_MEDS));
        return card;
    }

    private View buildHistory() {
        LinearLayout card = Ui.v(this);
        card.setBackground(Ui.roundStroke(this, Palette.CARD, 18, Palette.LINE, 1));
        int count = Math.min(3, store.history.size());
        for (int i = 0; i < count; i++) {
            HistoryItem h = store.history.get(i);
            LinearLayout row = Ui.h(this);
            row.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 14), Ui.dp(this, 12));
            LinearLayout col = Ui.v(this);
            String date = h.date != null && h.date.length() > 0 ? Fmt.dateKeyToCn(h.date) : Fmt.monthDay(h.startAt);
            col.addView(Ui.medium(this, date, 13.5f, Palette.INK));
            TextView summary = Ui.text(this, h.summary, 11.5f, Palette.MUTED);
            summary.setPadding(0, Ui.dp(this, 2), 0, 0);
            col.addView(summary);
            row.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            boolean full = h.taken >= h.total;
            TextView score = Ui.medium(this, h.taken + "/" + h.total, 13, full ? Palette.PRIMARY : Palette.AMBER);
            score.setGravity(Gravity.CENTER);
            score.setPadding(Ui.dp(this, 9), Ui.dp(this, 4), Ui.dp(this, 9), Ui.dp(this, 4));
            score.setBackground(Ui.round(this, full ? Palette.MINT : Palette.AMBER_BG, 12));
            row.addView(score);
            card.addView(row);
            if (i < count - 1) card.addView(Ui.line(this, Palette.LINE));
        }
        return card;
    }

    private View sectionHeader(String title, String trailing) {
        LinearLayout row = Ui.h(this);
        row.setPadding(0, Ui.dp(this, 2), 0, Ui.dp(this, 8));
        TextView t = Ui.bold(this, title, 16.5f, Palette.INK);
        row.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        if (trailing != null) {
            TextView tr = Ui.text(this, trailing, 11.5f, Palette.MUTED);
            tr.setGravity(Gravity.CENTER);
            tr.setPadding(Ui.dp(this, 9), Ui.dp(this, 4), Ui.dp(this, 9), Ui.dp(this, 4));
            tr.setBackground(Ui.round(this, Palette.MINT, 12));
            row.addView(tr);
        }
        return row;
    }

    private boolean shouldStartNewDay() {
        Cycle c = store.cycle;
        if (c == null || !c.isStarted()) return true;
        String today = Fmt.todayKey();
        if (c.allResolved()) {
            return !today.equals(c.startDate);
        }
        if (!today.equals(c.startDate)) {
            long last = c.size() > 0 ? c.planned[c.size() - 1] : c.firstAt;
            return System.currentTimeMillis() > last + 6 * 3600_000L;
        }
        return false;
    }

    private void ensureFirstAtChoice() {
        if (firstAtChoice <= 0L || !Fmt.dateKey(firstAtChoice).equals(Fmt.todayKey())) {
            firstAtChoice = System.currentTimeMillis() / 60_000L * 60_000L;
        }
    }

    private void pickFirstTime() {
        ensureFirstAtChoice();
        new TimeSheet(this, firstAtChoice, millis -> {
            firstAtChoice = millis;
            refreshCurrent(false);
            return true;
        });
    }

    private void startCycle() {
        ensureFirstAtChoice();
        long now = System.currentTimeMillis();
        long first = Math.min(firstAtChoice, now);
        store.startCycle(first, store.interval, store.doseCount);
        firstAtChoice = 0L;
        NotificationHelper.cancelAll(this);
        ReminderScheduler.scheduleAll(this, true);
        refreshAll();
        if (store.meds.isEmpty()) {
            Toast.makeText(this, "提醒已设定，建议到「药物」页添加药品", Toast.LENGTH_LONG).show();
        } else if (store.cycle.size() > 1) {
            Toast.makeText(this, "下一次提醒：" + Fmt.time(store.cycle.planned[1]), Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, "已记录今天的服药", Toast.LENGTH_LONG).show();
        }
        if (!Perms.notificationsEnabled(this)) {
            handler.postDelayed(() -> Perms.requestNotifications(this), 600);
        }
    }

    private void markNextTaken() {
        if (store.cycle == null) return;
        int next = store.cycle.nextPending();
        if (next < 0) return;
        long planned = store.cycle.planned[next];
        if (planned - System.currentTimeMillis() > 30 * 60_000L) {
            Dialogs.confirm(this, "还没到服药时间",
                    "计划时间是 " + Fmt.time(planned) + "，确定现在就记录为已服用吗？",
                    "现在记录", () -> doMarkNextTaken(next));
            return;
        }
        doMarkNextTaken(next);
    }

    private void doMarkNextTaken(int next) {
        if (store.cycle == null || next < 0 || next >= store.cycle.size()) return;
        if (store.cycle.status[next] != Cycle.PENDING) return;
        store.markTaken(next);
        NotificationHelper.cancel(this, next);
        ReminderScheduler.scheduleAll(this, false);
        boolean all = store.cycle.allResolved();
        store = Store.load(this);
        refreshCurrent(false);
        Toast.makeText(this, all ? "今天的药都完成了" : "已记录第" + (next + 1) + "次服药", Toast.LENGTH_SHORT).show();
    }

    private void snoozeNext() {
        if (store.cycle == null) return;
        int next = store.cycle.nextPending();
        if (next < 0) return;
        store.snooze(next, 10);
        NotificationHelper.cancel(this, next);
        ReminderScheduler.scheduleDose(this, next, true);
        refreshAll();
        Toast.makeText(this, "将在 10 分钟后提醒", Toast.LENGTH_SHORT).show();
    }

    private ScrollView buildSpecial() {
        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 20), Ui.dp(this, 6), Ui.dp(this, 20), Ui.dp(this, 28));

        LinearLayout header = Ui.h(this);
        header.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
        LinearLayout titleCol = Ui.v(this);
        titleCol.addView(Ui.bold(this, "特殊用药", 25, Palette.INK));
        TextView sub = Ui.text(this, "独立间隔或每天固定时间，不参与今日计划", 12.5f, Palette.MUTED);
        sub.setPadding(0, Ui.dp(this, 4), 0, 0);
        titleCol.addView(sub);
        header.addView(titleCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        FrameLayout add = new FrameLayout(this);
        add.setBackground(Ui.ripple(Ui.round(this, Palette.VIOLET, 21), 0x33FFFFFF));
        ImageView plus = Ui.icon(this, R.drawable.ic_add, Palette.WHITE, 21);
        add.addView(plus, new FrameLayout.LayoutParams(Ui.dp(this, 21), Ui.dp(this, 21), Gravity.CENTER));
        add.setClickable(true);
        add.setFocusable(true);
        add.setContentDescription("添加特殊用药");
        add.setOnClickListener(v -> new SpecialSheet(this, store, null, this::refreshAll));
        header.addView(add, new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));
        col.addView(header);

        LinearLayout info = Ui.h(this);
        info.setPadding(Ui.dp(this, 13), Ui.dp(this, 11), Ui.dp(this, 13), Ui.dp(this, 11));
        info.setBackground(Ui.round(this, Palette.VIOLET_BG, 16));
        info.addView(Ui.icon(this, R.drawable.ic_clock, Palette.VIOLET, 18));
        TextView hint = Ui.text(this, "适合每 8 小时、每 12 小时或每天 21:00 等特殊节奏；与普通药物分开提醒。",
                11.5f, Palette.VIOLET_TEXT);
        hint.setPadding(Ui.dp(this, 9), 0, 0, 0);
        hint.setLineSpacing(0, 1.15f);
        info.addView(hint, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        col.addView(info, topParams(14));

        if (store.specials.isEmpty()) {
            LinearLayout empty = Ui.v(this);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(Ui.dp(this, 20), Ui.dp(this, 30), Ui.dp(this, 20), Ui.dp(this, 30));
            empty.setBackground(Ui.roundStroke(this, Palette.CARD, 20, Palette.LINE, 1));
            FrameLayout iconWrap = new FrameLayout(this);
            iconWrap.setBackground(Ui.circle(this, Palette.VIOLET_BG));
            ImageView icon = Ui.icon(this, R.drawable.ic_clock, Palette.VIOLET, 28);
            iconWrap.addView(icon, new FrameLayout.LayoutParams(Ui.dp(this, 28), Ui.dp(this, 28), Gravity.CENTER));
            LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(Ui.dp(this, 64), Ui.dp(this, 64));
            ip.gravity = Gravity.CENTER_HORIZONTAL;
            empty.addView(iconWrap, ip);
            TextView title = Ui.bold(this, "还没有特殊用药", 17, Palette.INK);
            title.setGravity(Gravity.CENTER);
            title.setPadding(0, Ui.dp(this, 14), 0, 0);
            empty.addView(title);
            TextView desc = Ui.text(this, "如果某种药不按普通方案服用，\n可以在这里单独设置它的提醒节奏。", 12, Palette.MUTED);
            desc.setGravity(Gravity.CENTER);
            desc.setLineSpacing(0, 1.3f);
            desc.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 16));
            empty.addView(desc);
            TextView addFirst = Ui.primaryButton(this, "添加特殊用药", Palette.VIOLET, Palette.WHITE, 48);
            addFirst.setOnClickListener(v -> new SpecialSheet(this, store, null, this::refreshAll));
            LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(Ui.dp(this, 180), Ui.dp(this, 48));
            ap.gravity = Gravity.CENTER_HORIZONTAL;
            empty.addView(addFirst, ap);
            col.addView(empty, topParams(16));
        } else {
            for (int i = 0; i < store.specials.size(); i++) {
                col.addView(buildSpecialCard(store.specials.get(i)), topParams(i == 0 ? 16 : 10));
            }
            TextView addMore = Ui.medium(this, "＋  添加特殊用药", 14, Palette.VIOLET);
            addMore.setGravity(Gravity.CENTER);
            addMore.setPadding(0, Ui.dp(this, 14), 0, Ui.dp(this, 14));
            addMore.setBackground(Ui.ripple(Ui.roundDashed(this, 0x00000000, 18, Palette.VIOLET_LINE, 1.3f), 0x0F000000));
            addMore.setOnClickListener(v -> new SpecialSheet(this, store, null, this::refreshAll));
            col.addView(addMore, topParams(12));
        }

        TextView note = Ui.text(this, "特殊用药独立提醒，不会影响「今日」的服药次数和间隔。", 11.5f, Palette.MUTED_LIGHT);
        note.setGravity(Gravity.CENTER);
        note.setLineSpacing(0, 1.25f);
        col.addView(note, topParams(20));
        return Ui.scroll(this, col);
    }

    private View buildSpecialCard(SpecialMed m) {
        LinearLayout card = Ui.v(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 13), Ui.dp(this, 12), Ui.dp(this, 13));
        card.setBackground(Ui.ripple(Ui.roundStroke(this, Palette.CARD, 18, Palette.LINE, 1), 0x0F000000));
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> new SpecialSheet(this, store, m, this::refreshAll));

        LinearLayout top = Ui.h(this);
        FrameLayout avatar = new FrameLayout(this);
        avatar.setBackground(Ui.circle(this, Palette.VIOLET));
        avatar.addView(Ui.icon(this, Forms.iconRes(m.form), Palette.isDark() ? Palette.ON_BRIGHT : Palette.WHITE, 24),
                new FrameLayout.LayoutParams(Ui.dp(this, 24), Ui.dp(this, 24), Gravity.CENTER));
        top.addView(avatar, new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));

        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 11), 0, Ui.dp(this, 6), 0);
        col.addView(Ui.medium(this, m.name, 15.5f, Palette.INK));
        TextView detail = Ui.text(this, m.form + "  ·  " + m.dose + "  ·  " + m.method, 12, Palette.MUTED);
        detail.setPadding(0, Ui.dp(this, 3), 0, 0);
        col.addView(detail);
        top.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        Switch sw = new Switch(this);
        sw.setChecked(m.enabled);
        sw.setShowText(false);
        sw.setContentDescription(m.name + (m.enabled ? " 已启用" : " 已停用"));
        sw.setPadding(0, 0, 0, 0);
        int[][] states = {{android.R.attr.state_checked}, {}};
        sw.setThumbTintList(new ColorStateList(states, new int[]{Palette.VIOLET, 0xFFC7D2CE}));
        sw.setTrackTintList(new ColorStateList(states, new int[]{0x667C3AED, Palette.LINE}));
        sw.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (m.enabled == isChecked) return;
            m.enabled = isChecked;
            store.saveSpecials();
            NotificationHelper.cancelSpecial(this, m.code);
            if (isChecked) SpecialScheduler.scheduleOne(this, m.id, true);
            else SpecialScheduler.cancelOne(this, m);
            refreshCurrent(false);
            Toast.makeText(this, isChecked ? "已启用 " + m.name : "已停用 " + m.name, Toast.LENGTH_SHORT).show();
        });
        top.addView(sw, new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 34)));
        top.addView(Ui.icon(this, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 16));
        card.addView(top);

        LinearLayout meta = Ui.h(this);
        meta.setPadding(0, Ui.dp(this, 10), 0, 0);
        meta.addView(Ui.pill(this, m.scheduleText(), Palette.VIOLET_TEXT, Palette.VIOLET_BG));
        TextView next = Ui.text(this, "", 11.5f, Palette.MUTED);
        next.setPadding(Ui.dp(this, 9), 0, 0, 0);
        meta.addView(next, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        card.addView(meta);

        long due = m.effectiveAt();
        long now = System.currentTimeMillis();
        String status;
        int statusColor;
        if (!m.enabled) {
            status = "已停用";
            statusColor = Palette.MUTED;
        } else if (due <= now) {
            status = (now - due < 60_000L ? "已到时间" : "已超时 " + Fmt.durationShort(now - due));
            statusColor = Palette.AMBER;
        } else {
            status = "下次 " + Fmt.dayLabel(due) + " " + Fmt.time(due);
            statusColor = Palette.VIOLET_TEXT;
        }
        next.setText(status);
        next.setTextColor(statusColor);
        if (m.lastAt > 0L) {
            TextView last = Ui.text(this, "上次服用 " + Fmt.dayLabel(m.lastAt) + " " + Fmt.time(m.lastAt), 11, Palette.MUTED_LIGHT);
            last.setPadding(0, Ui.dp(this, 6), 0, 0);
            card.addView(last);
        }

        LinearLayout actions = Ui.h(this);
        actions.setPadding(0, Ui.dp(this, 10), 0, 0);
        TextView take = Ui.primaryButton(this, "已服用", Palette.VIOLET, Palette.WHITE, 42);
        take.setTextSize(13);
        take.setOnClickListener(v -> markSpecialNow(m));
        actions.addView(take, new LinearLayout.LayoutParams(0, Ui.dp(this, 42), 1));
        TextView backfill = Ui.outlineButton(this, "补登", Palette.VIOLET_TEXT, Palette.VIOLET_LINE, 42);
        backfill.setTextSize(13);
        backfill.setOnClickListener(v -> backfillSpecial(m));
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, Ui.dp(this, 42), 1);
        bp.leftMargin = Ui.dp(this, 8);
        actions.addView(backfill, bp);
        TextView snooze = Ui.medium(this, "推迟", 12.5f, Palette.MUTED);
        snooze.setGravity(Gravity.CENTER);
        snooze.setPadding(Ui.dp(this, 8), 0, Ui.dp(this, 4), 0);
        snooze.setOnClickListener(v -> snoozeSpecial(m));
        actions.addView(snooze, new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 42)));
        card.addView(actions);

        if (!m.enabled) card.setAlpha(0.62f);
        return card;
    }

    private void markSpecialNow(SpecialMed m) {
        store.markSpecialTaken(m.id, System.currentTimeMillis());
        NotificationHelper.cancelSpecial(this, m.code);
        SpecialScheduler.scheduleOne(this, m.id, false);
        store = Store.load(this);
        refreshCurrent(false);
        Toast.makeText(this, "已记录 " + m.name, Toast.LENGTH_SHORT).show();
    }

    private void snoozeSpecial(SpecialMed m) {
        store.snoozeSpecial(m.id, 10);
        NotificationHelper.cancelSpecial(this, m.code);
        SpecialScheduler.scheduleOne(this, m.id, true);
        store = Store.load(this);
        refreshCurrent(false);
        Toast.makeText(this, "将在 10 分钟后提醒", Toast.LENGTH_SHORT).show();
    }

    private void backfillSpecial(SpecialMed m) {
        long now = System.currentTimeMillis();
        long initial = Math.min(now, m.effectiveAt() > 0L ? m.effectiveAt() : now);
        new TimeSheet(this, "补登 " + m.name,
                "选择这次实际服用的时间，下一次会按这个时间重新计算。",
                "只能选择过去的时间；补登后会同步更新提醒。",
                false, initial, at -> {
                    if (m.lastAt > 0L && at < m.lastAt) {
                        Toast.makeText(this, "补登时间不能早于上次服药时间", Toast.LENGTH_SHORT).show();
                        return false;
                    }
                    store.markSpecialTaken(m.id, at);
                    NotificationHelper.cancelSpecial(this, m.code);
                    SpecialScheduler.scheduleOne(this, m.id, false);
                    store = Store.load(this);
                    refreshCurrent(false);
                    Toast.makeText(this, "已补登 " + m.name + " " + Fmt.time(at), Toast.LENGTH_SHORT).show();
                    return true;
                });
    }

    private ScrollView buildMeds() {
        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 20), Ui.dp(this, 6), Ui.dp(this, 20), Ui.dp(this, 28));

        LinearLayout header = Ui.h(this);
        header.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
        LinearLayout titleCol = Ui.v(this);
        titleCol.addView(Ui.bold(this, "我的药物", 25, Palette.INK));
        TextView sub = Ui.text(this, "设置每次服用的药名、用量和方式", 12.5f, Palette.MUTED);
        sub.setPadding(0, Ui.dp(this, 4), 0, 0);
        titleCol.addView(sub);
        header.addView(titleCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        FrameLayout add = new FrameLayout(this);
        add.setBackground(Ui.ripple(Ui.round(this, Palette.PRIMARY, 21), 0x33FFFFFF));
        ImageView plus = Ui.icon(this, R.drawable.ic_add, Palette.WHITE, 21);
        add.addView(plus, new FrameLayout.LayoutParams(Ui.dp(this, 21), Ui.dp(this, 21), Gravity.CENTER));
        add.setClickable(true);
        add.setFocusable(true);
        add.setContentDescription("添加药物");
        add.setOnClickListener(v -> new MedSheet(this, store, null, this::refreshAll));
        header.addView(add, new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));
        col.addView(header);

        LinearLayout info = Ui.h(this);
        info.setPadding(Ui.dp(this, 13), Ui.dp(this, 11), Ui.dp(this, 13), Ui.dp(this, 11));
        info.setBackground(Ui.round(this, Palette.MINT, 16));
        info.addView(Ui.icon(this, R.drawable.ic_pill, Palette.PRIMARY, 18));
        TextView hint = Ui.text(this, "每种药可以指定在第几次服用；停用后仍会保留在清单里。", 11.5f, Palette.PRIMARY_DARK);
        hint.setPadding(Ui.dp(this, 9), 0, 0, 0);
        hint.setLineSpacing(0, 1.15f);
        info.addView(hint, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        col.addView(info, topParams(14));

        if (store.meds.isEmpty()) {
            LinearLayout empty = Ui.v(this);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(Ui.dp(this, 20), Ui.dp(this, 30), Ui.dp(this, 20), Ui.dp(this, 30));
            empty.setBackground(Ui.roundStroke(this, Palette.CARD, 20, Palette.LINE, 1));
            FrameLayout iconWrap = new FrameLayout(this);
            iconWrap.setBackground(Ui.circle(this, Palette.MINT));
            ImageView icon = Ui.icon(this, R.drawable.ic_pill, Palette.PRIMARY, 28);
            iconWrap.addView(icon, new FrameLayout.LayoutParams(Ui.dp(this, 28), Ui.dp(this, 28), Gravity.CENTER));
            LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(Ui.dp(this, 64), Ui.dp(this, 64));
            ip.gravity = Gravity.CENTER_HORIZONTAL;
            empty.addView(iconWrap, ip);
            TextView title = Ui.bold(this, "还没有添加药物", 17, Palette.INK);
            title.setGravity(Gravity.CENTER);
            title.setPadding(0, Ui.dp(this, 14), 0, 0);
            empty.addView(title);
            TextView desc = Ui.text(this, "先添加你每天要吃的药，\n开始提醒时会自动带上药名、用量和方式。", 12, Palette.MUTED);
            desc.setGravity(Gravity.CENTER);
            desc.setLineSpacing(0, 1.3f);
            desc.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 16));
            empty.addView(desc);
            TextView addFirst = Ui.primaryButton(this, "添加第一种药", Palette.PRIMARY, Palette.WHITE, 48);
            addFirst.setOnClickListener(v -> new MedSheet(this, store, null, this::refreshAll));
            LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(Ui.dp(this, 180), Ui.dp(this, 48));
            ap.gravity = Gravity.CENTER_HORIZONTAL;
            empty.addView(addFirst, ap);
            col.addView(empty, topParams(16));
        } else {
            for (int i = 0; i < store.meds.size(); i++) {
                col.addView(buildMedCard(store.meds.get(i)), topParams(i == 0 ? 16 : 10));
            }
            TextView addMore = Ui.medium(this, "＋  添加药物", 14, Palette.PRIMARY);
            addMore.setGravity(Gravity.CENTER);
            addMore.setPadding(0, Ui.dp(this, 14), 0, Ui.dp(this, 14));
            addMore.setBackground(Ui.ripple(Ui.roundDashed(this, 0x00000000, 18, 0xFFB9CCC6, 1.3f), 0x0F000000));
            addMore.setOnClickListener(v -> new MedSheet(this, store, null, this::refreshAll));
            col.addView(addMore, topParams(12));
        }

        TextView note = Ui.text(this, "提醒内容按这里的最新设置生成；修改后无需重新开始计时。", 11.5f, Palette.MUTED_LIGHT);
        note.setGravity(Gravity.CENTER);
        note.setLineSpacing(0, 1.25f);
        col.addView(note, topParams(20));
        return Ui.scroll(this, col);
    }

    private View buildMedCard(Med med) {
        LinearLayout card = Ui.v(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 13), Ui.dp(this, 12), Ui.dp(this, 13));
        card.setBackground(Ui.ripple(Ui.roundStroke(this, Palette.CARD, 18, Palette.LINE, 1), 0x0F000000));
        card.setClickable(true);
        card.setFocusable(true);
        card.setOnClickListener(v -> new MedSheet(this, store, med, this::refreshAll));

        LinearLayout top = Ui.h(this);
        FrameLayout avatar = new FrameLayout(this);
        avatar.setBackground(Ui.circle(this, Palette.medColor(med.color)));
        avatar.addView(Ui.icon(this, Forms.iconRes(med.form), Palette.WHITE, 24),
                new FrameLayout.LayoutParams(Ui.dp(this, 24), Ui.dp(this, 24), Gravity.CENTER));
        top.addView(avatar, new LinearLayout.LayoutParams(Ui.dp(this, 42), Ui.dp(this, 42)));

        LinearLayout col = Ui.v(this);
        col.setPadding(Ui.dp(this, 11), 0, Ui.dp(this, 6), 0);
        col.addView(Ui.medium(this, med.name, 15.5f, Palette.INK));
        TextView detail = Ui.text(this, med.form + "  ·  " + med.dose + "  ·  " + med.method, 12, Palette.MUTED);
        detail.setPadding(0, Ui.dp(this, 3), 0, 0);
        col.addView(detail);
        top.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        Switch sw = new Switch(this);
        sw.setChecked(med.enabled);
        sw.setShowText(false);
        sw.setContentDescription(med.name + (med.enabled ? " 已启用" : " 已停用"));
        sw.setPadding(0, 0, 0, 0);
        int[][] states = {{android.R.attr.state_checked}, {}};
        sw.setThumbTintList(new ColorStateList(states, new int[]{Palette.PRIMARY, 0xFFC7D2CE}));
        sw.setTrackTintList(new ColorStateList(states, new int[]{0x6614B8A6, Palette.LINE}));
        sw.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (med.enabled == isChecked) return;
            med.enabled = isChecked;
            store.saveMeds();
            refreshCurrent(false);
            Toast.makeText(this, isChecked ? "已启用 " + med.name : "已停用 " + med.name, Toast.LENGTH_SHORT).show();
        });
        LinearLayout.LayoutParams swp = new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 34));
        top.addView(sw, swp);
        top.addView(Ui.icon(this, R.drawable.ic_chevron, Palette.MUTED_LIGHT, 16));
        card.addView(top);

        FlowLayout chips = new FlowLayout(this);
        chips.setPadding(0, Ui.dp(this, 10), 0, 0);
        if (med.allDoses) {
            chips.addView(Ui.pill(this, "每次服用", Palette.PRIMARY, Palette.MINT));
        } else {
            boolean any = false;
            for (int i = 0; i < store.doseCount; i++) {
                if (med.isSlot(i)) {
                    chips.addView(Ui.pill(this, "第" + (i + 1) + "次", Palette.PRIMARY, Palette.MINT));
                    any = true;
                }
            }
            if (!any) chips.addView(Ui.pill(this, "未指定", Palette.MUTED, Palette.FIELD));
        }
        card.addView(chips);

        if (med.courseDays > 0 || med.followupDays > 0) {
            FlowLayout meta = new FlowLayout(this);
            meta.setPadding(0, Ui.dp(this, 7), 0, 0);
            boolean ended = med.courseDays > 0 && !med.isCourseActive();
            meta.addView(Ui.pill(this, med.courseText(),
                    ended ? Palette.DANGER : Palette.AMBER,
                    ended ? Palette.DANGER_BG : Palette.AMBER_BG));
            if (med.followupDays > 0 && med.nextFollowupAt > 0L && !ended) {
                meta.addView(Ui.pill(this, "复诊 " + Fmt.monthDay(med.nextFollowupAt),
                        Palette.VIOLET_TEXT, Palette.VIOLET_BG));
            }
            card.addView(meta);
        }

        if (med.note != null && med.note.length() > 0) {
            TextView note = Ui.text(this, med.note, 11.5f, Palette.MUTED_LIGHT);
            note.setPadding(0, Ui.dp(this, 8), 0, 0);
            card.addView(note);
        }
        if (!med.enabled) card.setAlpha(0.62f);
        else if (med.courseDays > 0 && !med.isCourseActive()) card.setAlpha(0.78f);
        return card;
    }

    private static String greeting(int hour) {
        if (hour >= 5 && hour < 11) return "早上好";
        if (hour >= 11 && hour < 14) return "中午好";
        if (hour >= 14 && hour < 18) return "下午好";
        if (hour >= 18 && hour < 23) return "晚上好";
        return "夜深了";
    }

    private LinearLayout.LayoutParams topParams(int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = Ui.dp(this, topDp);
        return p;
    }

    private void startTicker() {
        stopTicker();
        ticker = new Runnable() {
            @Override
            public void run() {
                if (isFinishing() || isDestroyed()) return;
                int currentHour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
                if (currentHour != lastGreetingHour) {
                    refreshCurrent(false);
                }
                Cycle c = store.cycle;
                if (c != null && c.isStarted()) {
                    int next = c.nextPending();
                    if (next >= 0) {
                        long due = c.effectiveTime(next);
                        long remain = due - System.currentTimeMillis();
                        boolean overdue = remain <= 0;
                        if (next != lastNext || overdue != lastOverdue) {
                            refreshCurrent(false);
                        } else if (countdownView != null) {
                            countdownView.setText(countdownText(remain, overdue));
                        }
                    }
                }
                handler.postDelayed(this, 1000);
            }
        };
        handler.post(ticker);
    }

    private void stopTicker() {
        if (ticker != null) {
            handler.removeCallbacks(ticker);
            ticker = null;
        }
    }

    private void showOnboarding() {
        if (isFinishing() || store.isOnboarded()) return;
        new GuideSheet(this, store, this::refreshAll, () -> showTab(TAB_MEDS));
    }
}
