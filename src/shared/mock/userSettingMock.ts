import type { UserSettingDto } from '../types/backend';
import { inputMethodIdToBackendValue } from '../../features/analysis/utils/analysisMappers';

export const mockPatientSetting: UserSettingDto = {
  user_id: 'patient-test-user',
  keyboard_layout: 'QWERTY',
  is_key_enlarged: false,
  current_input_method: inputMethodIdToBackendValue.gaze,
  updated_at: null,
};
