var ids = {
  oracle: {
    "ClientId": '',
    "ClientSecret": '',
    "IDCSHost": '',
    "AudienceServiceUrl" : '',
    "TokenIssuer": 'https://identity.oraclecloud.com/',
    "scope": 'urn:opc:idm:t.user.me openid',
    "logoutSufix": '/sso/v1/user/logout',
    "redirectURL": 'http://localhost:3000/callback'
  }
};

module.exports = ids;
