package com.dsh.medtimer;

import org.json.JSONException;
import org.json.JSONObject;

final class HistoryItem {
    String date = "";
    long startAt = 0L;
    int taken = 0;
    int total = 3;
    String summary = "";

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("date", date);
            o.put("startAt", startAt);
            o.put("taken", taken);
            o.put("total", total);
            o.put("summary", summary);
        } catch (JSONException ignored) {
        }
        return o;
    }

    static HistoryItem fromJson(JSONObject o) {
        HistoryItem h = new HistoryItem();
        h.date = o.optString("date", "");
        h.startAt = o.optLong("startAt", 0L);
        h.taken = o.optInt("taken", 0);
        h.total = o.optInt("total", 3);
        h.summary = o.optString("summary", "");
        return h;
    }
}
