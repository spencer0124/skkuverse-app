export interface NoticeBriefSource {
  boardName: string;
  postedAt: string;
  firstSeenAt: string;
  isEdited: boolean;
  url: string;
}

export interface NoticeBriefAnswer {
  question: string;
  label: string;
  bullets: { text: string }[];
}

export interface NoticeBriefPoster {
  url: string;
  width: number | null;
  height: number | null;
}

export interface NoticeBriefBody {
  markdown: string | null;
  posters: NoticeBriefPoster[];
}

export interface NoticeBriefAttachment {
  name: string;
  url: string;
  isForm: boolean;
}

export interface NoticeBriefLink {
  url: string;
  domain: string;
  label: string | null;
}

export interface NoticeBriefRefs {
  attachments: NoticeBriefAttachment[];
  links: NoticeBriefLink[];
  phones: string[];
  emails: string[];
}

export interface NoticeBrief {
  id: string;
  title: string;
  source: NoticeBriefSource;
  answer: NoticeBriefAnswer;
  body: NoticeBriefBody;
  refs: NoticeBriefRefs;
}
