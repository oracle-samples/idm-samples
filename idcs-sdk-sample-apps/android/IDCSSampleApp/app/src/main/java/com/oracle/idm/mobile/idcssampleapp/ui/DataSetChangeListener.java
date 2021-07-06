/*
 * Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

package com.oracle.idm.mobile.idcssampleapp.ui;

import com.oracle.idm.mobile.idcssampleapp.etc.Data;

import java.util.ArrayList;

public interface DataSetChangeListener {
    void onDataSerChanged(ArrayList<Data> items, boolean isGroup);
}

