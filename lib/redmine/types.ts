export type Project = {
  id: number;
  name: string;
  identifier: string;
  parent?: { id: number };
};

export type Version = { id: number; name: string; status?: string };

export type Issue = {
  id: number;
  subject: string;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
};

export type Membership = {
  user?: { id: number; name: string };
  group?: { id: number; name: string };
  roles: Array<{ id: number; name: string }>;
};

export type CurrentUser = {
  id: number;
  firstname: string;
  lastname: string;
  mail: string | null;
};

export type Tracker = { id: number; name: string };
export type Priority = { id: number; name: string };
