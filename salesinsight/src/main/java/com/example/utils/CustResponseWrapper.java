/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.MD' which is part of this source code package.
 */
package com.example.utils;

import java.io.CharArrayWriter;
import java.io.PrintWriter;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;

//Custom Response Wrapper to change response 
//in case of errors while validating the token
public class CustResponseWrapper extends HttpServletResponseWrapper {
	private CharArrayWriter output;
	
	public String toString() {
            return output.toString();
	}
	
	public CustResponseWrapper(HttpServletResponse response){
	   super(response);
	   output = new CharArrayWriter();
	}
	
	public PrintWriter getWriter(){
	   return new PrintWriter(output);
	}
}
