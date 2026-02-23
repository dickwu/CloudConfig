export type Client = {
  id: string;
  name: string;
  public_key: string;
  is_admin: boolean;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

export type ConfigItem = {
  id: string;
  project_id: string;
  key: string;
  value: string;
  version: number;
  updated_at: string;
};

export type ClientPermission = {
  client_id: string;
  project_id: string;
  can_read: boolean;
  can_write: boolean;
};

export type CreateClientResponse = {
  client: Client;
  private_key_pem: string;
};
