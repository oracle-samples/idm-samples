package com.oracle.idm.mobile.idcssampleapp.ui;

import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.RadioGroup;
import android.widget.TextView;

import com.oracle.idm.mobile.idcssampleapp.R;
import com.oracle.idm.mobile.idcssampleapp.etc.Data;
import com.oracle.idm.mobile.idcssampleapp.wrapper.Const;
import com.oracle.idm.mobile.idcssampleapp.wrapper.IDCSSDKWrapper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;

import oracle.idm.mobile.OMMobileSecurityException;
import oracle.idm.mobile.callback.OMHTTPRequestCallback;
import oracle.idm.mobile.connection.OMAuthorizationService;
import oracle.idm.mobile.connection.OMHTTPRequest;
import oracle.idm.mobile.connection.OMHTTPResponse;

public class HomeActivity extends BaseActivity implements ItemsFragment.OnListFragmentInteractionListener {

    private static final String TAG = HomeActivity.class.getSimpleName();
    ArrayList<Data> groupList, appsList;
    private Button btLogout;
    private RadioGroup radioAppsNGroups;
    private ItemsFragment mFragment;

    public static String toCamelCase(final String init) {
        if (TextUtils.isEmpty(init))
            return init;

        final StringBuilder ret = new StringBuilder(init.length());

        for (final String word : init.split(" ")) {
            if (!word.isEmpty()) {
                ret.append(word.substring(0, 1).toUpperCase());
                ret.append(word.substring(1).toLowerCase());
            }
            if (!(ret.length() == init.length()))
                ret.append(" ");
        }

        return ret.toString();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate");
        setContentView(R.layout.activity_home);

        initViews();
        initListeners();
        //******************************
        try {
            getMyApps();
        } catch (MalformedURLException e) {
            Log.e(TAG, "", e);
            displayToast(getString(R.string.unknown_error));
            finish();
        }
        //******************************


    }

    private void initViews() {
        btLogout = findViewById(R.id.btLogout);
        radioAppsNGroups = (RadioGroup) findViewById(R.id.toggle);
        mFragment = (ItemsFragment) getSupportFragmentManager().findFragmentById(R.id.container_list);
        if (null != getIntent().getStringExtra("displayame")) {
            ((TextView) findViewById(R.id.tv_display_name)).setText(toCamelCase(getIntent().getStringExtra("displayname")));
            ((TextView) findViewById(R.id.tv_user_display_name)).setText(getAbbreviationFormText(getIntent().getStringExtra("displayname")));
        }
        String username = getIntent().getStringExtra("email");
        if (null != username) {
            if (!username.contains("@")) {
                username = "Username : " + getIntent().getStringExtra("email");
            }
            ((TextView) findViewById(R.id.tv_user_email)).setText(username);
        }
    }

    private void initListeners() {
        btLogout.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                handleLogout(true);
            }
        });
        radioAppsNGroups.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                int id = group.getCheckedRadioButtonId();
                try {
                    switch (id) {
                        case R.id.apps:
                            getMyApps();
                            break;
                        case R.id.group:
                            getMyGroups();
                            break;
                    }
                } catch (MalformedURLException e) {
                    Log.e(TAG, "error in fetching apps/groups ", e);
                }
            }
        });
    }

    private String getAbbreviationFormText(String displayName) {
        if (TextUtils.isEmpty(displayName)) {
            return "";
        }
        String name = displayName.trim();
        if (!TextUtils.isEmpty(name)) {
            name = name.toUpperCase();
            if (name.contains(" ")) {
                String[] arr = name.split(" ", 2);
                return (arr[0].substring(0, 1) + arr[1].substring(0, 1));
            } else {
                return name.substring(0, 2);
            }
        } else {
            return "";
        }
    }

    private void getMyApps() throws MalformedURLException {
        if (appsList == null) {
            showProgress("getting apps...");
            OMAuthorizationService authZService = new OMAuthorizationService(IDCSSDKWrapper.getInstance().getOMMSService());
            OMHTTPRequest request = new OMHTTPRequest(new URL(Const.URL_MY_APPS), OMHTTPRequest.Method.GET);
            authZService.executeRequest(request, new MyAppsResponseListener(), IDCSSDKWrapper.getInstance().getScopes());
        } else {
            if (mFragment != null) {
                mFragment.onDataSerChanged(appsList, true);
            }
        }
    }

    private void getMyGroups() throws MalformedURLException {
        if (groupList == null) {
            showProgress("getting groups...");
            OMAuthorizationService authZService = new OMAuthorizationService(IDCSSDKWrapper.getInstance().getOMMSService());
            OMHTTPRequest request = new OMHTTPRequest(new URL(Const.URL_MY_GROUPS/*?count=48&startIndex=1&sortBy=displayName&sortOrder=ascending&attributes=id%2CdisplayName"*/), OMHTTPRequest.Method.GET);
            authZService.executeRequest(request, new MyGroupsResponseListener(), IDCSSDKWrapper.getInstance().getScopes());
        } else {
            if (mFragment != null) {
                mFragment.onDataSerChanged(groupList, true);
            }
        }
    }


    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause");

    }

    private void handleLogout(boolean flag) {
        attemptLogout();
    }

    @Override
    public void onListFragmentInteraction(Data item) {
        //dummy
    }

    @Override
    public void onBackPressed() {
        setResult(Const.REQUEST_CODE_FINISH_HOME);
        finish();
    }

    private void attemptLogout() {
        setResult(Const.REQUEST_CODE_LOGOUT_HOME);
        finish();
    }

    private class MyAppsResponseListener implements OMHTTPRequestCallback {

        @Override
        public void processHTTPResponse(OMHTTPRequest request, OMHTTPResponse response, OMMobileSecurityException exception) {

            if (response != null) {
                Log.d(TAG, " response : ");
                String res = response.getResponseStringOnSuccess();
                JSONObject jsonObject = null;
                try {
                    jsonObject = new JSONObject(res);
                    JSONArray resourcesArray = jsonObject.getJSONArray("Resources");
                    appsList = new ArrayList<>();
                    for (int i = 0; i < resourcesArray.length(); i++) {
                        JSONObject app = resourcesArray.getJSONObject(i).getJSONObject("app");
                        String icon = null;
                        try {
                            icon = app.getString("appIcon");
                        } catch (Exception e) {
                            Log.w(TAG, " unable to parse appIcon : ", e);
                        }
                        String detail = null;
                        try {
                            detail = app.getString("description");
                        } catch (Exception e) {

                            Log.w(TAG, " unable to parse appIcon : ", e);
                        }
                        Data data = new Data(app.getString("value"), app.getString("display"), detail, icon);
                        Log.d(TAG, "app = " + data);
                        appsList.add(data);
                    }
                    if (mFragment != null) {
                        mFragment.onDataSerChanged(appsList, false);
                    }

                } catch (JSONException e) {
                    Log.e(TAG, " unable to parse response : ", e);
                }
            } else {
                if (exception != null) {
                    displayResult(exception.getErrorMessage());
                }
            }
            dismissProgress();
        }
    }

    private class MyGroupsResponseListener implements OMHTTPRequestCallback {

        @Override
        public void processHTTPResponse(OMHTTPRequest request, OMHTTPResponse response, OMMobileSecurityException exception) {
            if (response != null) {
                String res = response.getResponseStringOnSuccess();
                Log.d(TAG, " response : " + res);
                JSONObject jsonObject;
                try {

                    jsonObject = new JSONObject(res);
                    JSONArray resourcesArray = jsonObject.getJSONArray("Resources");
                    groupList = new ArrayList<>();
                    for (int i = 0; i < resourcesArray.length(); i++) {
                        try {
                            String displayName = resourcesArray.getJSONObject(i).getString("displayName");
                            String details = resourcesArray.getJSONObject(i).getJSONObject("urn:ietf:params:scim:schemas:oracle:idcs:extension:group:Group").getString("description");
                            String id = resourcesArray.getJSONObject(i).getString("id");
                            Data data = new Data(id, displayName, details, null);
                            Log.d(TAG, "group = " + data);
                            groupList.add(data);
                        } catch (Exception e) {
                            Log.e(TAG, " unable to parse data for group : ", e);
                        }
                    }
                    if (mFragment != null) {
                        mFragment.onDataSerChanged(groupList, true);
                    }
                } catch (JSONException e) {
                    Log.e(TAG, " unable to parse response : ", e);
                }
            } else {
                if (exception != null) {
                    displayResult(exception.getErrorMessage());
                }
            }
            dismissProgress();
        }
    }
}
