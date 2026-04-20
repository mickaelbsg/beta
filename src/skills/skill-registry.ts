import type { Skill } from "./skill.js";

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  public register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  public list(): Skill[] {
    return [...this.skills.values()];
  }

  public findTriggered(input: string): Skill | null {
    for (const skill of this.skills.values()) {
      if (skill.trigger(input)) {
        return skill;
      }
    }
    return null;
  }
}

