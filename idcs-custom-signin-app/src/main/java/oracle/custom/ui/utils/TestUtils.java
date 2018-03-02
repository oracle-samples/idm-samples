/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.utils;

import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 *
 * @author npattar
 */
public class TestUtils {
    
    public static String extractBrowserFromUserAgent(String userAgent) {
        String user = userAgent.toLowerCase();
        String browser = "";
        if (user.indexOf("msie") != -1) {
            browser = "Microsoft Internet Explorer";
        } else if (user.indexOf("opera") != -1) {
            browser = "Opera";
        } else if (user.indexOf("opr") != -1) {
            browser = "Opera";
        } else if (user.indexOf("edge") != -1) {
            browser = "Microsoft Edge";
        } else if (user.indexOf("chrome") != -1) {
            browser = "Chrome";
        } else if (user.indexOf("safari") != -1) {
            browser = "Safari";
        } else if (user.indexOf("firefox") != -1) {
            browser = "Firefox";
        } else if (user.indexOf("trident") != -1) { //Check for IE 11, as "msie" string has been removed. Keep this check **ALWAYS** at the end
            browser = "Microsoft Internet Explorer";
        }
        return browser;
    }
    public static void main(String args[]) throws Exception  {
        String url = "http://cisco.idcs.internal.oracle.com:9246/admin/v1/TrustedUserAgents?filter=user.value+eq+x\"";
        new URI(url);
        
        
    }
                
    public static String getQueryParam(String name, String url) throws Exception {
        URI uri = new URI(url);
        String query = uri.getQuery();
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String [] kv = pair.split("=");
            if (name.equalsIgnoreCase(kv[0])) {
                return URLDecoder.decode(kv[1], "UTF-8");
            }
        }
        return null;
    }
    
    private static Map<String, String> osMap = new LinkedHashMap<String, String>();

    static {
        osMap.put("Win16", "Windows 3.11");
        osMap.put("Windows 95", "Windows 95");
        osMap.put("Win95", "Windows 95");
        osMap.put("Windows_95", "Windows 95");
        osMap.put("Windows 98", "Windows 98");
        osMap.put("Win98", "Windows 98");
        osMap.put("Windows NT 5.0", "Windows 2000");
        osMap.put("Windows 2000", "Windows 2000");
        osMap.put("Windows NT 5.1", "Windows XP");
        osMap.put("Windows XP", "Windows XP");
        osMap.put("Windows NT 5.2", "Windows Server 2003");
        osMap.put("Windows NT 6.0", "Windows Vista");
        osMap.put("Windows NT 6.1", "Windows 7");
        osMap.put("Windows 7", "Windows 7");
        osMap.put("Windows NT 6.2", "Windows 8");
        osMap.put("Windows 8", "Windows 8");
        osMap.put("Windows 8.1", "Windows 8.1");
        osMap.put("Windows NT 6.3", "Windows 8.1");
        osMap.put("Windows 10.0", "Windows 10");
        osMap.put("Windows NT 10.0", "Windows 10");
        osMap.put("Windows NT 4.0", "Windows NT 4.0");
        osMap.put("WinNT4.0", "Windows NT 4.0");
        osMap.put("WinNT", "Windows NT 4.0");
        osMap.put("Windows NT", "Windows NT 4.0");
        osMap.put("Windows ME", "Windows ME");
        osMap.put("Win 9x 4.90", "Windows ME");
        osMap.put("Windows CE", "Windows CE");
        osMap.put("Android", "Android");
        osMap.put("OpenBSD", "Open BSD");
        osMap.put("SunOS", "Sun OS");
        osMap.put("Linux", "Linux");
        osMap.put("X11", "Linux");
        osMap.put("iPhone", "iPhone OS");
        osMap.put("iPod", "iPod OS");
        osMap.put("iPad", "iPad OS");
        osMap.put("Mac OS X", "Mac OS X");
        osMap.put("QNX", "QNX");
        osMap.put("UNIX", "UNIX");
        osMap.put("BeOS", "BeOS");
        osMap.put("MacPPC", "Mac OS");
        osMap.put("MacIntel", "Mac OS");
        osMap.put("Mac_PowerPC", "Mac OS");
        osMap.put("Macintosh", "Mac OS");
        osMap.put("OS/2", "OS/2");
    }

    
    public static String extractOsFromUserAgent(String userAgent) {
       
        String os = "";
        String user = userAgent.toLowerCase();
        // Getting OS
        Set<String> keySet = osMap.keySet();
        for (String string : keySet) {
            if (user.contains(string.toLowerCase())) {
                os = osMap.get(string);
                break;
            }
        }
        return os;
    }
}
