package com.oracle.idm.mobile.idcssampleapp.ui;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.support.v7.widget.RecyclerView;
import android.text.TextUtils;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import com.oracle.idm.mobile.idcssampleapp.R;
import com.oracle.idm.mobile.idcssampleapp.etc.Data;
import com.oracle.idm.mobile.idcssampleapp.ui.ItemsFragment.OnListFragmentInteractionListener;

import java.util.List;

/**
 * {@link RecyclerView.Adapter} that can display a {@link Data} and makes a call to the
 * specified {@link OnListFragmentInteractionListener}.
 * TODO: Replace the implementation with code for your data type.
 */
public class MyDataRecyclerViewAdapter extends RecyclerView.Adapter<MyDataRecyclerViewAdapter.ViewHolder> {

    private final OnListFragmentInteractionListener mListener;
    public List<Data> mValues;

    public MyDataRecyclerViewAdapter(List<Data> items, OnListFragmentInteractionListener listener) {
        mValues = items;
        mListener = listener;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.layout_list_item, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(final ViewHolder holder, int position) {
        holder.mItem = mValues.get(position);
        holder.mIdView.setText(mValues.get(position).content);
        holder.mContentView.setText(mValues.get(position).details);
        if (TextUtils.isEmpty(mValues.get(position).mIconData)) {
            holder.mIcon.setVisibility(View.VISIBLE);
            holder.mIconImg.setVisibility(View.GONE);
        } else {
            holder.mIconImg.setVisibility(View.VISIBLE);
            holder.mIcon.setVisibility(View.GONE);
            byte[] decodedString = Base64.decode(mValues.get(position).mIconData, Base64.DEFAULT);
            Bitmap decodedByte = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
            holder.mIconImg.setImageBitmap(decodedByte);
        }

        holder.mIcon.setText(getAbbriviationFormText(mValues.get(position).content));
        holder.mView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (null != mListener) {
                    // Notify the active callbacks interface (the activity, if the
                    // fragment is attached to one) that an item has been selected.
                    mListener.onListFragmentInteraction(holder.mItem);
                }
            }
        });
    }

    @Override
    public int getItemCount() {
        return mValues.size();
    }

    private String getAbbriviationFormText(String displayname) {
        if (TextUtils.isEmpty(displayname)) {
            return "";
        }
        String name = displayname.trim();
        if (!TextUtils.isEmpty(name)) {
            name = name.toUpperCase();
            if (name.contains(" ")) {
                String[] arr = name.split(" ", 2);
                return (arr[0].substring(0, 1) + arr[1].substring(0, 1));
            } else {
                return name.substring(0, 2);
            }
        } else {
            return "";
        }
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        public final View mView;
        public final TextView mIcon;
        public final ImageView mIconImg;
        public final TextView mIdView;
        public final TextView mContentView;
        public Data mItem;

        public ViewHolder(View view) {
            super(view);
            mView = view;
            mIcon = view.findViewById(R.id.id_item_icon);
            mIconImg = view.findViewById(R.id.id_item_icon_image);
            mIdView = (TextView) view.findViewById(R.id.tv_item_name);
            mContentView = (TextView) view.findViewById(R.id.tv_item_description);
        }

        @Override
        public String toString() {
            return super.toString() + " '" + mIdView.getText() + "'";
        }
    }
}
