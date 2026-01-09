import { Command } from './historyStore';
import { useStore } from './useStore';
import type { Asset, Cut, Scene } from '../types';

/**
 * カット追加コマンド
 */
export class AddCutCommand implements Command {
  type = 'ADD_CUT';
  description: string;

  private sceneId: string;
  private asset: Asset;
  private cutId?: string;
  private displayTime?: number;

  constructor(sceneId: string, asset: Asset, displayTime?: number) {
    this.sceneId = sceneId;
    this.asset = asset;
    this.displayTime = displayTime;
    this.description = `Add cut: ${asset.name}`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    this.cutId = store.addCutToScene(this.sceneId, this.asset);

    if (this.displayTime !== undefined && this.cutId) {
      store.updateCutDisplayTime(this.sceneId, this.cutId, this.displayTime);
    }
  }

  async undo(): Promise<void> {
    if (!this.cutId) return;

    const store = useStore.getState();
    store.removeCut(this.sceneId, this.cutId);
  }
}

/**
 * カット削除コマンド
 */
export class RemoveCutCommand implements Command {
  type = 'REMOVE_CUT';
  description: string;

  private sceneId: string;
  private cutId: string;
  private removedCut?: Cut;
  private removedCutIndex?: number;

  constructor(sceneId: string, cutId: string) {
    this.sceneId = sceneId;
    this.cutId = cutId;
    this.description = `Remove cut`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    const scene = store.scenes.find((s) => s.id === this.sceneId);

    if (scene) {
      this.removedCutIndex = scene.cuts.findIndex((c) => c.id === this.cutId);
      this.removedCut = scene.cuts[this.removedCutIndex];
    }

    store.removeCut(this.sceneId, this.cutId);
  }

  async undo(): Promise<void> {
    if (!this.removedCut) {
      console.warn('No cut data to restore');
      return;
    }

    const confirmed = confirm(
      'カットをタイムラインに復元します。続行しますか？'
    );

    if (!confirmed) return;

    const store = useStore.getState();

    // カットを復元
    const newCutId = store.addCutToScene(this.sceneId, this.removedCut.asset!);
    store.updateCutDisplayTime(
      this.sceneId,
      newCutId,
      this.removedCut.displayTime
    );

    // 元の位置に移動（可能な場合）
    if (this.removedCutIndex !== undefined && this.removedCutIndex > 0) {
      const scene = store.scenes.find((s) => s.id === this.sceneId);
      if (scene) {
        store.reorderCuts(
          this.sceneId,
          newCutId,
          this.removedCutIndex,
          this.sceneId,
          scene.cuts.length - 1
        );
      }
    }
  }
}

/**
 * 表示時間更新コマンド
 */
export class UpdateDisplayTimeCommand implements Command {
  type = 'UPDATE_DISPLAY_TIME';
  description: string;

  private sceneId: string;
  private cutId: string;
  private newTime: number;
  private oldTime?: number;

  constructor(sceneId: string, cutId: string, newTime: number) {
    this.sceneId = sceneId;
    this.cutId = cutId;
    this.newTime = newTime;
    this.description = `Update display time to ${newTime}s`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    const scene = store.scenes.find((s) => s.id === this.sceneId);
    const cut = scene?.cuts.find((c) => c.id === this.cutId);

    if (cut) {
      this.oldTime = cut.displayTime;
    }

    store.updateCutDisplayTime(this.sceneId, this.cutId, this.newTime);
  }

  async undo(): Promise<void> {
    if (this.oldTime === undefined) return;

    const store = useStore.getState();
    store.updateCutDisplayTime(this.sceneId, this.cutId, this.oldTime);
  }
}

/**
 * カット並び替えコマンド
 */
export class ReorderCutsCommand implements Command {
  type = 'REORDER_CUTS';
  description: string;

  private sceneId: string;
  private cutId: string;
  private newIndex: number;
  private oldIndex?: number;

  constructor(sceneId: string, cutId: string, newIndex: number, oldIndex: number) {
    this.sceneId = sceneId;
    this.cutId = cutId;
    this.oldIndex = oldIndex;
    this.newIndex = newIndex;
    this.description = `Reorder cut`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    store.reorderCuts(this.sceneId, this.cutId, this.newIndex, this.sceneId, this.oldIndex!);
  }

  async undo(): Promise<void> {
    if (this.oldIndex === undefined) return;

    const store = useStore.getState();
    store.reorderCuts(this.sceneId, this.cutId, this.oldIndex, this.sceneId, this.newIndex);
  }
}

/**
 * シーン間カット移動コマンド
 */
export class MoveCutBetweenScenesCommand implements Command {
  type = 'MOVE_CUT_BETWEEN_SCENES';
  description: string;

  private fromSceneId: string;
  private toSceneId: string;
  private cutId: string;
  private toIndex: number;
  private fromIndex?: number;

  constructor(fromSceneId: string, toSceneId: string, cutId: string, toIndex: number) {
    this.fromSceneId = fromSceneId;
    this.toSceneId = toSceneId;
    this.cutId = cutId;
    this.toIndex = toIndex;
    this.description = `Move cut between scenes`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    const fromScene = store.scenes.find((s) => s.id === this.fromSceneId);

    if (fromScene) {
      this.fromIndex = fromScene.cuts.findIndex((c) => c.id === this.cutId);
    }

    store.moveCutToScene(this.fromSceneId, this.toSceneId, this.cutId, this.toIndex);
  }

  async undo(): Promise<void> {
    if (this.fromIndex === undefined) return;

    const store = useStore.getState();
    store.moveCutToScene(this.toSceneId, this.fromSceneId, this.cutId, this.fromIndex);
  }
}

/**
 * シーン複製コマンド
 */
export class DuplicateSceneCommand implements Command {
  type = 'DUPLICATE_SCENE';
  description: string;

  private sourceSceneId: string;
  private newSceneId?: string;
  private newCutIds: string[] = [];

  constructor(sourceSceneId: string) {
    this.sourceSceneId = sourceSceneId;
    this.description = `Duplicate scene`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    const sourceScene = store.scenes.find((s) => s.id === this.sourceSceneId);

    if (!sourceScene) return;

    // 新しいシーンを作成
    this.newSceneId = store.addScene(`${sourceScene.name} (Copy)`);

    // 全カットをコピー
    sourceScene.cuts.forEach((cut) => {
      if (cut.asset) {
        const newCutId = store.addCutToScene(this.newSceneId!, cut.asset);
        store.updateCutDisplayTime(this.newSceneId!, newCutId, cut.displayTime);
        this.newCutIds.push(newCutId);
      }
    });

    // ノートをコピー
    sourceScene.notes?.forEach((note) => {
      store.addSceneNote(this.newSceneId!, {
        type: note.type,
        content: note.content,
      });
    });
  }

  async undo(): Promise<void> {
    if (!this.newSceneId) return;

    const confirmed = confirm(
      '複製したシーンを削除します。続行しますか？'
    );

    if (!confirmed) return;

    const store = useStore.getState();
    store.removeScene(this.newSceneId);
  }
}

/**
 * シーン追加コマンド
 */
export class AddSceneCommand implements Command {
  type = 'ADD_SCENE';
  description: string;

  private sceneName: string;
  private sceneId?: string;

  constructor(sceneName: string) {
    this.sceneName = sceneName;
    this.description = `Add scene: ${sceneName}`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    this.sceneId = store.addScene(this.sceneName);
  }

  async undo(): Promise<void> {
    if (!this.sceneId) return;

    const confirmed = confirm(
      `シーン "${this.sceneName}" を削除します。続行しますか？`
    );

    if (!confirmed) return;

    const store = useStore.getState();
    store.removeScene(this.sceneId);
  }
}

/**
 * シーン削除コマンド
 */
export class RemoveSceneCommand implements Command {
  type = 'REMOVE_SCENE';
  description: string;

  private sceneId: string;
  private removedScene?: Scene;
  private removedSceneIndex?: number;

  constructor(sceneId: string) {
    this.sceneId = sceneId;
    this.description = `Remove scene`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    this.removedSceneIndex = store.scenes.findIndex((s) => s.id === this.sceneId);
    this.removedScene = store.scenes[this.removedSceneIndex];

    store.removeScene(this.sceneId);
  }

  async undo(): Promise<void> {
    if (!this.removedScene) {
      console.warn('No scene data to restore');
      return;
    }

    const confirmed = confirm(
      'シーンを復元します。続行しますか？'
    );

    if (!confirmed) return;

    const store = useStore.getState();

    // シーンを復元（簡易実装: 末尾に追加）
    const newSceneId = store.addScene(this.removedScene.name);

    // カットを復元
    this.removedScene.cuts.forEach((cut) => {
      if (cut.asset) {
        const newCutId = store.addCutToScene(newSceneId, cut.asset);
        store.updateCutDisplayTime(newSceneId, newCutId, cut.displayTime);
      }
    });

    // ノートを復元
    this.removedScene.notes?.forEach((note) => {
      store.addSceneNote(newSceneId, {
        type: note.type,
        content: note.content,
      });
    });
  }
}

/**
 * シーン名変更コマンド
 */
export class RenameSceneCommand implements Command {
  type = 'RENAME_SCENE';
  description: string;

  private sceneId: string;
  private newName: string;
  private oldName?: string;

  constructor(sceneId: string, newName: string) {
    this.sceneId = sceneId;
    this.newName = newName;
    this.description = `Rename scene to ${newName}`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();
    const scene = store.scenes.find((s) => s.id === this.sceneId);

    if (scene) {
      this.oldName = scene.name;
    }

    store.renameScene(this.sceneId, this.newName);
  }

  async undo(): Promise<void> {
    if (!this.oldName) return;

    const store = useStore.getState();
    store.renameScene(this.sceneId, this.oldName);
  }
}

/**
 * バッチ表示時間更新コマンド
 */
export class BatchUpdateDisplayTimeCommand implements Command {
  type = 'BATCH_UPDATE_DISPLAY_TIME';
  description: string;

  private updates: Array<{ sceneId: string; cutId: string; newTime: number }>;
  private oldTimes: Map<string, number> = new Map();

  constructor(updates: Array<{ sceneId: string; cutId: string; newTime: number }>) {
    this.updates = updates;
    this.description = `Update ${updates.length} cuts display time`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();

    // 古い値を保存
    this.updates.forEach(({ sceneId, cutId }) => {
      const scene = store.scenes.find((s) => s.id === sceneId);
      const cut = scene?.cuts.find((c) => c.id === cutId);
      if (cut) {
        this.oldTimes.set(cutId, cut.displayTime);
      }
    });

    // 新しい値を適用
    this.updates.forEach(({ sceneId, cutId, newTime }) => {
      store.updateCutDisplayTime(sceneId, cutId, newTime);
    });
  }

  async undo(): Promise<void> {
    const store = useStore.getState();

    // 古い値に戻す
    this.updates.forEach(({ sceneId, cutId }) => {
      const oldTime = this.oldTimes.get(cutId);
      if (oldTime !== undefined) {
        store.updateCutDisplayTime(sceneId, cutId, oldTime);
      }
    });
  }
}

/**
 * 複数カット一括移動コマンド
 */
export class MoveCutsToSceneCommand implements Command {
  type = 'MOVE_CUTS_TO_SCENE';
  description: string;

  private cutIds: string[];
  private toSceneId: string;
  private toIndex: number;
  private originalPositions: Array<{ cutId: string; sceneId: string; index: number }> = [];

  constructor(cutIds: string[], toSceneId: string, toIndex: number) {
    this.cutIds = cutIds;
    this.toSceneId = toSceneId;
    this.toIndex = toIndex;
    this.description = `Move ${cutIds.length} cuts`;
  }

  async execute(): Promise<void> {
    const store = useStore.getState();

    // 元の位置を保存（移動前に取得）
    this.originalPositions = [];
    for (const cutId of this.cutIds) {
      for (const scene of store.scenes) {
        const index = scene.cuts.findIndex((c) => c.id === cutId);
        if (index !== -1) {
          this.originalPositions.push({ cutId, sceneId: scene.id, index });
          break;
        }
      }
    }

    // 一括移動を実行
    store.moveCutsToScene(this.cutIds, this.toSceneId, this.toIndex);
  }

  async undo(): Promise<void> {
    if (this.originalPositions.length === 0) return;

    const store = useStore.getState();

    // 逆順で元の位置に戻す（インデックスの整合性を保つため）
    const sortedPositions = [...this.originalPositions].sort((a, b) => b.index - a.index);

    for (const { cutId, sceneId, index } of sortedPositions) {
      // 現在のシーンから取得
      let currentSceneId: string | null = null;
      for (const scene of store.scenes) {
        if (scene.cuts.some((c) => c.id === cutId)) {
          currentSceneId = scene.id;
          break;
        }
      }

      if (currentSceneId) {
        store.moveCutToScene(currentSceneId, sceneId, cutId, index);
      }
    }
  }
}
