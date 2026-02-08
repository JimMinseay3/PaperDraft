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
    // We do NOT switch to it automatically (usually). User can switch explicitly.
    
    this.saveGraph(zip, graph);
    return newBranch;
  }

  static switchBranch(zip: AdmZip, branchId: string): { success: boolean, data?: PaperData } {
    const graph = this.getGraph(zip);
    const branch = graph.branches[branchId];
    
    if (!branch) throw new Error(`Branch ${branchId} not found`);

    // Update active branch
    graph.activeBranchId = branchId;
    this.saveGraph(zip, graph);

    // Load HEAD of that branch
    if (branch.headNodeId) {
        const node = graph.nodes[branch.headNodeId];
        if (node) {
            const content = this.loadNodeData(zip, node);
            return { success: true, data: content };
        }
    }

    // If branch is empty (new repo), return null or empty?
    return { success: true };
  }

  static loadNodeData(zip: AdmZip, node: VersionNode): PaperData {
    const entry = zip.getEntry(node.storagePath);
    if (!entry) throw new Error(`Snapshot file not found: ${node.storagePath}`);
    return JSON.parse(zip.readAsText(entry)) as PaperData;
  }

  private static calculateWordCount(data: PaperData): number {
    let count = 0;
    data.body.forEach(b => {
        if (typeof b.content === 'string') {
            count += b.content.length;
        }
    });
    return count;
  }

  private static getRandomColor(): string {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
