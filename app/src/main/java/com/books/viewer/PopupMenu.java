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
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AbsListView;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.books.sandbox.R;

import java.util.ArrayList;

public class PopupMenu {

	public interface OnClickPopupListener {
		void onClickPopup(PopupMenu menu, Object key);
	}

	private static class Item {
		public Object key;
		public int icon;
		public CharSequence title;
	}

	private Activity mContext;
	private PopupWindow mPopup;
	private int mWidth;
	private double mRelativeWidth;
	private int mItemLayout;
	private AbsListView mList;
	private ListAdapter mAdapter;
	private ArrayList<Item> mItems;
	private boolean mReadOnly;
	private OnClickPopupListener mListener;

	private class ListAdapter extends BaseAdapter {
		@Override
		public int getCount() {
			return mItems.size();
		}

		@Override
		public Object getItem(int pos) {
			return pos;
		}

		@Override
		public long getItemId(int pos) {
			return pos;
		}

		@Override
		public View getView(int pos, View view, ViewGroup parent) {
			if (view == null) {
				view = mContext.getLayoutInflater().inflate(mItemLayout, parent, false);
			}

			Item info = mItems.get(pos);

			ImageView image = (ImageView)view.findViewById(R.id.image);
			if (info.icon != 0) {
				image.setVisibility(View.VISIBLE);
				image.setImageResource(info.icon);
			} else {
				image.setVisibility(View.GONE);
			}

			TextView title = (TextView)view.findViewById(R.id.text_title);
			title.setText(info.title);

			return view;
		}
	}

	public PopupMenu(Activity context) {
		this(context, R.layout.list_popup, R.layout.item_popup, false);
	}

	public PopupMenu(Activity context, int layout, int item_layout, boolean read_only) {
		mContext = context;
		mWidth = ViewGroup.LayoutParams.WRAP_CONTENT;
		mRelativeWidth = 0;
		mItemLayout = item_layout;
		mReadOnly = read_only;

		View v = context.getLayoutInflater().inflate(layout, null);

		mItems = new ArrayList<Item>();
		mAdapter = new ListAdapter();
		mList = (AbsListView)v.findViewById(R.id.list);

		if (mReadOnly) {
			ColorDrawable color = new ColorDrawable(0);
			color.setAlpha(0);
			mList.setSelector(color);
		}

		// make it compatible with android-7
		if (mList instanceof ListView) {
			((ListView) mList).setAdapter(mAdapter);
		} else if (mList instanceof GridView) {
			((GridView) mList).setAdapter(mAdapter);
		} else {
			throw new IllegalArgumentException("unknown AbsListView sub type");
		}

		mList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
			public void onItemClick(AdapterView<?> parent, View view, int pos, long id) {
				if (mReadOnly) {
					mPopup.dismiss();
				} else if (mListener != null) {
					Item info = mItems.get(pos);
					mListener.onClickPopup(PopupMenu.this, info.key);
					mPopup.dismiss();
				}
			}
		});

		mPopup = new PopupWindow(v);
		mPopup.setFocusable(true);
		mPopup.setInputMethodMode(PopupWindow.INPUT_METHOD_NOT_NEEDED);
		mPopup.setWindowLayoutMode(0, ViewGroup.LayoutParams.WRAP_CONTENT);
		mPopup.setOutsideTouchable(true);
		mPopup.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
	}

	public void add(int icon, int title, Object key) {
		add(icon, mContext.getText(title), key);
	}

	public void add(int icon, CharSequence title, Object key) {
		Item item = new Item();
		item.key = key;
		item.icon = icon;
		item.title = title;
		mItems.add(item);
		mAdapter.notifyDataSetChanged();
	}

	public void removeAll() {
		mItems.clear();
		mAdapter.notifyDataSetChanged();
	}

	public Drawable getBackground() {
		return mPopup.getBackground();
	}

	public void setBackground(int res) {
		Drawable bg = mContext.getResources().getDrawable(res);
		mPopup.setBackgroundDrawable(bg);
	}

	public void setBackground(Drawable bg) {
		mPopup.setBackgroundDrawable(bg);
	}

	public void setOnClickPopupListener(OnClickPopupListener listener) {
		mListener = listener;
	}

	public void setReadOnly(boolean readOnly) {
		mReadOnly = readOnly;
	}

	public void setWidth(int width) {
		mWidth = width;
		mRelativeWidth = 0;
	}

	public void setRelativeWidth(double width) {
		mRelativeWidth = width;
	}

	public Object getTag() {
		return mList.getTag();
	}

	public void setTag(Object tag) {
		mList.setTag(tag);
	}

	public void showAsDropDown(View anchor) {
		showAsDropDown(anchor, 0, 0);
	}

	public void showAsDropDown(View anchor, int xoff, int yoff) {
		setupWindow();
		mPopup.showAsDropDown(anchor, xoff, yoff);
	}

	public void showAtLocation(View parent, int gravity, int xoff, int yoff) {
		setupWindow();
		mPopup.showAtLocation(parent, gravity, xoff, yoff);
	}

	@SuppressWarnings("deprecation")
	private void setupWindow() {
		View decor = mContext.getWindow().getDecorView();
		int max_w = decor.getWidth();
		int w = mWidth;

		if (mRelativeWidth > 0) {
			w = (int)(max_w * mRelativeWidth);
		} else if (mWidth == 0 || mWidth == ViewGroup.LayoutParams.WRAP_CONTENT) {
			mPopup.getContentView().measure(
				View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
				View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
			w = mPopup.getContentView().getMeasuredWidth() * 8 / 5; // FIXME: table seems to measure first item only
			w = Math.max(300, Math.min(w, max_w * 95 / 100));
		} else if (mWidth == ViewGroup.LayoutParams.FILL_PARENT) {
			w = max_w - 10;
		}

		mPopup.setWindowLayoutMode(0, ViewGroup.LayoutParams.WRAP_CONTENT);
		mPopup.setWidth(w);
		mPopup.setHeight(ViewGroup.LayoutParams.WRAP_CONTENT);
	}

	public void dismiss() {
		mPopup.dismiss();
	}
}
