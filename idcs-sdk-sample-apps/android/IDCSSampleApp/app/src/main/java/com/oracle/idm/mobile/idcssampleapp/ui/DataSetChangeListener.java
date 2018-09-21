package com.oracle.idm.mobile.idcssampleapp.ui;

import com.oracle.idm.mobile.idcssampleapp.etc.Data;

import java.util.ArrayList;

public interface DataSetChangeListener {
    void onDataSerChanged(ArrayList<Data> items, boolean isGroup);
}

