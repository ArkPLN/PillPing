package com.dsh.medtimer;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

final class Fmt {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.CHINA);
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("M月d日", Locale.CHINA);
    private static final DateTimeFormatter FULL = DateTimeFormatter.ofPattern("M月d日 HH:mm", Locale.CHINA);

    private Fmt() {
    }

    static ZoneId zone() {
        return ZoneId.systemDefault();
    }

    static LocalDateTime dateTime(long millis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(millis), zone());
    }

    static LocalDate date(long millis) {
        return dateTime(millis).toLocalDate();
    }

    static String time(long millis) {
        return TIME.format(dateTime(millis));
    }

    static String monthDay(long millis) {
        return MONTH_DAY.format(dateTime(millis));
    }

    static String full(long millis) {
        return FULL.format(dateTime(millis));
    }

    static String dateKey(long millis) {
        return date(millis).toString();
    }

    static String todayKey() {
        return LocalDate.now(zone()).toString();
    }

    static String dayLabel(long millis) {
        LocalDate d = date(millis);
        LocalDate today = LocalDate.now(zone());
        if (d.equals(today)) return "今天";
        if (d.equals(today.plusDays(1))) return "明天";
        if (d.equals(today.minusDays(1))) return "昨天";
        return MONTH_DAY.format(d.atStartOfDay());
    }

    static String weekday(long millis) {
        String[] names = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
        int idx = date(millis).getDayOfWeek().getValue() - 1;
        return names[Math.max(0, Math.min(6, idx))];
    }

    static String dateKeyToCn(String key) {
        try {
            LocalDate d = LocalDate.parse(key);
            return MONTH_DAY.format(d.atStartOfDay());
        } catch (Exception e) {
            return key;
        }
    }

    static String duration(long millis) {
        long totalSec = Math.max(0, millis / 1000);
        long h = totalSec / 3600;
        long m = (totalSec % 3600) / 60;
        long s = totalSec % 60;
        if (h > 0) return h + " 小时 " + m + " 分";
        if (m > 0) return m + " 分 " + s + " 秒";
        return s + " 秒";
    }

    static String durationShort(long millis) {
        long totalMin = Math.max(0, millis / 60000);
        long h = totalMin / 60;
        long m = totalMin % 60;
        if (h > 0) return h + " 小时 " + m + " 分";
        return m + " 分钟";
    }
}
