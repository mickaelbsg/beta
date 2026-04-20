export interface SkillExecutionContext {
  input: string;
  chatId: string;
  userId: string;
}

export interface Skill {
  name: string;
  description: string;
  trigger(input: string): boolean;
  execute(context: SkillExecutionContext): Promise<string>;
}

