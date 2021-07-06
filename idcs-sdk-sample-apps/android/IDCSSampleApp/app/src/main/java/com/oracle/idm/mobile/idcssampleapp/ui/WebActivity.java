/*
 * Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

package com.oracle.idm.mobile.idcssampleapp.ui;

import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.support.customtabs.CustomTabsIntent;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RelativeLayout;
import android.widget.Toast;

import com.oracle.idm.mobile.idcssampleapp.R;
import com.oracle.idm.mobile.idcssampleapp.chromeTabs.ActionBroadcastReceiver;
import com.oracle.idm.mobile.idcssampleapp.chromeTabs.CustomTabActivityHelper;
import com.oracle.idm.mobile.idcssampleapp.chromeTabs.CustomTabsHelper;
import com.oracle.idm.mobile.idcssampleapp.wrapper.Const;
import com.oracle.idm.mobile.idcssampleapp.wrapper.IDCSSDKWrapper;
import com.oracle.idm.mobile.idcssampleapp.wrapper.ServiceCallListener;

import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;

import oracle.idm.mobile.OMMobileSecurityException;
import oracle.idm.mobile.OMSecurityConstants;
import oracle.idm.mobile.auth.OMAuthenticationChallenge;
import oracle.idm.mobile.auth.OMAuthenticationChallengeType;
import oracle.idm.mobile.auth.OMAuthenticationCompletionHandler;
import oracle.idm.mobile.auth.OMAuthenticationContext;
import oracle.idm.mobile.auth.logout.OMLogoutCompletionHandler;
import oracle.idm.mobile.configuration.OMMobileSecurityConfiguration;
import oracle.idm.mobile.configuration.OMOICMobileSecurityConfiguration;

import static com.oracle.idm.mobile.idcssampleapp.wrapper.Const.AppBrowserMode.CHROMETAB;
import static oracle.idm.mobile.configuration.OMMobileSecurityConfiguration.BrowserMode.EMBEDDED;
import static oracle.idm.mobile.configuration.OMMobileSecurityConfiguration.BrowserMode.EXTERNAL;


/**
 * The responsibility of this class is to facilitate login/logout events using the browser/chrometab.
 * For the sake of simplicity and modularity, all the events of login/logout
 * which will be performed in different screens should land to this activity.
 * <p>
 * This class implements the interface ServiceCallListener which is the listener for the event in
 * the SDKWrapper and the implementation of this shall handle the UI respective to the events.
 */
public class WebActivity extends BaseActivity implements ServiceCallListener {


    protected CustomTabActivityHelper mTabHelper;
    private Button btLogin;
    private boolean openedBrowser;
    boolean embedded;
    private RelativeLayout relativeLayout;
    private WebView webview;
    private LinearLayout webviewLL;
    private final static String TAG = WebActivity.class.getSimpleName();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_sign_in);
        btLogin = findViewById(R.id.btLogin);
        launchLoginPage();
        relativeLayout = (RelativeLayout) findViewById(R.id.parentRL);
        btLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                launchLoginPage();
            }
        });
    }

    @Override
    protected void onStart() {
        super.onStart();
        Log.d(TAG, "onStart");

        IDCSSDKWrapper.getInstance().registerUIListener(this);
    }

    @Override
    protected void onStop() {
        super.onStop();
        Log.d(TAG, "onStop");
        IDCSSDKWrapper.getInstance().unregisterUIListener(this);

    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume : ");
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause");
    }


    private void initializeSDK() {
        OMMobileSecurityConfiguration.BrowserMode browserMode = EMBEDDED;

        //change this to Const.AppBrowserMode.EXTERNAL if you want any other external browser to handle this
        Const.AppBrowserMode type = Const.AppBrowserMode.EMBEDDED;

        // check if chrome tab is supported else fallback to external browser
        if ((browserMode == EXTERNAL) && (null == CustomTabsHelper.getPackageNameToUse(WebActivity.this))) {
            type = Const.AppBrowserMode.EXTERNAL;
        }

        // call initialize when the SDK needs to be initialized for a given browser mode and type
        IDCSSDKWrapper.initialize(getApplicationContext(), browserMode, type);
    }


    @Override
    public void onSetupCompleted(OMMobileSecurityConfiguration config, OMMobileSecurityException mse) {
        Log.d(TAG, "onSetupCompleted");
        dismissProgress();
        String errorMessage = (mse != null) ? mse.getErrorCode() + " : " + mse.getErrorMessage() : "";
        //displayToast("Setup done Status: " + (mse == null) + errorMessage);
        Log.d(TAG, "Setup done Status: " + (mse == null) + errorMessage);

        if (config != null) {
            String frontChannelRequest = (((OMOICMobileSecurityConfiguration) config).getOAuthAuthorizationEndpoint().toString());
            if (mTabHelper != null) {
                mTabHelper.mayLaunchUrl(Uri.parse(frontChannelRequest), null, null);
            }
        }
        openedBrowser = true;
    }

    @Override
    public void onAuthenticationChallenge(OMAuthenticationChallenge challenge, OMAuthenticationCompletionHandler completionHandler) {
        //displayToast("onAuthenticationChallenge - " + challenge.getChallengeType());
        Log.d(TAG, "onAuthenticationChallenge : " + challenge.getChallengeType());
        if (challenge.getChallengeType() == OMAuthenticationChallengeType.EMBEDDED_WEBVIEW_REQUIRED) {
            embedded = true;
            webviewLL = (LinearLayout) (getLayoutInflater().inflate(R.layout.oauth_webview, null));
            relativeLayout.addView(webviewLL, new RelativeLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            WebView webView = (WebView) webviewLL.findViewById(R.id.oauthWebview);
            WebViewClient appWebViewClient = new EmbeddedWebViewClient();
            Map<String, Object> response = new HashMap<>();
            response.put(OMSecurityConstants.Challenge.WEBVIEW_KEY, webView);
            response.put(OMSecurityConstants.Challenge.WEBVIEW_CLIENT_KEY, appWebViewClient);
            completionHandler.proceed(response);
        }
        if (challenge.getChallengeType() == OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED) {
            String externalBrowserURL = (String) challenge.getChallengeFields().get(OMSecurityConstants.Challenge.EXTERNAL_BROWSER_LOAD_URL);
            if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == Const.AppBrowserMode.EXTERNAL) {
                if (!TextUtils.isEmpty(externalBrowserURL)) {
                    invokeExternalBrowser(externalBrowserURL);
                } else {
                    //SDK error
                    displayToast("SDK ERROR!!!!!!!");
                    Log.w(TAG, "onAuthenticationChallenge : SDK ERROR!!!!!!!");
                }
            } else if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == CHROMETAB) {
                Log.d(TAG, "Chrome TAB Load URL: " + externalBrowserURL);
                /*if (mTabHelper != null) {
                    mTabHelper.bindCustomTabsService(WebActivity.this);
                }*/
                openCustomTab(externalBrowserURL);
            }

        } else if (challenge.getChallengeType() == OMAuthenticationChallengeType.UNTRUSTED_SERVER_CERTIFICATE) {
            /*With the following commented code, app can show a security alert to end-user
            with details of server certificate. But, this is NOT supposed to used in
            production apps as leaving the decision to end-user in case of mobile apps where
            URLs are known in advance as opposed to a browser is a security concern.
            */

            //onUntrustedServerCertificateReceived(challenge, completionHandler);
        }
    }

    @Override
    public void onAuthenticationCompleted(OMAuthenticationContext omAuthenticationContext, OMMobileSecurityException mse) {
        Log.d(TAG, "onAuthenticationCompleted called");
        dismissProgress();
        if (mTabHelper != null) {
            mTabHelper.unbindCustomTabsService(WebActivity.this);
        }
        if (mse != null) {
            Log.d(TAG, "Authentication Failed : " + mse.getErrorMessage());
            displayToast("Authentication Failed !!!");
            finishAuthentication(false);
        } else {
            finishAuthentication(true);
            //launchHome();
        }
    }

    @Override
    public void onLogoutChallenge(OMAuthenticationChallenge challenge, OMLogoutCompletionHandler completionHandler) {
        Log.d(TAG, "onLogoutChallenge  : " + challenge.getChallengeType());
        if (challenge.getChallengeType() == OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED) {

            String logoutURL = (String) challenge.getChallengeFields().get(OMSecurityConstants.Challenge.EXTERNAL_BROWSER_LOAD_URL);
            Log.d(TAG, "Logout url = " + logoutURL);
            if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == Const.AppBrowserMode.EXTERNAL) {
                if (!TextUtils.isEmpty(logoutURL)) {
                    invokeExternalBrowser(logoutURL);
                } else {
                    //SDK error
                    Toast.makeText(this, "SDK ERROR!!!!!!!", Toast.LENGTH_LONG).show();
                }
            } else if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == CHROMETAB) {
                Log.d(TAG, "Chrome TAB Load URL: " + logoutURL);
                if (mTabHelper != null) {
                    mTabHelper.bindCustomTabsService(WebActivity.this);
                }
                openCustomTab(logoutURL);
            }
            /* Can call proceed here if server does not redirect the control back to app after logout.
             * In case of Oracle Identity Cloud Service OpenID flow, after successful logout, control comes back to app.*/

                // completionHandler.proceed(null);
                // mLogoutCompletionHandler = null;
        } else {
            webviewLL = (LinearLayout) (getLayoutInflater().inflate(R.layout.oauth_webview, null));
            relativeLayout.addView(webviewLL, new RelativeLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            WebView webView = (WebView) webviewLL.findViewById(R.id.oauthWebview);
            WebViewClient webViewClient = new EmbeddedWebViewClient();
            webView.setWebViewClient(webViewClient);
            Map<String, Object> response = new HashMap<>();
            response.put(OMSecurityConstants.Challenge.WEBVIEW_KEY, webView);
            response.put(OMSecurityConstants.Challenge.WEBVIEW_CLIENT_KEY, webViewClient);
            completionHandler.proceed(response);
        }
    }

    @Override
    public void onErrorMessage(String msg) {
        displayToast(msg);
    }

    @Override
    public void onLogoutCompleted(OMMobileSecurityException mse) {
        Log.d(TAG, "onLogoutCompleted called");
        dismissProgress();
        if (mTabHelper != null) {
            mTabHelper.unbindCustomTabsService(WebActivity.this);
        }
        if (mse == null) {
            //displayToast("Logout is successful");
            Log.d(TAG, "Logout is successful");
        } else {
            displayToast("Logout failed: " + mse.getErrorMessage());
            Log.d(TAG, "Logout failed: " + mse.getErrorMessage());
        }
        //finish();
        // you can relaunch the login Web page as an option to relogin
        if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == Const.AppBrowserMode.CHROMETAB) {
            launchLoginPage();
        } else if (IDCSSDKWrapper.getInstance().getAppBrowserMode() == Const.AppBrowserMode.EMBEDDED) {
            if (webviewLL != null) {
                relativeLayout.removeView(webviewLL);
            }
        }
    }


    private void onUntrustedServerCertificateReceived(final OMAuthenticationChallenge challenge,
                                                      final OMAuthenticationCompletionHandler completionHandler) {
        //lets get the certificate object
        X509Certificate[] certificateChain = (X509Certificate[]) challenge.getChallengeFields()
                .get(OMSecurityConstants.Challenge.UNTRUSTED_SERVER_CERTIFICATE_CHAIN_KEY);
        AlertDialog dialog = getAlertDialogSSL(null, certificateChain[0]
                .getSubjectX500Principal().getName(), certificateChain[0].getIssuerX500Principal().getName());

        dialog.setButton(DialogInterface.BUTTON_NEGATIVE, "Deny", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                Log.d(TAG, " Deny pressed on untrusted server certificate challenge");
                completionHandler.cancel();
            }
        });

        dialog.setButton(DialogInterface.BUTTON_POSITIVE, "Allow", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                Log.d(TAG, " Allow pressed on untrusted server certificate challenge");

                completionHandler.proceed(challenge.getChallengeFields());
            }
        });

        dialog.show();
    }


    private void invokeExternalBrowser(String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
        if (intent.resolveActivity(getPackageManager()) != null) {
            startActivity(intent);
        } else {
            Log.d(TAG,
                    "External Browser not available in this profile[we are failing gracefully]");
            displayToast(getString(R.string.external_browser_npt_available));
        }
    }


    /**
     * initialize the chrome tab properties and open the chrome tab for the url passed in
     *
     * @param url
     */
    private void openCustomTab(String url) {

        int color = getResources().getColor(R.color.colorPrimary);
        int secondaryColor = getResources().getColor(R.color.colorPrimaryDark);

        CustomTabsIntent.Builder intentBuilder = new CustomTabsIntent.Builder(mTabHelper.getSession());
        intentBuilder.setToolbarColor(color);
        intentBuilder.setSecondaryToolbarColor(secondaryColor);

        intentBuilder.setShowTitle(true);

        intentBuilder.enableUrlBarHiding();
        intentBuilder.setCloseButtonIcon(
                BitmapFactory.decodeResource(getResources(), android.R.drawable.arrow_down_float));
        intentBuilder.setStartAnimations(this, android.R.anim.slide_in_left, android.R.anim.slide_out_right);
        intentBuilder.setExitAnimations(this, android.R.anim.slide_in_left,
                android.R.anim.slide_out_right);

        CustomTabActivityHelper.openCustomTab(
                this, intentBuilder.build(), Uri.parse(url), /*new WebviewFallback()*/null);
    }

    private PendingIntent createPendingIntent(int actionSourceId) {
        Intent actionIntent = new Intent(
                this.getApplicationContext(), ActionBroadcastReceiver.class);
        actionIntent.putExtra("something", actionSourceId);
        return PendingIntent.getBroadcast(
                getApplicationContext(), actionSourceId, actionIntent, 0);
    }


    private void initBrowserEnvironment() {
        // initialize the chrometab environment if the browse mode is CHROME
        //if(mTabHelper == null) {
        mTabHelper = new CustomTabActivityHelper();
        // }
        mTabHelper.bindCustomTabsService(this);
    }


    /**
     * the call flow will come here on the redirections which will follow in the process of login/logout
     *
     * @param intent
     */
    @Override
    protected void onNewIntent(Intent intent) {
        //super.onNewIntent(intent);
        Log.d(TAG, "onNewIntent(): intent.getData() = " + intent.getData());
        if (intent.getData() != null) {
            if (mTabHelper != null) {
                mTabHelper.bindCustomTabsService(WebActivity.this);
            }
            // obtain the instances of the OMAuthenticationCompletionHandler and OMLogoutCompletionHandler from
            // the singleton instance of OMMobileSecurityService
            OMAuthenticationCompletionHandler authCompletionHandler = IDCSSDKWrapper.getInstance().getCurrentAuthCompletionHandler();
            OMLogoutCompletionHandler logoutCompletionHandler = IDCSSDKWrapper.getInstance().getCurrentLogoutCompletionHandler();
            if (authCompletionHandler != null || logoutCompletionHandler != null) {
                openedBrowser = false;
                // register your UI listener to receive the call backs in UI
                IDCSSDKWrapper.getInstance().registerUIListener(this);


                Map<String, Object> inputParams = new HashMap<>();
                Log.d(TAG, "received intent data: " + intent.getData().toString());
                inputParams.put(OMSecurityConstants.Challenge.REDIRECT_RESPONSE_KEY, intent.getData());

                /* depending on the existence of the instance of the completionHandler decide if it
                 * is a login/logout redirection and use the handler to call the proceed() of the same handler.
                 * This will respectively trigger onAuthenticationCompleted/onLogoutCompleted.
                 */
                if (authCompletionHandler != null) {
                    showProgress(getString(R.string.completing_login));
                    authCompletionHandler.proceed(inputParams);
                } else {
                    showProgress(getString(R.string.finishing_logout));
                    logoutCompletionHandler.proceed(inputParams);
                }
            }

        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult request=" + requestCode + " resultcode=" + resultCode);
        if (requestCode == Const.REQUEST_CODE_LAUNCH_HOME) {
            if (resultCode == Const.REQUEST_CODE_FINISH_HOME) {
                finish();
            } else if (resultCode == Const.REQUEST_CODE_LOGOUT_HOME) {
                IDCSSDKWrapper.getInstance().registerUIListener(this);
                handleLogout(true);
            } else {
                // Unknown resultcode. Finishing the WebActivity
                finish();
            }
        }
    }

    /**
     * here OMAuthenticationContext is obtained from the singleton instance
     * of OMMobileSecurityService and logout is initiated
     *
     * @param flag
     */
    private void handleLogout(boolean flag) {
        OMAuthenticationContext mAuthContext = IDCSSDKWrapper.getInstance().getCurrentAuthContext();
        if (mAuthContext != null) {
            mAuthContext.logout(flag);
        } else {
            Log.e(TAG, "Authenticate first!");
            displayToast("Authenticate first!");
        }
    }

    private void finishAuthentication(boolean isSuccess) {
        if (isSuccess) {
            launchHome();
            // setResult(Const.ACTION_RESULT_AUTH_COMPLETED_SUCCESS);
        } else {
            Log.d(TAG, "Authentication Failed !!!");
            //setResult(Const.ACTION_RESULT_AUTH_COMPLETED_FAIL);
        }

    }

    private void launchHome() {
        Intent intent = new Intent(WebActivity.this, HomeActivity.class);
        intent.putExtra("displayname", IDCSSDKWrapper.getInstance()
                .getCurrentAuthContext().getOpenIDUserInfo().getDisplayName());
        intent.putExtra("email", IDCSSDKWrapper.getInstance()
                .getCurrentAuthContext().getOpenIDUserInfo().getUsername());
        startActivityForResult(intent, Const.REQUEST_CODE_LAUNCH_HOME);
    }

    private void launchLoginPage() {

        initBrowserEnvironment();
        // login requests need to come to this activity with request code Const.REQUEST_CODE_LOGIN
        showProgress("setting up...");
        initializeSDK();
        IDCSSDKWrapper.getInstance().registerUIListener(this);
        IDCSSDKWrapper.getInstance().getOMMSService().setup();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy");
        if (mTabHelper != null) {
            mTabHelper.unbindCustomTabsService(this);
        }
    }
}
