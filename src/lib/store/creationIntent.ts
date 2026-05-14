export type CreationIntentType = 'empty' | 'template' | 'upload' | 'ai_prompt';

export interface CreationIntent {
  type: CreationIntentType;
  title?: string;
  html?: string;
  file?: File;
  prompt?: string;
}

class CreationIntentStore {
  private intents: Map<string, CreationIntent> = new Map();

  setIntent(id: string, intent: CreationIntent) {
    this.intents.set(id, intent);
  }

  getIntent(id: string): CreationIntent | undefined {
    return this.intents.get(id);
  }

  removeIntent(id: string) {
    this.intents.delete(id);
  }
}

export const creationIntentStore = new CreationIntentStore();