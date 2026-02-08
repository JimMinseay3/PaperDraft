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
  type: 'heading' | 'paragraph' | 'image' | 'citation' | 'list' | 'code' | 'math';
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

// "Structured Soul" Version Control Types
export interface VersionGraph {
  activeBranchId: string;
  branches: Record<string, Branch>;
  nodes: Record<string, VersionNode>;
}

export interface Branch {
  id: string;
  name: string; // Display name (e.g., "Main Track", "Experiment A")
  headNodeId: string; // The latest committed node in this branch
  baseNodeId?: string; // The node this branch started from
  color?: string; // For visualization
  isMain: boolean; // "Main Track" flag
}

export interface VersionNode {
  id: string;
  parentId: string | null;
  branchId: string; // The branch this node was created on
  timestamp: number;
  note: string; // Commit message / Tag
  type: 'snapshot' | 'milestone'; // Small dot vs Big dot
  wordCount: number;
  storagePath: string; // Path inside ZIP (e.g., "snapshots/v123.json")
}

export interface HistoryIndex {
  snapshots: Snapshot[]; // Legacy support
  versionGraph?: VersionGraph; // New structure
}
