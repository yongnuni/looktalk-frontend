import { useCallback, useEffect, useState } from 'react';
import {
  addAssignedPatient,
  getMyAssignedPatients,
  removeAssignedPatient,
  updateAssignedPatientAlias,
} from '../../staffChat/api/staffPatients';
import { useStaffPatientStore } from '../../../shared/stores/staffPatientStore';
import type { StaffAssignedPatientDto } from '../../../shared/types/backend';

function toManagedPatient(dto: StaffAssignedPatientDto) {
  return {
    userId: dto.userId,
    loginId: dto.loginId,
    displayName: dto.displayName || dto.name || dto.loginId,
    alias: dto.patientAlias,
    assignedAt: dto.assignedAt,
  };
}

/** 담당 환자 목록 조회 / 추가 / 별칭 수정 / 해제 (STAFF-002~005) */
export function useStaffPatients() {
  const patients = useStaffPatientStore((state) => state.patients);
  const setPatients = useStaffPatientStore((state) => state.setPatients);
  const updatePatientAliasInStore = useStaffPatientStore((state) => state.updatePatientAlias);
  const removePatientFromStore = useStaffPatientStore((state) => state.removePatient);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 담당 환자 추가(STAFF-003)는 등록된 환자 정보를 응답으로 주지 않으므로
  // 추가 성공 후 목록을 다시 조회해 최신 상태를 반영한다.
  const fetchPatients = useCallback(async () => {
    const data = await getMyAssignedPatients();

    setPatients(data.map(toManagedPatient));
  }, [setPatients]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        await fetchPatients();
      } catch {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [fetchPatients]);

  const addPatient = useCallback(
    async (patientLoginId: string) => {
      await addAssignedPatient(patientLoginId);
      await fetchPatients();
    },
    [fetchPatients],
  );

  const updateAlias = useCallback(
    async (userId: string, alias: string) => {
      const updated = await updateAssignedPatientAlias(userId, alias);

      updatePatientAliasInStore(userId, updated.patientAlias);
    },
    [updatePatientAliasInStore],
  );

  const removePatient = useCallback(
    async (userId: string) => {
      await removeAssignedPatient(userId);
      removePatientFromStore(userId);
    },
    [removePatientFromStore],
  );

  return {
    patients,
    isLoading,
    hasError,
    addPatient,
    updateAlias,
    removePatient,
  };
}
