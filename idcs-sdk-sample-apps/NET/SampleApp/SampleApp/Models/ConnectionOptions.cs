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
                { "ClientId", "585e8d4843714cc38e806880459b93e2" },
                { "ClientSecret", "d9950134-8d7e-40fd-9040-a20338719b1c" },
                { "BaseUrl", "https://idcs-35e8456d2e6544e7846d14ffa9866e83.identity.oraclecloud.com" },
                { "AudienceServiceUrl", "https://idcs-35e8456d2e6544e7846d14ffa9866e83.identity.oraclecloud.com" },
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