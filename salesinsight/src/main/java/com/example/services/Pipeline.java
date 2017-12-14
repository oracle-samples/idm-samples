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

@Path("/pipeline")
public class Pipeline {
    
    private String pipeline;
    private static final int NUMBER_OF_MONTHS=6;
    
    @Override
    public String toString(){
        return pipeline;
    }
    
    @GET
    @Produces(MediaType.TEXT_HTML)
    public static String getPipeline(){
        Random random = new Random();
        Calendar cal = Calendar.getInstance();
        SimpleDateFormat sdf = new SimpleDateFormat("MMMM-yyyy");
        
        String pipeline = "<strong>Sales pipeline for the next " + NUMBER_OF_MONTHS + " months:</strong><br><ul>";
        for (int i = 0; i < NUMBER_OF_MONTHS; i++) {
            cal.add(Calendar.MONTH, 1);
            pipeline += "<li><strong>"+sdf.format(cal.getTime()) + ":</strong> "
                           + NumberFormat.getCurrencyInstance().format(10+(100000-10)*random.nextDouble()) + ".</li>";
        }
        pipeline += "</ul>";
        return pipeline;
    }
    
    public static void main(String args[]){
        System.out.println(Pipeline.getPipeline());
    }
}

