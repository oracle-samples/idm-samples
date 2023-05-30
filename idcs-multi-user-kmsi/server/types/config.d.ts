import { IdcsConfig } from "./idcsTypes";

interface ServerConfig {
  idcs_config: IdcsConfig;
  ssl?: SslConfig;
  port?: number;
  force_ip_version_4?: boolean;
  cookie_signing_key: string;
  style?: StyleConfig;
}

interface SslConfig {
  use_ssl: boolean;
  is_ssl?: boolean;
  public_cert_path: string;
  private_key_path: string;
}

interface StyleConfig {
  redwood_theme: boolean;
}

export {ServerConfig};