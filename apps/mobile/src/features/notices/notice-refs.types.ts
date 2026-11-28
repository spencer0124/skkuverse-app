export interface NoticeRefLink {
  /** WHY: as found in the notice, so it can lack a scheme, as `www.example.com` does. */
  url: string;
  domain: string;
}

/** WHY: an object, not a bare string, so the server can add a field to a contact without a new shape. */
export interface NoticeRefContact {
  value: string;
}

export interface NoticeRefs {
  links: NoticeRefLink[];
  phones: NoticeRefContact[];
  emails: NoticeRefContact[];
}
