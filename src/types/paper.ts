export interface PaperData {
  version: string;
  paper_info: {
    title: string;
    author: string;
    school: string;
  };
  body: Block[];
  references: Reference[];
}

export interface Block {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'citation' | 'list' | 'code';
  content?: string | any[]; // Allow array content for lists/nested structures
  attrs?: {
    level?: number;      // heading level
    src?: string;        // image source
    caption?: string;    // image caption
    fileName?: string;   // image filename (for assets)
    refId?: string;      // citation reference
    checked?: boolean;   // task list item checked state
    language?: string;   // code block language
    [key: string]: any;  // Allow other attributes
  };
}

export interface Reference {
  id: string;
  type?: string; // article, book, misc, etc.
  title: string;
  author: string;
  year: number;
  journal?: string;
  volume?: string;
  pages?: string;
  publisher?: string;
  bibtex?: string; // Store raw bibtex if imported
}

export interface Snapshot {
  id: string;
  timestamp: number;
  note: string;
  type: 'manual' | 'auto';
  wordCount?: number;
}

export interface HistoryIndex {
  snapshots: Snapshot[];
}
