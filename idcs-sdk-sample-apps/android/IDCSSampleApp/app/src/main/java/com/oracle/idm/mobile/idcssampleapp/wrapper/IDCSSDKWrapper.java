package com.oracle.idm.mobile.idcssampleapp.wrapper;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import oracle.idm.mobile.OMAuthenticationRequest;
import oracle.idm.mobile.OMMobileSecurityException;
import oracle.idm.mobile.OMMobileSecurityService;
import oracle.idm.mobile.auth.OMAuthenticationChallenge;
import oracle.idm.mobile.auth.OMAuthenticationCompletionHandler;
import oracle.idm.mobile.auth.OMAuthenticationContext;
import oracle.idm.mobile.auth.logout.OMLogoutCompletionHandler;
import oracle.idm.mobile.callback.OMMobileSecurityServiceCallback;
import oracle.idm.mobile.configuration.OAuthAuthorizationGrantType;
import oracle.idm.mobile.configuration.OMConnectivityMode;
import oracle.idm.mobile.configuration.OMMobileSecurityConfiguration;

import static com.oracle.idm.mobile.idcssampleapp.wrapper.Const.OPEND_ID_REDIRECT_EP;
import static com.oracle.idm.mobile.idcssampleapp.wrapper.Const.OPEN_ID_CLIENT_ID;


/**
 * this implementation demonstrates that a singleton instance needs to exist for each authentication method.
 * In current class OpenID authentication flow is implemented and showcases the use of IDCS SDK for the same
 */
public class IDCSSDKWrapper {
    private static final String TAG = "IDCSSDKWrapper";
    private static IDCSSDKWrapper mInstance;
    private OMMobileSecurityService mOMSS;
    private Set<String> scopes;
    private OMMobileSecurityConfiguration.BrowserMode mode;
    private Const.AppBrowserMode appBrowserMode;
    private OMAuthenticationContext mAuthContext;
    private OMAuthenticationCompletionHandler mAuthCompletionHandler;
    private OMLogoutCompletionHandler mLogoutCompletionHandler;
    private Context mContext;
    private HashSet<ServiceCallListener> mUICallbackMap;


    private IDCSSDKWrapper() {
        mUICallbackMap = new HashSet<>();
    }

    /**
     * method to get the singleton instance of the wrapper class.
     * @Warning : DO NOT CALL THIS WITHOUT calling initialize for the first time.
     * @return
     */
    public synchronized static IDCSSDKWrapper getInstance() {
        if(mInstance == null) {
           //TODO : throw  new Exception ("getInstance called first time without calling initialize.");
            Log.e(TAG,"getInstance called first time without calling initialize.");
        }
        return mInstance;
    }

    /**
     * This method needs to be called for the first time when the instance of this class is fetched.
     * It will instantiate the SDK using the given context for given browser mode and type.
     *
     * @param ctx         : application context
     * @param mode
     * @param browserType
     */
    public static void initialize(Context ctx, OMMobileSecurityConfiguration.BrowserMode mode, Const.AppBrowserMode browserType) {
        mInstance = new IDCSSDKWrapper();


        Log.d(TAG, "initialize");
        mInstance.mContext = ctx.getApplicationContext();
        mInstance.mode = mode;
        mInstance.appBrowserMode = browserType;

        try {
            Map<String, Object> map = mInstance.getConfigMap();
            if (map != null) {
                mInstance.mOMSS = new OMMobileSecurityService(mInstance.mContext, map, mInstance.new OMMobileSecurityServiceCallbackImp());
            }
        } catch (OMMobileSecurityException e) {
            Log.e(TAG, "initialization failed", e);
            throw new IllegalArgumentException(e);
        }
    }

    public OMMobileSecurityService getOMMSService() {
        return mOMSS;
    }

    /**
     * this methos will unregister listeners from UI classes which were registered using unregisterUIListener api
     *
     * @param serviceCallback
     */
    public void unregisterUIListener(ServiceCallListener serviceCallback) {
        Log.d(TAG, "unregisterUIListener");
        this.mUICallbackMap.remove(serviceCallback);
    }

    /**
     * this method will register listeners from UI calsses to listen for different SDK authorization/logout callbacks
     *
     * @param serviceCallback
     */
    public void registerUIListener(ServiceCallListener serviceCallback) {
        Log.d(TAG, "registerUIListener");
        this.mUICallbackMap.add(serviceCallback);
    }

    public Set<String> getScopes() {
        return scopes;
    }

    /**
     * Defining the scope for the SDK initialization where scope properties like authorization type,
     * redirection endpoint, browser node, auth client id etc need to be defined.
     *
     * @return
     */
    private Map<String, Object> getConfigMap() {
        scopes = new HashSet<>();
        Map<String, Object> map = new HashMap<>();
        map.put(OMMobileSecurityService.OM_PROP_AUTHSERVER_TYPE, OMMobileSecurityService.AuthServerType.OpenIDConnect10);
        map.put(OMMobileSecurityService.OM_PROP_OPENID_CONNECT_CONFIGURATION_URL, Const.OPEN_ID_DISCOVERY_URL);
        map.put(OMMobileSecurityService.OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE, OAuthAuthorizationGrantType.AUTHORIZATION_CODE);
        map.put(OMMobileSecurityService.OM_PROP_BROWSER_MODE, mode);
        map.put(OMMobileSecurityService.OM_PROP_OAUTH_ENABLE_PKCE, true);
        map.put(OMMobileSecurityService.OM_PROP_OAUTH_REDIRECT_ENDPOINT, OPEND_ID_REDIRECT_EP);
        map.put(OMMobileSecurityService.OM_PROP_OAUTH_CLIENT_ID, OPEN_ID_CLIENT_ID);
        scopes.add("openid");
        //  scopes.add("profile");
        scopes.add("urn:opc:idm:t.user.me");
        map.put(OMMobileSecurityService.OM_PROP_OAUTH_SCOPE, scopes);
        map.put(OMMobileSecurityService.OM_PROP_APPNAME, "OracleIdentityCloudServicesSampleApp");
        return map;
    }


    public OMMobileSecurityConfiguration.BrowserMode getMode() {
        return mode;
    }

    public Const.AppBrowserMode getAppBrowserMode() {
        return appBrowserMode;
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        if (mUICallbackMap != null) {
            mUICallbackMap.clear();
            mUICallbackMap = null;
        }

    }

    /**
     * here the instance of OMMobileSecurityService is fetched from singleton entity and
     * a authentication request is prepared to trigger authenticate event.
     */
    private void handleAuthentication() {
        OMMobileSecurityService mss = IDCSSDKWrapper.getInstance().getOMMSService();
        String errMsg = null;
        if (mss != null) {
            try {
                OMAuthenticationRequest.Builder authReqBuilder = new OMAuthenticationRequest.Builder();
                authReqBuilder.setConnMode(OMConnectivityMode.ONLINE);
                mss.authenticate(authReqBuilder.build());
            } catch (OMMobileSecurityException e) {
                errMsg = "Error: " + e.getErrorMessage();
                Log.e(TAG, errMsg , e);
            }

        } else {
            Log.d(TAG, "error initializing SDK");
                errMsg = "error initializing OMSS";
        }
        if ((mUICallbackMap != null) && (errMsg != null)) {
            for (ServiceCallListener listener : mUICallbackMap) {
                listener.onErrorMessage(errMsg);
            }
        }
    }

    public OMAuthenticationCompletionHandler getCurrentAuthCompletionHandler() {
        return mAuthCompletionHandler;
    }

    public OMLogoutCompletionHandler getCurrentLogoutCompletionHandler() {
        return mLogoutCompletionHandler;
    }

    public OMAuthenticationContext getCurrentAuthContext() {
        try {
            mAuthContext = mOMSS.retrieveAuthenticationContext();
        } catch (OMMobileSecurityException e) {
            Log.e(TAG, "getCurrentAuthContext", e);
            mAuthContext = null;
        }
        return mAuthContext;
    }

    /**
     * This is the callback implementation which is triggerd by the IDCS sdk respective to the
     * events of authorization challenge/completion and logout challenge/completion.
     * Instance of this implementation needs to be provided in the instantiation of the IDSC sdk.
     */
    private class OMMobileSecurityServiceCallbackImp implements OMMobileSecurityServiceCallback {

        /**
         * this callback is called on the event of setup completion which is triggered as a result of OMMobileSecurityService.setup()
         *
         * @param mss
         * @param config
         * @param mse
         */
        @Override
        public void onSetupCompleted(OMMobileSecurityService mss, OMMobileSecurityConfiguration config, OMMobileSecurityException mse) {
            Log.d(TAG, "onSetupCompleted called");
            String errMsg = null;
            if (mse != null) {
                errMsg = "ERROR : " + mse.getErrorMessage();
            }
            if (mUICallbackMap != null) {
                for (ServiceCallListener listener : mUICallbackMap) {
                    if(errMsg != null) {
                        listener.onErrorMessage(errMsg);
                    } else {
                        listener.onSetupCompleted(config, mse);
                    }
                }
            }
            if((mss != null) && (mse == null)) {
                handleAuthentication(); // once setup is completed then Authentication should be called
            }
        }

        /**
         * this callback is called on the event of challenge for authentication which is triggered
         * as a result of OMMobileSecurityService.authenticate()
         *
         * @param mss
         * @param challenge
         * @param completionHandler
         */
        @Override
        public void onAuthenticationChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge challenge, OMAuthenticationCompletionHandler completionHandler) {
            Log.d(TAG, "onAuthenticationChallenge called");
            // retain an instance of the OMAuthenticationCompletionHandler which is available as a part of authentication challenge here
            mAuthCompletionHandler = completionHandler;

            // inform all listeners of UI which are regestered
            if (mUICallbackMap != null) {
                for (ServiceCallListener listener : mUICallbackMap) {
                    listener.onAuthenticationChallenge(challenge, completionHandler);
                }

            }
        }

        /**
         * this callback is called on the event of a authentication completion triggered
         * as a result of credential validation and redirection.
         *
         * @param mss
         * @param authContext
         * @param mse
         */
        @Override
        public void onAuthenticationCompleted(OMMobileSecurityService
                                                      mss, OMAuthenticationContext authContext, OMMobileSecurityException mse) {
            Log.d(TAG, "onAuthenticationCompleted called");

            mAuthCompletionHandler = null;
            //refresh the authContext instance of OMMobileSecurityService. This context is latte used for handling authentication
            mAuthContext = authContext;
            // inform all listeners of UI which are registered
            if (mUICallbackMap != null) {
                for (ServiceCallListener listener : mUICallbackMap) {
                    listener.onAuthenticationCompleted(authContext, mse);
                }

            }
        }

        /**
         * this callback is called on the event of challenge for authentication which is triggered
         * as a result of OMAuthenticationContext.logout()
         *
         * @param mss
         * @param challenge
         * @param completionHandler
         */
        @Override
        public void onLogoutChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge
                challenge, OMLogoutCompletionHandler completionHandler) {
            Log.d(TAG, "onLogoutChallenge called");
            // retain an instance of the OMLogoutCompletionHandler which is available as a part of authentication challenge here
            mLogoutCompletionHandler = completionHandler;
            // inform all listeners of UI which are registered
            if (mUICallbackMap != null) {
                for (ServiceCallListener listener : mUICallbackMap) {
                    listener.onLogoutChallenge(challenge, completionHandler);
                }

            }
        }

        /**
         * this callback is called on the event of a logout completion triggered
         * as a result of logout validation and redirection.
         *
         * @param mss
         * @param mse
         */
        @Override
        public void onLogoutCompleted(OMMobileSecurityService mss, OMMobileSecurityException
                mse) {
            Log.d(TAG, "onLogoutCompleted called");
            try {

                mAuthContext = mss.retrieveAuthenticationContext();
                mLogoutCompletionHandler = null;
                if (mUICallbackMap != null) {
                    for (ServiceCallListener listener : mUICallbackMap) {
                        listener.onLogoutCompleted(mse);
                    }

                }
            } catch (OMMobileSecurityException e) {
                Log.e(TAG, "Error while retrieving auth context after logout!", e);
                if (mUICallbackMap != null) {
                    for (ServiceCallListener listener : mUICallbackMap) {
                        listener.onErrorMessage("Error while retrieving auth context after logout! :" + e.getErrorMessage());
                    }

                }
            } finally {
                mOMSS = null;
                mAuthCompletionHandler = null;
                mAuthContext = null;
            }

        }

        @Override
        public Handler getHandler() {
            return new Handler(Looper.getMainLooper());
        }
    }

}
