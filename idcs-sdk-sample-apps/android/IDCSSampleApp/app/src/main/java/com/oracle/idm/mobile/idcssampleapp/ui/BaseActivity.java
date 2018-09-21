package com.oracle.idm.mobile.idcssampleapp.ui;

import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.support.v7.app.AppCompatActivity;
import android.text.TextUtils;
import android.util.Log;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.webkit.ClientCertRequest;
import android.webkit.HttpAuthHandler;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import android.widget.Toast;

import com.oracle.idm.mobile.idcssampleapp.R;

import java.util.Arrays;

public abstract class BaseActivity extends AppCompatActivity {

    private static final String TAG = BaseActivity.class.getSimpleName();

    private ProgressDialog mProgress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }


    protected void displayResult(String data) {
        final AlertDialog.Builder alert = new AlertDialog.Builder(this);
        final TextView tv = new TextView(this);
        tv.setText(data);
        alert.setView(tv);
        alert.setTitle(R.string.response);
        alert.setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface dialog, int whichButton) {

                dialog.cancel();
            }
        });
        alert.show();
    }

    public AlertDialog getAlertDialogSSL(String primaryError, String commonName, String issuedBy) {

        if (TextUtils.isEmpty(primaryError)) {
            primaryError = "Untrusted server certificate.";
        }

        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Your connection is not private").setMessage(primaryError + " Do you want to trust this certificate?").create();
        dialog.setCancelable(false);
        dialog.setCanceledOnTouchOutside(false);

        View certLayout = ((LayoutInflater) getSystemService(LAYOUT_INFLATER_SERVICE)).inflate(R.layout.certificate_layout, null);
        TextView commonNameTV = (TextView) certLayout.findViewById(R.id.commonNameTv);
        commonNameTV.setText(commonName);
        TextView issuedByTV = (TextView) certLayout.findViewById(R.id.issuerTV);
        issuedByTV.setText(issuedBy);
        dialog.setView(certLayout);
        return dialog;
    }

    protected void displayToast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
        // Log.d(TAG, msg);
    }


    protected void showProgress(String msg) {
        Log.d(TAG, "showProgress dialog for msg =" + msg);
        //if(TextUtils.isEmpty(msg)) {
        msg = getString(R.string.please_wait);
        //}

        if (null == mProgress) {
            mProgress = new ProgressDialog(BaseActivity.this);
        }
        mProgress.setCancelable(false);
        mProgress.setMessage(msg);
        mProgress.setProgressStyle(ProgressDialog.STYLE_SPINNER);
        mProgress.setIndeterminate(true);
        if (!mProgress.isShowing()) {
            mProgress.show();
        }
    }

    protected void dismissProgress() {
        Log.d(TAG, "dismissProgress dialog");
        if (mProgress != null) {
            if (mProgress.isShowing()) {
                mProgress.dismiss();
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        dismissProgress();
    }

    public class EmbeddedWebViewClient extends WebViewClient {

        private final String TAG = EmbeddedWebViewClient.class.getSimpleName();

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Log.d(TAG, "shouldOverrideUrlLoading: url = " + url);
            return super.shouldOverrideUrlLoading(view, url);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Log.d(TAG, "onPageStarted: url = " + url);
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.d(TAG, "onPageFinished: url = " + url);
            super.onPageFinished(view, url);
        }

        @Override
        public void onLoadResource(WebView view, String url) {
            Log.d(TAG, "onLoadResource: url = " + url);
            super.onLoadResource(view, url);
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            Log.d(TAG, "onPageCommitVisible: url = " + url);
            super.onPageCommitVisible(view, url);
        }

        @SuppressWarnings("deprecation")
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            Log.d(TAG, "shouldInterceptRequest: url = " + url);
            return super.shouldInterceptRequest(view, url);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Log.d(TAG, "shouldInterceptRequest");
            return super.shouldInterceptRequest(view, request);
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onTooManyRedirects(WebView view, Message cancelMsg, Message continueMsg) {
            Log.d(TAG, "onTooManyRedirects");
            super.onTooManyRedirects(view, cancelMsg, continueMsg);
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            Log.d(TAG, "onReceivedError deprecated: errorCode = " + errorCode
                    + " description = " + description + " failingUrl = " + failingUrl);
            super.onReceivedError(view, errorCode, description, failingUrl);
        }

        @TargetApi(Build.VERSION_CODES.M)
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            Log.d(TAG, "onReceivedError: url = " + request.getUrl() + " error = " + error.getErrorCode());
            super.onReceivedError(view, request, error);
        }

        @TargetApi(Build.VERSION_CODES.LOLLIPOP)
        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            Log.d(TAG, "onReceivedHttpError: url = " + request.getUrl() + " error = " + errorResponse.getStatusCode());
            super.onReceivedHttpError(view, request, errorResponse);
        }

        @Override
        public void onFormResubmission(WebView view, Message dontResend, Message resend) {
            Log.d(TAG, "onFormResubmission");
            super.onFormResubmission(view, dontResend, resend);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            Log.d(TAG, "doUpdateVisitedHistory: url = " + url);
            super.doUpdateVisitedHistory(view, url, isReload);
        }

        @Override
        public void onReceivedSslError(WebView view, final SslErrorHandler handler, SslError error) {
            Log.e(TAG, "onReceivedSslError: " + error.toString());
        }

        @TargetApi(Build.VERSION_CODES.LOLLIPOP)
        @Override
        public void onReceivedClientCertRequest(WebView view, final ClientCertRequest request) {
            Log.e(TAG, "onReceivedClientCertRequest: Host: " + request.getHost() +
                    " Port: " + request.getPort() + " \nKeyTypes: " + Arrays.toString(request.getKeyTypes()) +
                    " \nAcceptable certificate issuers for the certificate matching the private key:" + Arrays.toString(request.getPrincipals()));
        }

        @Override
        public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {
            Log.d(TAG, "_onReceivedHttpAuthRequest host = " + host
                    + " realm = " + realm);
        }

        @Override
        public boolean shouldOverrideKeyEvent(WebView view, KeyEvent event) {
            Log.d(TAG, "shouldOverrideKeyEvent");
            return super.shouldOverrideKeyEvent(view, event);
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onUnhandledKeyEvent(WebView view, KeyEvent event) {
            Log.d(TAG, "onUnhandledKeyEvent");
            super.onUnhandledKeyEvent(view, event);
        }

//        @Override
//        public void onUnhandledInputEvent(WebView view, InputEvent event) {
//            Log.d(TAG, "onUnhandledInputEvent");
//            super.onUnhandledInputEvent(view, event);
//        }

        @Override
        public void onScaleChanged(WebView view, float oldScale, float newScale) {
            Log.d(TAG, "onScaleChanged");
            super.onScaleChanged(view, oldScale, newScale);
        }

        @Override
        public void onReceivedLoginRequest(WebView view, String realm, String account, String args) {
            Log.d(TAG, "onReceivedLoginRequest");
            super.onReceivedLoginRequest(view, realm, account, args);
        }
    }

}
