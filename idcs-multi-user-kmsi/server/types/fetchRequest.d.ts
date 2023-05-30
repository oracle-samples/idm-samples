import { AbortSignal } from "node-fetch/externals";

interface RequestOptions {
  url: string;
  clientIp?: string;
  headers?: any;
  method?: string;
  body?: any;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
  follow?: number;
  compress?: boolean;
  size?: number;
  agent?: any;
  highWaterMark?: number;
  insecureHTTPParser?: boolean;
}

export {RequestOptions};