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
    refId?: string;      // citation reference
    checked?: boolean;   // task list item checked state
    language?: string;   // code block language
    [key: string]: any;  // Allow other attributes
  };
}

export interface Reference {
  id: string;
  title: string;
  author: string;
  year: number;
}
