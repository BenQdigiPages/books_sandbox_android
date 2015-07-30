//***************************************************************************
//* Written by Steve Chiu <steve.chiu@benq.com>
//* BenQ Corporation, All Rights Reserved.
//*
//* NOTICE: All information contained herein is, and remains the property
//* of BenQ Corporation and its suppliers, if any. Dissemination of this
//* information or reproduction of this material is strictly forbidden
//* unless prior written permission is obtained from BenQ Corporation.
//***************************************************************************

package com.books.viewer;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.widget.ImageButton;
import android.widget.RelativeLayout;
import android.widget.TextView;

import com.books.sandbox.R;

import org.json.JSONArray;
import org.json.JSONObject;

public class ViewerActivity extends Activity implements PopupMenu.OnClickPopupListener {
    private static final String TAG = "ViewerActivity";

    private ViewerBridge mBridge;
    private WebView mWebView;
    private RelativeLayout mTitleBar;
    private TextView mTitle;
    private ImageButton mBtnTOC;
    private ImageButton mBtnOptions;
    private ImageButton mBtnBookmark;
    private ImageButton mBtnMonkey;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.viewer);
        getActionBar().hide();

        mTitleBar = (RelativeLayout) findViewById(R.id.title_bar);
        mTitle = (TextView) findViewById(R.id.title);
        mWebView = (WebView) findViewById(R.id.webview);
        mBridge = new ViewerBridge(this, mWebView);

        mBtnTOC = (ImageButton) findViewById(R.id.btn_toc);
        mBtnTOC.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickTOC();
            }
        });

        mBtnOptions = (ImageButton) findViewById(R.id.btn_options);
        mBtnOptions.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickOptions();
            }
        });

        mBtnBookmark = (ImageButton) findViewById(R.id.btn_bookmark);
        mBtnBookmark.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickBookmark();
            }
        });

        mBtnMonkey = (ImageButton) findViewById(R.id.btn_monkey);
        mBtnMonkey.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickMonkey();
            }
        });

        mBridge.loadBook("http://fake.benqguru.com/book/");
    }

    private JSONArray mTOC;

    public void setTableOfContent(JSONArray toc) {
        mTOC = toc;
    }

    public void setTitle(String title) {
        mTitle.setText(title);
    }

    public void setTitleVisible(boolean visible) {
        mTitleBar.setVisibility(visible ? View.VISIBLE : View.INVISIBLE);
    }

    private void onClickTOC() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        if (mTOC == null) {
            popup.setReadOnly(true);
            popup.add(0, "No TOC are available", null);
            popup.showAsDropDown(mBtnTOC);
            return;
        }

        for (int i = 0; i < mTOC.length(); i++) {
            try {
                JSONObject item = mTOC.getJSONObject(i);
                String title = item.getString("title");
                int level = item.getInt("level");
                while (level-- > 0) {
                    title = "    " + title;
                }
                final String link = item.getString("url");
                popup.add(0, title, new Runnable() {
                    public void run() {
                        mBridge.gotoLink(link);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "fail to get TOC", e);
            }
        }

        popup.showAsDropDown(mBtnTOC);
    }

    private void onClickOptions() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(0, "Font scale +25%", new Runnable() {
            public void run() {
                mBridge.getFontScale(new ValueCallback<Double>() {
                    public void onReceiveValue(Double value) {
                        double scale = Math.min(value + 0.25, 4);
                        mBridge.setFontScale(scale);
                    }
                });
            }
        });

        popup.add(0, "Font scale -25%", new Runnable() {
            public void run() {
                mBridge.getFontScale(new ValueCallback<Double>() {
                    public void onReceiveValue(Double value) {
                        double scale = Math.max(value - 0.25, 0.25);
                        mBridge.setFontScale(scale);
                    }
                });
            }
        });

        popup.add(0, "Background: [128, 128, 128]", new Runnable() {
            public void run() {
                mBridge.setBackgroundColor(128, 128, 128);
            }
        });

        popup.add(0, "Background: [255, 255, 255]", new Runnable() {
            public void run() {
                mBridge.setBackgroundColor(255, 255, 255);
            }
        });

        popup.add(0, "Mode: single", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("single");
            }
        });

        popup.add(0, "Mode: side_by_side", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("side_by_side");
            }
        });

        popup.add(0, "Mode: continuous", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("continuous");
            }
        });

        popup.showAsDropDown(mBtnOptions);
    }

    private void onClickBookmark() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(0, "Bookmark: [255, 0, 0]", new Runnable() {
            public void run() {
                mBridge.setBookmark(255, 0, 0);
            }
        });

        popup.add(0, "Bookmark: [0, 255, 0]", new Runnable() {
            public void run() {
                mBridge.setBookmark(0, 255, 0);
            }
        });

        popup.add(0, "Bookmark: [0, 0, 255]", new Runnable() {
            public void run() {
                mBridge.setBookmark(0, 0, 255);
            }
        });

        popup.add(0, "Remove bookmark", new Runnable() {
            public void run() {
                mBridge.removeBookmark();
            }
        });

        popup.showAsDropDown(mBtnBookmark);
    }

    private void onClickMonkey() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(0, "Viewer.getFontScale", new Runnable() {
            public void run() {
                mBridge.getFontScale(new ValueCallback<Double>() {
                    public void onReceiveValue(Double value) {
                        alert("Viewer.getFontScale", "scale = " + value);
                    }
                });
            }
        });

        popup.add(0, "Viewer.getBackgroundColor", new Runnable() {
            public void run() {
                mBridge.getBackgroundColor(new ValueCallback<Integer>() {
                    public void onReceiveValue(Integer value) {
                        int color = value;
                        int r = Color.red(color);
                        int g = Color.green(color);
                        int b = Color.blue(color);

                        alert("Viewer.getBackgroundColor",
                                String.format("r = %d\ng = %d\nb = %d", r, g, b));
                    }
                });
            }
        });

        popup.add(0, "Viewer.getAvailableLayoutModes", new Runnable() {
            public void run() {
                mBridge.getAvailableLayoutModes(new ValueCallback<String[]>() {
                    public void onReceiveValue(String[] modes) {
                        alert("Viewer.getAvailableLayoutModes", "modes = " + TextUtils.join(" | ", modes));
                    }
                });
            }
        });

        popup.add(0, "Viewer.getLayoutMode", new Runnable() {
            public void run() {
                mBridge.getLayoutMode(new ValueCallback<String>() {
                     public void onReceiveValue(String value) {
                         alert("Viewer.getLayoutMode", "mode = " + value);
                    }
                });
            }
        });

        popup.add(0, "Viewer.getCurrentPosition", new Runnable() {
            public void run() {
                mBridge.getCurrentPosition(new ValueCallback<Object[]>() {
                    public void onReceiveValue(Object[] value) {
                        alert("Viewer.getCurrentPosition",
                                "chapter = " + value[0]
                                + "\ncfi = " + value[1]
                                + "\ncurrent = " + value[2]
                                + "\ntotal = " + value[3]);
                    }
                });
            }
        });

        popup.showAsDropDown(mBtnMonkey);
    }

    public void onClickPopup(PopupMenu menu, Object key) {
        Runnable runnable = (Runnable) key;
        runnable.run();
        menu.dismiss();
    }

    private void alert(String title, String message) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .show();
    }
}
