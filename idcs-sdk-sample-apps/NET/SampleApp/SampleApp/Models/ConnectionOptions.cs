using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SampleApp.Models
{
    public class ConnectionOptions
    {
        private System.Collections.Generic.Dictionary<String, String> options = null;

        public Dictionary<string, string> GetOptions()
        {
            this.options = new System.Collections.Generic.Dictionary<String, String>
            {
                { "ClientId", "123456789abcdefghij" },
                { "ClientSecret", "abcde-12345-zyxvu-98765-qwerty" },
                { "BaseUrl", "https://idcs-abcd1234.identity.oraclecloud.com" },
                { "AudienceServiceUrl", "https://idcs-abcd1234.identity.oraclecloud.com" },
                { "TokenIssuer", "https://identity.oraclecloud.com/" },
                { "scope", "urn:opc:idm:t.user.me openid" },
                { "redirectURL", "http://localhost:3001/Home/Callback" },
                { "logoutSufix", "/oauth2/v1/userlogout"},
                { "LogLevel", "0" },
                { "ConsoleLog", "True" }
            };
            return this.options;
        }

    }

    
}