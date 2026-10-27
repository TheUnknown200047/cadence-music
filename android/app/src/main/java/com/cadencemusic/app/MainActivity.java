package com.cadencemusic.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private PowerManager.WakeLock wakeLock;

    // Live Cloud Endpoint for Instant Automatic Updates
    private static final String LIVE_URL = "https://theunknown200047.github.io/cadence-music/";
    // Offline local fallback bundled inside the APK
    private static final String FALLBACK_URL = "file:///android_asset/index.html";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep CPU alive for background lock-screen audio playback
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Cadence::BackgroundAudioLock");
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        // Full screen immersive dark
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#07080c"));
            window.setNavigationBarColor(Color.parseColor("#07080c"));
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#07080c"));
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Native Android Bridge for CORS-Free YouTube Search Directly on Phone
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String search(String query) {
                try {
                    java.net.URL url = new java.net.URL("https://www.youtube.com/youtubei/v1/search");
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);

                    String payload = "{\"context\":{\"client\":{\"clientName\":\"WEB\",\"clientVersion\":\"2.20240101.00.00\"}},\"query\":\"" + query.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}";
                    byte[] out = payload.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        os.write(out);
                    }

                    try (java.io.InputStream is = conn.getInputStream();
                         java.util.Scanner s = new java.util.Scanner(is, java.nio.charset.StandardCharsets.UTF_8.name())) {
                        return s.useDelimiter("\\A").hasNext() ? s.next() : "";
                    }
                } catch (Exception e) {
                    return "{\"error\":\"" + e.getMessage() + "\"}";
                }
            }
        }, "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    view.loadUrl(FALLBACK_URL);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Launch live stream with automatic OTA updates
        webView.loadUrl(LIVE_URL);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Keep WebView media active when screen is turned off / phone is closed
    }

    @Override
    protected void onStop() {
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
