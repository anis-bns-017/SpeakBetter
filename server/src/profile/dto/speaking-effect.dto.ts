import { IsIn, IsString } from 'class-validator';
import {
  SPEAKING_EFFECT_IDS,
  type SpeakingEffectId,
} from '../speaking-effects';

/** PUT /profile/me/speaking-effect */
export class SpeakingEffectDto {
  @IsString()
  @IsIn([...SPEAKING_EFFECT_IDS])
  effect: SpeakingEffectId;
}
