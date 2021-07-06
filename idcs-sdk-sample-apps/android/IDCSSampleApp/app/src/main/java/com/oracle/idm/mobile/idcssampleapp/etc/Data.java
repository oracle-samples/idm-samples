/*
 * Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

package com.oracle.idm.mobile.idcssampleapp.etc;

public class Data {
    public String id;
    public String content;
    public String details;
    public String mIconData;

    public Data(String id, String content, String details, String icon) {
        this.id = id;
        this.content = content;
        this.details = details;
        if (icon != null && icon.contains("data:image/png;base64,")) {
            icon = icon.replace("data:image/png;base64,", "");
        }
        this.mIconData = icon;
    }

    @Override
    public String toString() {
        return "Data{" +
                "id='" + id + '\'' +
                ", content='" + content + '\'' +
                ", details='" + details + '\'' +
                '}';
    }
}
