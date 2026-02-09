import AdmZip from 'adm-zip';
import { PaperData, VersionGraph, Branch, VersionNode, HistoryIndex } from '../../src/types/paper';

const HISTORY_INDEX_PATH = 'history/index.json';
const SNAPSHOTS_DIR = 'snapshots';

export class VersionManager {
  
  static getGraph(zip: AdmZip): VersionGraph {
    const entry = zip.getEntry(HISTORY_INDEX_PATH);
    if (!entry) {
      return this.createInitialGraph();
    }

    try {
      const index = JSON.parse(zip.readAsText(entry)) as HistoryIndex;
      if (index.versionGraph) {
        return index.versionGraph;
      } else {
        // Migration: Convert legacy snapshots to Graph
        return this.migrateLegacy(index.snapshots || []);
      }
    } catch (e) {
      console.error('Failed to parse history index, creating new graph', e);
      return this.createInitialGraph();
    }
  }

  static saveGraph(zip: AdmZip, graph: VersionGraph) {
    // Preserve legacy snapshots field for backward compatibility if needed, 
    // or just overwrite with new structure wrapped in HistoryIndex
    let index: HistoryIndex = { snapshots: [], versionGraph: graph };
    
    // Try to keep legacy snapshots if they exist
    const entry = zip.getEntry(HISTORY_INDEX_PATH);
    if (entry) {
        try {
            const oldIndex = JSON.parse(zip.readAsText(entry));
            if (oldIndex.snapshots) index.snapshots = oldIndex.snapshots;
        } catch (e) {}
    }

    zip.addFile(HISTORY_INDEX_PATH, Buffer.from(JSON.stringify(index, null, 2)));
  }

  static createInitialGraph(): VersionGraph {
    // We don't create a node yet, just the structure.
    // The first save/commit will create the root node.
    return {
      activeBranchId: 'main',
      branches: {
        'main': {
          id: 'main',
          name: 'Main Track',
          headNodeId: '', // Empty initially
          isMain: true,
          color: '#3b82f6' // Blue
        }
      },
      nodes: {}
    };
  }

  static migrateLegacy(snapshots: any[]): VersionGraph {
    const graph = this.createInitialGraph();
    
    // Convert linear snapshots to a chain on Main branch
    let previousId: string | null = null;
    
    // Snapshots are usually stored newest first in legacy. We need oldest first to build chain.
    const sorted = [...snapshots].reverse(); // Assuming original was newest-first

    sorted.forEach(snap => {
        const node: VersionNode = {
            id: snap.id,
            parentId: previousId,
            branchId: 'main', // Default to main for legacy
            timestamp: snap.timestamp,
            note: snap.note,
            type: snap.type === 'manual' ? 'milestone' : 'snapshot',
            wordCount: snap.wordCount || 0,
            storagePath: `history/${snap.id}_content.json` // Legacy path
        };
        
        graph.nodes[node.id] = node;
        previousId = node.id;
    });

    if (previousId) {
        graph.branches['main'].headNodeId = previousId;
    }

    return graph;
  }

  static commit(zip: AdmZip, data: PaperData, note: string, type: 'snapshot' | 'milestone' = 'snapshot'): VersionNode {
    const graph = this.getGraph(zip);
    const activeBranchId = graph.activeBranchId;
    const branch = graph.branches[activeBranchId];

    if (!branch) {
        throw new Error(`Active branch ${activeBranchId} not found`);
    }

    const timestamp = Date.now();
    const id = `v${timestamp}`;
    const wordCount = this.calculateWordCount(data);

    // Save Content
    const storagePath = `${SNAPSHOTS_DIR}/${id}.json`;
    zip.addFile(storagePath, Buffer.from(JSON.stringify(data, null, 2)));

    // Create Node
    const node: VersionNode = {
        id,
        parentId: branch.headNodeId || null,
        branchId: activeBranchId,
        timestamp,
        note,
        type,
        wordCount,
        storagePath
    };

    // Update Graph
    graph.nodes[id] = node;
    branch.headNodeId = id; // Move HEAD

    this.saveGraph(zip, graph);
    return node;
  }

  static saveAutosave(zip: AdmZip, data: PaperData): VersionNode {
    const graph = this.getGraph(zip);
    const id = 'autosave';
    const timestamp = Date.now();
    const wordCount = this.calculateWordCount(data);
    const storagePath = `${SNAPSHOTS_DIR}/${id}.json`;

    // Save Content (Overwrites existing)
    zip.addFile(storagePath, Buffer.from(JSON.stringify(data, null, 2)));

    // Create or Update Node
    // Autosave is a standalone node, not part of the main branch chain
    const node: VersionNode = {
      id,
      parentId: null, 
      branchId: '',   
      timestamp,
      note: 'Auto-save',
      type: 'snapshot', 
      wordCount,
      storagePath
    };

    graph.nodes[id] = node;
    this.saveGraph(zip, graph);
    return node;
  }

  static createBranch(zip: AdmZip, name: string, fromNodeId?: string): Branch {
    const graph = this.getGraph(zip);
    
    // Default to current HEAD if not specified
    const baseId = fromNodeId || graph.branches[graph.activeBranchId].headNodeId;
    
    if (!baseId && Object.keys(graph.nodes).length > 0) {
        throw new Error('Cannot branch from nothing (unless graph is empty)');
    }

    const id = `branch_${Date.now()}`;
    const newBranch: Branch = {
        id,
        name,
        headNodeId: baseId, // Starts at the same point
        baseNodeId: baseId,
        isMain: false,
        color: this.getRandomColor()
    };

    graph.branches[id] = newBranch;
    graph.activeBranchId = id; // Switch to new branch
    
    this.saveGraph(zip, graph);
    return newBranch;
  }

  static switchBranch(zip: AdmZip, branchId: string): boolean {
    const graph = this.getGraph(zip);
    if (!graph.branches[branchId]) {
        throw new Error(`Branch ${branchId} not found`);
    }
    graph.activeBranchId = branchId;
    this.saveGraph(zip, graph);
    return true;
  }

  static deleteSnapshot(zip: AdmZip, snapshotId: string): boolean {
    const graph = this.getGraph(zip);
    const node = graph.nodes[snapshotId];
    if (!node) return false;

    // 1. Remove file
    try {
        zip.deleteFile(node.storagePath);
    } catch (e) {
        console.warn(`Failed to delete snapshot file ${node.storagePath}:`, e);
    }

    // 2. Update parent/child links (Simplified linear)
    const parentId = node.parentId;
    const children = Object.values(graph.nodes).filter(n => n.parentId === snapshotId);
    
    children.forEach(child => {
        child.parentId = parentId;
    });

    // 3. Update branch HEADs if necessary
    Object.values(graph.branches).forEach(branch => {
        if (branch.headNodeId === snapshotId) {
            branch.headNodeId = parentId || '';
        }
    });

    // 4. Remove from graph
    delete graph.nodes[snapshotId];

    this.saveGraph(zip, graph);
    return true;
  }

  static loadNodeData(zip: AdmZip, node: VersionNode): PaperData {
    const entry = zip.getEntry(node.storagePath);
    if (!entry) throw new Error(`Snapshot file not found: ${node.storagePath}`);
    return JSON.parse(zip.readAsText(entry)) as PaperData;
  }

  private static calculateWordCount(data: PaperData): number {
    let count = 0;
    
    const countInContent = (content: any): number => {
      if (!content) return 0;
      if (typeof content === 'string') {
        // Simple word count for Latin, character count for CJK
        // We'll use a simple character count for now to be consistent
        return content.trim().length;
      }
      if (Array.isArray(content)) {
        return content.reduce((acc, item) => {
          if (typeof item === 'string') return acc + item.trim().length;
          if (item && typeof item === 'object') {
            // TipTap JSON structure often has { text: '...' }
            if (item.text) return acc + item.text.trim().length;
            if (item.content) return acc + countInContent(item.content);
          }
          return acc;
        }, 0);
      }
      return 0;
    };

    data.body.forEach(b => {
      // Only count content for text-heavy blocks: headings, paragraphs, lists
      // Skip images, code blocks, math, etc. as per "body text only" request
      if (['heading', 'paragraph', 'list'].includes(b.type)) {
        count += countInContent(b.content);
      }
    });
    
    return count;
  }

  private static getRandomColor(): string {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
