// apps/web/src/i18n/bn-screens/index.ts
// Bangla for the rest of the app's screens, in batches by area. bn.ts merges these with its own entries
// (bn.ts wins when both have the same English text).
import { part00 } from "./part00";
import { part01 } from "./part01";
import { part02 } from "./part02";
import { part03 } from "./part03";
import { part04 } from "./part04";
import { part05 } from "./part05";
import { part06 } from "./part06";
import { part07 } from "./part07";
import { part08 } from "./part08";
import { part09 } from "./part09";
import { part10 } from "./part10";
import { part11 } from "./part11";
import { part12 } from "./part12";
import { part13 } from "./part13";
import { part14 } from "./part14";
import { part15 } from "./part15";
import { part16 } from "./part16";
import { part17 } from "./part17";

export const screens: Record<string, string> = {
  ...part00,
  ...part01,
  ...part02,
  ...part03,
  ...part04,
  ...part05,
  ...part06,
  ...part07,
  ...part08,
  ...part09,
  ...part10,
  ...part11,
  ...part12,
  ...part13,
  ...part14,
  ...part15,
  ...part16,
  ...part17,
};
