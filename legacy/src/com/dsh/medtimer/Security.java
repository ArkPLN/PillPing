package com.dsh.medtimer;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.security.MessageDigest;
import java.util.Locale;

/**
 * The APK is protected by Android's v2/v3 signature during install. This extra
 * certificate pin catches a simple repackage/re-sign, and warns about a
 * debuggable build.
 */
final class Security {
    private static final String EXPECTED_SHA256 =
            "0a85df154a84c9447741aea71282efbcacc6de06d6376b6da52ddf8c931e9863";

    private Security() {
    }

    static boolean verify(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 28) {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                if (info.signingInfo == null) return false;
                Signature[] signatures = info.signingInfo.getApkContentsSigners();
                if (signatures == null || signatures.length == 0) return false;
                return EXPECTED_SHA256.equals(sha256(signatures[0].toByteArray()));
            } else {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
                if (info.signatures == null || info.signatures.length == 0) return false;
                return EXPECTED_SHA256.equals(sha256(info.signatures[0].toByteArray()));
            }
        } catch (Exception e) {
            return false;
        }
    }

    static boolean isDebuggable(Context context) {
        try {
            ApplicationInfo info = context.getApplicationInfo();
            return (info.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    static String certShort(Context context) {
        String s = certSha256(context);
        if (s == null || s.length() < 12) return "不可读取";
        return s.substring(0, 12) + "…";
    }

    static String certSha256(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            PackageInfo info;
            Signature signature;
            if (Build.VERSION.SDK_INT >= 28) {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                if (info.signingInfo == null) return null;
                Signature[] signatures = info.signingInfo.getApkContentsSigners();
                if (signatures == null || signatures.length == 0) return null;
                signature = signatures[0];
            } else {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
                if (info.signatures == null || info.signatures.length == 0) return null;
                signature = info.signatures[0];
            }
            return sha256(signature.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }

    static boolean isTrusted(Context context) {
        return verify(context) && !isDebuggable(context);
    }

    static boolean enforce(Context context) {
        if (isTrusted(context)) return true;
        if (context instanceof Activity) {
            showBlocked((Activity) context);
        }
        return false;
    }

    private static void showBlocked(Activity activity) {
        Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(false);
        dialog.setCanceledOnTouchOutside(false);

        LinearLayout card = Ui.v(activity);
        card.setPadding(Ui.dp(activity, 22), Ui.dp(activity, 24), Ui.dp(activity, 22), Ui.dp(activity, 18));
        card.setBackground(Ui.round(activity, Palette.CARD, 24));
        TextView title = Ui.bold(activity, "应用安全校验失败", 20, Palette.DANGER);
        card.addView(title);
        TextView msg = Ui.text(activity,
                "当前安装包的应用签名与正式版本不一致，可能被重新打包或修改。为了保护用药数据，应用已停止运行。\n\n请从可信来源重新安装正式版本。",
                13, Palette.MUTED);
        msg.setLineSpacing(0, 1.3f);
        msg.setPadding(0, Ui.dp(activity, 10), 0, Ui.dp(activity, 18));
        card.addView(msg);
        TextView close = Ui.primaryButton(activity, "退出应用", Palette.DANGER, Palette.WHITE, 48);
        close.setOnClickListener(v -> {
            dialog.dismiss();
            activity.finish();
        });
        card.addView(close, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(activity, 48)));

        dialog.setContentView(card);
        Window w = dialog.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.setDimAmount(0.6f);
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            w.setGravity(Gravity.CENTER);
            int width = Math.min(activity.getResources().getDisplayMetrics().widthPixels - Ui.dp(activity, 44),
                    Ui.dp(activity, 360));
            w.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }
        dialog.show();
    }

    private static String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format(Locale.US, "%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
