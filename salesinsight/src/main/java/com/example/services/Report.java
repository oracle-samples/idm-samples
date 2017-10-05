/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.services;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Random;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/report")
public class Report {
    private static final int NUMBER_OF_MONTHS=6;
    
    @GET
    @Produces(MediaType.TEXT_HTML)
    public static String getReport(){
        Random random = new Random();
        Calendar cal = Calendar.getInstance();
        SimpleDateFormat sdf = new SimpleDateFormat("MMMM-yyyy");
        
        String report = "<strong>Sales report for the last " + NUMBER_OF_MONTHS + " months:</strong><br><ul>";
        for (int i = 0; i < NUMBER_OF_MONTHS; i++) {
            cal.add(Calendar.MONTH, -1);
            report += "<li><strong>"+sdf.format(cal.getTime()) + ":</strong> "
                           + NumberFormat.getCurrencyInstance().format(10+(100000-10)*random.nextDouble()) + ".</li>";
        }
        report += "</ul>";
        return report;
    }
    
    public static void main(String args[]){
        System.out.println(Report.getReport());
    }
}
