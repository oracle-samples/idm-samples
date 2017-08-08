/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.services;

import java.text.NumberFormat;
import java.util.Random;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/quote")
public class Quote {
    private static final int MAX_QUOTES=20;
    
    @GET
    @Produces(MediaType.TEXT_HTML)
    public static String getQuotes() {
        Random random = new Random();
        int numberOfQuotes = random.nextInt(MAX_QUOTES);
        String quotes = "<strong>Quotes requiring your immediate action:</strong><br>";
        quotes +="<table class=\"table table-hover\">"
                +"<thead>"
                +"<thead>"
                +"<tr>"
                +"<th>Quote</th>"
                +"<th>Title</th>"
                +"<th>Description</th>"
                +"<th>Value</th>"
                +"</tr></thead><tbody>";
        for (int i = 0; i < numberOfQuotes; i++) {
            quotes += "<tr>"+
               "<td> "+random.nextInt(10000)+"</td>"+
               "<td> "+ExampleUtils.COMPANY[random.nextInt(ExampleUtils.COMPANY.length)]+"'s "+
                                              ExampleUtils.THING[random.nextInt(ExampleUtils.THING.length)]+"</td>"+
               "<td> "+ExampleUtils.RANDON_DESC[random.nextInt(ExampleUtils.RANDON_DESC.length)]+"</td>"+
               "<td> "+NumberFormat.getCurrencyInstance().format(10+(1000-10)*random.nextDouble())+"</td>"+
               "</tr>";
        }
        quotes+="</tbody></table>";
        return quotes;
    }

    public static void main(String args[]){
        System.out.println(Quote.getQuotes());
    }
}
