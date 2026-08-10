import type { ISpineRenderer } from "./ISpineRenderer";
import { SpineRenderer41 } from "./SpineRenderer41";
import { SpineRenderer42 } from "./SpineRenderer42";

export class SpineFactory {
  static createRenderer(version: string): ISpineRenderer {
    if (version.startsWith("4.1")) {
      return new SpineRenderer41();
    } else if (version.startsWith("4.2")) {
      return new SpineRenderer42();
    } else {
      throw new Error(`spine version ${version} is not supported`);
    }
  }
}
