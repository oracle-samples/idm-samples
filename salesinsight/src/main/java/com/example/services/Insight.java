/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.services;

import java.util.Random;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

/**
 * Dummy bean to report sales insights
 */
@Path("/insight")
public class Insight {
    
    private static final int MAX_INSIGHTS=20;
    
    @GET
    @Produces(MediaType.TEXT_HTML)
    public static String getInsights() {
        Random random = new Random();
        int numberOfInsights = random.nextInt(MAX_INSIGHTS);
        String insight = ExampleUtils.MOMENT[random.nextInt(ExampleUtils.MOMENT.length)] + " " + ExampleUtils.PERIOD[random.nextInt(ExampleUtils.PERIOD.length)] + ":<br><ol>";
        for (int i = 0; i < numberOfInsights; i++) {
            insight += "<li><strong>"+ random.nextInt(100) + "%</strong> of "
                    +"<u>"+ExampleUtils.COMPANY[random.nextInt(ExampleUtils.COMPANY.length)] + "'s</u> "
                    + ExampleUtils.ACTION[random.nextInt(ExampleUtils.ACTION.length)] + " "
                    + ExampleUtils.THING[random.nextInt(ExampleUtils.THING.length)] + " "
                    + ExampleUtils.RESULTS[random.nextInt(ExampleUtils.RESULTS.length)] + ".</li>";
        }
        insight+="</ol>";
        return insight;
    }
    
    public static void main(String args[]) {
        System.out.println(Insight.getInsights());
    }
}
