/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.utils;

import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URL;
import java.util.Map;

/**
 * You don't need to worry too much about this class; it implements some
 * basic HTTP request functionality which includes proxy handling.
 */
class HttpUtil {

    static Response doHttpRequest(final String urlStr,
                                  final String requestMethod, final String body,
                                  final Map<String, String> header,
                                  boolean useProxy, String proxyHost, int proxyPort) throws Exception {
        HttpURLConnection conn;
        try {

            URL url = new URL(urlStr);

            if (useProxy) {

                Proxy proxy = new Proxy(Proxy.Type.HTTP,
                        new InetSocketAddress(proxyHost, proxyPort));

                conn = (HttpURLConnection) url.openConnection(proxy);
            } else {
                conn = (HttpURLConnection) url.openConnection();
            }
            conn.setDoOutput(true);
            conn.setDoInput(true);
            conn.setInstanceFollowRedirects(true);
            if (requestMethod != null) {
                conn.setRequestMethod(requestMethod);
            }
            if (header != null) {
                for (String key : header.keySet()) {

                    conn.setRequestProperty(key, header.get(key));

                }
            }

            // If use POST or PUT must use this
            OutputStreamWriter wr;
            if (body != null) {
                if (requestMethod != null
                        && !"GET".equals(requestMethod)
                        && !"DELETE".equals(requestMethod)) {
                    wr = new OutputStreamWriter(conn.getOutputStream());
                    wr.write(body);
                    wr.flush();
                }
            }

            conn.connect();
        } catch (Exception e) {
            System.out.println("HTTP UTIL: exception :" + e);
            throw new Exception(e);
        }
        return new Response(conn);

    }

}
