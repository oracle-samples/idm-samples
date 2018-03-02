/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package oracle.custom.ui.common;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Properties;

/**
 *
 * @author npattar
 */
public class DomainName {
    static {
        Properties pr = new Properties();
        try {
            pr.load(new FileInputStream("sys.props"));
//            protocol = pr.getProperty("protocol");
            domainName = pr.getProperty("account");
//            hostSuffix = pr.getProperty("hostSuffix");
        } catch (Exception ex) {
            System.out.println("Unable to load system preferences");
        }
    }
    
    public static String domainName;
//    public static String hostSuffix;
//    public static String protocol;

//    public static String getProtocol() {
//        if (protocol == null || protocol.isEmpty()) {
//            protocol = "https";
//        }
//        return protocol;
//    }
//
//    public static void setProtocol(String protocol) {
//        DomainName.protocol = protocol;
//    }
//    
//    public static void setHostSuffix(String s) {
//        if (s == null || s.isEmpty()) {
//            hostSuffix = ".idcs.internal.oracle.com";
//        } else {
//            hostSuffix = s.trim();
//        }
//    }
    
    public static String getDomainName() {
        return domainName;
    }
    
    public static void setDomainName(String d) {
        domainName = d;
    }
    
//    public static String getHostSuffix() {
//        if (hostSuffix == null || hostSuffix.isEmpty()) {
//            hostSuffix = ".idcs.internal.oracle.com";
//        }
//        return hostSuffix;
//    }
//    public static void update() {
//        Properties pr = new Properties();
//        pr.setProperty("protocol", getProtocol());
//        pr.setProperty("account", getDomainName());
//        pr.setProperty("hostSuffix", getHostSuffix());
//        try {
//            pr.store(new FileOutputStream("sys.props"), "System Properties persisted");
//        } catch (Exception ex) {
//            ex.printStackTrace();
//        }
//    }
}
